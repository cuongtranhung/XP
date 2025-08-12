/**
 * Live Submission Service for Real-time Form Submission Updates
 * Handles WebSocket-based live submission tracking and notifications
 */

import { webSocketService } from './webSocketService';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';

export interface LiveSubmission {
  submissionId: string;
  formId: string;
  userId: string | null;
  submitterEmail?: string;
  submitterName?: string;
  status: 'in_progress' | 'submitted' | 'processing' | 'completed' | 'failed';
  currentStep?: number;
  totalSteps?: number;
  lastActivity: Date;
  startedAt: Date;
  submittedAt?: Date;
  progressData: {
    completedFields: string[];
    currentField?: string;
    validationErrors: Record<string, string[]>;
    completionPercentage: number;
  };
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
    sessionId?: string;
  };
}

export interface SubmissionUpdate {
  type: 'field_updated' | 'step_changed' | 'validation_error' | 'status_changed' | 'submitted';
  fieldId?: string;
  fieldValue?: any;
  stepNumber?: number;
  validationErrors?: Record<string, string[]>;
  completionPercentage?: number;
  timestamp: Date;
}

export interface FormOwnerNotification {
  formId: string;
  ownerId: string;
  submissionId: string;
  type: 'new_submission' | 'submission_progress' | 'submission_completed';
  submissionData: Partial<LiveSubmission>;
  timestamp: Date;
}

/**
 * Live Submission Service
 */
class LiveSubmissionService {
  private activeSubmissions = new Map<string, LiveSubmission>();
  private formOwnerSubscriptions = new Map<string, Set<string>>(); // formId -> Set of ownerIds
  private userSubmissions = new Map<string, Set<string>>(); // userId -> Set of submissionIds

  constructor() {
    this.setupCleanupInterval();
  }

  /**
   * Start tracking a new submission
   */
  async startSubmission(data: {
    submissionId: string;
    formId: string;
    userId?: string;
    submitterEmail?: string;
    submitterName?: string;
    totalSteps?: number;
    metadata?: Partial<LiveSubmission['metadata']>;
  }): Promise<LiveSubmission> {
    try {
      const submission: LiveSubmission = {
        submissionId: data.submissionId,
        formId: data.formId,
        userId: data.userId || null,
        submitterEmail: data.submitterEmail,
        submitterName: data.submitterName,
        status: 'in_progress',
        currentStep: 1,
        totalSteps: data.totalSteps || 1,
        lastActivity: new Date(),
        startedAt: new Date(),
        progressData: {
          completedFields: [],
          validationErrors: {},
          completionPercentage: 0
        },
        metadata: {
          userAgent: data.metadata?.userAgent,
          ipAddress: data.metadata?.ipAddress,
          deviceType: data.metadata?.deviceType || 'desktop',
          sessionId: data.metadata?.sessionId
        }
      };

      // Store submission
      this.activeSubmissions.set(data.submissionId, submission);

      // Track user submissions
      if (data.userId) {
        if (!this.userSubmissions.has(data.userId)) {
          this.userSubmissions.set(data.userId, new Set());
        }
        this.userSubmissions.get(data.userId)!.add(data.submissionId);
      }

      // Store in Redis for persistence
      await this.storeSubmissionInRedis(data.submissionId, submission);

      // Notify form owners
      await this.notifyFormOwners(data.formId, {
        formId: data.formId,
        ownerId: '', // Will be resolved in notifyFormOwners
        submissionId: data.submissionId,
        type: 'new_submission',
        submissionData: submission,
        timestamp: new Date()
      });

      logger.info('Started tracking live submission', {
        submissionId: data.submissionId,
        formId: data.formId,
        userId: data.userId
      });

      return submission;

    } catch (error) {
      logger.error('Failed to start submission tracking', { error, submissionId: data.submissionId });
      throw error;
    }
  }

