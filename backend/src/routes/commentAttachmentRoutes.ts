import { Router, Request, Response } from 'express';
import multer from 'multer';
import { commentAttachmentService } from '../services/CommentAttachmentService';
import { authenticate } from '../middleware/auth';
import { imageNotesRoutes } from './imageNotesRoutes';

const router = Router();

// Most routes require authentication, but we'll handle /image endpoint separately
// router.use(authenticate); // Commented out to allow selective authentication

// Debug route to check if router is working
// GET /api/comment-attachments/debug
router.get('/debug', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Comment attachment routes are working',
    timestamp: new Date().toISOString()
  });
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MEGA_S4_MAX_FILE_SIZE || '104857600'), // 100MB default
  },
});

// Middleware to extract user info (simplified for development)
const getUserInfo = (req: Request) => {
  // Extract user from JWT token (added by authenticate middleware)
  return (req as any).user || null;
};

/**
 * Temporary upload for comment attachments (before comment is created)
 * POST /api/comment-attachments/submission/:submissionId/temp
 */
router.post(
  '/submission/:submissionId/temp',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      console.log('🔍 === TEMPORARY UPLOAD DEBUG START ===');
      console.log('Request method:', req.method);
      console.log('Request URL:', req.url);
      console.log('Request params:', req.params);
      console.log('Request headers (partial):', {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? `Bearer ${req.headers.authorization.slice(7, 27)}...` : 'NONE',
        'content-length': req.headers['content-length']
      });
      console.log('Auth middleware passed, user:', req.user);
      console.log('Multer file:', req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : 'NO FILE');
      console.log('Request body keys:', Object.keys(req.body));
      
      const { submissionId } = req.params;
      const user = getUserInfo(req);

      console.log(`📤 Temporary upload request for submission ${submissionId}`);
      console.log('User from getUserInfo:', user);

      if (!user) {
        console.error('❌ No user found after authentication');
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      if (!req.file) {
        console.error('❌ No file provided in request');
        return res.status(400).json({
          success: false,
          error: 'No file provided',
        });
      }

      if (!submissionId) {
        console.error('❌ No submission ID in params');
        return res.status(400).json({
          success: false,
          error: 'Submission ID required',
        });
      }

      // Create temporary comment ID
      const tempCommentId = `temp-${submissionId}`;
      console.log(`📁 Processing temporary upload: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)}MB) for temp comment ${tempCommentId}`);

      // Create a temporary attachment (no comment ID yet)
      console.log('🔄 Calling commentAttachmentService.uploadAttachment...');
      const result = await commentAttachmentService.uploadAttachment(
        tempCommentId, // Use temporary comment ID
        user.id,
        req.file
      );
      console.log('📤 Upload service result:', {
        success: result.success,
        error: result.error,
        attachmentId: result.attachment?.id,
        uploadKey: result.uploadResult?.key
      });

      if (result.success) {
        const response = {
          success: true,
          id: result.attachment!.id,
          url: `/api/comment-attachments/${result.attachment!.id}/download?direct=true`,
          attachment: {
            id: result.attachment!.id,
            originalName: result.attachment!.original_name,
            mimeType: result.attachment!.mime_type,
            fileSize: result.attachment!.file_size,
            fileCategory: result.attachment!.file_category,
            uploadDate: result.attachment!.upload_date,
            validationStatus: result.attachment!.validation_status,
            virusScanStatus: result.attachment!.virus_scan_status,
          },
          uploadResult: {
            key: result.uploadResult?.key,
            etag: result.uploadResult?.etag,
            validation: result.uploadResult?.validation ? {
              valid: result.uploadResult.validation.valid,
              errors: result.uploadResult.validation.errors,
              warnings: result.uploadResult.validation.warnings,
              fileInfo: result.uploadResult.validation.fileInfo
            } : undefined
          }
        };
        
        console.log('✅ Sending success response:', JSON.stringify(response, null, 2));
        console.log('🔍 === TEMPORARY UPLOAD DEBUG END (SUCCESS) ===');
        return res.json(response);
      } else {
        console.error('❌ Upload service failed:', result.error);
        console.log('🔍 === TEMPORARY UPLOAD DEBUG END (SERVICE FAILED) ===');
        return res.status(400).json({
          success: false,
          error: result.error,
          uploadResult: result.uploadResult
        });
      }
    } catch (error) {
      console.error('🚨 ERROR in temporary upload:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.log('🔍 === TEMPORARY UPLOAD DEBUG END (EXCEPTION) ===');
      
      // Handle Multer errors
      if (error instanceof Error && error.message === 'File too large') {
        return res.status(400).json({
          success: false,
          error: `File exceeds maximum size limit of ${(parseInt(process.env.MEGA_S4_MAX_FILE_SIZE || '104857600') / 1048576).toFixed(0)}MB`,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to upload attachment: ' + (error instanceof Error ? error.message : String(error)),
      });
    }
  }
);

/**
 * Upload attachment to comment
 * POST /api/comment-attachments/comment/:commentId
 */
router.post(
  '/comment/:commentId',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      const user = getUserInfo(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided',
        });
      }

      // Verify comment exists and user has permission
      // TODO: Add proper permission checking

      const result = await commentAttachmentService.uploadAttachment(
        commentId,
        user.id,
        req.file
      );

      if (result.success) {
        return res.json({
          success: true,
          attachment: {
            id: result.attachment!.id,
            originalName: result.attachment!.original_name,
            mimeType: result.attachment!.mime_type,
            fileSize: result.attachment!.file_size,
            fileCategory: result.attachment!.file_category,
            uploadDate: result.attachment!.upload_date,
            validationStatus: result.attachment!.validation_status,
            virusScanStatus: result.attachment!.virus_scan_status,
          },
          uploadResult: {
            key: result.uploadResult?.key,
            etag: result.uploadResult?.etag,
            validation: result.uploadResult?.validation ? {
              valid: result.uploadResult.validation.valid,
              errors: result.uploadResult.validation.errors,
              warnings: result.uploadResult.validation.warnings,
              fileInfo: result.uploadResult.validation.fileInfo
            } : undefined
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
          uploadResult: result.uploadResult
        });
      }
    } catch (error) {
      console.error('Upload attachment error:', error);
      
      // Handle Multer errors
      if (error instanceof Error && error.message === 'File too large') {
        return res.status(400).json({
          success: false,
          error: `File exceeds maximum size limit of ${(parseInt(process.env.MEGA_S4_MAX_FILE_SIZE || '104857600') / 1048576).toFixed(0)}MB`,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to upload attachment',
      });
    }
  }
);

