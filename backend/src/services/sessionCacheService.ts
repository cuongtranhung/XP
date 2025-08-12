import cacheService from './cacheService';
import cacheInvalidationService from './cacheInvalidationService';
import { logger } from '../utils/logger';
import { pool } from '../config/database';
import crypto from 'crypto';

interface UserSession {
  id: number;
  user_id: number;
  session_token: string;
  ip_address: string;
  user_agent: string;
  expires_at: Date;
  last_activity: Date;
  is_active: boolean;
  metadata?: any;
}

interface SessionUser {
  id: number;
  email: string;
  full_name: string;
  role_id: number;
  role_name?: string;
  permissions?: string[];
}

/**
 * Session Cache Service
 * Manages user sessions with Redis caching for high performance
 */
class SessionCacheService {
  private readonly SESSION_TTL = 1800; // 30 minutes
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSION_PREFIX = 'user:sessions:';

  /**
   * Create new session with caching
   */
  async createSession(userId: number, ipAddress: string, userAgent: string): Promise<string> {
    try {
      // Generate secure session token
      const sessionToken = this.generateSessionToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store in database
      const result = await pool.query(`
        INSERT INTO user_sessions (
          user_id, session_token, ip_address, user_agent, 
          expires_at, last_activity, is_active
        ) VALUES ($1, $2, $3, $4, $5, NOW(), true)
        RETURNING *
      `, [userId, sessionToken, ipAddress, userAgent, expiresAt]);

      const session = result.rows[0];

      // Cache the session
      await this.cacheSession(session);

      // Also cache user data with session
      await this.cacheUserWithSession(userId, sessionToken);

      // Update user's active sessions list
      await this.updateUserSessionsList(userId, sessionToken);

      logger.info(`Session created for user ${userId}`);
      return sessionToken;

    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Get session from cache or database
   */
  async getSession(sessionToken: string): Promise<UserSession | null> {
    try {
      const cacheKey = `${this.SESSION_PREFIX}${sessionToken}`;

      // Try cache first
      let session = await cacheService.get<UserSession>(cacheKey);
      
      if (session) {
        logger.debug('Session retrieved from cache');
        return session;
      }

      // Fallback to database
      const result = await pool.query(`
        SELECT * FROM user_sessions
        WHERE session_token = $1
          AND expires_at > NOW()
          AND is_active = true
      `, [sessionToken]);

      if (result.rows.length === 0) {
        return null;
      }

      session = result.rows[0];

      // Cache for next time
      await this.cacheSession(session);

      logger.debug('Session retrieved from database and cached');
      return session;

    } catch (error) {
      logger.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Get user data with session
   */
  async getUserWithSession(sessionToken: string): Promise<SessionUser | null> {
    try {
      const cacheKey = `${this.SESSION_PREFIX}user:${sessionToken}`;

      // Try cache first
      let user = await cacheService.get<SessionUser>(cacheKey);
      
      if (user) {
        logger.debug('User data retrieved from cache');
        return user;
      }

      // Get session first
      const session = await this.getSession(sessionToken);
      if (!session) {
        return null;
      }

      // Get user from database
      const result = await pool.query(`
        SELECT u.id, u.email, u.full_name, u.role_id,
               r.name as role_name, r.permissions
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1 AND u.is_active = true
      `, [session.user_id]);

      if (result.rows.length === 0) {
        return null;
      }

      user = result.rows[0];

      // Parse permissions if they exist
      if (user.permissions) {
        user.permissions = JSON.parse(user.permissions as any);
      }

      // Cache user data
      await cacheService.set(cacheKey, user, { ttl: this.SESSION_TTL });

      logger.debug('User data retrieved from database and cached');
      return user;

    } catch (error) {
      logger.error('Error getting user with session:', error);
      return null;
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionToken: string): Promise<void> {
    try {
      const now = new Date();

      // Update in database
      await pool.query(`
        UPDATE user_sessions
        SET last_activity = $1
        WHERE session_token = $2
      `, [now, sessionToken]);

      // Update cache
      const session = await this.getSession(sessionToken);
      if (session) {
        session.last_activity = now;
        await this.cacheSession(session);
      }

      logger.debug('Session activity updated');

    } catch (error) {
      logger.error('Error updating session activity:', error);
    }
  }

  /**
   * Invalidate session
   */
  async invalidateSession(sessionToken: string): Promise<void> {
    try {
      // Get session to find user ID
      const session = await this.getSession(sessionToken);
      
      if (session) {
        // Mark as inactive in database
        await pool.query(`
          UPDATE user_sessions
          SET is_active = false
          WHERE session_token = $1
        `, [sessionToken]);

        // Remove from cache
        await cacheService.del([
          `${this.SESSION_PREFIX}${sessionToken}`,
          `${this.SESSION_PREFIX}user:${sessionToken}`
        ]);

        // Update user's sessions list
        await this.removeFromUserSessionsList(session.user_id, sessionToken);

        logger.info(`Session invalidated: ${sessionToken}`);
      }

    } catch (error) {
      logger.error('Error invalidating session:', error);
    }
  }

  /**
   * Invalidate all user sessions
   */
  async invalidateAllUserSessions(userId: number): Promise<void> {
    try {
      // Get all active sessions
      const result = await pool.query(`
        SELECT session_token FROM user_sessions
        WHERE user_id = $1 AND is_active = true
      `, [userId]);

      // Invalidate each session
      for (const row of result.rows) {
        await this.invalidateSession(row.session_token);
      }

      // Clear user's session list cache
      await cacheService.del(`${this.USER_SESSION_PREFIX}${userId}`);

      logger.info(`All sessions invalidated for user ${userId}`);

    } catch (error) {
      logger.error('Error invalidating all user sessions:', error);
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: number): Promise<UserSession[]> {
    try {
      const cacheKey = `${this.USER_SESSION_PREFIX}${userId}`;

      // Try cache first
      let sessions = await cacheService.get<UserSession[]>(cacheKey);
      
      if (sessions) {
        logger.debug('User sessions retrieved from cache');
        return sessions;
      }

      // Get from database
      const result = await pool.query(`
        SELECT * FROM user_sessions
        WHERE user_id = $1
          AND expires_at > NOW()
          AND is_active = true
        ORDER BY last_activity DESC
      `, [userId]);

      sessions = result.rows;

      // Cache the list
      await cacheService.set(cacheKey, sessions, { ttl: 600 }); // 10 minutes

      logger.debug('User sessions retrieved from database and cached');
      return sessions;

    } catch (error) {
      logger.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      // Mark expired sessions as inactive
      const result = await pool.query(`
        UPDATE user_sessions
        SET is_active = false
        WHERE expires_at < NOW()
          AND is_active = true
        RETURNING session_token
      `);

      // Remove from cache
      for (const row of result.rows) {
        await cacheService.del([
          `${this.SESSION_PREFIX}${row.session_token}`,
          `${this.SESSION_PREFIX}user:${row.session_token}`
        ]);
      }

      logger.info(`Cleaned up ${result.rowCount} expired sessions`);

    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<any> {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_sessions,
          COUNT(CASE WHEN last_activity > NOW() - INTERVAL '5 minutes' THEN 1 END) as recent_active,
          COUNT(DISTINCT user_id) as unique_users
        FROM user_sessions
        WHERE expires_at > NOW()
      `);

      return result.rows[0];

    } catch (error) {
      logger.error('Error getting session stats:', error);
      return {};
    }
  }

  /**
   * Private helper methods
   */

  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async cacheSession(session: UserSession): Promise<void> {
    const cacheKey = `${this.SESSION_PREFIX}${session.session_token}`;
    await cacheService.set(cacheKey, session, { ttl: this.SESSION_TTL });
  }

  private async cacheUserWithSession(userId: number, sessionToken: string): Promise<void> {
    const result = await pool.query(`
      SELECT u.id, u.email, u.full_name, u.role_id,
             r.name as role_name, r.permissions
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      if (user.permissions) {
        user.permissions = JSON.parse(user.permissions);
      }
      
      const cacheKey = `${this.SESSION_PREFIX}user:${sessionToken}`;
      await cacheService.set(cacheKey, user, { ttl: this.SESSION_TTL });
    }
  }

  private async updateUserSessionsList(userId: number, sessionToken: string): Promise<void> {
    // Invalidate the cached sessions list so it's refreshed next time
    await cacheService.del(`${this.USER_SESSION_PREFIX}${userId}`);
  }

  private async removeFromUserSessionsList(userId: number, sessionToken: string): Promise<void> {
    // Invalidate the cached sessions list
    await cacheService.del(`${this.USER_SESSION_PREFIX}${userId}`);
  }
}

// Export singleton instance
export default new SessionCacheService();