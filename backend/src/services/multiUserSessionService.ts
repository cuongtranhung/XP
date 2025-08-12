/**
 * Multi-User Session Management Service
 * Handles concurrent sessions, session synchronization, and cache partitioning
 */

import cacheService from './cacheService';
import { logger } from '../utils/logger';
import { realTimeCacheService } from './realTimeCacheService';

// Session types and interfaces
export interface UserSession {
  sessionId: string;
  userId: string;
  deviceId?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser?: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
  metadata?: {
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
    preferences?: {
      theme?: string;
      language?: string;
      timezone?: string;
    };
    features?: string[];
  };
}

export interface SessionCache {
  sessionId: string;
  userId: string;
  cachePartition: string;
  data: Record<string, any>;
  syncStatus: 'synced' | 'pending' | 'conflict';
  lastSync: Date;
  version: number;
}

export interface SessionConflict {
  sessionId: string;
  conflictingSessionId: string;
  dataKey: string;
  currentValue: any;
  conflictingValue: any;
  timestamp: Date;
  resolution: 'pending' | 'resolved' | 'ignored';
}

/**
 * Multi-User Session Management with Cache Partitioning
 */
class MultiUserSessionService {
  // Cache configuration for session management
  private sessionCacheConfig = {
    ttl: 86400, // 24 hours
    keyPrefix: 'session:data'
  };

  private sessionDataConfig = {
    ttl: 7200, // 2 hours for session cache data
    keyPrefix: 'session:cache'
  };

  private conflictConfig = {
    ttl: 3600, // 1 hour for conflict resolution
    keyPrefix: 'session:conflict'
  };

  // Active session tracking
  private activeSessions = new Map<string, UserSession>();
  private userSessionMap = new Map<string, Set<string>>(); // userId -> sessionIds
  private sessionSyncQueues = new Map<string, any[]>();
  private conflictResolutionStrategies = new Map<string, Function>();

  // Session statistics
  private sessionStats = {
    totalSessions: 0,
    activeSessions: 0,
    conflictsResolved: 0,
    syncOperations: 0,
    lastCleanup: new Date()
  };

  constructor() {
    this.initializeConflictResolutionStrategies();
    this.startSessionCleanup();
    this.startSyncProcessor();
  }

  /**
   * Create new user session
   */
  async createSession(sessionData: Omit<UserSession, 'sessionId' | 'isActive' | 'createdAt' | 'expiresAt'>): Promise<string> {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: UserSession = {
      ...sessionData,
      sessionId,
      isActive: true,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    };

    // Store session in cache
    const sessionKey = `${this.sessionCacheConfig.keyPrefix}:${sessionId}`;
    await cacheService.set(sessionKey, session, { ttl: this.sessionCacheConfig.ttl });
    this.activeSessions.set(sessionId, session);

    // Track user sessions
    if (!this.userSessionMap.has(session.userId)) {
      this.userSessionMap.set(session.userId, new Set());
    }
    this.userSessionMap.get(session.userId)!.add(sessionId);

    // Create session cache partition
    await this.createSessionCachePartition(sessionId, session.userId);

    // Update statistics
    this.sessionStats.totalSessions++;
    this.sessionStats.activeSessions = this.activeSessions.size;

    // Subscribe to real-time cache updates for this session
    await this.subscribeToRealtimeUpdates(sessionId, session.userId);

    logger.info('Multi-user session created', {
      sessionId,
      userId: session.userId,
      deviceType: session.deviceType,
      totalActiveSessions: this.sessionStats.activeSessions
    });

    return sessionId;
  }

