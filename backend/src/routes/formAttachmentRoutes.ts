/**
 * Form Attachment Routes
 * API endpoints for managing file attachments in forms using MEGA S4
 */

import { Router } from 'express';
import multer from 'multer';
import { formAttachmentService } from '../services/FormAttachmentService';
import { authenticate } from '../middleware/auth';
import { XPAuthenticatedRequest } from '../types/auth';

const router = Router();

// Configure multer for file uploads (memory storage since we're uploading to MEGA S4)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Basic file type filtering - more detailed validation in service
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4', 'video/quicktime'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

/**
 * Upload file for form field
 * POST /api/form-attachments/form/:formId/field/:fieldKey
 */
router.post('/form/:formId/field/:fieldKey', 
  authenticate, 
  upload.single('file'), 
  async (req: XPAuthenticatedRequest, res) => {
    try {
      const { formId, fieldKey } = req.params;
      const { submissionId } = req.body;
      const user = req.user!;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      console.log(`📎 Form attachment upload request: ${user.email} -> form ${formId}, field ${fieldKey}`);

      const result = await formAttachmentService.uploadFormAttachment(
        formId,
        fieldKey,
        parseInt(user.id),
        req.file,
        submissionId
      );

      if (result.success) {
        res.json({
          success: true,
          attachment: {
            id: result.attachment!.id,
            originalName: result.attachment!.original_name,
            mimeType: result.attachment!.mime_type,
            fileSize: result.attachment!.file_size,
            fileCategory: result.attachment!.file_category,
            uploadDate: result.attachment!.upload_date,
            validationStatus: result.attachment!.validation_status,
            virusScanStatus: result.attachment!.virus_scan_status
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('Form attachment upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * Get attachments for form
 * GET /api/form-attachments/form/:formId
 */
router.get('/form/:formId', authenticate, async (req: XPAuthenticatedRequest, res) => {
  try {
    const { formId } = req.params;
    const { submissionId } = req.query;
    const user = req.user!;

    // TODO: Check if user has access to this form
    
    const attachments = await formAttachmentService.getFormAttachments(
      formId, 
      submissionId as string
    );

    res.json({
      success: true,
      data: attachments
    });

  } catch (error) {
    console.error('Error fetching form attachments:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get attachments by field
 * GET /api/form-attachments/form/:formId/field/:fieldKey
 */
router.get('/form/:formId/field/:fieldKey', authenticate, async (req: XPAuthenticatedRequest, res) => {
  try {
    const { formId, fieldKey } = req.params;
    const { submissionId } = req.query;
    const user = req.user!;

    // TODO: Check if user has access to this form

    const attachments = await formAttachmentService.getAttachmentsByField(
      formId, 
      fieldKey, 
      submissionId as string
    );

    res.json({
      success: true,
      data: attachments
    });

  } catch (error) {
    console.error('Error fetching field attachments:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Download attachment
 * GET /api/form-attachments/:attachmentId/download
 */
router.get('/:attachmentId/download', authenticate, async (req: XPAuthenticatedRequest, res) => {
  try {
    const { attachmentId } = req.params;
    const { expiresIn = 3600 } = req.query;
    const user = req.user!;

    const result = await formAttachmentService.getDownloadUrl(
      attachmentId,
      parseInt(user.id),
      parseInt(expiresIn as string)
    );

    if (result.success) {
      res.json({
        success: true,
        downloadUrl: result.url,
        expiresIn: parseInt(expiresIn as string)
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Delete attachment
 * DELETE /api/form-attachments/:attachmentId
 */
router.delete('/:attachmentId', authenticate, async (req: XPAuthenticatedRequest, res) => {
  try {
    const { attachmentId } = req.params;
    const user = req.user!;

    const result = await formAttachmentService.deleteAttachment(
      attachmentId,
      parseInt(user.id)
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Attachment deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get attachment details
 * GET /api/form-attachments/:attachmentId
 */
router.get('/:attachmentId', authenticate, async (req: XPAuthenticatedRequest, res) => {
  try {
    const { attachmentId } = req.params;
    const user = req.user!;

    const attachment = await formAttachmentService.getAttachmentById(attachmentId);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found'
      });
    }

    // Check access permission (simplified for now)
    // TODO: Implement proper access control
    
    res.json({
      success: true,
      data: {
        id: attachment.id,
        formId: attachment.form_id,
        submissionId: attachment.submission_id,
        fieldKey: attachment.field_key,
        originalName: attachment.original_name,
        mimeType: attachment.mime_type,
        fileSize: attachment.file_size,
        fileCategory: attachment.file_category,
        uploadDate: attachment.upload_date,
        validationStatus: attachment.validation_status,
        virusScanStatus: attachment.virus_scan_status,
        downloadCount: attachment.download_count,
        createdAt: attachment.created_at,
        updatedAt: attachment.updated_at
      }
    });

  } catch (error) {
    console.error('Error fetching attachment details:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Associate uploaded files with form submission
 * PUT /api/form-attachments/form/:formId/associate-submission
 */
router.put('/form/:formId/associate-submission', authenticate, async (req: XPAuthenticatedRequest, res) => {
  try {
    const { formId } = req.params;
    const { submissionId, fieldData } = req.body;
    const user = req.user!;

    if (!submissionId || !fieldData) {
      return res.status(400).json({
        success: false,
        error: 'submissionId and fieldData are required'
      });
    }

    await formAttachmentService.associateWithSubmission(formId, submissionId, fieldData);

    res.json({
      success: true,
      message: 'Files associated with submission successfully'
    });

  } catch (error) {
    console.error('Error associating files with submission:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;