import { Router, Request, Response } from 'express';
import { SessionService } from '../services/sessionService';
import { UserSessionModel } from '../models/UserSession';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get current user's active sessions
 */
router.get('/my-sessions', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found'
      });
      return;
    }

    const sessions = await UserSessionModel.getActiveSessions(req.userId);
    
    // Remove sensitive data before sending to client
    const safeSessions = sessions.map(session => ({
      id: session.id,
      created_at: session.created_at,
      last_activity: session.last_activity,
      expires_at: session.expires_at,
      ip_address: session.ip_address,
      browser_info: session.browser_info,
      location_info: session.location_info,
      is_current: session.id === req.sessionId,
      metadata: {
        loginMethod: session.metadata?.loginMethod,
        deviceTrust: session.metadata?.deviceTrust,
        riskScore: session.metadata?.riskScore
      }
    }));

    res.json({
      success: true,
      data: {
        sessions: safeSessions,
        count: safeSessions.length
      }
    });
  } catch (error) {
    logger.error('Failed to get user sessions', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sessions'
    });
  }
});

/**
 * Terminate a specific session
 */
router.delete('/sessions/:sessionId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    
    if (!req.userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found'
      });
      return;
    }

    // Verify that the session belongs to the current user
    const session = await UserSessionModel.findById(sessionId);
    if (!session || session.user_id !== req.userId) {
      res.status(404).json({
        success: false,
        message: 'Session not found'
      });
      return;
    }

    // Deactivate the session
    const success = await UserSessionModel.deactivate(sessionId, 'USER_TERMINATED');
    
    if (success) {
      logger.info('User terminated session', {
        userId: req.userId,
        sessionId,
        terminatedBy: req.sessionId
      });

      res.json({
        success: true,
        message: 'Session terminated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to terminate session'
      });
    }
  } catch (error) {
    logger.error('Failed to terminate session', { error, sessionId: req.params.sessionId });
    res.status(500).json({
      success: false,
      message: 'Failed to terminate session'
    });
  }
});

/**
 * Terminate all other sessions (keep current session active)
 */
router.delete('/sessions/others', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId || !req.sessionId) {
      res.status(400).json({
        success: false,
        message: 'User ID or session ID not found'
      });
      return;
    }

    // Get all active sessions for the user
    const sessions = await UserSessionModel.getActiveSessions(req.userId);
    
    // Deactivate all sessions except the current one
    let terminatedCount = 0;
    for (const session of sessions) {
      if (session.id !== req.sessionId) {
        const success = await UserSessionModel.deactivate(session.id, 'USER_TERMINATED_OTHERS');
        if (success) {terminatedCount++;}
      }
    }

    logger.info('User terminated other sessions', {
      userId: req.userId,
      currentSessionId: req.sessionId,
      terminatedCount
    });

    res.json({
      success: true,
      message: `${terminatedCount} sessions terminated successfully`,
      data: {
        terminatedCount
      }
    });
  } catch (error) {
    logger.error('Failed to terminate other sessions', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      message: 'Failed to terminate other sessions'
    });
  }
});

/**
 * Get session analytics for current user
 */
router.get('/analytics', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found'
      });
      return;
    }

    const analytics = await SessionService.getSessionAnalytics(req.userId);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Failed to get session analytics', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve session analytics'
    });
  }
});

/**
 * Admin: Get global session analytics
 */
router.get('/admin/analytics', authenticate, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const analytics = await SessionService.getSessionAnalytics();
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Failed to get global session analytics', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve global session analytics'
    });
  }
});

/**
 * Admin: Manual session cleanup
 */
router.post('/admin/cleanup', authenticate, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    await SessionService.cleanupExpiredSessions();
    
    res.json({
      success: true,
      message: 'Session cleanup completed successfully'
    });
  } catch (error) {
    logger.error('Manual session cleanup failed', { error });
    res.status(500).json({
      success: false,
      message: 'Session cleanup failed'
    });
  }
});

/**
 * Admin: Get all active sessions
 */
router.get('/admin/active', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, userId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    // This would need a new method in UserSessionModel
    // For now, we'll return a basic implementation
    const sessions = await UserSessionModel.findActiveByUserId(
      userId ? Number(userId) : undefined as any
    );
    
    res.json({
      success: true,
      data: {
        sessions: sessions.slice(offset, offset + Number(limit)),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: sessions.length
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get active sessions', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve active sessions'
    });
  }
});

/**
 * Admin: Force terminate any session
 */
router.delete('/admin/sessions/:sessionId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { reason = 'ADMIN_TERMINATED' } = req.body;
    
    const success = await UserSessionModel.deactivate(sessionId, reason);
    
    if (success) {
      logger.info('Admin terminated session', {
        adminUserId: req.userId,
        sessionId,
        reason
      });

      res.json({
        success: true,
        message: 'Session terminated successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Session not found or already inactive'
      });
    }
  } catch (error) {
    logger.error('Admin session termination failed', { error, sessionId: req.params.sessionId });
    res.status(500).json({
      success: false,
      message: 'Failed to terminate session'
    });
  }
});

export default router;