/**
 * Authentication Middleware for Dynamic Form Builder
 * Supports both Bearer tokens and session-based authentication
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../../../utils/database';
import { AuthService } from '../../../services/authService';
import { SessionService } from '../../../services/sessionService';
import { UserModel } from '../../../models/User';
import { logger } from '../../../utils/logger';
import { XPAuthenticatedRequest } from '../types';

/**
 * Flexible authentication middleware that supports:
 * 1. Bearer tokens (JWT)
 * 2. Session cookies
 * 3. Session tokens in headers
 */
export const authenticate = async (
  req: XPAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let user = null;
    let sessionId: string | undefined;

    // Method 1: Try Bearer token authentication first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = AuthService.verifyToken(token);
        
        if (decoded?.userId) {
          user = await UserModel.findByIdSafe(String(decoded.userId));
          sessionId = decoded.sessionId || decoded.jti;
          logger.debug('Bearer token authentication successful', { userId: decoded.userId });
        }
      } catch (tokenError) {
        logger.debug('Bearer token authentication failed', { error: tokenError });
        // Continue to try other methods
      }
    }

    // Method 2: Try session cookie if Bearer token failed
    if (!user) {
      const sessionCookie = req.cookies?.session;
      if (sessionCookie) {
        try {
          // Query session directly from database
          const sessionResult = await pool.query(
            `SELECT s.user_id, s.id as session_id, u.id, u.email, u.full_name, u.email_verified, u.created_at, u.updated_at, u.last_login
             FROM user_sessions s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = $1 AND s.is_active = true AND s.expires_at > NOW()`,
            [sessionCookie]
          );

          if (sessionResult.rows.length > 0) {
            const row = sessionResult.rows[0];
            user = {
              id: row.id.toString(),
              email: row.email,
              full_name: row.full_name || '',
              email_verified: row.email_verified || false,
              created_at: row.created_at,
              updated_at: row.updated_at,
              last_login: row.last_login
            };
            sessionId = row.session_id;
            logger.debug('Session cookie authentication successful', { userId: user.id });
          }
        } catch (sessionError) {
          logger.debug('Session cookie authentication failed', { error: sessionError });
        }
      }
    }

    // Method 3: Try session token in headers
    if (!user) {
      const sessionToken = req.headers['x-session-token'] as string;
      if (sessionToken) {
        try {
          const sessionResult = await pool.query(
            `SELECT s.user_id, s.id as session_id, u.id, u.email, u.full_name, u.email_verified, u.created_at, u.updated_at, u.last_login
             FROM user_sessions s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = $1 AND s.is_active = true AND s.expires_at > NOW()`,
            [sessionToken]
          );

          if (sessionResult.rows.length > 0) {
            const row = sessionResult.rows[0];
            user = {
              id: row.id.toString(),
              email: row.email,
              full_name: row.full_name || '',
              email_verified: row.email_verified || false,
              created_at: row.created_at,
              updated_at: row.updated_at,
              last_login: row.last_login
            };
            sessionId = row.session_id;
            logger.debug('Session header authentication successful', { userId: user.id });
          }
        } catch (headerError) {
          logger.debug('Session header authentication failed', { error: headerError });
        }
      }
    }

    // If no authentication method worked
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required. Please provide valid credentials.'
        }
      });
      return;
    }

    // Attach user to request
    req.user = user;
    if (sessionId) {
      req.sessionId = sessionId;
    }
    req.userId = parseInt(user.id);

    logger.debug('Authentication successful', { 
      userId: user.id, 
      email: user.email,
      sessionId: sessionId || 'none' 
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed due to server error'
      }
    });
  }
};