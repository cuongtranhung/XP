/**
 * Multi-User Session Management Routes
 * API endpoints for managing concurrent user sessions and cache synchronization
 */

import { Router, Request, Response } from 'express';
import { multiUserSessionService, UserSession } from '../services/multiUserSessionService';
import auth from '../middleware/auth';
// Async handler for route error handling
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
import { logger } from '../utils/logger';

const router = Router();

/**
 * Create new session
 * POST /api/multi-session/create
 */
router.post('/create', auth, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.user as any;
  const {
    deviceId,
    deviceType = 'unknown',
    browser,
    metadata
  } = req.body;

  const sessionData: Omit<UserSession, 'sessionId' | 'isActive' | 'createdAt' | 'expiresAt'> = {
    userId,
    deviceId,
    deviceType,
    browser,
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    lastActivity: new Date(),
    metadata
  };

  const sessionId = await multiUserSessionService.createSession(sessionData);

  logger.info('Multi-user session created via API', {
    sessionId,
    userId,
    deviceType,
    ipAddress: sessionData.ipAddress
  });

  res.status(201).json({
    success: true,
    data: {
      sessionId,
      message: 'Session created successfully'
    }
  });
}));

/**
 * Get user sessions
 * GET /api/multi-session/user/:userId
 */
router.get('/user/:userId', auth, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const requestingUser = req.user as any;

  // Users can only view their own sessions (unless admin)
  if (requestingUser.userId !== userId && requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Cannot view other user sessions'
    });
  }

  const sessions = await multiUserSessionService.getUserSessions(userId);

  res.json({
    success: true,
    data: {
      userId,
      sessionCount: sessions.length,
      sessions: sessions.map(session => ({
        sessionId: session.sessionId,
        deviceType: session.deviceType,
        browser: session.browser,
        lastActivity: session.lastActivity,
        createdAt: session.createdAt,
        isActive: session.isActive,
        metadata: session.metadata
      }))
    }
  });
}));

/**
 * Update session activity
 * PUT /api/multi-session/:sessionId/activity
 */
router.put('/:sessionId/activity', auth, asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { metadata } = req.body;

  const updated = await multiUserSessionService.updateSessionActivity(sessionId, metadata);

  if (!updated) {
    return res.status(404).json({
      success: false,
      error: 'Session not found or inactive'
    });
  }

  res.json({
    success: true,
    data: {
      sessionId,
      message: 'Session activity updated',
      timestamp: new Date()
    }
  });
}));

/**
 * Terminate session
 * DELETE /api/multi-session/:sessionId
 */
router.delete('/:sessionId', auth, asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { reason = 'logout' } = req.body;

  const terminated = await multiUserSessionService.terminateSession(sessionId, reason);

  if (!terminated) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  logger.info('Multi-user session terminated via API', {
    sessionId,
    reason,
    requestedBy: (req.user as any)?.userId
  });

  res.json({
    success: true,
    data: {
      sessionId,
      message: 'Session terminated successfully',
      reason
    }
  });
}));

/**
 * Get session cache data
 * GET /api/multi-session/:sessionId/cache/:key
 */
router.get('/:sessionId/cache/:key', auth, asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, key } = req.params;

  const data = await multiUserSessionService.getSessionCacheData(sessionId, key);

  if (data === null || data === undefined) {
    return res.status(404).json({
      success: false,
      error: 'Cache data not found'
    });
  }

  res.json({
    success: true,
    data: {
      sessionId,
      key,
      value: data,
      retrievedAt: new Date()
    }
  });
}));

/**
 * Set session cache data
 * PUT /api/multi-session/:sessionId/cache/:key
 */
router.put('/:sessionId/cache/:key', auth, asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, key } = req.params;
  const { value, ttl } = req.body;

  const success = await multiUserSessionService.setSessionCacheData(sessionId, key, value, ttl);

  if (!success) {
    return res.status(400).json({
      success: false,
      error: 'Failed to set session cache data'
    });
  }

  res.json({
    success: true,
    data: {
      sessionId,
      key,
      message: 'Cache data set successfully',
      timestamp: new Date()
    }
  });
}));

/**
 * Synchronize user sessions
 * POST /api/multi-session/user/:userId/sync
 */
router.post('/user/:userId/sync', auth, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const requestingUser = req.user as any;

  // Users can only sync their own sessions (unless admin)
  if (requestingUser.userId !== userId && requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Cannot sync other user sessions'
    });
  }

  await multiUserSessionService.synchronizeUserSessions(userId);

  logger.info('Multi-user session sync requested via API', {
    userId,
    requestedBy: requestingUser.userId
  });

  res.json({
    success: true,
    data: {
      userId,
      message: 'Session synchronization initiated',
      timestamp: new Date()
    }
  });
}));

/**
 * Get session statistics
 * GET /api/multi-session/stats
 */
router.get('/stats', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can view global session stats
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const stats = multiUserSessionService.getSessionStats();

  res.json({
    success: true,
    data: {
      statistics: stats,
      timestamp: new Date()
    }
  });
}));

/**
 * Force cleanup expired sessions
 * POST /api/multi-session/cleanup
 */
router.post('/cleanup', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can trigger cleanup
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const cleanedCount = await multiUserSessionService.cleanupExpiredSessions();

  logger.info('Manual session cleanup triggered via API', {
    cleanedCount,
    requestedBy: requestingUser.userId
  });

  res.json({
    success: true,
    data: {
      message: 'Session cleanup completed',
      sessionsCleanedUp: cleanedCount,
      timestamp: new Date()
    }
  });
}));

/**
 * Health check for session service
 * GET /api/multi-session/health
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const stats = multiUserSessionService.getSessionStats();
  
  const healthStatus = {
    status: 'healthy',
    service: 'multi-user-session',
    activeSessions: stats.activeSessions,
    lastCleanup: stats.lastCleanup,
    uptime: process.uptime(),
    timestamp: new Date()
  };

  res.json({
    success: true,
    data: healthStatus
  });
}));

export default router;