/**
 * Comment Controller
 * Handles comment operations for form submissions with multi-user access control
 */

import { Response } from 'express';
import { validationResult } from 'express-validator';
import { CommentModel, CreateCommentData, UpdateCommentData } from '../models/CommentModel';
import { SubmissionService } from '../services/SubmissionService';
import { FormService } from '../services/FormService';
import { XPAuthenticatedRequest, DynamicFormBuilderError } from '../types';
import { logger } from '../../../utils/logger';
import { pool } from '../../../utils/database';

export class CommentController {
  private commentModel: CommentModel;
  private submissionService: SubmissionService;
  private formService: FormService;

  constructor() {
    this.commentModel = new CommentModel(pool);
    this.submissionService = new SubmissionService();
    this.formService = new FormService();
  }

  /**
   * Get all comments for a submission
   */
  async getComments(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: errors.array()
          }
        });
        return;
      }

      const { submissionId } = req.params;
      const userId = req.user!.id;

      // Get submission to check form ownership
      const submission = await this.submissionService.getSubmissionById(submissionId, userId);
      if (!submission) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SUBMISSION_NOT_FOUND',
            message: 'Submission not found or access denied'
          }
        });
        return;
      }

      // Check if user is form owner
      const form = await this.formService.getFormById(submission.formId, userId);
      const isFormOwner = form?.ownerId === userId;

      // Get comments with appropriate access control
      const comments = await this.commentModel.getBySubmissionId(
        submissionId,
        Number(userId),
        isFormOwner
      );

      res.json({
        success: true,
        data: {
          comments,
          submissionId,
          isFormOwner,
          accessLevel: isFormOwner ? 'full' : 'limited'
        }
      });

      logger.info('Comments retrieved', {
        submissionId,
        userId,
        commentCount: comments.length,
        isFormOwner
      });

    } catch (error) {
      logger.error('Error getting comments', { error, submissionId: req.params.submissionId });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get comments'
        }
      });
    }
  }

  /**
   * Create a new comment
   */
  async createComment(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: errors.array()
          }
        });
        return;
      }

      const { submissionId } = req.params;
      const { content, parentId, isPrivate, attachmentIds } = req.body;
      const userId = req.user!.id;

      // Verify user can access the submission
      const submission = await this.submissionService.getSubmissionById(submissionId, userId);
      if (!submission) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SUBMISSION_NOT_FOUND',
            message: 'Submission not found or access denied'
          }
        });
        return;
      }

      // If replying to a comment, verify parent comment exists
      if (parentId) {
        const parentComment = await this.commentModel.getById(parentId);
        if (!parentComment || (parentComment as any).submission_id !== submissionId) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARENT_COMMENT',
              message: 'Parent comment not found or does not belong to this submission'
            }
          });
          return;
        }
      }

      const createData: CreateCommentData = {
        submissionId,
        userId: Number(userId),
        content: content.trim(),
        parentId: parentId || null,
        isPrivate: isPrivate || false
      };

      const comment = await this.commentModel.create(createData);

      // If there are attachment IDs, link them to the comment
      if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
        try {
          // Update the comment_id for these attachments
          // They were uploaded with temp-{submissionId} but now need the real comment ID
          const updateQuery = `
            UPDATE comment_attachments 
            SET comment_id = $1, updated_at = NOW()
            WHERE id = ANY($2) AND uploaded_by = $3
          `;
          const result = await pool.query(updateQuery, [comment.id, attachmentIds, userId]);
          
          logger.info('Attachments linked to comment', {
            commentId: comment.id,
            attachmentIds,
            userId,
            rowsUpdated: result.rowCount
          });
        } catch (attachmentError) {
          logger.error('Failed to link attachments to comment', {
            error: attachmentError,
            commentId: comment.id,
            attachmentIds
          });
        }
      }

      // Get the comment with attachments for response
      const commentWithAttachments = await this.commentModel.getById(comment.id);

      res.status(201).json({
        success: true,
        data: {
          comment: commentWithAttachments || comment,
          message: 'Comment created successfully'
        }
      });

      logger.info('Comment created', {
        commentId: comment.id,
        submissionId,
        userId,
        isReply: !!parentId,
        attachmentCount: attachmentIds?.length || 0
      });

    } catch (error) {
      logger.error('Error creating comment', { 
        error, 
        submissionId: req.params.submissionId,
        userId: req.user?.id 
      });

      if (error instanceof DynamicFormBuilderError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create comment'
          }
        });
      }
    }
  }

  /**
   * Get a specific comment
   */
  async getComment(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: errors.array()
          }
        });
        return;
      }

      const { commentId } = req.params;
      const userId = req.user!.id;

      const comment = await this.commentModel.getById(commentId);
      if (!comment) {
        res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Comment not found'
          }
        });
        return;
      }

      // Check if user can access this comment
      const form = await this.formService.getFormBySubmissionId((comment as any).submission_id, userId);
      const isFormOwner = form?.ownerId === userId;

      const canAccess = await this.commentModel.canUserAccessComment(commentId, Number(userId), isFormOwner);
      if (!canAccess) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to view this comment'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          comment,
          canEdit: (comment as any).user_id === Number(userId) || isFormOwner,
          canDelete: (comment as any).user_id === Number(userId) || isFormOwner
        }
      });

    } catch (error) {
      logger.error('Error getting comment', { error, commentId: req.params.commentId });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get comment'
        }
      });
    }
  }

  /**
   * Update a comment
   */
  async updateComment(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: errors.array()
          }
        });
        return;
      }

      const { commentId } = req.params;
      const { content, isResolved, isPrivate } = req.body;
      const userId = req.user!.id;

      const comment = await this.commentModel.getById(commentId);
      if (!comment) {
        res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Comment not found'
          }
        });
        return;
      }

      // Check permissions - only comment author or form owner can edit
      const form = await this.formService.getFormBySubmissionId((comment as any).submission_id, userId);
      const isFormOwner = form?.ownerId === userId;
      const isCommentAuthor = (comment as any).user_id === Number(userId);

      if (!isCommentAuthor && !isFormOwner) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You can only edit your own comments or comments on your forms'
          }
        });
        return;
      }

      const updateData: UpdateCommentData = {};
      
      if (content !== undefined) {
        updateData.content = content.trim();
      }
      
      // Only form owners can change resolution status
      if (isResolved !== undefined && isFormOwner) {
        updateData.isResolved = isResolved;
      }
      
      // Only comment author or form owner can change privacy
      if (isPrivate !== undefined) {
        updateData.isPrivate = isPrivate;
      }

      const updatedComment = await this.commentModel.update(commentId, updateData);

      res.json({
        success: true,
        data: {
          comment: updatedComment,
          message: 'Comment updated successfully'
        }
      });

      logger.info('Comment updated', {
        commentId,
        userId,
        isFormOwner,
        updatedFields: Object.keys(updateData)
      });

    } catch (error) {
      logger.error('Error updating comment', { 
        error, 
        commentId: req.params.commentId,
        userId: req.user?.id 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update comment'
        }
      });
    }
  }

  /**
   * Delete a comment
   */
  async deleteComment(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: errors.array()
          }
        });
        return;
      }

      const { commentId } = req.params;
      const userId = req.user!.id;

      const comment = await this.commentModel.getById(commentId);
      if (!comment) {
        res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Comment not found'
          }
        });
        return;
      }

      // Check permissions - only comment author or form owner can delete
      const form = await this.formService.getFormBySubmissionId((comment as any).submission_id, userId);
      const isFormOwner = form?.ownerId === userId;
      const isCommentAuthor = (comment as any).user_id === Number(userId);

      if (!isCommentAuthor && !isFormOwner) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You can only delete your own comments or comments on your forms'
          }
        });
        return;
      }

      const deleted = await this.commentModel.delete(commentId);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Comment not found'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          message: 'Comment and its replies deleted successfully'
        }
      });

      logger.info('Comment deleted', {
        commentId,
        userId,
        isFormOwner
      });

    } catch (error) {
      logger.error('Error deleting comment', { 
        error, 
        commentId: req.params.commentId,
        userId: req.user?.id 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete comment'
        }
      });
    }
  }

  /**
   * Get comment statistics for a submission
   */
  async getCommentStats(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { submissionId } = req.params;
      const userId = req.user!.id;

      // Verify user can access the submission
      const submission = await this.submissionService.getSubmissionById(submissionId, userId);
      if (!submission) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SUBMISSION_NOT_FOUND',
            message: 'Submission not found or access denied'
          }
        });
        return;
      }

      const stats = await this.commentModel.getSubmissionCommentStats(submissionId);

      res.json({
        success: true,
        data: {
          submissionId,
          stats
        }
      });

    } catch (error) {
      logger.error('Error getting comment stats', { 
        error, 
        submissionId: req.params.submissionId 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get comment statistics'
        }
      });
    }
  }

  /**
   * Toggle comment resolution status
   */
  async toggleCommentResolution(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { commentId } = req.params;
      const { isResolved } = req.body;
      const userId = req.user!.id;

      const comment = await this.commentModel.getById(commentId);
      if (!comment) {
        res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Comment not found'
          }
        });
        return;
      }

      // Only form owners can change resolution status
      const form = await this.formService.getFormBySubmissionId((comment as any).submission_id, userId);
      if (form?.ownerId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Only form owners can mark comments as resolved'
          }
        });
        return;
      }

      const updatedComment = await this.commentModel.update(commentId, { isResolved });

      res.json({
        success: true,
        data: {
          comment: updatedComment,
          message: `Comment marked as ${isResolved ? 'resolved' : 'unresolved'}`
        }
      });

      logger.info('Comment resolution toggled', {
        commentId,
        userId,
        isResolved
      });

    } catch (error) {
      logger.error('Error toggling comment resolution', { error, commentId: req.params.commentId });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update comment resolution'
        }
      });
    }
  }

  /**
   * Get comment counts for multiple submissions (for table view)
   */
  async getBatchCommentCounts(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: errors.array()
          }
        });
        return;
      }

      const { submissionIds } = req.body;

      if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'submissionIds must be a non-empty array'
          }
        });
        return;
      }

      if (submissionIds.length > 100) {
        res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_SUBMISSIONS',
            message: 'Cannot request comment counts for more than 100 submissions at once'
          }
        });
        return;
      }

      const countMap = await this.commentModel.getCommentsCountForSubmissions(submissionIds);

      // Convert Map to object for JSON response
      const counts: Record<string, number> = {};
      submissionIds.forEach(id => {
        counts[id] = countMap.get(id) || 0;
      });

      res.json({
        success: true,
        data: {
          commentCounts: counts,
          totalSubmissions: submissionIds.length
        }
      });

    } catch (error) {
      logger.error('Error getting batch comment counts', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get comment counts'
        }
      });
    }
  }
}