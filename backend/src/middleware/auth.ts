import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { SessionService } from '../services/sessionService';
import { UserModel } from '../models/User';
import { logger } from '../utils/logger';

// Extend Request interface to include user and activity logging info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        full_name: string;
        email_verified: boolean;
        created_at: Date;
        updated_at: Date;
        last_login?: Date;
      };
      userId?: number; // For activity logging
      sessionId?: string; // For activity logging
      startTime?: number; // For performance tracking
    }
  }
}

// Authentication middleware
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    logger.debug('Authentication attempt', { hasAuthHeader: !!authHeader });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    logger.debug('Token extraction', { tokenPresent: !!token });
    
    // Verify token
    try {
      const decoded = AuthService.verifyToken(token);
      logger.debug('Token verification successful', { userId: decoded.userId });
      
      if (!decoded?.userId) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
        return;
      }

      // Validate session if session ID is present
      if (decoded.sessionId) {
        const sessionValidation = await SessionService.validateSession(decoded.sessionId, req);
        
        if (!sessionValidation.valid) {
          logger.logSecurity('Invalid session detected', {
            sessionId: decoded.sessionId,
            userId: decoded.userId,
            ip: req.ip
          });
          res.status(401).json({
            success: false,
            message: 'Session expired or invalid'
          });
          return;
        }

        // Handle session rotation if needed
        if (sessionValidation.shouldRotate) {
          const newSessionId = await SessionService.rotateSession(decoded.sessionId);
          if (newSessionId) {
            // Note: In a real implementation, you would need to return the new token
            // For now, we'll just log it
            logger.info('Session rotated', { 
              oldSessionId: decoded.sessionId, 
              newSessionId,
              userId: decoded.userId 
            });
          }
        }

        // Log high-risk sessions
        if (sessionValidation.riskLevel === 'high') {
          logger.logSecurity('High-risk session detected', {
            sessionId: decoded.sessionId,
            userId: decoded.userId,
            riskLevel: sessionValidation.riskLevel,
            ip: req.ip
          });
        }
      }

      // Get user from database - ensure userId is always treated as string
      const userId = String(decoded.userId);
      logger.debug('User lookup', { userId });
      const user = await UserModel.findByIdSafe(userId);
      if (!user) {
        logger.logSecurity('JWT token for non-existent user', { 
          userId: decoded.userId,
          ip: req.ip 
        });
        res.status(401).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Attach user to request
      req.user = user;
      
      // Attach user info for activity logging
      req.userId = parseInt(user.id);
      req.sessionId = decoded.sessionId || decoded.jti; // Extract session ID from token
      
      next();
    } catch (tokenError) {
      logger.error('Token verification failed', { error: tokenError });
      logger.logSecurity('JWT verification failed', { 
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: tokenError
      });
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
      return;
    }

  } catch (error) {
    logger.error('Authentication middleware error', { error });
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    const decoded = AuthService.verifyToken(token);
    
    if (decoded?.userId) {
      const userId = String(decoded.userId);
      const user = await UserModel.findByIdSafe(userId);
      if (user) {
        req.user = user;
        // Attach user info for activity logging
        req.userId = parseInt(user.id);
        req.sessionId = decoded.sessionId || decoded.jti;
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error', { error });
    next(); // Continue without authentication
  }
};

// Email verification required middleware
export const requireEmailVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (!req.user.email_verified) {
    logger.logSecurity('Unverified email access attempt', { 
      userId: req.user.id,
      email: req.user.email 
    });
    res.status(403).json({
      success: false,
      message: 'Email verification required'
    });
    return;
  }

  next();
};

// Admin role middleware (if you need admin functionality later)
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Check if user is admin (you would need to add an is_admin field to users table)
    // For now, we'll assume the first user (id: "1") is admin
    if (req.user.id !== '1') {
      logger.logSecurity('Unauthorized admin access attempt', { 
        userId: req.user.id,
        email: req.user.email 
      });
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Admin middleware error', { error });
    res.status(500).json({
      success: false,
      message: 'Authorization failed'
    });
  }
};

// Default export for backwards compatibility
export const authMiddleware = authenticate;
export default authenticate;