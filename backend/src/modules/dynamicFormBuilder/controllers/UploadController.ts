/**
 * Upload Controller
 * Handles file upload operations for form submissions
 */

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import fileUploadService from '../services/FileUploadService';
import { FormService } from '../services/FormService';
import { SubmissionService } from '../services/SubmissionService';

// Simple AppError class for error handling
class AppError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'AppError';
  }
}

const formService = new FormService();
const submissionService = new SubmissionService();

export class UploadController {
  /**
   * Upload single file
   */
  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { formId, submissionId } = req.params;
      const { fieldKey } = req.body;
      const file = req.file;

      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      // Verify form exists and get field configuration
      const form = await formService.getFormById(formId);
      if (!form) {
        throw new AppError('Form not found', 404);
      }

      // TODO: Implement field validation
      // For now, allow all file uploads

      // Verify submission exists and belongs to current user (if authenticated)
      const submission = await submissionService.getSubmissionById(submissionId, formId);
      if (!submission) {
        throw new AppError('Submission not found', 404);
      }

      // Check submission ownership if user is authenticated
      if (req.user && submission.submitterId && submission.submitterId !== req.user.id) {
        throw new AppError('Unauthorized to upload files to this submission', 403);
      }

      // Get validation options from field configuration
      const validationOptions = { maxSize: 10 * 1024 * 1024 }; // 10MB default

      // Upload file
      const uploadResult = await fileUploadService.uploadFile(
        file,
        formId,
        submissionId,
        fieldKey,
        validationOptions
      );

      // Update submission data with file info
      const currentData = submission.data || {};
      currentData[fieldKey] = uploadResult;
      
      await submissionService.updateSubmission(
        submissionId,
        { data: currentData },
        req.user?.id || submission.submitterId
      );

      res.status(201).json({
        message: 'File uploaded successfully',
        file: uploadResult
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Failed to upload file' });
      }
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { formId, submissionId } = req.params;
      const { fieldKey } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw new AppError('No files uploaded', 400);
      }

      // Verify form exists and get field configuration
      const form = await formService.getFormById(formId);
      if (!form) {
        throw new AppError('Form not found', 404);
      }

      // TODO: Implement field validation
      // For now, allow all multiple file uploads

      // Verify submission exists
      const submission = await submissionService.getSubmissionById(submissionId, formId);
      if (!submission) {
        throw new AppError('Submission not found', 404);
      }

      // Check submission ownership if user is authenticated
      if (req.user && submission.submitterId && submission.submitterId !== req.user.id) {
        throw new AppError('Unauthorized to upload files to this submission', 403);
      }

      // Get validation options from field configuration
      const validationOptions = { maxSize: 10 * 1024 * 1024 }; // 10MB default

      // Upload files
      const uploadResults = await fileUploadService.uploadMultipleFiles(
        files,
        formId,
        submissionId,
        fieldKey,
        validationOptions
      );

      // Update submission data with file info
      const currentData = submission.data || {};
      currentData[fieldKey] = uploadResults;
      
      await submissionService.updateSubmission(
        submissionId,
        { data: currentData },
        req.user?.id || submission.submitterId
      );

      res.status(201).json({
        message: 'Files uploaded successfully',
        files: uploadResults
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Failed to upload files' });
      }
    }
  }

  /**
   * Delete uploaded file
   */
  async deleteFile(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { formId, submissionId, fileId } = req.params;

      // Verify submission exists and belongs to current user
      const submission = await submissionService.getSubmissionById(submissionId, formId);
      if (!submission) {
        throw new AppError('Submission not found', 404);
      }

      // Check submission ownership
      if (req.user && submission.submitterId && submission.submitterId !== req.user.id) {
        // Check if user is form owner
        const form = await formService.getFormById(formId);
        if (!form || form.ownerId !== req.user.id) {
          throw new AppError('Unauthorized to delete this file', 403);
        }
      }

      // Delete file
      await fileUploadService.deleteFile(fileId, submissionId);

      // Update submission data to remove file reference
      const currentData = submission.data || {};
      
      // Find and remove file reference from data
      for (const key in currentData) {
        const value = currentData[key];
        if (Array.isArray(value)) {
          currentData[key] = value.filter((file: any) => file.id !== fileId);
        } else if (value && typeof value === 'object' && value.id === fileId) {
          delete currentData[key];
        }
      }

      await submissionService.updateSubmission(
        submissionId,
        { data: currentData },
        req.user?.id || submission.submitterId
      );

      res.status(200).json({
        message: 'File deleted successfully'
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        console.error('Delete file error:', error);
        res.status(500).json({ message: 'Failed to delete file' });
      }
    }
  }

  /**
   * Get all files for a submission
   */
  async getSubmissionFiles(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { formId, submissionId } = req.params;

      // Verify submission exists
      const submission = await submissionService.getSubmissionById(submissionId, formId);
      if (!submission) {
        throw new AppError('Submission not found', 404);
      }

      // Check submission ownership or form ownership
      if (req.user) {
        if (submission.submitterId && submission.submitterId !== req.user.id) {
          const form = await formService.getFormById(formId);
          if (!form || form.ownerId !== req.user.id) {
            throw new AppError('Unauthorized to view submission files', 403);
          }
        }
      } else if (!(req as any).sessionId || (req as any).sessionId !== req.sessionId) {
        throw new AppError('Unauthorized to view submission files', 403);
      }

      // Extract file information from submission data
      const files: any[] = [];
      const data = submission.data || {};

      for (const key in data) {
        const value = data[key];
        if (Array.isArray(value)) {
          // Multiple files
          value.forEach((file: any) => {
            if (file && typeof file === 'object' && file.id) {
              files.push({ ...file, fieldKey: key });
            }
          });
        } else if (value && typeof value === 'object' && value.id && value.filename) {
          // Single file
          files.push({ ...value, fieldKey: key });
        }
      }

      res.status(200).json({
        submissionId,
        files
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        console.error('Get files error:', error);
        res.status(500).json({ message: 'Failed to get submission files' });
      }
    }
  }
}