/**
 * Get attachments for a comment
 * GET /api/comment-attachments/comment/:commentId
 */
router.get('/comment/:commentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const user = getUserInfo(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const attachments = await commentAttachmentService.getCommentAttachments(commentId);

    return res.json({
      success: true,
      attachments: attachments.map(att => ({
        id: att.id,
        originalName: att.original_name,
        mimeType: att.mime_type,
        fileSize: att.file_size,
        fileCategory: att.file_category,
        uploadDate: att.upload_date,
        downloadCount: att.download_count,
        validationStatus: att.validation_status,
        virusScanStatus: att.virus_scan_status,
        isPublic: att.is_public,
        uploadedBy: att.uploaded_by
      }))
    });
  } catch (error) {
    console.error('Get attachments error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get attachments',
    });
  }
});

/**
 * Direct image serving endpoint (for use in img tags)
 * GET /api/comment-attachments/:attachmentId/image
 * This endpoint works without authentication for simplicity
 * In production, you should implement proper security
 */
router.get('/:attachmentId/image', async (req: Request, res: Response) => {
  try {
    const { attachmentId } = req.params;
    
    // For development, we'll allow access without authentication
    // In production, you should verify access rights properly
    const result = await commentAttachmentService.getDownloadUrl(attachmentId, 1, 3600); // Using user ID 1 as default

    if (result.success && result.url) {
      // Redirect to the presigned URL so the browser can display the image
      return res.redirect(result.url);
    } else {
      // Return transparent 1x1 pixel for not found
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.writeHead(404, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-cache'
      });
      return res.end(pixel);
    }
  } catch (error) {
    console.error('Image serving error:', error);
    // Return transparent 1x1 pixel for errors
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(500, {
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache'
    });
    return res.end(pixel);
  }
});

