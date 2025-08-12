import { query, getClient } from '../utils/database';

export interface UserSessionData {
  id: string;
  user_id: number;
  created_at: Date;
  last_activity?: Date;
  expires_at: Date;
  ip_address?: string | null;
  user_agent?: string;
  browser_info?: any;
  location_info?: any;
  is_active?: boolean;
  deactivated_at?: Date;
  deactivation_reason?: string;
  logout_reason?: string;
  metadata?: any;
}

export class UserSessionModel {
  static async create(sessionData: Partial<UserSessionData>): Promise<UserSessionData | null> {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `INSERT INTO user_sessions (
          id, user_id, expires_at, ip_address, user_agent, 
          browser_info, location_info, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          sessionData.id,
          sessionData.user_id,
          sessionData.expires_at,
          sessionData.ip_address || null,
          sessionData.user_agent || null,
          sessionData.browser_info ? JSON.stringify(sessionData.browser_info) : null,
          sessionData.location_info ? JSON.stringify(sessionData.location_info) : null,
          sessionData.metadata ? JSON.stringify(sessionData.metadata) : null
        ]
      );
      
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating user session:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(sessionId: string): Promise<UserSessionData | null> {
    try {
      const result = await query(
        'SELECT * FROM user_sessions WHERE id = $1',
        [sessionId]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error finding session by ID:', error);
      throw error;
    }
  }

  static async updateActivity(sessionId: string): Promise<boolean> {
    try {
      const result = await query(
        'UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = $1 AND is_active = true',
        [sessionId]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error updating session activity:', error);
      return false;
    }
  }

  static async deactivate(sessionId: string, deactivationReason: string = 'USER_LOGOUT'): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE user_sessions 
         SET is_active = false, 
             deactivated_at = CURRENT_TIMESTAMP,
             deactivation_reason = $2 
         WHERE id = $1`,
        [sessionId, deactivationReason]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deactivating session:', error);
      return false;
    }
  }

  static async findActiveByUserId(userId: number): Promise<UserSessionData[]> {
    try {
      const result = await query(
        'SELECT * FROM user_sessions WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error finding active sessions for user:', error);
      return [];
    }
  }

  static async deactivateAllUserSessions(userId: number, logoutReason: string = 'FORCED'): Promise<number> {
    try {
      const result = await query(
        'UPDATE user_sessions SET is_active = false, logout_reason = $2 WHERE user_id = $1 AND is_active = true',
        [userId, logoutReason]
      );
      
      return result.rowCount;
    } catch (error) {
      console.error('Error deactivating all user sessions:', error);
      return 0;
    }
  }

  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await query(
        'UPDATE user_sessions SET is_active = false, deactivation_reason = $1 WHERE expires_at < CURRENT_TIMESTAMP AND is_active = true',
        ['EXPIRED']
      );
      
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  /**
   * Clean up old sessions (older than 7 days)
   */
  static async cleanup(): Promise<{ deletedCount: number }> {
    const client = await getClient();
    try {
      // First cleanup expired sessions
      await this.cleanupExpiredSessions();
      
      // Then delete old inactive sessions
      const result = await client.query(
        `DELETE FROM user_sessions 
         WHERE is_active = false 
         AND deactivated_at < CURRENT_TIMESTAMP - INTERVAL '7 days'`
      );
      
      return { deletedCount: result.rowCount || 0 };
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      throw new Error('Failed to cleanup sessions');
    } finally {
      client.release();
    }
  }

  /**
   * Get active sessions for a user
   */
  static async getActiveSessions(userId: number): Promise<UserSessionData[]> {
    const client = await getClient();
    try {
      const result = await client.query(
        `SELECT * FROM user_sessions 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY last_activity DESC`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      throw new Error('Failed to get active sessions');
    } finally {
      client.release();
    }
  }

  /**
   * Update session metadata
   */
  static async updateMetadata(sessionId: string, metadata: any): Promise<void> {
    const client = await getClient();
    try {
      await client.query(
        `UPDATE user_sessions 
         SET metadata = $1, last_activity = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(metadata), sessionId]
      );
    } catch (error) {
      console.error('Error updating session metadata:', error);
      throw new Error('Failed to update session metadata');
    } finally {
      client.release();
    }
  }

  /**
   * Get session analytics
   */
  static async getAnalytics(userId?: number): Promise<any> {
    const client = await getClient();
    try {
      let query = `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_sessions,
          COUNT(CASE WHEN deactivation_reason = 'USER_LOGOUT' THEN 1 END) as user_logouts,
          COUNT(CASE WHEN deactivation_reason = 'EXPIRED' THEN 1 END) as expired_sessions,
          COUNT(CASE WHEN deactivation_reason = 'CONCURRENT_LIMIT_EXCEEDED' THEN 1 END) as limit_exceeded,
          AVG(EXTRACT(EPOCH FROM (COALESCE(deactivated_at, CURRENT_TIMESTAMP) - created_at)) / 3600) as avg_session_hours,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(DISTINCT user_agent) as unique_browsers
        FROM user_sessions
      `;
      
      const params: any[] = [];
      if (userId) {
        query += ' WHERE user_id = $1';
        params.push(userId);
      }
      
      const result = await client.query(query, params);
      
      // Additional queries for more detailed analytics
      const browserStats = await client.query(`
        SELECT 
          browser_info->>'name' as browser,
          COUNT(*) as count
        FROM user_sessions
        ${userId ? 'WHERE user_id = $1' : ''}
        GROUP BY browser_info->>'name'
        ORDER BY count DESC
        LIMIT 10
      `, params);
      
      const locationStats = await client.query(`
        SELECT 
          location_info->>'country' as country,
          COUNT(*) as count
        FROM user_sessions
        ${userId ? 'WHERE user_id = $1' : ''}
        GROUP BY location_info->>'country'
        ORDER BY count DESC
        LIMIT 10
      `, params);
      
      return {
        overview: result.rows[0],
        browsers: browserStats.rows,
        locations: locationStats.rows,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting session analytics:', error);
      throw new Error('Failed to get session analytics');
    } finally {
      client.release();
    }
  }
}