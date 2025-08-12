/**
 * Form Collaboration Routes
 * WebSocket and REST API endpoints for real-time form collaboration
 */

import { Router, Request, Response } from 'express';
import { param, body, query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { formCollaborationService } from '../services/formCollaborationService';
import { webSocketService } from '../services/webSocketService';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

const router = Router();

// Validation schemas
const formIdValidation = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID')
];

const joinSessionValidation = [
  ...formIdValidation,
  body('userInfo')
    .optional()
    .isObject()
    .withMessage('User info must be an object')
];

const fieldChangeValidation = [
  ...formIdValidation,
  body('fieldId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Field ID is required'),
  
  body('fieldKey')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Field key is required'),
  
  body('changeType')
    .isIn(['value', 'config', 'add', 'remove', 'reorder'])
    .withMessage('Change type must be value, config, add, remove, or reorder'),
  
  body('oldValue')
    .optional(),
  
  body('newValue')
    .exists()
    .withMessage('New value is required')
];

const cursorUpdateValidation = [
  ...formIdValidation,
  body('fieldId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Field ID is required'),
  
  body('position')
    .isInt({ min: 0 })
    .withMessage('Position must be a non-negative integer')
];

// Validation error handler
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST /forms/:formId/collaboration/join
 * @desc    Join form collaboration session
 * @access  Private
 */
router.post('/:formId/collaboration/join',
  authenticate,
  joinSessionValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { formId } = req.params;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const result = await formCollaborationService.joinFormSession(formId, {
        userId: user.id || user.userId,
        userEmail: user.email,
        fullName: user.fullName || user.full_name
      });

      res.json({
        success: true,
        data: {
          session: {
            formId: result.session.formId,
            versionNumber: result.session.versionNumber,
            lastSaved: result.session.lastSaved,
            conflictResolution: result.session.conflictResolution,
            collaboratorCount: result.session.collaborators.size
          },
          collaborators: result.collaborators,
          userSocketConnections: webSocketService.getUserConnections(user.id || user.userId).length
        },
        message: 'Successfully joined collaboration session'
      });

      logger.info('User joined form collaboration via REST API', {
        formId,
        userId: user.id || user.userId,
        userEmail: user.email
      });

    } catch (error) {
      logger.error('Failed to join collaboration session', { error, formId: req.params.formId });
      res.status(500).json({
        success: false,
        message: 'Failed to join collaboration session',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /forms/:formId/collaboration/leave
 * @desc    Leave form collaboration session
 * @access  Private
 */
router.post('/:formId/collaboration/leave',
  authenticate,
  formIdValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { formId } = req.params;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      await formCollaborationService.leaveFormSession(formId, user.id || user.userId);

      res.json({
        success: true,
        message: 'Successfully left collaboration session'
      });

      logger.info('User left form collaboration via REST API', {
        formId,
        userId: user.id || user.userId
      });

    } catch (error) {
      logger.error('Failed to leave collaboration session', { error, formId: req.params.formId });
      res.status(500).json({
        success: false,
        message: 'Failed to leave collaboration session',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /forms/:formId/collaboration/field-change
 * @desc    Apply field change in collaboration session
 * @access  Private
 */
router.post('/:formId/collaboration/field-change',
  authenticate,
  fieldChangeValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { formId } = req.params;
      const { fieldId, fieldKey, changeType, oldValue, newValue } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const result = await formCollaborationService.handleFieldChange(formId, {
        fieldId,
        fieldKey,
        changeType,
        oldValue,
        newValue,
        userId: user.id || user.userId
      });

      res.json({
        success: result.accepted,
        data: {
          accepted: result.accepted,
          conflicts: result.conflicts,
          resolvedChange: result.resolvedChange,
          session: formCollaborationService.getFormSession(formId)
        },
        message: result.accepted ? 'Field change applied successfully' : 'Field change rejected'
      });

      logger.debug('Field change processed via REST API', {
        formId,
        fieldId,
        changeType,
        userId: user.id || user.userId,
        accepted: result.accepted
      });

    } catch (error) {
      logger.error('Failed to process field change', { error, formId: req.params.formId });
      res.status(500).json({
        success: false,
        message: 'Failed to process field change',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /forms/:formId/collaboration/cursor
 * @desc    Update cursor position in collaboration session
 * @access  Private
 */
router.post('/:formId/collaboration/cursor',
  authenticate,
  cursorUpdateValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { formId } = req.params;
      const { fieldId, position } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      await formCollaborationService.updateCursorPosition(formId, user.id || user.userId, {
        fieldId,
        position
      });

      res.json({
        success: true,
        message: 'Cursor position updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update cursor position', { error, formId: req.params.formId });
      res.status(500).json({
        success: false,
        message: 'Failed to update cursor position',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /forms/:formId/collaboration/session
 * @desc    Get current collaboration session status
 * @access  Private
 */
router.get('/:formId/collaboration/session',
  authenticate,
  formIdValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { formId } = req.params;
      const session = formCollaborationService.getFormSession(formId);

      if (!session) {
        return res.json({
          success: true,
          data: {
            active: false,
            formId,
            collaborators: [],
            versionNumber: 0
          },
          message: 'No active collaboration session'
        });
      }

      res.json({
        success: true,
        data: {
          active: true,
          formId: session.formId,
          collaborators: Array.from(session.collaborators.values()),
          versionNumber: session.versionNumber,
          lastSaved: session.lastSaved,
          conflictResolution: session.conflictResolution,
          activeChanges: session.activeChanges.size
        },
        message: 'Collaboration session retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get collaboration session', { error, formId: req.params.formId });
      res.status(500).json({
        success: false,
        message: 'Failed to get collaboration session',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /user/collaboration/sessions
 * @desc    Get user's active collaboration sessions
 * @access  Private
 */
router.get('/user/collaboration/sessions',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const activeSessions = formCollaborationService.getUserActiveSessions(user.id || user.userId);
      const sessionDetails = activeSessions.map(formId => {
        const session = formCollaborationService.getFormSession(formId);
        return session ? {
          formId,
          collaboratorCount: session.collaborators.size,
          versionNumber: session.versionNumber,
          lastActivity: session.lastSaved
        } : null;
      }).filter(Boolean);

      res.json({
        success: true,
        data: {
          activeSessions: sessionDetails,
          totalSessions: activeSessions.length,
          webSocketConnections: webSocketService.getUserConnections(user.id || user.userId).length
        },
        message: 'User collaboration sessions retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get user collaboration sessions', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get user collaboration sessions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /admin/collaboration/stats
 * @desc    Get collaboration service statistics (admin only)
 * @access  Private (admin)
 */
router.get('/admin/collaboration/stats',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      // Basic admin check - can be enhanced with proper role-based access
      if (!user || user.email !== process.env.ADMIN_EMAIL) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const stats = formCollaborationService.getStats();
      const webSocketStats = webSocketService.getStats();

      res.json({
        success: true,
        data: {
          collaboration: stats,
          webSocket: webSocketStats,
          timestamp: new Date().toISOString()
        },
        message: 'Collaboration statistics retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get collaboration stats', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get collaboration stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;