/**
 * Comment Routes for Form Submissions
 * RESTful API endpoints for managing comments on submission data rows
 */

import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { CommentController } from '../controllers/CommentController';
import { 
  canViewFormSubmissions,
  requireFormOwnership 
} from '../middleware/permissions';
import { 
  generalRateLimit,
  formBuilderRateLimits 
} from '../../../middleware/rateLimiter';
import {
  validateSubmissionContent,
  logSecurityEvent
} from '../middleware/security';
import { XPAuthenticatedRequest } from '../types';

const router = Router();
const commentController = new CommentController();

// Validation schemas
const createCommentValidation = [
  param('submissionId')
    .isUUID()
    .withMessage('Submission ID must be a valid UUID'),
  
  body('content')
    .isString()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Content is required and must be 1-2000 characters'),
  
  body('parentId')
    .optional()
    .isUUID()
    .withMessage('Parent ID must be a valid UUID'),
  
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be boolean'),
  
  body('attachmentIds')
    .optional()
    .isArray()
    .withMessage('attachmentIds must be an array'),
  
  body('attachmentIds.*')
    .optional()
    .isUUID()
    .withMessage('Each attachment ID must be a valid UUID')
];

const updateCommentValidation = [
  param('submissionId')
    .isUUID()
    .withMessage('Submission ID must be a valid UUID'),
  
  param('commentId')
    .isUUID()
    .withMessage('Comment ID must be a valid UUID'),
  
  body('content')
    .optional()
    .isString()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Content must be 1-2000 characters'),
  
  body('isResolved')
    .optional()
    .isBoolean()
    .withMessage('isResolved must be boolean'),
  
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be boolean')
];

const commentIdValidation = [
  param('submissionId')
    .isUUID()
    .withMessage('Submission ID must be a valid UUID'),
  
  param('commentId')
    .isUUID()
    .withMessage('Comment ID must be a valid UUID')
];

const submissionIdValidation = [
  param('submissionId')
    .isUUID()
    .withMessage('Submission ID must be a valid UUID')
];

/**
 * @route   GET /submissions/:submissionId/comments
 * @desc    Get all comments for a submission
 * @access  Private (with multi-user access control)
 */
router.get('/:submissionId/comments',
  generalRateLimit,
  authenticate,
  submissionIdValidation,
  async (req: XPAuthenticatedRequest, res: Response) => {
    await commentController.getComments(req, res);
  }
);

/**
 * @route   POST /submissions/:submissionId/comments
 * @desc    Create a new comment on a submission
 * @access  Private
 */
router.post('/:submissionId/comments',
  formBuilderRateLimits.formSubmission, // Reuse submission rate limit
  authenticate,
  createCommentValidation,
  validateSubmissionContent, // Validate comment content for XSS
  logSecurityEvent('comment_creation', { action: 'create_comment' }),
  async (req: XPAuthenticatedRequest, res: Response) => {
    await commentController.createComment(req, res);
  }
);

/**
 * @route   GET /submissions/:submissionId/comments/:commentId
 * @desc    Get a specific comment
 * @access  Private
 */
router.get('/:submissionId/comments/:commentId',
  generalRateLimit,
  authenticate,
  commentIdValidation,
  async (req: XPAuthenticatedRequest, res: Response) => {
    await commentController.getComment(req, res);
  }
);

/**
 * @route   PUT /submissions/:submissionId/comments/:commentId
 * @desc    Update a comment
 * @access  Private (comment author or form owner only)
 */
router.put('/:submissionId/comments/:commentId',
  formBuilderRateLimits.formUpdate,
  authenticate,
  updateCommentValidation,
  validateSubmissionContent, // Validate updated content
  logSecurityEvent('comment_update', { action: 'update_comment' }),
  async (req: XPAuthenticatedRequest, res: Response) => {
    await commentController.updateComment(req, res);
  }
);

/**
 * @route   DELETE /submissions/:submissionId/comments/:commentId
 * @desc    Delete a comment and its replies
 * @access  Private (comment author or form owner only)
 */
router.delete('/:submissionId/comments/:commentId',
  authenticate,
  commentIdValidation,
  logSecurityEvent('comment_deletion', { action: 'delete_comment' }),
  async (req: XPAuthenticatedRequest, res: Response) => {
    await commentController.deleteComment(req, res);
  }
);

/**
 * @route   GET /submissions/:submissionId/comments/stats
 * @desc    Get comment statistics for a submission
 * @access  Private
 */
router.get('/:submissionId/comments/stats',
  generalRateLimit,
  authenticate,
  submissionIdValidation,
  async (req: XPAuthenticatedRequest, res: Response) => {
    await commentController.getCommentStats(req, res);
  }
);

/**
 * @route   POST /submissions/:submissionId/comments/:commentId/resolve
 * @desc    Mark comment as resolved/unresolved
 * @access  Private (form owner only)
 */
router.post('/:submissionId/comments/:commentId/resolve',
  formBuilderRateLimits.formUpdate,
  authenticate,
  commentIdValidation,
  [
    body('isResolved')
      .isBoolean()
      .withMessage('isResolved must be boolean')
  ],
  async (req: XPAuthenticatedRequest, res: Response) => {
    await commentController.toggleCommentResolution(req, res);
  }
);

/**
 * @route   POST /submissions/batch/comments/count
 * @desc    Get comment counts for multiple submissions (for table view)
 * @access  Private
 */
router.post('/batch/comments/count',
  generalRateLimit,
  authenticate,
  [
    body('submissionIds')
      .isArray()
      .withMessage('submissionIds must be an array'),
    
    body('submissionIds.*')
      .isUUID()
      .withMessage('Each submission ID must be a valid UUID')
  ],
  async (req: XPAuthenticatedRequest, res: Response) => {
    await commentController.getBatchCommentCounts(req, res);
  }
);

export default router;