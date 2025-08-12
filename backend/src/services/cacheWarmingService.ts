import cacheService from './cacheService';
import { logger } from '../utils/logger';
import { pool } from '../config/database';

/**
 * Cache Warming Service
 * Pre-loads frequently accessed data into cache for optimal performance
 */
class CacheWarmingService {
  private isWarming: boolean = false;
  private warmingInterval: NodeJS.Timeout | null = null;

  /**
   * Start cache warming process
   */
  async startWarming(): Promise<void> {
    if (this.isWarming) {
      logger.warn('Cache warming already in progress');
      return;
    }

    try {
      this.isWarming = true;
      logger.info('🔥 Starting cache warming process...');

      // Initial warming
      await this.warmCache();

      // Schedule periodic warming (every 30 minutes)
      this.warmingInterval = setInterval(() => {
        this.warmCache().catch(err => {
          logger.error('Cache warming error:', err);
        });
      }, 30 * 60 * 1000); // 30 minutes

      logger.info('✅ Cache warming completed successfully');
    } catch (error) {
      logger.error('❌ Cache warming failed:', error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Stop cache warming process
   */
  stopWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
      logger.info('Cache warming stopped');
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  private async warmCache(): Promise<void> {
    const startTime = Date.now();
    let warmedCount = 0;

    try {
      // Warm active users data
      warmedCount += await this.warmActiveUsers();

      // Warm popular forms
      warmedCount += await this.warmPopularForms();

      // Warm system configurations
      warmedCount += await this.warmSystemConfigs();

      // Warm recent sessions
      warmedCount += await this.warmRecentSessions();

      const duration = Date.now() - startTime;
      logger.info(`🔥 Cache warmed with ${warmedCount} items in ${duration}ms`);

    } catch (error) {
      logger.error('Cache warming error:', error);
      throw error;
    }
  }

  /**
   * Warm active users cache
   */
  private async warmActiveUsers(): Promise<number> {
    try {
      // Get active users from last 24 hours
      const result = await pool.query(`
        SELECT u.id, u.email, u.full_name, u.role_id, u.is_active,
               r.name as role_name, r.permissions
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.last_login > NOW() - INTERVAL '24 hours'
          AND u.is_active = true
        LIMIT 100
      `);

      let count = 0;
      for (const user of result.rows) {
        const cacheKey = `user:${user.id}`;
        await cacheService.set(cacheKey, user, { ttl: 3600 }); // 1 hour TTL
        count++;
      }

      logger.debug(`Warmed ${count} active users`);
      return count;

    } catch (error) {
      logger.error('Error warming active users:', error);
      return 0;
    }
  }

  /**
   * Warm popular forms cache
   */
  private async warmPopularForms(): Promise<number> {
    try {
      // Get most accessed forms
      const result = await pool.query(`
        SELECT f.*, 
               COUNT(fs.id) as submission_count
        FROM dynamic_forms f
        LEFT JOIN form_submissions fs ON f.id = fs.form_id
        WHERE f.status = 'published'
          AND f.created_at > NOW() - INTERVAL '30 days'
        GROUP BY f.id
        ORDER BY submission_count DESC
        LIMIT 50
      `);

      let count = 0;
      for (const form of result.rows) {
        const cacheKey = `form:${form.id}`;
        await cacheService.set(cacheKey, form, { ttl: 7200 }); // 2 hour TTL
        count++;

        // Also cache form schema
        if (form.schema) {
          const schemaKey = `form:schema:${form.id}`;
          await cacheService.set(schemaKey, form.schema, { ttl: 7200 });
        }
      }

      logger.debug(`Warmed ${count} popular forms`);
      return count;

    } catch (error) {
      logger.error('Error warming popular forms:', error);
      return 0;
    }
  }

  /**
   * Warm system configurations cache
   */
  private async warmSystemConfigs(): Promise<number> {
    try {
      const configs = {
        app_settings: {
          max_file_size: process.env.MAX_FILE_SIZE || '10485760',
          allowed_file_types: process.env.ALLOWED_FILE_TYPES || 'image/*,application/pdf',
          rate_limits: {
            login: process.env.LOGIN_RATE_LIMIT || '50',
            register: process.env.REGISTER_RATE_LIMIT || '30',
            api: process.env.GENERAL_RATE_LIMIT || '1000'
          }
        },
        features: {
          collaboration: process.env.FEATURE_COLLABORATION === 'true',
          file_upload: process.env.FEATURE_FILE_UPLOAD === 'true',
          webhooks: process.env.FEATURE_WEBHOOKS === 'true',
          analytics: process.env.FEATURE_ANALYTICS === 'true',
          versioning: process.env.FEATURE_VERSIONING === 'true'
        },
        cache_config: {
          enabled: process.env.REDIS_ENABLED === 'true',
          ttl: {
            default: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
            user: parseInt(process.env.CACHE_USER_TTL || '600'),
            form: parseInt(process.env.CACHE_FORM_TTL || '3600'),
            session: parseInt(process.env.CACHE_SESSION_TTL || '1800')
          }
        }
      };

      await cacheService.set('system:config', configs, { ttl: 86400 }); // 24 hour TTL
      
      logger.debug('Warmed system configurations');
      return 1;

    } catch (error) {
      logger.error('Error warming system configs:', error);
      return 0;
    }
  }

  /**
   * Warm recent sessions cache
   */
  private async warmRecentSessions(): Promise<number> {
    try {
      // Get recent active sessions
      const result = await pool.query(`
        SELECT s.*, u.email, u.full_name
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.expires_at > NOW()
          AND s.is_active = true
        ORDER BY s.last_activity DESC
        LIMIT 100
      `);

      let count = 0;
      for (const session of result.rows) {
        const cacheKey = `session:${session.session_token}`;
        await cacheService.set(cacheKey, session, { ttl: 1800 }); // 30 min TTL
        count++;
      }

      logger.debug(`Warmed ${count} recent sessions`);
      return count;

    } catch (error) {
      logger.error('Error warming recent sessions:', error);
      return 0;
    }
  }

  /**
   * Warm specific user cache
   */
  async warmUserCache(userId: number): Promise<void> {
    try {
      // Get user data with roles and permissions
      const userResult = await pool.query(`
        SELECT u.*, r.name as role_name, r.permissions
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `, [userId]);

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        await cacheService.set(`user:${userId}`, user, { ttl: 3600 });

        // Also warm user's recent forms
        const formsResult = await pool.query(`
          SELECT * FROM dynamic_forms
          WHERE created_by = $1
          ORDER BY updated_at DESC
          LIMIT 10
        `, [userId]);

        for (const form of formsResult.rows) {
          await cacheService.set(`form:${form.id}`, form, { ttl: 3600 });
        }

        logger.debug(`Warmed cache for user ${userId}`);
      }

    } catch (error) {
      logger.error(`Error warming cache for user ${userId}:`, error);
    }
  }

  /**
   * Get cache warming statistics
   */
  async getWarmingStats(): Promise<{
    isWarming: boolean;
    lastWarmed?: Date;
    nextWarming?: Date;
    cacheStats: any;
  }> {
    const stats = await cacheService.getCacheStats();
    
    return {
      isWarming: this.isWarming,
      cacheStats: stats
    };
  }

  /**
   * Clear and re-warm cache
   */
  async refreshCache(): Promise<void> {
    logger.info('🔄 Refreshing cache...');
    
    // Note: Be careful with clearing all cache in production
    // You might want to clear specific patterns instead
    
    // Re-warm cache
    await this.warmCache();
    
    logger.info('✅ Cache refreshed successfully');
  }
}

// Export singleton instance
export default new CacheWarmingService();