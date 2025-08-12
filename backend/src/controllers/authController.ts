import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { UserModel } from '../models/User';
import bcrypt from 'bcryptjs';
import { MinimalActivityLogger } from '../services/minimalActivityLogger';
import { UserSessionModel } from '../models/UserSession';

// Helper function to format date without timezone issues
const formatDateForResponse = (date: Date): string => {
  // Use getFullYear(), getMonth(), getDate() to avoid timezone conversion
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export class AuthController {
  // Register a new user
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, fullName } = req.body;
      
      // Basic validation
      if (!email || !password || !fullName) {
        res.status(400).json({
          success: false,
          message: 'Email, password, and full name are required'
        });
        return;
      }

      const result = await AuthService.register({ email, password, name: fullName });

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Registration controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration'
      });
    }
  }

  // Login user
  static async login(req: Request, res: Response): Promise<void> {
    req.startTime = Date.now(); // Start timing for activity logging
    
    try {
      const { email, password } = req.body;
      
      // Basic validation
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
        return;
      }

      const result = await AuthService.login({ email, password }, req);

      if (result.success) {
        // Use session ID from service result and log successful login
        const sessionId = (result as any).sessionId;
        if (result.data?.user?.id && sessionId) {
          const userId = parseInt(result.data.user.id);
          MinimalActivityLogger.logLogin(userId, sessionId, req);
        }
        res.status(200).json(result);
      } else {
        // Log failed login
        MinimalActivityLogger.logFailedLogin(email, req, 'invalid_credentials');
        res.status(401).json(result);
      }
    } catch (error) {
      console.error('Login controller error:', error);
      // Log failed login due to error
      MinimalActivityLogger.logFailedLogin(req.body?.email || 'unknown', req, 'server_error');
      res.status(500).json({
        success: false,
        message: 'Internal server error during login'
      });
    }
  }

  // Forgot password
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      
      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required'
        });
        return;
      }

      const result = await AuthService.forgotPassword(email);
      res.status(200).json(result);
    } catch (error) {
      console.error('Forgot password controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password reset request'
      });
    }
  }

  // Reset password
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Token and new password are required'
        });
        return;
      }

      const result = await AuthService.resetPassword(token, newPassword);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Reset password controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password reset'
      });
    }
  }

  // Validate token
  static async validateToken(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'No token provided'
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const result = await AuthService.validateToken(token);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(401).json(result);
      }
    } catch (error) {
      console.error('Token validation controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during token validation'
      });
    }
  }

  // Logout (client-side operation, but we can provide an endpoint)
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // Extract user info for logging
      const userId = req.userId;
      const sessionId = req.sessionId;
      
      // Log logout activity and deactivate session if user is authenticated
      if (userId && sessionId) {
        MinimalActivityLogger.logLogout(userId, sessionId);
        
        // Deactivate the session in database
        try {
          await UserSessionModel.deactivate(sessionId, 'USER_LOGOUT');
        } catch (sessionError) {
          console.warn('Failed to deactivate session:', sessionError);
        }
      }
      
      // In JWT authentication, logout is typically handled client-side
      // by removing the token from storage
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during logout'
      });
    }
  }

  // Health check endpoint
  static async healthCheck(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Auth service is healthy',
      timestamp: new Date().toISOString()
    });
  }

  // Verify reset token
  static async verifyResetToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      
      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Token is required'
        });
        return;
      }

      // Here you would verify the token against your token storage
      // For now, we'll just check if it's a valid format
      if (token.length < 10) {
        res.status(400).json({
          success: false,
          message: 'Invalid token format'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Token is valid'
      });
    } catch (error) {
      console.error('Verify reset token error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get current user
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      // The user should be attached to req by auth middleware
      const user = req.user;
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const userData = await UserModel.findByIdSafe(String(user.id));
      
      if (!userData) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: userData.id,
            email: userData.email,
            name: userData.full_name,
            emailVerified: userData.email_verified,
            email_verified: userData.email_verified, // For frontend compatibility
            full_name: userData.full_name, // For frontend compatibility
            avatar_url: userData.avatar_url,
            date_of_birth: userData.date_of_birth ? formatDateForResponse(userData.date_of_birth) : null,
            ...(userData.created_at && { created_at: userData.created_at.toISOString() }),
            ...(userData.updated_at && { updated_at: userData.updated_at.toISOString() }),
            ...(userData.last_login && { last_login: userData.last_login.toISOString() })
          }
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update user profile
  static async updateProfile(req: Request, res: Response): Promise<void> {
    req.startTime = Date.now(); // Start timing for activity logging
    
    try {
      const user = req.user;
      const { fullName, email, avatarUrl, dateOfBirth } = req.body;
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Validate input
      if (!fullName && !email && avatarUrl === undefined && !dateOfBirth) {
        res.status(400).json({
          success: false,
          message: 'At least one field (fullName, email, avatarUrl, or dateOfBirth) is required'
        });
        return;
      }

      // Validate fullName if provided
      if (fullName && (typeof fullName !== 'string' || fullName.trim().length < 1)) {
        res.status(400).json({
          success: false,
          message: 'Full name must be a non-empty string'
        });
        return;
      }

      // Check for protected users - prevent email changes for test accounts
      const protectedEmails = ['cuongtranhung@gmail.com', 'cphvt2017@gmail.com'];
      if (email && protectedEmails.includes(user.email) && email !== user.email) {
        res.status(403).json({
          success: false,
          message: 'Email cannot be changed for this test account'
        });
        return;
      }

      // Validate email if provided
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof email !== 'string' || !emailRegex.test(email)) {
          res.status(400).json({
            success: false,
            message: 'Please provide a valid email address'
          });
          return;
        }
      }

      // Validate avatarUrl if provided
      if (avatarUrl !== undefined) {
        if (avatarUrl !== null && typeof avatarUrl !== 'string') {
          res.status(400).json({
            success: false,
            message: 'Avatar URL must be a string or null'
          });
          return;
        }

        if (avatarUrl && avatarUrl.length > 100000) {
          res.status(400).json({
            success: false,
            message: 'Avatar URL must not exceed 100,000 characters'
          });
          return;
        }
      }

      // Validate dateOfBirth if provided
      if (dateOfBirth) {
        if (typeof dateOfBirth !== 'string') {
          res.status(400).json({
            success: false,
            message: 'Date of birth must be a string'
          });
          return;
        }

        // Validate YYYY-MM-DD format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateOfBirth)) {
          res.status(400).json({
            success: false,
            message: 'Date of birth must be in YYYY-MM-DD format'
          });
          return;
        }

        // Validate it's a real date
        const dateObj = new Date(dateOfBirth);
        if (isNaN(dateObj.getTime()) || dateObj.toISOString().split('T')[0] !== dateOfBirth) {
          res.status(400).json({
            success: false,
            message: 'Please provide a valid date of birth'
          });
          return;
        }

        // Check if date is reasonable (not in future, not too old)
        const today = new Date();
        const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
        
        if (dateObj > today) {
          res.status(400).json({
            success: false,
            message: 'Date of birth cannot be in the future'
          });
          return;
        }

        if (dateObj < minDate) {
          res.status(400).json({
            success: false,
            message: 'Please provide a valid date of birth'
          });
          return;
        }
      }

      const profileData: { full_name?: string; email?: string; avatar_url?: string; date_of_birth?: string } = {};
      if (fullName) {profileData.full_name = fullName;}
      if (email) {profileData.email = email;}
      if (avatarUrl !== undefined) {profileData.avatar_url = avatarUrl;}
      if (dateOfBirth) {profileData.date_of_birth = dateOfBirth;}

      const updatedUser = await UserModel.updateProfile(user.id, profileData);
      
      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Log profile update activity
      // const updatedFields = Object.keys(profileData); // Commented - not used yet
      // Use sessionId from req (added by auth middleware)

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.full_name,
            emailVerified: updatedUser.email_verified,
            email_verified: updatedUser.email_verified, // For frontend compatibility
            full_name: updatedUser.full_name, // For frontend compatibility
            avatar_url: updatedUser.avatar_url,
            date_of_birth: updatedUser.date_of_birth ? formatDateForResponse(updatedUser.date_of_birth) : null
          }
        }
      });
    } catch (error: any) {
      console.error('Update profile error:', error);
      
      if (error.message === 'Email already exists') {
        res.status(409).json({
          success: false,
          message: 'This email is already in use by another account'
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during profile update'
      });
    }
  }

  // Change password
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = (req as any).user;
      
      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
        return;
      }

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Check for protected users - prevent password changes for test accounts
      const protectedEmails = ['cuongtranhung@gmail.com', 'cphvt2017@gmail.com'];
      if (protectedEmails.includes(user.email)) {
        res.status(403).json({
          success: false,
          message: 'Password cannot be changed for this test account'
        });
        return;
      }

      // Get full user data to verify current password
      const userData = await UserModel.findById(String(user.id));
      if (!userData) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userData.password_hash);
      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
        return;
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);
      
      // Update password
      await UserModel.updatePassword(String(user.id), newPasswordHash);

      // Log password change activity
      // Extract sessionId from user object (added by auth middleware)
      const sessionId = (user).sessionId || null;
      MinimalActivityLogger.logPasswordChange(
        user.id,
        sessionId,
        req
      );

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Verify email with token
  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      
      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
        return;
      }

      const result = await AuthService.verifyEmail(token);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during email verification'
      });
    }
  }

  // Resend email verification
  static async resendEmailVerification(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      
      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required'
        });
        return;
      }

      const result = await AuthService.resendEmailVerification(email);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during resend verification'
      });
    }
  }
}