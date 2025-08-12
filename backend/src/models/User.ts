// PostgreSQL user model
import { query, getClient } from '../utils/database';

interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  email_verified: boolean;
  email_verification_token?: string;
  email_verification_expires?: Date;
  avatar_url?: string;
  date_of_birth?: Date;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
}

interface CreateUserData {
  email: string;
  password_hash: string;
  full_name: string;
  email_verified: boolean;
  email_verification_token?: string;
  email_verification_expires?: Date;
}

export class UserModel {
  
  static async findByEmail(email: string): Promise<User | null> {
    try {
      // Input validation
      if (!email || typeof email !== 'string') {
        throw new Error('Invalid email parameter');
      }

      const result = await query(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
        [email.trim()]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      console.error('Error finding user by email:', {
        email: email?.substring(0, 3) + '***',
        error: error.message,
        code: error.code
      });
      
      // Re-throw with user-friendly message
      if (error.code === '42P01') {
        throw new Error('Database schema not initialized. Please run migrations.');
      }
      throw new Error('Database query failed');
    }
  }

  static async findById(id: string): Promise<User | null> {
    try {
      // Input validation
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid ID parameter');
      }

      const result = await query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      console.error('Error finding user by ID:', {
        id: id?.substring(0, 8) + '***',
        error: error.message,
        code: error.code
      });
      throw new Error('Database query failed');
    }
  }

