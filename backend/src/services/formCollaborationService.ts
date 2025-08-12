/**
 * Form Collaboration Service for Real-time Multi-user Editing
 * Handles WebSocket-based collaborative form editing with conflict resolution
 */

import { webSocketService } from './webSocketService';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';

export interface FormCollaborator {
  userId: string;
  userEmail: string;
  fullName?: string;
  joinedAt: Date;
  lastActivity: Date;
  cursor?: {
    fieldId: string;
    position: number;
  };
  isActive: boolean;
}

export interface FieldChange {
  fieldId: string;
  fieldKey: string;
  changeType: 'value' | 'config' | 'add' | 'remove' | 'reorder';
  oldValue: any;
  newValue: any;
  userId: string;
  timestamp: Date;
  changeId: string;
}

export interface FormEditSession {
  formId: string;
  collaborators: Map<string, FormCollaborator>;
  activeChanges: Map<string, FieldChange>;
  versionNumber: number;
  lastSaved: Date;
  conflictResolution: 'last-writer-wins' | 'merge' | 'manual';
}

/**
 * Form Collaboration Service
 */
class FormCollaborationService {
  private activeSessions = new Map<string, FormEditSession>();
  private userFormSessions = new Map<string, Set<string>>(); // userId -> Set of formIds

  constructor() {
    this.setupCleanupInterval();
  }

  /**
   * Join form collaboration session
   */
  async joinFormSession(formId: string, user: {
    userId: string;
    userEmail: string;
    fullName?: string;
  }): Promise<{
    session: FormEditSession;
    collaborators: FormCollaborator[];
  }> {
    try {
      // Get or create session
      let session = this.activeSessions.get(formId);
      if (!session) {
        session = {
          formId,
          collaborators: new Map(),
          activeChanges: new Map(),
          versionNumber: 1,
          lastSaved: new Date(),
          conflictResolution: 'last-writer-wins'
        };
        this.activeSessions.set(formId, session);
        
        // Store in Redis for clustering
        await this.storeSessionInRedis(formId, session);
      }

      // Add collaborator
      const collaborator: FormCollaborator = {
        userId: user.userId,
        userEmail: user.userEmail,
        fullName: user.fullName,
        joinedAt: new Date(),
        lastActivity: new Date(),
        isActive: true
      };

      session.collaborators.set(user.userId, collaborator);

      // Track user sessions
      if (!this.userFormSessions.has(user.userId)) {
        this.userFormSessions.set(user.userId, new Set());
      }
      this.userFormSessions.get(user.userId)!.add(formId);

      // Notify other collaborators
      await this.notifyCollaborators(formId, 'user:joined', {
        user: collaborator,
        totalCollaborators: session.collaborators.size
      }, user.userId);

      logger.info('User joined form collaboration session', {
        formId,
        userId: user.userId,
        collaboratorCount: session.collaborators.size
      });

      return {
        session,
        collaborators: Array.from(session.collaborators.values())
      };

    } catch (error) {
      logger.error('Failed to join form session', { error, formId, userId: user.userId });
      throw error;
    }
  }