  /**
   * Update submission progress
   */
  async updateSubmission(submissionId: string, update: SubmissionUpdate): Promise<boolean> {
    try {
      const submission = this.activeSubmissions.get(submissionId);
      if (!submission) {
        logger.warn('Submission not found for update', { submissionId });
        return false;
      }

      // Update submission based on update type
      switch (update.type) {
        case 'field_updated':
          if (update.fieldId && !submission.progressData.completedFields.includes(update.fieldId)) {
            submission.progressData.completedFields.push(update.fieldId);
          }
          submission.progressData.currentField = update.fieldId;
          break;

        case 'step_changed':
          if (update.stepNumber) {
            submission.currentStep = update.stepNumber;
          }
          break;

        case 'validation_error':
          if (update.validationErrors) {
            submission.progressData.validationErrors = {
              ...submission.progressData.validationErrors,
              ...update.validationErrors
            };
          }
          break;

        case 'status_changed':
          // Status changes are handled in separate methods
          break;

        case 'submitted':
          submission.status = 'submitted';
          submission.submittedAt = new Date();
          break;
      }

      // Update completion percentage
      if (update.completionPercentage !== undefined) {
        submission.progressData.completionPercentage = update.completionPercentage;
      }

      submission.lastActivity = new Date();

      // Store in Redis
      await this.storeSubmissionInRedis(submissionId, submission);

      // Notify interested parties
      await this.broadcastSubmissionUpdate(submission, update);

      // Notify form owners
      await this.notifyFormOwners(submission.formId, {
        formId: submission.formId,
        ownerId: '', // Will be resolved in notifyFormOwners
        submissionId,
        type: 'submission_progress',
        submissionData: submission,
        timestamp: new Date()
      });

      logger.debug('Submission updated', {
        submissionId,
        updateType: update.type,
        completionPercentage: submission.progressData.completionPercentage
      });

      return true;

    } catch (error) {
      logger.error('Failed to update submission', { error, submissionId });
      return false;
    }
  }

  /**
   * Complete submission
   */
  async completeSubmission(submissionId: string, finalData?: any): Promise<boolean> {
    try {
      const submission = this.activeSubmissions.get(submissionId);
      if (!submission) {
        return false;
      }

      submission.status = 'completed';
      submission.submittedAt = new Date();
      submission.progressData.completionPercentage = 100;
      submission.lastActivity = new Date();

      // Store final state in Redis
      await this.storeSubmissionInRedis(submissionId, submission);

      // Notify form owners
      await this.notifyFormOwners(submission.formId, {
        formId: submission.formId,
        ownerId: '', // Will be resolved in notifyFormOwners
        submissionId,
        type: 'submission_completed',
        submissionData: submission,
        timestamp: new Date()
      });

      // Broadcast completion
      await this.broadcastSubmissionUpdate(submission, {
        type: 'submitted',
        completionPercentage: 100,
        timestamp: new Date()
      });

      logger.info('Submission completed', {
        submissionId,
        formId: submission.formId,
        userId: submission.userId,
        duration: submission.submittedAt.getTime() - submission.startedAt.getTime()
      });

      // Clean up after 1 hour
      setTimeout(() => {
        this.cleanupSubmission(submissionId);
      }, 60 * 60 * 1000);

      return true;

    } catch (error) {
      logger.error('Failed to complete submission', { error, submissionId });
      return false;
    }
  }

  /**
   * Subscribe form owner to live submission updates
   */
  async subscribeFormOwner(formId: string, ownerId: string): Promise<void> {
    if (!this.formOwnerSubscriptions.has(formId)) {
      this.formOwnerSubscriptions.set(formId, new Set());
    }
    this.formOwnerSubscriptions.get(formId)!.add(ownerId);

    logger.debug('Form owner subscribed to live submissions', { formId, ownerId });
  }

  /**
   * Unsubscribe form owner from live submission updates
   */
  async unsubscribeFormOwner(formId: string, ownerId: string): Promise<void> {
    const subscribers = this.formOwnerSubscriptions.get(formId);
    if (subscribers) {
      subscribers.delete(ownerId);
      if (subscribers.size === 0) {
        this.formOwnerSubscriptions.delete(formId);
      }
    }

    logger.debug('Form owner unsubscribed from live submissions', { formId, ownerId });
  }

  /**
   * Get active submissions for a form
   */
  getFormActiveSubmissions(formId: string): LiveSubmission[] {
    return Array.from(this.activeSubmissions.values())
      .filter(submission => submission.formId === formId && submission.status === 'in_progress');
  }

  /**
   * Get user's active submissions
   */
  getUserActiveSubmissions(userId: string): LiveSubmission[] {
    const submissionIds = this.userSubmissions.get(userId);
    if (!submissionIds) return [];

    return Array.from(submissionIds)
      .map(id => this.activeSubmissions.get(id))
      .filter((submission): submission is LiveSubmission => 
        submission !== undefined && submission.status === 'in_progress'
      );
  }