  static async findByIdSafe(id: string): Promise<Omit<User, 'password_hash'> | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid ID parameter');
      }

      const result = await query(
        'SELECT id, email, full_name, email_verified, avatar_url, date_of_birth, created_at, updated_at, last_login FROM users WHERE id = $1',
        [id]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      console.error('Error finding user by ID (safe):', {
        id: id?.substring(0, 8) + '***',
        error: error.message
      });
      throw new Error('Database query failed');
    }
  }

  static async create(userData: CreateUserData): Promise<User> {
    // Input validation
    if (!userData.email || !userData.password_hash || !userData.full_name) {
      throw new Error('Missing required user data');
    }

    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      // Double-check for existing user in transaction
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1 FOR UPDATE',
        [userData.email.toLowerCase().trim()]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      const result = await client.query(`
        INSERT INTO users (
          email, 
          password_hash, 
          full_name, 
          email_verified,
          email_verification_token,
          email_verification_expires
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        userData.email.toLowerCase().trim(),
        userData.password_hash,
        userData.full_name.trim(),
        userData.email_verified,
        userData.email_verification_token || null,
        userData.email_verification_expires || null
      ]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error: any) {
      await client.query('ROLLBACK');
      
      console.error('Error creating user:', {
        email: userData.email?.substring(0, 3) + '***',
        error: error.message,
        code: error.code
      });
      
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('User with this email already exists');
      }
      if (error.message.includes('already exists')) {
        throw error; // Re-throw our custom message
      }
      throw new Error('Database insert failed');
    } finally {
      client.release();
    }
  }

  static async updateLastLogin(userId: string): Promise<void> {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }

      await query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
    } catch (error: any) {
      console.error('Error updating last login:', {
        userId: userId?.substring(0, 8) + '***',
        error: error.message
      });
      throw new Error('Database update failed');
    }
  }

  static async updatePassword(userId: string, passwordHash: string): Promise<void> {
    try {
      if (!userId || !passwordHash) {
        throw new Error('Invalid parameters for password update');
      }

      const result = await query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('User not found');
      }
    } catch (error: any) {
      console.error('Error updating password:', {
        userId: userId?.substring(0, 8) + '***',
        error: error.message
      });
      throw new Error('Database update failed');
    }
  }

  static async updateEmailVerification(userId: string, verified: boolean): Promise<void> {
    try {
      if (!userId || typeof verified !== 'boolean') {
        throw new Error('Invalid parameters for email verification update');
      }

      const result = await query(`
        UPDATE users 
        SET email_verified = $1, 
            email_verification_token = NULL,
            email_verification_expires = NULL,
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2
      `, [verified, userId]);

      if (result.rowCount === 0) {
        throw new Error('User not found');
      }
    } catch (error: any) {
      console.error('Error updating email verification:', {
        userId: userId?.substring(0, 8) + '***',
        verified,
        error: error.message
      });
      throw new Error('Database update failed');
    }
  }

  static async findByVerificationToken(token: string): Promise<User | null> {
    try {
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid verification token');
      }

      const result = await query(`
        SELECT * FROM users 
        WHERE email_verification_token = $1 
        AND email_verification_expires > CURRENT_TIMESTAMP
      `, [token]);
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      console.error('Error finding user by verification token:', {
        token: token?.substring(0, 8) + '***',
        error: error.message
      });
      throw new Error('Database query failed');
    }
  }

  // Update verification token
  static async updateVerificationToken(
    userId: string, 
    token: string, 
    expires: Date
  ): Promise<void> {
    try {
      if (!userId || !token || !expires) {
        throw new Error('Invalid parameters for verification token update');
      }

      const result = await query(`
        UPDATE users 
        SET email_verification_token = $1,
            email_verification_expires = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [token, expires, userId]);

      if (result.rowCount === 0) {
        throw new Error('User not found');
      }
    } catch (error: any) {
      console.error('Error updating verification token:', {
        userId: userId?.substring(0, 8) + '***',
        expires: expires?.toISOString(),
        error: error.message
      });
      throw new Error('Database update failed');
    }
  }

  // Mark email as verified
  static async markEmailAsVerified(userId: string): Promise<void> {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }

      const result = await query(`
        UPDATE users 
        SET email_verified = true,
            email_verification_token = NULL,
            email_verification_expires = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId]);

      if (result.rowCount === 0) {
        throw new Error('User not found');
      }
    } catch (error: any) {
      console.error('Error marking email as verified:', {
        userId: userId?.substring(0, 8) + '***',
        error: error.message
      });
      throw new Error('Database update failed');
    }
  }

  // Update user profile information
  static async updateProfile(userId: string, profileData: { full_name?: string; email?: string; avatar_url?: string; date_of_birth?: string }): Promise<User | null> {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }

      if (!profileData.full_name && !profileData.email && profileData.avatar_url === undefined && !profileData.date_of_birth) {
        throw new Error('No profile data provided for update');
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (profileData.full_name) {
        updateFields.push(`full_name = $${paramIndex}`);
        updateValues.push(profileData.full_name.trim());
        paramIndex++;
      }

      if (profileData.email) {
        updateFields.push(`email = $${paramIndex}`);
        updateValues.push(profileData.email.toLowerCase().trim());
        paramIndex++;
      }

      if (profileData.avatar_url !== undefined) {
        updateFields.push(`avatar_url = $${paramIndex}`);
        updateValues.push(profileData.avatar_url);
        paramIndex++;
      }

      if (profileData.date_of_birth) {
        updateFields.push(`date_of_birth = $${paramIndex}`);
        updateValues.push(profileData.date_of_birth);
        paramIndex++;
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(userId);

      const result = await query(`
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, email, full_name, email_verified, avatar_url, date_of_birth, created_at, updated_at, last_login
      `, updateValues);

      if (result.rowCount === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } catch (error: any) {
      console.error('Error updating user profile:', {
        userId: userId?.substring(0, 8) + '***',
        profileData: { 
          hasFullName: !!profileData.full_name,
          hasEmail: !!profileData.email,
          hasAvatar: !!profileData.avatar_url,
          hasDateOfBirth: !!profileData.date_of_birth
        },
        error: error.message
      });
      
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Email already exists');
      }
      throw new Error('Database update failed');
    }
  }

  // Health check method
  static async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await query('SELECT 1');
      return { healthy: true, message: 'Database connection healthy' };
    } catch (error: any) {
      return { healthy: false, message: `Database connection failed: ${error.message}` };
    }
  }
}