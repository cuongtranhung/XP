import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../models/User';
import { PasswordResetTokenModel } from '../models/PasswordResetToken';
import { UserSessionModel } from '../models/UserSession';
import { SessionService } from './sessionService';
import { emailService } from './emailService';

interface RegisterData {
  email: string;
  password: string;
  name: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    token: string;
    user: {
      id: string;
      email: string;
      name: string;
      emailVerified: boolean;
      email_verified?: boolean; // For frontend compatibility
      full_name?: string; // For frontend compatibility
      created_at?: string; // For frontend compatibility
      updated_at?: string; // For frontend compatibility
      last_login?: string; // For frontend compatibility
    };
  };
  sessionId?: string;
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || (() => {
    throw new Error('JWT_SECRET environment variable is required for security');
  })();
  private static readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '24h';
  private static readonly BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12');

  // Generate JWT token
  private static generateToken(payload: any, sessionId?: string): string {
    // Ensure userId is always a string
    if (payload.userId && typeof payload.userId !== 'string') {
      payload.userId = String(payload.userId);
    }
    
    // Add sessionId to payload if provided
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    
    return jwt.sign(payload, this.JWT_SECRET, { 
      expiresIn: this.JWT_EXPIRES_IN,
      issuer: 'fullstack-auth-app',
      audience: 'fullstack-auth-users'
    } as jwt.SignOptions);
  }

  // Generate email verification token
  private static generateVerificationToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  // Register a new user
  static async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const { email, password, name } = userData;

      // Check if user already exists
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return {
          success: false,
          message: 'User with this email already exists'
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

      // Generate email verification token
      const verificationToken = this.generateVerificationToken();
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user with verification token
      const user = await UserModel.create({
        email,
        password_hash: passwordHash,
        full_name: name,
        email_verified: false,
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires
      });

      // Generate session ID and JWT token
      const sessionId = uuidv4();
      const token = this.generateToken({
        userId: user.id,
        email: user.email
      }, sessionId);

      // Send email verification email
      try {
        await emailService.sendEmailVerificationEmail(email, name, verificationToken);
      } catch (emailError) {
        console.warn('Failed to send email verification:', emailError);
      }

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(email, name);
      } catch (emailError) {
        console.warn('Failed to send welcome email:', emailError);
      }

      return {
        success: true,
        sessionId, // Include session ID in response
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.full_name,
            emailVerified: user.email_verified,
            email_verified: user.email_verified, // For frontend compatibility
            full_name: user.full_name, // For frontend compatibility
            ...(user.created_at && { created_at: user.created_at.toISOString() }),
            ...(user.updated_at && { updated_at: user.updated_at.toISOString() }),
            ...(user.last_login && { last_login: user.last_login.toISOString() })
          }
        }
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'Failed to register user'
      };
    }
  }

  // Login user
  static async login(credentials: LoginCredentials, req?: any): Promise<AuthResponse> {
    try {
      const { email, password } = credentials;

      // Find user by email
      const user = await UserModel.findByEmail(email);
      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Update last login
      await UserModel.updateLastLogin(user.id);

      // Generate session ID and JWT token
      const sessionId = uuidv4();
      const token = this.generateToken({
        userId: user.id,
        email: user.email
      }, sessionId);

      // Create secure session record using SessionService
      try {
        const { sessionId: secureSessionId } = await SessionService.createSecureSession(
          parseInt(user.id),
          req,
          { loginMethod: 'email_password' }
        );
        
        // Update sessionId and token with the secure session ID
        const newToken = this.generateToken({
          userId: user.id,
          email: user.email
        }, secureSessionId);
        
        return {
          success: true,
          sessionId: secureSessionId,
          data: {
            token: newToken,
            user: {
              id: user.id,
              email: user.email,
              name: user.full_name,
              emailVerified: user.email_verified,
              email_verified: user.email_verified,
              full_name: user.full_name,
              ...(user.created_at && { created_at: user.created_at.toISOString() }),
              ...(user.updated_at && { updated_at: user.updated_at.toISOString() }),
              ...(user.last_login && { last_login: user.last_login.toISOString() })
            }
          }
        };
      } catch (sessionError) {
        console.warn('Failed to create secure session, falling back to basic session:', sessionError);
        
        // Fallback to basic session creation
        try {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await UserSessionModel.create({
            id: sessionId,
            user_id: parseInt(user.id),
            expires_at: expiresAt,
            ip_address: req ? this.getClientIP(req) : null,
            user_agent: req ? req.get('User-Agent') : null,
            metadata: {
              loginMethod: 'email_password',
              timestamp: new Date().toISOString()
            }
          });
        } catch (fallbackError) {
          console.warn('Basic session creation also failed:', fallbackError);
        }
      }

      return {
        success: true,
        sessionId, // Include session ID in response
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.full_name,
            emailVerified: user.email_verified,
            email_verified: user.email_verified, // For frontend compatibility
            full_name: user.full_name, // For frontend compatibility
            ...(user.created_at && { created_at: user.created_at.toISOString() }),
            ...(user.updated_at && { updated_at: user.updated_at.toISOString() }),
            ...(user.last_login && { last_login: user.last_login.toISOString() })
          }
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed'
      };
    }
  }

  // Forgot password
  static async forgotPassword(email: string): Promise<AuthResponse> {
    try {
      const user = await UserModel.findByEmail(email);
      
      // Don't reveal if user exists or not (security practice)
      if (!user) {
        return {
          success: true,
          message: 'Password reset instructions sent to your email'
        };
      }

      // Generate reset token
      const resetTokenData = await PasswordResetTokenModel.create(user.id);

      // Send password reset email
      try {
        await emailService.sendPasswordResetEmail(
          email,
          user.full_name,
          resetTokenData.token
        );
      } catch (emailError) {
        console.warn('Failed to send password reset email:', emailError);
      }

      return {
        success: true,
        message: 'Password reset instructions sent to your email'
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        message: 'Failed to process password reset request'
      };
    }
  }

  // Reset password
  static async resetPassword(token: string, newPassword: string): Promise<AuthResponse> {
    try {
      // Find valid reset token
      const resetToken = await PasswordResetTokenModel.findByToken(token);
      if (!resetToken) {
        return {
          success: false,
          message: 'Invalid or expired reset token'
        };
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

      // Update user password
      await UserModel.updatePassword(resetToken.user_id, passwordHash);

      // Delete used token
      await PasswordResetTokenModel.delete(token);

      return {
        success: true,
        message: 'Password reset successful'
      };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        message: 'Failed to reset password'
      };
    }
  }

  // Validate token
  static async validateToken(token: string): Promise<AuthResponse> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;
      
      const user = await UserModel.findById(decoded.userId);
      if (!user) {
        return {
          success: false,
          message: 'Invalid token'
        };
      }

      return {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.full_name,
            emailVerified: user.email_verified,
            email_verified: user.email_verified, // For frontend compatibility
            full_name: user.full_name, // For frontend compatibility
            ...(user.created_at && { created_at: user.created_at.toISOString() }),
            ...(user.updated_at && { updated_at: user.updated_at.toISOString() }),
            ...(user.last_login && { last_login: user.last_login.toISOString() })
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Invalid token'
      };
    }
  }

  // Verify token and return payload
  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Helper method to get client IP
  private static getClientIP(req: any): string {
    return (
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  // Verify email with token
  static async verifyEmail(token: string): Promise<AuthResponse> {
    try {
      const user = await UserModel.findByVerificationToken(token);
      
      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired verification token'
        };
      }

      // Mark email as verified
      await UserModel.markEmailAsVerified(user.id);

      return {
        success: true,
        message: 'Email verified successfully'
      };
    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        message: 'Failed to verify email'
      };
    }
  }

  // Resend email verification
  static async resendEmailVerification(email: string): Promise<AuthResponse> {
    try {
      const user = await UserModel.findByEmail(email);
      
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      if (user.email_verified) {
        return {
          success: false,
          message: 'Email is already verified'
        };
      }

      // Generate new verification token
      const verificationToken = this.generateVerificationToken();
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with new token
      await UserModel.updateVerificationToken(user.id, verificationToken, verificationExpires);

      // Send verification email
      try {
        await emailService.sendEmailVerificationEmail(email, user.full_name, verificationToken);
      } catch (emailError) {
        console.warn('Failed to send email verification:', emailError);
        return {
          success: false,
          message: 'Failed to send verification email'
        };
      }

      return {
        success: true,
        message: 'Verification email sent successfully'
      };
    } catch (error) {
      console.error('Resend verification error:', error);
      return {
        success: false,
        message: 'Failed to resend verification email'
      };
    }
  }
}