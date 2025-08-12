/**
 * Submission Controller
 * Handles HTTP requests for form submissions
 */

import { Response } from 'express';
import { validationResult } from 'express-validator';
import submissionServiceWithPermissions from '../services/SubmissionServiceWithPermissions';
import { AnalyticsService } from '../services/AnalyticsService';
import formServiceWithPermissions from '../services/FormServiceWithPermissions';
import { XPAuthenticatedRequest, DynamicFormBuilderError } from '../types';
import { logger } from '../../../utils/logger';
import { exportSubmissions } from '../utils/exportUtils';
import { importSubmissions } from '../utils/importUtils';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

export class SubmissionController {
  private submissionService: typeof submissionServiceWithPermissions;
  private analyticsService: AnalyticsService;
  private formService: typeof formServiceWithPermissions;

  constructor() {
    this.submissionService = submissionServiceWithPermissions;
    this.analyticsService = new AnalyticsService();
    this.formService = formServiceWithPermissions;
  }

  /**
   * Submit form data
   */
  async submitForm(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array()
          }
        });
        return;
      }

      const { formId } = req.params;
      const submitterId = req.user?.id;
      const submitterIp = req.ip;

      // TODO: Fix analytics table structure first
      // Record form view first (for analytics)
      // await this.analyticsService.recordFormView(formId, {
      //   sessionId: req.sessionId,
      //   userId: submitterId,
      //   ip: submitterIp,
      //   userAgent: req.get('User-Agent'),
      //   referrer: req.get('Referer'),
      //   utmParams: {
      //     utm_source: req.query.utm_source as string,
      //     utm_medium: req.query.utm_medium as string,
      //     utm_campaign: req.query.utm_campaign as string
      //   }
      // });

      const submission = await this.submissionService.createSubmission(
        formId,
        req.body,
        submitterId,
        submitterIp
      );

      res.status(201).json({
        success: true,
        data: {
          id: submission.id,
          formId: submission.formId,
          submissionNumber: submission.submissionNumber || 0,
          status: submission.status,
          submittedAt: submission.submittedAt,
          confirmation: {
            message: 'Thank you for your submission!',
            referenceNumber: `SUB-${submission.id.slice(0, 8).toUpperCase()}`
          },
          score: submission.score,
          processingStatus: 'pending'
        }
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to submit form');
    }
  }

  /**
   * Get submission details
   */
  async getSubmission(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { formId, submissionId } = req.params;
      const userId = req.user?.id;

      const submission = await this.submissionService.getSubmissionById(submissionId, userId);

      if (!submission) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SUBMISSION_NOT_FOUND',
            message: 'Submission not found'
          }
        });
        return;
      }

      if (submission.formId !== formId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'FORM_MISMATCH',
            message: 'Submission does not belong to this form'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: submission
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to retrieve submission');
    }
  }

  /**
   * List form submissions
   */
  async listSubmissions(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { formId } = req.params;
      const query = {
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
        status: req.query.status as any,
        dateFrom: req.query.date_from as string,
        dateTo: req.query.date_to as string,
        search: req.query.search as string,
        export: req.query.export as 'csv' | 'xlsx' | 'json'
      };

      // Handle export requests
      if (query.export) {
        const exportResult = await this.submissionService.exportSubmissions(
          formId,
          req.user.id,
          query.export,
          {
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            includeMetadata: req.query.include_metadata === 'true'
          }
        );

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="submissions-${formId}-${new Date().toISOString().split('T')[0]}.${query.export}"`);
        res.json(exportResult);
        return;
      }

      const result = await this.submissionService.listSubmissions(formId, req.user.id, query);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to list submissions');
    }
  }

  /**
   * Update submission (draft only)
   */
  async updateSubmission(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array()
          }
        });
        return;
      }

      const { formId, submissionId } = req.params;
      const userId = req.user?.id;

      const submission = await this.submissionService.updateSubmission(
        submissionId,
        req.body,
        userId
      );

      // Verify the submission belongs to the form
      if (submission.formId !== formId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'FORM_MISMATCH',
            message: 'Submission does not belong to this form'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: submission
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to update submission');
    }
  }

  /**
   * Delete submission
   */
  async deleteSubmission(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { submissionId } = req.params;

      await this.submissionService.deleteSubmission(submissionId, req.user.id);

      res.json({
        success: true,
        message: 'Submission deleted successfully'
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to delete submission');
    }
  }

  /**
   * Export form submissions
   */
  async exportSubmissions(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { formId } = req.params;
      const format = (req.query.format as 'csv' | 'xlsx' | 'json') || 'csv';
      const options = {
        fields: req.query.fields ? (req.query.fields as string).split(',') : undefined,
        dateFrom: req.query.date_from as string,
        dateTo: req.query.date_to as string,
        includeMetadata: req.query.include_metadata === 'true',
        status: req.query.status as string,
        ids: req.query.ids ? (req.query.ids as string).split(',') : undefined
      };

      // Get form details
      const form = await this.formService.getFormById(formId, req.user.id);
      if (!form) {
        res.status(404).json({
          success: false,
          error: {
            code: 'FORM_NOT_FOUND',
            message: 'Form not found'
          }
        });
        return;
      }

      // Get submissions
      const query: any = {
        limit: 10000, // Large limit for export
        dateFrom: options.dateFrom,
        dateTo: options.dateTo
      };

      if (options.status) {
        query.status = options.status;
      }

      const submissionsResult = await this.submissionService.listSubmissions(formId, req.user.id, query);
      let submissions = submissionsResult.submissions;

      // Filter by IDs if specified
      if (options.ids && options.ids.length > 0) {
        submissions = submissions.filter(s => options.ids!.includes(s.id));
      }

      // Generate export buffer
      const exportBuffer = await exportSubmissions(format, {
        submissions,
        form,
        fields: options.fields,
        includeMetadata: options.includeMetadata
      });

      // Set appropriate headers based on format
      let contentType = 'application/json';
      let filename = `submissions-${formId}-${new Date().toISOString().split('T')[0]}.${format}`;

      switch (format) {
        case 'csv':
          contentType = 'text/csv';
          break;
        case 'xlsx':
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'json':
          contentType = 'application/json';
          break;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Send the buffer as response
      res.send(exportBuffer);
    } catch (error) {
      this.handleError(error, res, 'Failed to export submissions');
    }
  }

  /**
   * Get form analytics
   */
  async getFormAnalytics(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { formId } = req.params;
      const period = (req.query.period as string) || '30d';
      const timezone = (req.query.timezone as string) || 'UTC';

      const analytics = await this.analyticsService.getFormAnalyticsSummary(
        formId,
        period,
        timezone
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to retrieve form analytics');
    }
  }

  /**
   * Get field-specific analytics
   */
  async getFieldAnalytics(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { formId } = req.params;
      const period = (req.query.period as string) || '30d';

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }

      const fieldAnalytics = await this.analyticsService.getFieldAnalytics(formId, {
        start: startDate,
        end: endDate
      });

      const completionFunnel = await this.analyticsService.getCompletionFunnel(formId, {
        start: startDate,
        end: endDate
      });

      res.json({
        success: true,
        data: {
          fields: fieldAnalytics,
          completionFunnel
        }
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to retrieve field analytics');
    }
  }

  /**
   * Import form submissions from file
   */
  async importSubmissions(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication required'
          }
        });
        return;
      }

      // Configure multer for file upload
      const storage = multer.memoryStorage();
      const upload = multer({
        storage,
        limits: {
          fileSize: 10 * 1024 * 1024 // 10MB limit
        },
        fileFilter: (req, file, cb) => {
          const allowedMimes = [
            'text/csv',
            'application/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/json'
          ];
          
          if (allowedMimes.includes(file.mimetype) || 
              file.originalname.match(/\.(csv|xlsx|xls|json)$/i)) {
            cb(null, true);
          } else {
            cb(new Error('Invalid file type. Only CSV, Excel, and JSON files are allowed.'));
          }
        }
      }).single('file');

      // Handle file upload
      await new Promise((resolve, reject) => {
        upload(req, res, (err) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'FILE_REQUIRED',
            message: 'Please upload a file'
          }
        });
        return;
      }

      const { formId } = req.params;
      
      // Get form details to access field definitions
      const form = await this.formService.getFormById(formId, req.user.id);
      if (!form) {
        res.status(404).json({
          success: false,
          error: {
            code: 'FORM_NOT_FOUND',
            message: 'Form not found'
          }
        });
        return;
      }

      // Determine format from file extension or request body
      const extension = req.file.originalname.split('.').pop()?.toLowerCase();
      let format: 'csv' | 'xlsx' | 'json' = 'csv';
      
      if (extension === 'xlsx' || extension === 'xls') {
        format = 'xlsx';
      } else if (extension === 'json') {
        format = 'json';
      } else if (extension === 'csv') {
        format = 'csv';
      } else if (req.body.format) {
        format = req.body.format;
      }

      // Import submissions from file
      const importResult = await importSubmissions(
        format,
        req.file.buffer,
        form.fields
      );

      if (importResult.submissions.length === 0 && importResult.errors.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_DATA',
            message: 'No valid data found in the uploaded file'
          }
        });
        return;
      }

      // Batch insert submissions
      let imported = 0;
      let failed = 0;
      const failedDetails: any[] = [];

      for (const submission of importResult.submissions) {
        try {
          // Create submission with imported data
          await this.submissionService.createSubmission(
            formId,
            {
              data: submission.data,
              metadata: submission.metadata || {},
              partial: false
            },
            req.user.id,
            req.ip,
            {
              userEmail: submission.userEmail,
              userName: submission.userName,
              status: submission.status || 'completed',
              submittedAt: submission.submittedAt
            }
          );
          imported++;
        } catch (error) {
          failed++;
          failedDetails.push({
            data: submission.data,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error('Failed to import submission', { error, submission });
        }
      }

      // Add errors from parsing phase
      if (importResult.errors.length > 0) {
        failed += importResult.errors.length;
        failedDetails.push(...importResult.errors);
      }

      res.json({
        success: true,
        data: {
          imported,
          failed,
          total: imported + failed,
          failedDetails: failed > 0 ? failedDetails : undefined
        },
        message: `Successfully imported ${imported} submission(s)`
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to import submissions');
    }
  }

  /**
   * Batch update status for multiple submissions
   */
  async batchUpdateStatus(req: XPAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array()
          }
        });
        return;
      }

      const { formId } = req.params;
      const { submissionIds, status } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      const result = await this.submissionService.batchUpdateStatus(
        formId,
        submissionIds,
        status,
        userId
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to update submission status');
    }
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: any, res: Response, defaultMessage: string): void {
    if (error instanceof DynamicFormBuilderError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details })
        }
      });
    } else {
      logger.error(defaultMessage, { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  }
}