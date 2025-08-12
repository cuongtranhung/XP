import cacheService from './cacheService';
import { logger } from '../utils/logger';
import { createCachedRepository } from './cachedRepositoryService';

// User preference types
export interface UserPreferences {
  id: string;
  userId: string;
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    comments: boolean;
    formUpdates: boolean;
    systemAlerts: boolean;
  };
  dashboard: {
    defaultView: string;
    itemsPerPage: number;
    showArchived: boolean;
  };
  forms: {
    autoSave: boolean;
    showValidation: boolean;
    defaultTemplate: string;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'team';
    showActivity: boolean;
    trackingEnabled: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UserHistory {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: any;
  timestamp: Date;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    location?: string;
  };
  loginTime: Date;
  lastActivity: Date;
  isActive: boolean;
}

/**
 * User Preferences Cache Service
 * Handles caching for user preferences, history, and session data
 */
class UserPreferencesCache {
  private preferencesCache = createCachedRepository<UserPreferences>('preferences', {
    ttl: 3600, // 1 hour
    keyPrefix: 'user:preferences',
    enableCache: true
  });

  private historyCache = createCachedRepository<UserHistory[]>('history', {
    ttl: 86400, // 24 hours  
    keyPrefix: 'user:history',
    enableCache: true
  });

  private sessionCache = createCachedRepository<UserSession>('session', {
    ttl: 1800, // 30 minutes
    keyPrefix: 'user:session',
    enableCache: true
  });

  /**
   * Get user preferences with caching
   */
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    return this.preferencesCache.getById(
      userId,
      async () => {
        // Fetch from database (mock implementation)
        logger.debug(`Fetching user preferences from database for user ${userId}`);
        
        // TODO: Replace with actual database query
        // const result = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
        // return result.rows[0] || null;
        
        // Mock implementation
        return {
          id: `pref_${userId}`,
          userId,
          language: 'en',
          timezone: 'UTC',
          theme: 'light',
          notifications: {
            email: true,
            push: true,
            comments: true,
            formUpdates: true,
            systemAlerts: false
          },
          dashboard: {
            defaultView: 'grid',
            itemsPerPage: 20,
            showArchived: false
          },
          forms: {
            autoSave: true,
            showValidation: true,
            defaultTemplate: 'basic'
          },
          privacy: {
            profileVisibility: 'team',
            showActivity: true,
            trackingEnabled: true
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
    );
  }

  /**
   * Update user preferences and invalidate cache
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    // TODO: Update database
    // await db.query('UPDATE user_preferences SET ... WHERE user_id = $1', [userId]);
    
    // Invalidate cache
    await this.preferencesCache.invalidate(userId);
    
    logger.info(`Updated user preferences and invalidated cache`, { userId });
    
    // Return updated preferences (would fetch from DB in real implementation)
    const updated = await this.getUserPreferences(userId);
    return updated!;
  }

  /**
   * Get user activity history with caching
   */
  async getUserHistory(userId: string, limit: number = 50): Promise<UserHistory[]> {
    const cacheKey = `${userId}:${limit}`;
    
    return this.historyCache.cacheQuery(
      'list',
      { userId, limit },
      async () => {
        logger.debug(`Fetching user history from database`, { userId, limit });
        
        // TODO: Replace with actual database query
        // const result = await db.query(`
        //   SELECT * FROM user_activity_log 
        //   WHERE user_id = $1 
        //   ORDER BY created_at DESC 
        //   LIMIT $2
        // `, [userId, limit]);
        // return result.rows;
        
        // Mock implementation
        return [
          {
            userId,
            action: 'form_create',
            entityType: 'form',
            entityId: 'form_123',
            metadata: { name: 'Contact Form' },
            timestamp: new Date()
          },
          {
            userId,
            action: 'form_submit',
            entityType: 'submission',
            entityId: 'sub_456', 
            metadata: { formId: 'form_123' },
            timestamp: new Date(Date.now() - 3600000) // 1 hour ago
          }
        ];
      },
      1800 // 30 minutes cache for history
    );
  }

  /**
   * Add activity to user history and update cache
   */
  async addUserActivity(activity: Omit<UserHistory, 'timestamp'>): Promise<void> {
    // TODO: Insert into database
    // await db.query(`
    //   INSERT INTO user_activity_log (user_id, action, entity_type, entity_id, metadata, created_at)
    //   VALUES ($1, $2, $3, $4, $5, NOW())
    // `, [activity.userId, activity.action, activity.entityType, activity.entityId, activity.metadata]);
    
    // Invalidate history cache to force refresh
    await this.historyCache.invalidatePattern(`${activity.userId}:*`);
    
    logger.debug('Added user activity and invalidated history cache', activity);
  }

  /**
   * Get active user sessions
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    return this.sessionCache.cacheQuery(
      'sessions',
      { userId },
      async () => {
        logger.debug(`Fetching user sessions from database`, { userId });
        
        // TODO: Replace with actual database query
        // const result = await db.query(`
        //   SELECT * FROM user_sessions 
        //   WHERE user_id = $1 AND is_active = true 
        //   ORDER BY last_activity DESC
        // `, [userId]);
        // return result.rows;
        
        // Mock implementation
        return [
          {
            sessionId: `session_${Date.now()}`,
            userId,
            deviceInfo: {
              userAgent: 'Mozilla/5.0...',
              ip: '192.168.1.100',
              location: 'Ho Chi Minh City, Vietnam'
            },
            loginTime: new Date(Date.now() - 7200000), // 2 hours ago
            lastActivity: new Date(),
            isActive: true
          }
        ];
      },
      900 // 15 minutes cache for sessions
    );
  }

  /**
   * Invalidate user session cache
   */
  async invalidateUserSession(userId: string, sessionId: string): Promise<void> {
    await this.sessionCache.invalidate(sessionId);
    await this.sessionCache.invalidatePattern(`sessions:${userId}:*`);
    
    logger.info('Invalidated user session cache', { userId, sessionId });
  }

  /**
   * Cache warming for frequently accessed user data
   */
  async warmUserCache(userId: string): Promise<void> {
    logger.info(`Starting cache warming for user ${userId}`);
    
    try {
      // Warm preferences cache
      await this.getUserPreferences(userId);
      
      // Warm recent history cache
      await this.getUserHistory(userId, 20);
      
      // Warm session cache
      await this.getUserSessions(userId);
      
      logger.info(`Cache warming completed for user ${userId}`);
    } catch (error) {
      logger.error(`Cache warming failed for user ${userId}:`, error);
    }
  }

  /**
   * Get cache statistics for user preferences
   */
  async getCacheStats(): Promise<any> {
    return {
      preferences: await this.preferencesCache.getCacheStats(),
      history: await this.historyCache.getCacheStats(),
      sessions: await this.sessionCache.getCacheStats()
    };
  }

  /**
   * Bulk invalidate user cache (for user deletion/updates)
   */
  async invalidateAllUserCache(userId: string): Promise<void> {
    await Promise.all([
      this.preferencesCache.invalidate(userId),
      this.historyCache.invalidatePattern(`${userId}:*`),
      this.sessionCache.invalidatePattern(`sessions:${userId}:*`)
    ]);
    
    logger.info(`Invalidated all cache for user ${userId}`);
  }
}

// Export singleton instance
export const userPreferencesCache = new UserPreferencesCache();
export default userPreferencesCache;