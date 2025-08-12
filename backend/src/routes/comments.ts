import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authSession';
import * as commentService from '../services/commentService';
import { cachingStrategies, invalidationStrategies } from '../middleware/cacheMiddleware';

const router = express.Router();

// Validation schemas
const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentId: z.string().uuid().optional()
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000)
});

// Get all comments for a submission
router.get('/submissions/:submissionId/comments', authenticate, cachingStrategies.comments, async (req, res) => {
  try {
    const { submissionId } = req.params;
    
    const comments = await commentService.getCommentsBySubmission(submissionId);
    
    res.json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comments'
    });
  }
});

// Create a new comment
router.post('/submissions/:submissionId/comments', authenticate, invalidationStrategies.commentUpdate, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const validatedData = createCommentSchema.parse(req.body);
    
    const comment = await commentService.createComment({
      submissionId,
      userId,
      userName: req.user?.fullName || req.user?.email || 'Anonymous',
      userEmail: req.user?.email || '',
      content: validatedData.content,
      parentId: validatedData.parentId
    });
    
    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: error.errors
      });
    }
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create comment'
    });
  }
});

// Update a comment
router.put('/comments/:commentId', authenticate, invalidationStrategies.commentUpdate, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const validatedData = updateCommentSchema.parse(req.body);
    
    const comment = await commentService.updateComment(
      commentId,
      userId,
      validatedData.content
    );
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found or you do not have permission to edit it'
      });
    }
    
    res.json({
      success: true,
      data: comment
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: error.errors
      });
    }
    console.error('Error updating comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update comment'
    });
  }
});

// Delete a comment (soft delete)
router.delete('/comments/:commentId', authenticate, invalidationStrategies.commentUpdate, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const success = await commentService.deleteComment(commentId, userId, isAdmin);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found or you do not have permission to delete it'
      });
    }
    
    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete comment'
    });
  }
});

export default router;