  /**
   * Get active sessions for user
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const sessionIds = this.userSessionMap.get(userId) || new Set();
    const sessions: UserSession[] = [];

    for (const sessionId of sessionIds) {
      const session = this.activeSessions.get(sessionId);
      if (session && session.isActive) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string, metadata?: Partial<UserSession['metadata']>): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    // Update last activity
    session.lastActivity = new Date();
    
    // Merge metadata if provided
    if (metadata) {
      session.metadata = {
        ...session.metadata,
        ...metadata
      };
    }

    // Update in cache
    const sessionKey = `${this.sessionCacheConfig.keyPrefix}:${sessionId}`;
    await cacheService.set(sessionKey, session, { ttl: this.sessionCacheConfig.ttl });
    this.activeSessions.set(sessionId, session);

    logger.debug('Session activity updated', {
      sessionId,
      userId: session.userId,
      lastActivity: session.lastActivity
    });

    return true;
  }

  /**
   * Terminate session
   */
  async terminateSession(sessionId: string, reason: 'logout' | 'timeout' | 'admin' | 'security' = 'logout'): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Mark session as inactive
    session.isActive = false;
    const sessionKey = `${this.sessionCacheConfig.keyPrefix}:${sessionId}`;
    await cacheService.set(sessionKey, session, { ttl: this.sessionCacheConfig.ttl });

    // Remove from active tracking
    this.activeSessions.delete(sessionId);
    