  /**
   * Leave form collaboration session
   */
  async leaveFormSession(formId: string, userId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(formId);
      if (!session) return;

      const collaborator = session.collaborators.get(userId);
      if (!collaborator) return;

      // Remove collaborator
      session.collaborators.delete(userId);

      // Update user sessions tracking
      const userSessions = this.userFormSessions.get(userId);
      if (userSessions) {
        userSessions.delete(formId);
        if (userSessions.size === 0) {
          this.userFormSessions.delete(userId);
        }
      }

      // Notify other collaborators
      await this.notifyCollaborators(formId, 'user:left', {
        userId,
        userEmail: collaborator.userEmail,
        totalCollaborators: session.collaborators.size
      });

      // Clean up session if empty
      if (session.collaborators.size === 0) {
        this.activeSessions.delete(formId);
        await this.removeSessionFromRedis(formId);
      } else {
        await this.storeSessionInRedis(formId, session);
      }

      logger.info('User left form collaboration session', {
        formId,
        userId,
        remainingCollaborators: session.collaborators.size
      });

    } catch (error) {
      logger.error('Failed to leave form session', { error, formId, userId });
    }
  }

  /**
   * Handle field change in collaborative session
   */
  async handleFieldChange(formId: string, change: Omit<FieldChange, 'changeId' | 'timestamp'>): Promise<{
    accepted: boolean;
    conflicts?: FieldChange[];
    resolvedChange?: FieldChange;
  }> {
    try {
      const session = this.activeSessions.get(formId);
      if (!session) {
        throw new Error('Form session not found');
      }

      // Validate user is in session
      if (!session.collaborators.has(change.userId)) {
        throw new Error('User not in collaboration session');
      }

      // Create full change object
      const fullChange: FieldChange = {
        ...change,
        changeId: this.generateChangeId(),
        timestamp: new Date()
      };

      // Check for conflicts
      const existingChange = session.activeChanges.get(change.fieldId);
      let conflicts: FieldChange[] = [];
      let resolvedChange = fullChange;

      if (existingChange && existingChange.userId !== change.userId) {
        conflicts.push(existingChange);
        
        // Apply conflict resolution strategy
        resolvedChange = await this.resolveConflict(session, existingChange, fullChange);
      }

      // Store the change
      session.activeChanges.set(change.fieldId, resolvedChange);
      session.versionNumber++;

      // Update collaborator activity
      const collaborator = session.collaborators.get(change.userId);
      if (collaborator) {
        collaborator.lastActivity = new Date();
      }

      // Store in Redis
      await this.storeSessionInRedis(formId, session);

      // Notify other collaborators
      await this.notifyCollaborators(formId, 'field:changed', {
        change: resolvedChange,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
        versionNumber: session.versionNumber
      }, change.userId);

      logger.debug('Field change processed', {
        formId,
        fieldId: change.fieldId,
        userId: change.userId,
        changeType: change.changeType,
        conflicts: conflicts.length,
        versionNumber: session.versionNumber
      });

      return {
        accepted: true,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
        resolvedChange
      };

    } catch (error) {
      logger.error('Failed to handle field change', { error, formId, change });
      return { accepted: false };
    }
  }

  /**
   * Update user cursor position
   */
  async updateCursorPosition(formId: string, userId: string, cursor: {
    fieldId: string;
    position: number;
  }): Promise<void> {
    try {
      const session = this.activeSessions.get(formId);
      if (!session) return;

      const collaborator = session.collaborators.get(userId);
      if (!collaborator) return;

      collaborator.cursor = cursor;
      collaborator.lastActivity = new Date();

      // Notify other collaborators
      await this.notifyCollaborators(formId, 'cursor:moved', {
        userId,
        cursor
      }, userId);

    } catch (error) {
      logger.error('Failed to update cursor position', { error, formId, userId });
    }
  }

  /**
   * Get form session status
   */
  getFormSession(formId: string): FormEditSession | null {
    return this.activeSessions.get(formId) || null;
  }

  /**
   * Get user's active form sessions
   */
  getUserActiveSessions(userId: string): string[] {
    const sessions = this.userFormSessions.get(userId);
    return sessions ? Array.from(sessions) : [];
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activeSessions: number;
    totalCollaborators: number;
    activeChanges: number;
    topForms: Array<{ formId: string; collaborators: number }>;
  } {
    const totalCollaborators = Array.from(this.activeSessions.values())
      .reduce((sum, session) => sum + session.collaborators.size, 0);

    const activeChanges = Array.from(this.activeSessions.values())
      .reduce((sum, session) => sum + session.activeChanges.size, 0);

    const topForms = Array.from(this.activeSessions.entries())
      .map(([formId, session]) => ({
        formId,
        collaborators: session.collaborators.size
      }))
      .sort((a, b) => b.collaborators - a.collaborators)
      .slice(0, 10);

    return {
      activeSessions: this.activeSessions.size,
      totalCollaborators,
      activeChanges,
      topForms
    };
  }

  // Private helper methods

  private async notifyCollaborators(
    formId: string,
    eventType: string,
    data: any,
    excludeUserId?: string
  ): Promise<void> {
    const session = this.activeSessions.get(formId);
    if (!session) return;

    const eventData = {
      type: 'form_collaboration',
      eventType,
      formId,
      timestamp: new Date().toISOString(),
      data
    };

    // Send to all collaborators except excluded user
    for (const [userId] of session.collaborators) {
      if (excludeUserId && userId === excludeUserId) continue;

      await webSocketService.sendCacheUpdateToUser(userId, {
        type: 'realtime_update',
        entity: 'form_collaboration',
        entityId: formId,
        userId,
        data: eventData,
        timestamp: new Date(),
        metadata: { eventType }
      });
    }
  }

  private async resolveConflict(
    session: FormEditSession,
    existingChange: FieldChange,
    newChange: FieldChange
  ): Promise<FieldChange> {
    switch (session.conflictResolution) {
      case 'last-writer-wins':
        return newChange;
      
      case 'merge':
        // Simple merge strategy - combine values if possible
        if (existingChange.changeType === 'value' && newChange.changeType === 'value') {
          return {
            ...newChange,
            newValue: this.mergeValues(existingChange.newValue, newChange.newValue)
          };
        }
        return newChange;
      
      case 'manual':
        // Mark as requiring manual resolution
        return {
          ...newChange,
          changeType: 'value',
          newValue: {
            conflicted: true,
            options: [existingChange.newValue, newChange.newValue],
            timestamp: newChange.timestamp
          }
        };
      
      default:
        return newChange;
    }
  }

  private mergeValues(existingValue: any, newValue: any): any {
    // Simple merge strategy - for objects, merge properties
    if (typeof existingValue === 'object' && typeof newValue === 'object') {
      return { ...existingValue, ...newValue };
    }
    // For non-objects, use new value
    return newValue;
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async storeSessionInRedis(formId: string, session: FormEditSession): Promise<void> {
    try {
      const sessionData = {
        formId: session.formId,
        collaborators: Array.from(session.collaborators.entries()),
        activeChanges: Array.from(session.activeChanges.entries()),
        versionNumber: session.versionNumber,
        lastSaved: session.lastSaved.toISOString(),
        conflictResolution: session.conflictResolution
      };

      await redisClient.setex(
        `form_session:${formId}`,
        3600, // 1 hour TTL
        JSON.stringify(sessionData)
      );
    } catch (error) {
      logger.warn('Failed to store session in Redis', { error, formId });
    }
  }

  private async removeSessionFromRedis(formId: string): Promise<void> {
    try {
      await redisClient.del(`form_session:${formId}`);
    } catch (error) {
      logger.warn('Failed to remove session from Redis', { error, formId });
    }
  }

  private setupCleanupInterval(): void {
    // Clean up inactive sessions every 10 minutes
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 10 * 60 * 1000);
  }

  private cleanupInactiveSessions(): void {
    const now = new Date();
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [formId, session] of this.activeSessions) {
      // Check if all collaborators are inactive
      let allInactive = true;
      for (const collaborator of session.collaborators.values()) {
        if (now.getTime() - collaborator.lastActivity.getTime() < inactivityThreshold) {
          allInactive = false;
          break;
        }
      }

      if (allInactive) {
        logger.info('Cleaning up inactive form session', { formId, collaboratorCount: session.collaborators.size });
        this.activeSessions.delete(formId);
        this.removeSessionFromRedis(formId);
      }
    }
  }
}

// Export singleton instance
export const formCollaborationService = new FormCollaborationService();
export default formCollaborationService;