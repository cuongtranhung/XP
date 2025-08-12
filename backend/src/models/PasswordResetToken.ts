// PostgreSQL password reset token model
import crypto from 'crypto';
import { Pool } from 'pg';
import { getDatabaseConfig } from '../utils/database';

interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
  used_at?: Date;
}

export class PasswordResetTokenModel {
  private static pool: Pool;

  static getPool(): Pool {
    if (!this.pool) {
      this.pool = new Pool(getDatabaseConfig());
    }
    return this.pool;
  }

  static async create(userId: string): Promise<{ token: string }> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + parseInt(process.env.RESET_TOKEN_EXPIRY ?? '3600000'));
      
      // Remove any existing unused token for this user
      await client.query(
        'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
        [userId]
      );
      
      // Create new token
      await client.query(`
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
      `, [userId, token, expiresAt]);

      return { token };
    } catch (error) {
      console.error('Error creating password reset token:', error);
      throw new Error('Database insert failed');
    } finally {
      client.release();
    }
  }

  static async findByToken(token: string): Promise<PasswordResetToken | null> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT * FROM password_reset_tokens 
        WHERE token = $1 
        AND expires_at > CURRENT_TIMESTAMP 
        AND used_at IS NULL
      `, [token]);
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error finding password reset token:', error);
      throw new Error('Database query failed');
    } finally {
      client.release();
    }
  }

  static async markAsUsed(token: string): Promise<void> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = $1',
        [token]
      );
    } catch (error) {
      console.error('Error marking token as used:', error);
      throw new Error('Database update failed');
    } finally {
      client.release();
    }
  }

  static async delete(token: string): Promise<void> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query(
        'DELETE FROM password_reset_tokens WHERE token = $1',
        [token]
      );
    } catch (error) {
      console.error('Error deleting password reset token:', error);
      throw new Error('Database delete failed');
    } finally {
      client.release();
    }
  }

  static async cleanupExpiredTokens(): Promise<number> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      const result = await client.query(
        'DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP'
      );
      
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      throw new Error('Database cleanup failed');
    } finally {
      client.release();
    }
  }

  // Cleanup method to close pool connections
  static async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}