    // Remove from user session map
    const userSessions = this.userSessionMap.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessionMap.delete(session.userId);
      }
    }

    // Clean up session cache partition
    await this.cleanupSessionCachePartition(sessionId);

    // Update statistics
    this.sessionStats.activeSessions = this.activeSessions.size;

    logger.info('Multi-user session terminated', {
      sessionId,
      userId: session.userId,
      reason,
      remainingActiveSessions: this.sessionStats.activeSessions
    });

    return true;
  }

  /**
   * Get session cache data
   */
  async getSessionCacheData(sessionId: string, key: string): Promise<any> {
    const cachePartition = this.getSessionCachePartition(sessionId);
    const cacheKey = `${cachePartition}:${key}`;
    
    try {
      return await cacheService.get(cacheKey);
    } catch (error) {
      logger.error('Failed to get session cache data', {
        sessionId,
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Set session cache data
   */
  async setSessionCacheData(sessionId: string, key: string, value: any, ttl?: number): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    const cachePartition = this.getSessionCachePartition(sessionId);
    const cacheKey = `${cachePartition}:${key}`;
    
    try {
      await cacheService.set(cacheKey, value, { ttl: ttl || 3600 });

      // Queue for synchronization with other user sessions
      await this.queueSessionSync(session.userId, sessionId, key, value);

      return true;
    } catch (error) {
      logger.error('Failed to set session cache data', {
        sessionId,
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Synchronize cache data across user sessions
   */
  async synchronizeUserSessions(userId: string): Promise<void> {
    const userSessions = await this.getUserSessions(userId);
    
    if (userSessions.length <= 1) {
      return; // No synchronization needed for single session
    }

    logger.info('Synchronizing cache across user sessions', {
      userId,
      sessionCount: userSessions.length
    });

    // Collect all cache data from user sessions
    const sessionCacheData = new Map<string, Map<string, any>>();
    
    for (const session of userSessions) {
      const cachePartition = this.getSessionCachePartition(session.sessionId);
      const sessionData = new Map<string, any>();
      
      // In production, this would scan the cache partition
      // For now, we'll simulate with tracked keys
      sessionCacheData.set(session.sessionId, sessionData);
    }

    // Detect conflicts and resolve them
    await this.detectAndResolveConflicts(userId, sessionCacheData);

    // Apply synchronized data to all sessions
    await this.applySynchronizedData(userSessions, sessionCacheData);

    this.sessionStats.syncOperations++;
    logger.debug('Session synchronization completed', { userId });
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    conflictsResolved: number;
    syncOperations: number;
    lastCleanup: Date;
    averageSessionsPerUser: number;
    deviceTypeDistribution: Record<string, number>;
  } {
    // Calculate average sessions per user
    const averageSessionsPerUser = this.userSessionMap.size > 0 ? 
      Array.from(this.userSessionMap.values()).reduce((sum, sessions) => sum + sessions.size, 0) / this.userSessionMap.size : 0;

    // Calculate device type distribution
    const deviceTypeDistribution: Record<string, number> = {};
    for (const session of this.activeSessions.values()) {
      const deviceType = session.deviceType;
      deviceTypeDistribution[deviceType] = (deviceTypeDistribution[deviceType] || 0) + 1;
    }

    return {
      ...this.sessionStats,
      averageSessionsPerUser: Math.round(averageSessionsPerUser * 100) / 100,
      deviceTypeDistribution
    };
  }

  /**
   * Force cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;
    const expiredSessions: string[] = [];

    // Find expired sessions
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now || 
          (session.lastActivity && new Date(session.lastActivity.getTime() + 2 * 60 * 60 * 1000) < now)) {
        expiredSessions.push(sessionId);
      }
    }

    // Terminate expired sessions
    for (const sessionId of expiredSessions) {
      await this.terminateSession(sessionId, 'timeout');
      cleanedCount++;
    }

    this.sessionStats.lastCleanup = now;

    if (cleanedCount > 0) {
      logger.info('Expired sessions cleaned up', {
        cleanedCount,
        remainingActiveSessions: this.sessionStats.activeSessions
      });
    }

    return cleanedCount;
  }

  // Private helper methods

  private getSessionCachePartition(sessionId: string): string {
    return `session:partition:${sessionId}`;
  }

  private async createSessionCachePartition(sessionId: string, userId: string): Promise<void> {
    const sessionCache: SessionCache = {
      sessionId,
      userId,
      cachePartition: this.getSessionCachePartition(sessionId),
      data: {},
      syncStatus: 'synced',
      lastSync: new Date(),
      version: 1
    };

    const cacheKey = `${this.sessionDataConfig.keyPrefix}:${sessionId}`;
    await cacheService.set(cacheKey, sessionCache, { ttl: this.sessionDataConfig.ttl });
  }

  private async cleanupSessionCachePartition(sessionId: string): Promise<void> {
    const cachePartition = this.getSessionCachePartition(sessionId);
    
    // In production, this would clear all keys matching the partition pattern
    logger.debug('Cleaning up session cache partition', { sessionId, cachePartition });
    
    // Remove from session cache
    const cacheKey = `${this.sessionDataConfig.keyPrefix}:${sessionId}`;
    await cacheService.del(cacheKey);
  }

  private async subscribeToRealtimeUpdates(sessionId: string, userId: string): Promise<void> {
    // Subscribe to real-time updates for this session
    realTimeCacheService.subscribe({
      userId,
      entities: ['user', 'preference', 'session'],
      callback: async (event) => {
        // Handle real-time cache updates for this session
        await this.handleRealtimeCacheUpdate(sessionId, event);
      }
    });
  }

  private async handleRealtimeCacheUpdate(sessionId: string, event: any): Promise<void> {
    logger.debug('Handling real-time cache update for session', {
      sessionId,
      eventType: event.type,
      entity: event.entity
    });

    // Update session cache based on real-time event
    if (event.entity === 'preference' || event.entity === 'user') {
      await this.queueSessionSync(event.userId, sessionId, event.entity, event.data);
    }
  }

  private async queueSessionSync(userId: string, sessionId: string, key: string, value: any): Promise<void> {
    const queueKey = `${userId}:${sessionId}`;
    
    if (!this.sessionSyncQueues.has(queueKey)) {
      this.sessionSyncQueues.set(queueKey, []);
    }

    this.sessionSyncQueues.get(queueKey)!.push({
      key,
      value,
      timestamp: new Date(),
      sessionId
    });
  }

  private async detectAndResolveConflicts(
    userId: string, 
    sessionCacheData: Map<string, Map<string, any>>
  ): Promise<void> {
    const conflicts: SessionConflict[] = [];
    const allKeys = new Set<string>();

    // Collect all unique keys across sessions
    for (const sessionData of sessionCacheData.values()) {
      for (const key of sessionData.keys()) {
        allKeys.add(key);
      }
    }

    // Check for conflicts
    for (const key of allKeys) {
      const values = new Map<string, any>();
      
      for (const [sessionId, sessionData] of sessionCacheData.entries()) {
        if (sessionData.has(key)) {
          values.set(sessionId, sessionData.get(key));
        }
      }

      if (values.size > 1) {
        // Conflict detected
        const conflictingSessions = Array.from(values.keys());
        for (let i = 0; i < conflictingSessions.length - 1; i++) {
          const conflict: SessionConflict = {
            sessionId: conflictingSessions[i],
            conflictingSessionId: conflictingSessions[i + 1],
            dataKey: key,
            currentValue: values.get(conflictingSessions[i]),
            conflictingValue: values.get(conflictingSessions[i + 1]),
            timestamp: new Date(),
            resolution: 'pending'
          };
          
          conflicts.push(conflict);
        }
      }
    }

    // Resolve conflicts using registered strategies
    for (const conflict of conflicts) {
      await this.resolveConflict(conflict);
    }
  }

  private async resolveConflict(conflict: SessionConflict): Promise<void> {
    const strategy = this.conflictResolutionStrategies.get(conflict.dataKey) || 
                    this.conflictResolutionStrategies.get('default');

    if (strategy) {
      const resolution = await strategy(conflict);
      conflict.resolution = resolution ? 'resolved' : 'ignored';
      
      const conflictKey = `${this.conflictConfig.keyPrefix}:${conflict.sessionId}:${Date.now()}`;
      await cacheService.set(conflictKey, conflict, { ttl: this.conflictConfig.ttl });
      this.sessionStats.conflictsResolved++;

      logger.debug('Session conflict resolved', {
        sessionId: conflict.sessionId,
        dataKey: conflict.dataKey,
        resolution: conflict.resolution
      });
    }
  }

  private async applySynchronizedData(
    userSessions: UserSession[], 
    sessionCacheData: Map<string, Map<string, any>>
  ): Promise<void> {
    // Apply synchronized data to all user sessions
    for (const session of userSessions) {
      const sessionData = sessionCacheData.get(session.sessionId);
      if (sessionData) {
        for (const [key, value] of sessionData.entries()) {
          await this.setSessionCacheData(session.sessionId, key, value);
        }
      }
    }
  }

  private initializeConflictResolutionStrategies(): void {
    // Default conflict resolution: last write wins
    this.conflictResolutionStrategies.set('default', (conflict: SessionConflict) => {
      return Promise.resolve(true); // Accept the newer value
    });

    // User preferences: merge strategies
    this.conflictResolutionStrategies.set('preferences', (conflict: SessionConflict) => {
      if (typeof conflict.currentValue === 'object' && typeof conflict.conflictingValue === 'object') {
        // Merge objects
        const merged = { ...conflict.currentValue, ...conflict.conflictingValue };
        return Promise.resolve(merged);
      }
      return Promise.resolve(true); // Fall back to last write wins
    });

    // Form data: conflict notification required
    this.conflictResolutionStrategies.set('form_data', (conflict: SessionConflict) => {
      logger.warn('Form data conflict detected - manual resolution may be required', {
        sessionId: conflict.sessionId,
        dataKey: conflict.dataKey
      });
      return Promise.resolve(false); // Don't auto-resolve form conflicts
    });
  }

  private startSessionCleanup(): void {
    // Clean up expired sessions every 15 minutes
    setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, 15 * 60 * 1000);

    logger.info('Multi-user session cleanup service started');
  }

  private startSyncProcessor(): void {
    // Process session synchronization every 30 seconds
    setInterval(async () => {
      await this.processSyncQueues();
    }, 30 * 1000);

    logger.info('Multi-user session sync processor started');
  }

  private async processSyncQueues(): Promise<void> {
    if (this.sessionSyncQueues.size === 0) {
      return;
    }

    const userIds = new Set<string>();
    
    // Collect unique user IDs from sync queues
    for (const queueKey of this.sessionSyncQueues.keys()) {
      const userId = queueKey.split(':')[0];
      userIds.add(userId);
    }

    // Process synchronization for each user
    for (const userId of userIds) {
      await this.synchronizeUserSessions(userId);
    }

    // Clear processed queues
    this.sessionSyncQueues.clear();
  }
}

// Export singleton instance
export const multiUserSessionService = new MultiUserSessionService();
export default multiUserSessionService;