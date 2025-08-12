import { Pool } from 'pg';
import { User } from '../types/auth';
import crypto from 'crypto';

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.pool.query(query, [email]);
    return result.rows[0] || null;
  }

  async getUserById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async createUser(userData: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<User> {
    const id = crypto.randomUUID();
    const query = `
      INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;
    const values = [id, userData.email, userData.passwordHash, userData.name, false];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async updateLastLogin(userId: string): Promise<void> {
    const query = 'UPDATE users SET last_login = NOW() WHERE id = $1';
    await this.pool.query(query, [userId]);
  }

  async createPasswordResetToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + parseInt(process.env.RESET_TOKEN_EXPIRY ?? '3600000'));
    
    const query = `
      INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()
    `;
    await this.pool.query(query, [userId, token, expiresAt]);
    
    return token;
  }

  async getUserByResetToken(token: string): Promise<string | null> {
    const query = `
      SELECT user_id FROM password_reset_tokens
      WHERE token = $1 AND expires_at > NOW()
    `;
    const result = await this.pool.query(query, [token]);
    return result.rows[0]?.user_id || null;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const query = 'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2';
    await this.pool.query(query, [passwordHash, userId]);
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    const query = 'DELETE FROM password_reset_tokens WHERE token = $1';
    await this.pool.query(query, [token]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}