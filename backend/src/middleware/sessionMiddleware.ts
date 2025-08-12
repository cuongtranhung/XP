/**
 * Session Management Middleware
 * Automatically handles session tracking and management for authenticated requests
 */

import { Request, Response, NextFunction } from 'express';
import { multiUserSessionService } from '../services/multiUserSessionService';
import { logger } from '../utils/logger';

// Extend Request interface to include session info
declare global {
  namespace Express {
    interface Request {
      sessionInfo?: {
        sessionId: string;
        deviceType: string;
        isNewSession: boolean;
        userSessions: number;
      };
    }
  }
}

/**
 * Session tracking middleware
 * Automatically creates and manages sessions for authenticated users
 */
export function trackSession() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only process authenticated requests
      const user = req.user as any;
      if (!user || !user.userId) {
        return next();
      }

      const userId = user.userId;
      const sessionId = req.headers['x-session-id'] as string;
      
      let currentSessionId = sessionId;
      let isNewSession = false;

      // Check if session exists and is valid
      if (sessionId) {
        const existingSessions = await multiUserSessionService.getUserSessions(userId);
        const sessionExists = existingSessions.some(s => s.sessionId === sessionId && s.isActive);
        
        if (sessionExists) {
          // Update existing session activity
          await multiUserSessionService.updateSessionActivity(sessionId);
        } else {
          // Session doesn't exist, create new one
          currentSessionId = await createNewSession(req, userId);
          isNewSession = true;
        }
      } else {
        // No session ID provided, create new session
        currentSessionId = await createNewSession(req, userId);
        isNewSession = true;
      }

      // Get current user session count
      const userSessions = await multiUserSessionService.getUserSessions(userId);
      
      // Add session info to request
      req.sessionInfo = {
        sessionId: currentSessionId,
        deviceType: detectDeviceType(req),
        isNewSession,
        userSessions: userSessions.length
      };

      // Add session ID to response header for client tracking
      res.setHeader('X-Session-ID', currentSessionId);

      // Log session activity
      logger.debug('Session tracked', {
        userId,
        sessionId: currentSessionId,
        isNewSession,
        totalUserSessions: userSessions.length,
        path: req.path
      });

      next();

    } catch (error) {
      logger.error('Session tracking middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
        userId: (req.user as any)?.userId
      });
      
      // Don't block request on session tracking error
      next();
    }
  };
}

/**
 * Session synchronization middleware
 * Ensures cache synchronization across user sessions
 */
export function synchronizeSession() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      if (!user || !user.userId || !req.sessionInfo) {
        return next();
      }

      const userId = user.userId;

      // Check if user has multiple active sessions
      if (req.sessionInfo.userSessions > 1) {
        // Queue synchronization for multi-session users
        // This will be processed by the background sync processor
        logger.debug('Multi-session user detected, queuing sync', {
          userId,
          sessionCount: req.sessionInfo.userSessions,
          sessionId: req.sessionInfo.sessionId
        });

        // For critical operations, force immediate sync
        if (shouldForceSyncForRequest(req)) {
          await multiUserSessionService.synchronizeUserSessions(userId);
          logger.info('Forced session synchronization completed', {
            userId,
            path: req.path,
            method: req.method
          });
        }
      }

      next();

    } catch (error) {
      logger.error('Session synchronization middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
        userId: (req.user as any)?.userId
      });
      
      // Don't block request on sync error
      next();
    }
  };
}

/**
 * Session cleanup middleware
 * Handles session termination on logout
 */
export function handleSessionCleanup() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original response end function
    const originalEnd = res.end;

    // Override response end to handle session cleanup
    res.end = function(chunk?: any, encoding?: any) {
      // Check if this is a logout request
      if (req.path.includes('/logout') && req.method === 'POST') {
        const sessionId = req.headers['x-session-id'] as string;
        if (sessionId) {
          // Terminate session asynchronously
          multiUserSessionService.terminateSession(sessionId, 'logout')
            .then(() => {
              logger.info('Session terminated on logout', {
                sessionId,
                userId: (req.user as any)?.userId
              });
            })
            .catch(error => {
              logger.error('Failed to terminate session on logout', {
                sessionId,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            });
        }
      }

      // Call original end function
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Session cache middleware
 * Provides easy access to session-specific cache
 */
export function sessionCache() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.sessionInfo) {
      // Add session cache helpers to request
      req.sessionCache = {
        get: async (key: string) => {
          return await multiUserSessionService.getSessionCacheData(req.sessionInfo!.sessionId, key);
        },
        set: async (key: string, value: any, ttl?: number) => {
          return await multiUserSessionService.setSessionCacheData(req.sessionInfo!.sessionId, key, value, ttl);
        }
      };
    }

    next();
  };
}

// Helper functions

async function createNewSession(req: Request, userId: string): Promise<string> {
  const sessionData = {
    userId,
    deviceId: req.headers['x-device-id'] as string,
    deviceType: detectDeviceType(req),
    browser: detectBrowser(req),
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    lastActivity: new Date(),
    metadata: {
      preferences: {
        language: req.headers['accept-language']?.split(',')[0] || 'en',
        timezone: req.headers['x-timezone'] as string
      }
    }
  };

  return await multiUserSessionService.createSession(sessionData);
}

function detectDeviceType(req: Request): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
  const userAgent = req.get('User-Agent')?.toLowerCase() || '';
  
  if (userAgent.includes('mobile')) {
    return 'mobile';
  } else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
    return 'tablet';
  } else if (userAgent.includes('desktop') || userAgent.includes('windows') || userAgent.includes('mac')) {
    return 'desktop';
  }
  
  return 'unknown';
}

function detectBrowser(req: Request): string {
  const userAgent = req.get('User-Agent')?.toLowerCase() || '';
  
  if (userAgent.includes('chrome')) return 'Chrome';
  if (userAgent.includes('firefox')) return 'Firefox';
  if (userAgent.includes('safari')) return 'Safari';
  if (userAgent.includes('edge')) return 'Edge';
  
  return 'Unknown';
}

function shouldForceSyncForRequest(req: Request): boolean {
  // Force sync for critical operations
  const criticalPaths = [
    '/api/forms/submit',
    '/api/user/profile',
    '/api/user/preferences',
    '/api/user/password'
  ];

  const criticalMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  return criticalPaths.some(path => req.path.includes(path)) && 
         criticalMethods.includes(req.method);
}

// Extend Request interface for session cache helpers
declare global {
  namespace Express {
    interface Request {
      sessionCache?: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any, ttl?: number) => Promise<boolean>;
      };
    }
  }
}