  /**
   * Get submission by ID
   */
  getSubmission(submissionId: string): LiveSubmission | null {
    return this.activeSubmissions.get(submissionId) || null;
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activeSubmissions: number;
    completedToday: number;
    averageCompletionTime: number;
    topForms: Array<{ formId: string; activeSubmissions: number }>;
    deviceBreakdown: Record<string, number>;
  } {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const allSubmissions = Array.from(this.activeSubmissions.values());
    const activeSubmissions = allSubmissions.filter(s => s.status === 'in_progress').length;
    
    const completedToday = allSubmissions.filter(s => 
      s.status === 'completed' && 
      s.submittedAt && 
      s.submittedAt >= todayStart
    ).length;

    const completedSubmissions = allSubmissions.filter(s => s.status === 'completed' && s.submittedAt);
    const averageCompletionTime = completedSubmissions.length > 0 
      ? completedSubmissions.reduce((sum, s) => {
          return sum + (s.submittedAt!.getTime() - s.startedAt.getTime());
        }, 0) / completedSubmissions.length
      : 0;

    const formSubmissionCounts = new Map<string, number>();
    allSubmissions.forEach(s => {
      if (s.status === 'in_progress') {
        formSubmissionCounts.set(s.formId, (formSubmissionCounts.get(s.formId) || 0) + 1);
      }
    });

    const topForms = Array.from(formSubmissionCounts.entries())
      .map(([formId, count]) => ({ formId, activeSubmissions: count }))
      .sort((a, b) => b.activeSubmissions - a.activeSubmissions)
      .slice(0, 10);

    const deviceBreakdown = allSubmissions.reduce((acc, s) => {
      const device = s.metadata.deviceType || 'unknown';
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      activeSubmissions,
      completedToday,
      averageCompletionTime,
      topForms,
      deviceBreakdown
    };
  }

  // Private helper methods

  private async broadcastSubmissionUpdate(submission: LiveSubmission, update: SubmissionUpdate): Promise<void> {
    const eventData = {
      type: 'submission_update',
      submissionId: submission.submissionId,
      formId: submission.formId,
      update,
      progressData: submission.progressData,
      timestamp: new Date().toISOString()
    };

    // Send to submitter if authenticated
    if (submission.userId) {
      await webSocketService.sendCacheUpdateToUser(submission.userId, {
        type: 'realtime_update',
        entity: 'submission',
        entityId: submission.submissionId,
        userId: submission.userId,
        data: eventData,
        timestamp: new Date(),
        metadata: { updateType: update.type }
      });
    }
  }

  private async notifyFormOwners(formId: string, notification: FormOwnerNotification): Promise<void> {
    const subscribers = this.formOwnerSubscriptions.get(formId);
    if (!subscribers || subscribers.size === 0) return;

    const eventData = {
      type: 'form_submission_notification',
      formId,
      notification,
      timestamp: new Date().toISOString()
    };

    for (const ownerId of subscribers) {
      await webSocketService.sendCacheUpdateToUser(ownerId, {
        type: 'realtime_update',
        entity: 'form_submission',
        entityId: notification.submissionId,
        userId: ownerId,
        data: eventData,
        timestamp: new Date(),
        metadata: { notificationType: notification.type }
      });
    }
  }

  private async storeSubmissionInRedis(submissionId: string, submission: LiveSubmission): Promise<void> {
    try {
      await redisClient.setex(
        `live_submission:${submissionId}`,
        3600, // 1 hour TTL
        JSON.stringify(submission)
      );
    } catch (error) {
      logger.warn('Failed to store submission in Redis', { error, submissionId });
    }
  }

  private cleanupSubmission(submissionId: string): void {
    const submission = this.activeSubmissions.get(submissionId);
    if (submission) {
      // Remove from active submissions
      this.activeSubmissions.delete(submissionId);

      // Remove from user submissions tracking
      if (submission.userId) {
        const userSubmissions = this.userSubmissions.get(submission.userId);
        if (userSubmissions) {
          userSubmissions.delete(submissionId);
          if (userSubmissions.size === 0) {
            this.userSubmissions.delete(submission.userId);
          }
        }
      }

      // Remove from Redis
      redisClient.del(`live_submission:${submissionId}`).catch(error => {
        logger.warn('Failed to remove submission from Redis', { error, submissionId });
      });

      logger.debug('Submission cleaned up', { submissionId });
    }
  }

  private setupCleanupInterval(): void {
    // Clean up old submissions every 30 minutes
    setInterval(() => {
      this.cleanupOldSubmissions();
    }, 30 * 60 * 1000);
  }

  private cleanupOldSubmissions(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [submissionId, submission] of this.activeSubmissions) {
      const age = now.getTime() - submission.lastActivity.getTime();
      
      if (age > maxAge) {
        logger.info('Cleaning up old submission', { 
          submissionId, 
          formId: submission.formId,
          status: submission.status,
          age: Math.round(age / (60 * 60 * 1000)) + ' hours'
        });
        this.cleanupSubmission(submissionId);
      }
    }
  }
}

// Export singleton instance
export const liveSubmissionService = new LiveSubmissionService();
export default liveSubmissionService;