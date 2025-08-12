/**
 * Real-time Comment Routes
 * REST API endpoints for real-time comment features: notifications, typing, presence, reactions
 */

import { Router, Request, Response } from 'express';
import { param, body, query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { realTimeCommentService } from '../services/realTimeCommentService';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

const router = Router();

// Validation schemas
const entityValidation = [
  param('entityType')
    .isIn(['form_submission', 'form', 'comment'])
    .withMessage('Entity type must be form_submission, form, or comment'),
  
  param('entityId')
    .isUUID()
    .withMessage('Entity ID must be a valid UUID')
];

const subscriptionValidation = [
  ...entityValidation,
  body('userInfo')
    .isObject()
    .withMessage('User info is required'),
  
  body('userInfo.userEmail')
    .isEmail()
    .withMessage('Valid email is required'),
  
  body('userInfo.fullName')
    .optional()
    .isString()
    .withMessage('Full name must be a string')
];

const typingValidation = [
  param('entityType')
    .isIn(['form_submission', 'form'])
    .withMessage('Entity type must be form_submission or form'),
  
  param('entityId')
    .isUUID()
    .withMessage('Entity ID must be a valid UUID'),
  
  body('isTyping')
    .isBoolean()
    .withMessage('isTyping must be a boolean')
];

const presenceValidation = [
  ...entityValidation,
  body('status')
    .isIn(['viewing', 'commenting', 'typing', 'idle'])
    .withMessage('Status must be viewing, commenting, typing, or idle'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

const reactionValidation = [
  param('commentId')
    .isUUID()
    .withMessage('Comment ID must be a valid UUID'),
  
  body('reactionType')
    .isIn(['like', 'love', 'laugh', 'wow', 'sad', 'angry'])
    .withMessage('Reaction type must be like, love, laugh, wow, sad, or angry')
];

const notificationValidation = [
  body('type')
    .isIn(['new_comment', 'comment_reply', 'comment_mention', 'comment_reaction', 'comment_updated', 'comment_deleted'])
    .withMessage('Invalid notification type'),
  
  body('commentId')
    .isUUID()
    .withMessage('Comment ID must be a valid UUID'),
  
  body('entityType')
    .isIn(['form_submission', 'form'])
    .withMessage('Entity type must be form_submission or form'),
  
  body('entityId')
    .isUUID()
    .withMessage('Entity ID must be a valid UUID'),
  
  body('author')
    .isObject()
    .withMessage('Author information is required'),
  
  body('author.userId')
    .isString()
    .withMessage('Author user ID is required'),
  
  body('author.userEmail')
    .isEmail()
    .withMessage('Author email is required')
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
 * @route   POST /comments/:entityType/:entityId/subscribe
 * @desc    Subscribe to real-time comment updates for an entity
 * @access  Private
 */
router.post('/comments/:entityType/:entityId/subscribe',
  authenticate,
  subscriptionValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const { userInfo } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // For REST API, we'll use a placeholder socketId
      const socketId = `rest_${user.id || user.userId}_${Date.now()}`;

      const result = await realTimeCommentService.subscribeToEntity({
        userId: user.id || user.userId,
        socketId,
        entityType: entityType as any,
        entityId,
        userInfo: {
          userEmail: userInfo.userEmail || user.email,
          fullName: userInfo.fullName || user.fullName || user.full_name
        }
      });

      res.json({
        success: true,
        data: {
          subscription: {
            entityType: result.subscription.entityType,
            entityId: result.subscription.entityId,
            joinedAt: result.subscription.joinedAt
          },
          currentPresence: result.currentPresence,
          activeTyping: result.activeTyping
        },
        message: 'Successfully subscribed to comment updates'
      });

      logger.info('User subscribed to comment entity via REST API', {
        userId: user.id || user.userId,
        entityType,
        entityId
      });

    } catch (error) {
      logger.error('Failed to subscribe to comment entity', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to subscribe to comment updates',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /comments/:entityType/:entityId/typing
 * @desc    Update typing indicator for comment entity
 * @access  Private
 */
router.post('/comments/:entityType/:entityId/typing',
  authenticate,
  typingValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const { isTyping } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      await realTimeCommentService.updateTypingIndicator({
        userId: user.id || user.userId,
        userEmail: user.email,
        fullName: user.fullName || user.full_name,
        entityType: entityType as any,
        entityId,
        isTyping
      });

      res.json({
        success: true,
        message: `Typing indicator ${isTyping ? 'started' : 'stopped'} successfully`
      });

      logger.debug('Typing indicator updated via REST API', {
        userId: user.id || user.userId,
        entityType,
        entityId,
        isTyping
      });

    } catch (error) {
      logger.error('Failed to update typing indicator', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to update typing indicator',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /comments/:entityType/:entityId/presence
 * @desc    Update user presence status for comment entity
 * @access  Private
 */
router.post('/comments/:entityType/:entityId/presence',
  authenticate,
  presenceValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const { status, metadata } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      await realTimeCommentService.updatePresenceStatus(
        user.id || user.userId,
        entityType as any,
        entityId,
        status,
        metadata
      );

      res.json({
        success: true,
        message: 'Presence status updated successfully'
      });

      logger.debug('Presence status updated via REST API', {
        userId: user.id || user.userId,
        entityType,
        entityId,
        status
      });

    } catch (error) {
      logger.error('Failed to update presence status', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to update presence status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /comments/:commentId/reactions
 * @desc    Add or update comment reaction
 * @access  Private
 */
router.post('/comments/:commentId/reactions',
  authenticate,
  reactionValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      const { reactionType } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const reaction = await realTimeCommentService.updateCommentReaction({
        commentId,
        userId: user.id || user.userId,
        reactionType
      });

      res.json({
        success: true,
        data: {
          reaction: {
            reactionId: reaction.reactionId,
            reactionType: reaction.reactionType,
            timestamp: reaction.timestamp
          }
        },
        message: 'Comment reaction updated successfully'
      });

      logger.debug('Comment reaction updated via REST API', {
        commentId,
        userId: user.id || user.userId,
        reactionType
      });

    } catch (error) {
      logger.error('Failed to update comment reaction', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to update comment reaction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /comments/notifications/send
 * @desc    Send real-time comment notification
 * @access  Private
 */
router.post('/comments/notifications/send',
  authenticate,
  notificationValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const {
        type,
        commentId,
        entityType,
        entityId,
        author,
        content,
        parentCommentId,
        mentionedUsers,
        reactionData
      } = req.body;

      const notification = {
        type,
        commentId,
        entityType,
        entityId,
        author,
        content,
        parentCommentId,
        mentionedUsers,
        reactionData,
        timestamp: new Date(),
        metadata: {
          isReply: !!parentCommentId,
          depth: 0, // Would be calculated from comment hierarchy
          priority: mentionedUsers?.length > 0 ? 'high' : 'medium' as 'low' | 'medium' | 'high'
        }
      };

      await realTimeCommentService.sendCommentNotification(notification);

      res.json({
        success: true,
        message: 'Comment notification sent successfully'
      });

      logger.info('Comment notification sent via REST API', {
        type,
        commentId,
        authorId: author.userId
      });

    } catch (error) {
      logger.error('Failed to send comment notification', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to send comment notification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /comments/:entityType/:entityId/presence
 * @desc    Get current user presence for comment entity
 * @access  Private
 */
router.get('/comments/:entityType/:entityId/presence',
  authenticate,
  [
    param('entityType')
      .isIn(['form_submission', 'form'])
      .withMessage('Entity type must be form_submission or form'),
    
    param('entityId')
      .isUUID()
      .withMessage('Entity ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;

      const presence = realTimeCommentService.getEntityPresence(
        entityType as any,
        entityId
      );

      res.json({
        success: true,
        data: {
          presence,
          totalUsers: presence.length,
          lastUpdate: new Date().toISOString()
        },
        message: 'Entity presence retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get entity presence', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get entity presence',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /comments/:entityType/:entityId/typing
 * @desc    Get current typing indicators for comment entity
 * @access  Private
 */
router.get('/comments/:entityType/:entityId/typing',
  authenticate,
  [
    param('entityType')
      .isIn(['form_submission', 'form'])
      .withMessage('Entity type must be form_submission or form'),
    
    param('entityId')
      .isUUID()
      .withMessage('Entity ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;

      const typingIndicators = realTimeCommentService.getEntityTypingIndicators(
        entityType as any,
        entityId
      );

      res.json({
        success: true,
        data: {
          typingIndicators,
          activeTypingCount: typingIndicators.length,
          lastUpdate: new Date().toISOString()
        },
        message: 'Typing indicators retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get typing indicators', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get typing indicators',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /comments/:commentId/reactions
 * @desc    Get comment reactions
 * @access  Private
 */
router.get('/comments/:commentId/reactions',
  authenticate,
  [
    param('commentId')
      .isUUID()
      .withMessage('Comment ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;

      const reactions = realTimeCommentService.getCommentReactions(commentId);

      // Group reactions by type
      const reactionSummary = reactions.reduce((acc, reaction) => {
        if (!acc[reaction.reactionType]) {
          acc[reaction.reactionType] = {
            count: 0,
            users: []
          };
        }
        acc[reaction.reactionType].count++;
        acc[reaction.reactionType].users.push({
          userId: reaction.userId,
          timestamp: reaction.timestamp
        });
        return acc;
      }, {} as Record<string, { count: number; users: Array<{ userId: string; timestamp: Date }> }>);

      res.json({
        success: true,
        data: {
          reactions,
          reactionSummary,
          totalReactions: reactions.length,
          lastUpdate: new Date().toISOString()
        },
        message: 'Comment reactions retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get comment reactions', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get comment reactions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /comments/stats
 * @desc    Get real-time comment service statistics
 * @access  Private (admin)
 */
router.get('/comments/stats',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      // Basic admin check
      if (!user || user.email !== process.env.ADMIN_EMAIL) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const stats = realTimeCommentService.getStats();

      res.json({
        success: true,
        data: {
          stats,
          timestamp: new Date().toISOString()
        },
        message: 'Comment service statistics retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get comment service stats', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get comment service stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;