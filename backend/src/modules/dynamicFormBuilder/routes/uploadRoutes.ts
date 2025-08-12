/**
 * Upload Routes
 * RESTful API endpoints for file uploads in form submissions
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { param, body } from 'express-validator';
import { authenticate, optionalAuth } from '../../../middleware/auth';
import { UploadController } from '../controllers/UploadController';

const router = Router();
const uploadController = new UploadController();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB default limit
    files: 10 // Max 10 files per request
  }
});

// Validation schemas
const uploadFileValidation = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID'),
  
  param('submissionId')
    .isUUID()
    .withMessage('Submission ID must be a valid UUID'),
  
  body('fieldKey')
    .notEmpty()
    .withMessage('Field key is required')
    .isString()
    .isLength({ max: 255 })
    .withMessage('Field key must be less than 255 characters')
];

const deleteFileValidation = [
  param('formId')
    .isUUID()
    .withMessage('Form ID must be a valid UUID'),
  
  param('submissionId')
    .isUUID()
    .withMessage('Submission ID must be a valid UUID'),
  
  param('fileId')
    .isUUID()
    .withMessage('File ID must be a valid UUID')
];

// Routes

/**
 * @route   POST /forms/:formId/submissions/:submissionId/upload
 * @desc    Upload file(s) for a form submission
 * @access  Public (but tracks authenticated users)
 */
router.post('/:formId/submissions/:submissionId/upload',
  optionalAuth,
  upload.single('file') as any,  // Type workaround for multer
  uploadFileValidation,
  async (req: Request, res: Response) => {
    await uploadController.uploadFile(req, res);
  }
);

/**
 * @route   POST /forms/:formId/submissions/:submissionId/upload-multiple
 * @desc    Upload multiple files for a form submission
 * @access  Public (but tracks authenticated users)
 */
router.post('/:formId/submissions/:submissionId/upload-multiple',
  optionalAuth,
  upload.array('files', 10) as any,  // Type workaround for multer
  uploadFileValidation,
  async (req: Request, res: Response) => {
    await uploadController.uploadMultipleFiles(req, res);
  }
);

/**
 * @route   DELETE /forms/:formId/submissions/:submissionId/files/:fileId
 * @desc    Delete uploaded file
 * @access  Private (form owner or submitter)
 */
router.delete('/:formId/submissions/:submissionId/files/:fileId',
  optionalAuth,
  deleteFileValidation,
  async (req: Request, res: Response) => {
    await uploadController.deleteFile(req, res);
  }
);

/**
 * @route   GET /forms/:formId/submissions/:submissionId/files
 * @desc    Get all files for a submission
 * @access  Private (form owner or submitter)
 */
router.get('/:formId/submissions/:submissionId/files',
  optionalAuth,
  [
    param('formId')
      .isUUID()
      .withMessage('Form ID must be a valid UUID'),
    
    param('submissionId')
      .isUUID()
      .withMessage('Submission ID must be a valid UUID')
  ],
  async (req: Request, res: Response) => {
    await uploadController.getSubmissionFiles(req, res);
  }
);

export default router;