/**
 * Download attachment (returns actual file for direct use in img tags)
 * GET /api/comment-attachments/:attachmentId/download
 * 
 * This endpoint handles both authenticated and public image requests
 * Use ?direct=true for public image access (e.g., in img tags)
 */
router.get('/:attachmentId/download', async (req: Request, res: Response, next: any) => {
  const { attachmentId } = req.params;
  const { expires, direct } = req.query;
  
  // For direct image requests (from img tags), skip authentication
  if (direct === 'true' || req.headers['accept']?.includes('image/')) {
    try {
      const expiresIn = expires ? parseInt(expires as string) : 3600;
      const result = await commentAttachmentService.getDownloadUrl(attachmentId, 1, expiresIn); // Using user ID 1 as default
      
      if (result.success && result.url) {
        // Redirect to the presigned URL so the browser can display the image
        return res.redirect(result.url);
      } else {
        // Return transparent 1x1 pixel for not found
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(404, {
          'Content-Type': 'image/gif',
          'Content-Length': pixel.length,
          'Cache-Control': 'no-cache'
        });
        return res.end(pixel);
      }
    } catch (error) {
      console.error('Direct download error:', error);
      // Return transparent 1x1 pixel for errors
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.writeHead(500, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-cache'
      });
      return res.end(pixel);
    }
  }
  
  // For non-direct requests, apply authentication middleware and continue
  authenticate(req, res, async () => {
    try {
      const user = getUserInfo(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      const expiresIn = expires ? parseInt(expires as string) : 3600;
      const result = await commentAttachmentService.getDownloadUrl(attachmentId, user.id, expiresIn);

      if (result.success && result.url) {
        // Return JSON with the download URL for authenticated requests
        return res.json({
          success: true,
          downloadUrl: result.url,
          expiresIn,
        });
      } else {
        return res.status(404).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error('Download attachment error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate download URL',
      });
    }
  });
});

/**
 * Get attachment info
 * GET /api/comment-attachments/:attachmentId
 */
router.get('/:attachmentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const user = getUserInfo(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const attachment = await commentAttachmentService.getAttachmentById(attachmentId);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found',
      });
    }

    return res.json({
      success: true,
      attachment: {
        id: attachment.id,
        commentId: attachment.comment_id,
        originalName: attachment.original_name,
        mimeType: attachment.mime_type,
        fileSize: attachment.file_size,
        fileCategory: attachment.file_category,
        uploadDate: attachment.upload_date,
        downloadCount: attachment.download_count,
        validationStatus: attachment.validation_status,
        validationErrors: attachment.validation_errors,
        virusScanStatus: attachment.virus_scan_status,
        isPublic: attachment.is_public,
        uploadedBy: attachment.uploaded_by,
        checksum: attachment.checksum
      }
    });
  } catch (error) {
    console.error('Get attachment info error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get attachment info',
    });
  }
});

/**
 * Delete attachment
 * DELETE /api/comment-attachments/:attachmentId
 */
router.delete('/:attachmentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const user = getUserInfo(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const result = await commentAttachmentService.deleteAttachment(attachmentId, user.id);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Attachment deleted successfully',
      });
    } else {
      return res.status(403).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Delete attachment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete attachment',
    });
  }
});

/**
 * Get attachment statistics for multiple comments
 * POST /api/comment-attachments/stats
 */
router.post('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const { commentIds } = req.body;
    const user = getUserInfo(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!Array.isArray(commentIds)) {
      return res.status(400).json({
        success: false,
        error: 'commentIds must be an array',
      });
    }

    const stats = await commentAttachmentService.getAttachmentStats(commentIds);

    return res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Get attachment stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get attachment statistics',
    });
  }
});

// Mount Image Notes routes - these will be available at:
// /api/comment-attachments/:attachmentId/notes
router.use('/', imageNotesRoutes);

export default router;