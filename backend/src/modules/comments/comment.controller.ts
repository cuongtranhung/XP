// Comment Controller - REST API Endpoints
import { Request, Response, NextFunction } from 'express';
import { commentService } from './comment.service';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import { pool } from '../../utils/database';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // Max 5 files per comment
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Export multer middleware for routes
export const uploadMiddleware = upload.array('files', 5);

// Define AuthRequest type locally
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    full_name: string;
    email_verified: boolean;
    created_at: Date;
    updated_at: Date;
    last_login?: Date;
    role?: string;
  };
}

export class CommentController {
  /**
   * GET /api/submissions/:submissionId/comments
   * Get all comments for a submission
   */
  async getComments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      const { 
        page = '1', 
        limit = '20', 
        sortBy = 'created_at', 
        sortOrder = 'DESC',
        includeDeleted = 'false'
      } = req.query;

      const result = await commentService.getComments(
        {
          submission_id: submissionId,
          include_deleted: includeDeleted === 'true',
        },
        {
          page: parseInt(page as string, 10),
          limit: parseInt(limit as string, 10),
          sort_by: sortBy as any,
          sort_order: sortOrder as any,
        }
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/submissions/:submissionId/comments/count
   * Get comment count for a submission
   */
  async getCommentCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      
      const count = await commentService.getCommentCount(submissionId);

      return res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/comments/:id
   * Get a single comment by ID
   */
  async getCommentById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const comment = await commentService.getCommentById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found',
        });
      }

      return res.json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/submissions/:submissionId/comments
   * Create a new comment with optional file attachments
   */
  async createComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      const { content, parentId } = req.body;
      const userId = req.user!.id;
      const files = req.files as Express.Multer.File[];

      // Validate input - allow empty content if files are attached
      if ((!content || content.trim().length === 0) && (!files || files.length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'Comment content or files are required',
        });
      }

      if (content && content.length > 5000) {
        return res.status(400).json({
          success: false,
          error: 'Comment content must be less than 5000 characters',
        });
      }

      // Create comment first
      const comment = await commentService.createComment({
        submission_id: submissionId,
        user_id: parseInt(userId),
        content: content ? content.trim() : '',
        parent_id: parentId || null,
      });

      console.log('✅ Created comment:', comment.id);

      // Handle file attachments if any
      if (files && files.length > 0) {
        const uploadDir = path.join(process.cwd(), 'uploads', 'comments', comment.id);
        await fs.ensureDir(uploadDir);

        const attachments = [];
        
        for (const file of files) {
          const fileId = uuidv4();
          const fileExtension = path.extname(file.originalname);
          const storedName = `${fileId}${fileExtension}`;
          const filePath = path.join(uploadDir, storedName);
          
          // Save file to disk
          await fs.writeFile(filePath, file.buffer);
          
          // Save attachment record to database
          const attachmentQuery = `
            INSERT INTO comment_attachments (
              id, comment_id, file_key, original_name, 
              mime_type, file_size, uploaded_by,
              validation_status, virus_scan_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'validated', 'clean')
            RETURNING *
          `;
          
          const attachmentValues = [
            fileId,
            comment.id,
            `comments/${comment.id}/${storedName}`,
            file.originalname,
            file.mimetype,
            file.size,
            parseInt(userId)
          ];
          
          const attachmentResult = await pool.query(attachmentQuery, attachmentValues);
          attachments.push({
            id: attachmentResult.rows[0].id,
            original_name: attachmentResult.rows[0].original_name,
            mime_type: attachmentResult.rows[0].mime_type,
            file_size: attachmentResult.rows[0].file_size,
            file_key: attachmentResult.rows[0].file_key,
            url: `/api/comments/attachments/${attachmentResult.rows[0].id}/download`
          });
        }
        
        // Add attachments to comment response
        comment.attachments = attachments;
      }

      return res.status(201).json({
        success: true,
        data: comment,
      });
    } catch (error: any) {
      if (error.message.includes('Parent comment') || 
          error.message.includes('Maximum comment nesting')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * PUT /api/comments/:id
   * Update a comment
   */
  async updateComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'admin';

      // Validate input
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Comment content is required',
        });
      }

      if (content.length > 5000) {
        return res.status(400).json({
          success: false,
          error: 'Comment content must be less than 5000 characters',
        });
      }

      const comment = await commentService.updateComment(
        id,
        userId,
        { content: content.trim() },
        isAdmin
      );

      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found',
        });
      }

      return res.json({
        success: true,
        data: comment,
      });
    } catch (error: any) {
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * DELETE /api/comments/:id
   * Delete a comment (soft delete)
   */
  async deleteComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'admin';

      await commentService.deleteComment(id, userId, isAdmin);

      return res.json({
        success: true,
        message: 'Comment deleted successfully',
      });
    } catch (error: any) {
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/comments/attachments/:attachmentId/download
   * Download a comment attachment
   */
  async downloadAttachment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { attachmentId } = req.params;
      
      // Get attachment info from database
      const query = `
        SELECT ca.*, c.submission_id 
        FROM comment_attachments ca
        JOIN submission_comments c ON ca.comment_id = c.id
        WHERE ca.id = $1 AND ca.deleted_at IS NULL
      `;
      
      const result = await pool.query(query, [attachmentId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Attachment not found',
        });
      }
      
      const attachment = result.rows[0];
      const filePath = path.join(process.cwd(), 'uploads', attachment.file_key);
      
      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'File not found on server',
        });
      }
      
      // Update download count
      await pool.query(
        'UPDATE comment_attachments SET download_count = download_count + 1 WHERE id = $1',
        [attachmentId]
      );
      
      // Send file
      res.download(filePath, attachment.original_name);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/comments/attachments/:attachmentId
   * Delete a comment attachment
   */
  async deleteAttachment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { attachmentId } = req.params;
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'admin';
      
      // Get attachment info
      const query = `
        SELECT ca.*, c.user_id as comment_user_id 
        FROM comment_attachments ca
        JOIN submission_comments c ON ca.comment_id = c.id
        WHERE ca.id = $1 AND ca.deleted_at IS NULL
      `;
      
      const result = await pool.query(query, [attachmentId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Attachment not found',
        });
      }
      
      const attachment = result.rows[0];
      
      // Check permissions
      if (attachment.comment_user_id !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized to delete this attachment',
        });
      }
      
      // Soft delete
      await pool.query(
        'UPDATE comment_attachments SET deleted_at = NOW() WHERE id = $1',
        [attachmentId]
      );
      
      // Optionally delete physical file
      const filePath = path.join(process.cwd(), 'uploads', attachment.file_key);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
      
      return res.json({
        success: true,
        message: 'Attachment deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/comments/:id/restore
   * Restore a deleted comment
   */
  async restoreComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'admin';

      const comment = await commentService.restoreComment(id, userId, isAdmin);

      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found',
        });
      }

      return res.json({
        success: true,
        data: comment,
      });
    } catch (error: any) {
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/users/:userId/comments
   * Get all comments by a user
   */
  async getUserComments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { 
        page = '1', 
        limit = '20', 
        sortBy = 'created_at', 
        sortOrder = 'DESC' 
      } = req.query;

      const result = await commentService.getUserComments(
        userId,
        {
          page: parseInt(page as string, 10),
          limit: parseInt(limit as string, 10),
          sort_by: sortBy as any,
          sort_order: sortOrder as any,
        }
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/submissions/:submissionId/comments/stats
   * Get comment statistics for a submission
   */
  async getCommentStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      
      const stats = await commentService.getCommentStats(submissionId);

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/submissions/comments/counts
   * Get comment counts for multiple submissions
   */
  async getCommentCounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { submissionIds } = req.body;

      if (!Array.isArray(submissionIds)) {
        return res.status(400).json({
          success: false,
          error: 'submissionIds must be an array',
        });
      }

      const counts = await commentService.getCommentCounts(submissionIds);

      // Convert Map to object for JSON response
      const countsObject: Record<string, number> = {};
      counts.forEach((value, key) => {
        countsObject[key] = value;
      });

      return res.json({
        success: true,
        data: countsObject,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const commentController = new CommentController();

// Export class for testing
export default CommentController;