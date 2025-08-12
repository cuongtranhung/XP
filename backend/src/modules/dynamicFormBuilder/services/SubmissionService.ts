/**
 * Submission Service
 * Handles form submission processing and management
 */

import { Pool } from 'pg';
import { logger } from '../../../utils/logger';
import { getDb, querySchema, withSchemaTransaction } from '../database';
import { cachedRepositories } from '../../../services/cachedRepositoryService';
import {
  FormSubmission,
  CreateSubmissionRequest,
  ListSubmissionsQuery,
  SubmissionStatus,
  DynamicFormBuilderError,
  ValidationResult,
  ValidationError
} from '../types';
import { FormService } from './FormService';

export class SubmissionService {
  private db: Pool;
  private formService: FormService;

  constructor() {
    this.db = getDb();
    this.formService = new FormService();
  }

  /**
   * Create a new form submission
   */
  async createSubmission(
    formId: string, 
    data: CreateSubmissionRequest,
    submitterId?: string,
    submitterIp?: string,
    importOptions?: {
      userEmail?: string;
      userName?: string;
      status?: 'draft' | 'completed' | 'processing' | 'failed';
      submittedAt?: Date;
    }
  ): Promise<FormSubmission> {
    logger.info('Starting createSubmission', { formId, submitterId, submitterIp });
    const client = await this.db.connect();
    
    try {
      logger.info('Beginning transaction');
      await client.query('BEGIN');

      // Get form to validate against
      logger.info('Getting form by ID');
      const form = await this.formService.getFormById(formId);
      if (!form) {
        throw new DynamicFormBuilderError('Form not found', 'FORM_NOT_FOUND', 404);
      }

      if (form.status !== 'published') {
        throw new DynamicFormBuilderError('Form is not published', 'FORM_NOT_PUBLISHED', 400);
      }

      // Get form fields for validation
      logger.info('Getting form fields for validation');
      const fieldsQuery = 'SELECT * FROM form_fields WHERE form_id = $1 ORDER BY display_order';
      logger.info('Executing fields query', { query: fieldsQuery, formId });
      
      const fieldsResult = await client.query(fieldsQuery, [formId]);
      const formFields = fieldsResult.rows;
      logger.info('Got form fields', { count: formFields.length });

      // Validate submission data
      const validation = this.validateSubmissionData(data.data, formFields);
      if (!validation.isValid) {
        throw new DynamicFormBuilderError(
          'Validation failed',
          'VALIDATION_ERROR',
          400,
          validation.errors
        );
      }

      // Since submission_number column doesn't exist, we'll use ID for now
      const submissionNumber = 0; // Will use auto-generated ID instead

      // Determine status - use import options or default logic
      const status: SubmissionStatus = importOptions?.status || 
        (data.partial ? 'processing' : 'submitted');
      const submittedAt = (importOptions?.submittedAt || 
        (status === 'submitted' ? new Date() : null));

      // Calculate completion time if submitted
      let completionTime: number | undefined;
      if (status === 'submitted' && data.metadata && (data.metadata as any).startTime) {
        completionTime = Math.round((Date.now() - (data.metadata as any).startTime) / 1000);
      }

      // Use import options for email/name if provided
      const submitterEmail = importOptions?.userEmail || data.submitterEmail || null;
      const submitterName = importOptions?.userName || data.submitterName || null;

      // Create submission - using actual database columns
      const insertQuery = `
        INSERT INTO form_submissions (
          form_id, status, submission_data, metadata, 
          submitter_id, submitter_ip, submitter_email
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      // Log the query for debugging
      logger.info('Executing submission insert query', {
        query: insertQuery,
        params: [
          formId,
          status,
          JSON.stringify(data.data),
          JSON.stringify(data.metadata || {}),
          submitterId,
          submitterIp,
          submitterEmail
        ]
      });

      const submissionResult = await client.query(insertQuery, [
        formId,
        status,
        JSON.stringify(data.data),
        JSON.stringify(data.metadata || {}),
        submitterId,
        submitterIp,
        submitterEmail
      ]);

      const submission = submissionResult.rows[0];

      // TODO: Update form analytics if submitted - table structure needs to be fixed
      // if (status === 'submitted') {
      //   await this.updateFormAnalytics(client, formId, submitterId !== undefined);
      // }

      // TODO: Trigger webhooks for submission events
      // await this.triggerWebhooks(formId, 'submission.created', submission);

      await client.query('COMMIT');

      logger.info('Form submission created', {
        formId,
        submissionId: submission.id,
        submissionNumber,
        status,
        submitterId
      });

      return this.transformSubmissionRow(submission);
    } catch (error) {
      await client.query('ROLLBACK');
      
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to create submission', { 
        error, 
        formId, 
        submitterId,
        errorMessage: (error as any).message,
        errorDetail: (error as any).detail,
        errorCode: (error as any).code
      });
      throw new DynamicFormBuilderError('Failed to create submission', 'SUBMISSION_CREATE_FAILED', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Get submission by ID
   */
  async getSubmissionById(submissionId: string, userId?: string): Promise<FormSubmission | null> {
    try {
      // Use cached repository for submission lookup
      return await cachedRepositories.submissions.getById<FormSubmission>(
        submissionId,
        async () => {
          let query = `
            SELECT s.*, f.name as form_name, f.owner_id as form_owner_id
            FROM form_submissions s
            JOIN forms f ON s.form_id = f.id
            WHERE s.id = $1
          `;
          const params = [submissionId];

          // UPDATED: Allow all authenticated users to view submissions
          // This enables multi-user collaboration and commenting
          // Form owners still have edit/delete rights, but everyone can view
          
          // Note: We removed the restriction, so any logged-in user can view any submission
          // Access control is now based on form visibility settings, not ownership

          const result = await this.db.query(query, params);
      
          if (result.rows.length === 0) {
            return null;
          }

          return this.transformSubmissionRow(result.rows[0]);
        }
      );
    } catch (error) {
      logger.error('Failed to get submission by ID', { error, submissionId });
      throw new DynamicFormBuilderError('Failed to retrieve submission', 'SUBMISSION_FETCH_FAILED', 500);
    }
  }

  /**
   * List form submissions with pagination and filtering
   */
  async listSubmissions(formId: string, userId: string, query: ListSubmissionsQuery = {}) {
    try {
      // Get form to check ownership
      const form = await this.formService.getFormById(formId);
      if (!form) {
        throw new DynamicFormBuilderError('Form not found', 'FORM_NOT_FOUND', 404);
      }

      // Determine if user is owner
      const isOwner = form.ownerId === userId;

      const {
        page = 1,
        limit = 20,
        status,
        dateFrom,
        dateTo,
        search
      } = query;

      const offset = (page - 1) * Math.min(limit, 100);

      // Build WHERE clause
      const conditions = ['s.form_id = $1'];
      const params = [formId];
      let paramCount = 1;

      // UPDATED: Allow all users to view submissions of public forms
      // Only form settings determine visibility, not ownership
      // Form owners can still edit/delete, but everyone can view
      
      // Note: We removed the restriction that non-owners can only see their own submissions
      // This enables multi-user collaboration and commenting on all submissions

      if (status) {
        conditions.push(`s.status = $${++paramCount}`);
        params.push(status);
      }

      if (dateFrom) {
        conditions.push(`s.created_at >= $${++paramCount}`);
        params.push(dateFrom);
      }

      if (dateTo) {
        conditions.push(`s.created_at <= $${++paramCount}`);
        params.push(dateTo);
      }

      if (search) {
        conditions.push(`s.submission_data::text ILIKE $${++paramCount}`);
        params.push(`%${search}%`);
      }

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM form_submissions s
        WHERE ${conditions.join(' AND ')}
      `;

      // Main query
      const mainQuery = `
        SELECT s.*, u.full_name as submitter_name
        FROM form_submissions s
        LEFT JOIN users u ON s.submitter_id = u.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY s.created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      params.push(limit, offset);

      const [countResult, submissionsResult] = await Promise.all([
        this.db.query(countQuery, params.slice(0, -2)),
        this.db.query(mainQuery, params)
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      const submissions = submissionsResult.rows.map(row => this.transformSubmissionRow(row));

      return {
        submissions,
        pagination: {
          page,
          limit,
          total,
          pages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to list submissions', { error, formId, userId });
      throw new DynamicFormBuilderError('Failed to list submissions', 'SUBMISSIONS_LIST_FAILED', 500);
    }
  }

  /**
   * Update submission (for draft submissions only)
   */
  async updateSubmission(
    submissionId: string,
    data: Partial<CreateSubmissionRequest>,
    userId?: string
  ): Promise<FormSubmission> {
    try {
      // Check submission exists and is draft
      const existing = await this.getSubmissionById(submissionId, userId);
      if (!existing) {
        throw new DynamicFormBuilderError('Submission not found', 'SUBMISSION_NOT_FOUND', 404);
      }

      // Check if user can update this submission
      // Form owner can update any submission, submitter can only update their own
      const form = await this.formService.getFormById(existing.formId, userId);
      const isFormOwner = form && form.ownerId === userId;
      const isSubmitter = existing.submitterId === userId;
      
      if (!isFormOwner && !isSubmitter) {
        throw new DynamicFormBuilderError('Access denied', 'ACCESS_DENIED', 403);
      }

      // Allow updating submitted/completed submissions only with partial flag
      if (existing.status !== 'draft' && !data.partial) {
        throw new DynamicFormBuilderError('Can only update non-draft submissions with partial flag', 'SUBMISSION_NOT_DRAFT', 400);
      }

      // Build update query
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      if (data.data !== undefined) {
        updates.push(`submission_data = $${++paramCount}`);
        params.push(JSON.stringify(data.data));
      }

      if (data.metadata !== undefined) {
        updates.push(`metadata = $${++paramCount}`);
        params.push(JSON.stringify(data.metadata));
      }

      if (data.currentStep !== undefined) {
        updates.push(`current_step = $${++paramCount}`);
        params.push(data.currentStep);
      }

      if (data.completedSteps !== undefined) {
        updates.push(`completed_steps = $${++paramCount}`);
        params.push(data.completedSteps);
      }

      // Check if submission should be marked as completed
      if (data.partial === false) {
        updates.push(`status = 'completed'`);
        updates.push(`submitted_at = CURRENT_TIMESTAMP`);
      }

      if (updates.length === 0) {
        throw new DynamicFormBuilderError('No updates provided', 'NO_UPDATES', 400);
      }

      const updateQuery = `
        UPDATE form_submissions 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${++paramCount}
        RETURNING *
      `;
      params.push(submissionId);

      const result = await this.db.query(updateQuery, params);

      // Invalidate submission cache after update
      await cachedRepositories.submissions.invalidate(submissionId);

      logger.info('Submission updated', { submissionId, userId });

      return this.transformSubmissionRow(result.rows[0]);
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to update submission', { error, submissionId, userId });
      throw new DynamicFormBuilderError('Failed to update submission', 'SUBMISSION_UPDATE_FAILED', 500);
    }
  }

  /**
   * Delete submission
   */
  async deleteSubmission(submissionId: string, userId: string): Promise<void> {
    try {
      const submission = await this.getSubmissionById(submissionId, userId);
      if (!submission) {
        throw new DynamicFormBuilderError('Submission not found', 'SUBMISSION_NOT_FOUND', 404);
      }

      // Soft delete
      await this.db.query(
        'DELETE FROM form_submissions WHERE id = $1',
        [submissionId]
      );

      logger.info('Submission deleted', { submissionId, userId });
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to delete submission', { error, submissionId, userId });
      throw new DynamicFormBuilderError('Failed to delete submission', 'SUBMISSION_DELETE_FAILED', 500);
    }
  }

  /**
   * Export submissions in various formats
   */
  async exportSubmissions(
    formId: string,
    userId: string,
    format: 'csv' | 'xlsx' | 'json' = 'csv',
    options: {
      fields?: string[];
      dateFrom?: string;
      dateTo?: string;
      includeMetadata?: boolean;
    } = {}
  ) {
    try {
      // Check form ownership
      const form = await this.formService.getFormById(formId, userId);
      if (!form || form.ownerId !== userId) {
        throw new DynamicFormBuilderError('Access denied', 'ACCESS_DENIED', 403);
      }

      // Get submissions
      const submissionsResult = await this.listSubmissions(formId, userId, {
        limit: 10000, // Large limit for export
        dateFrom: options.dateFrom,
        dateTo: options.dateTo
      });

      const submissions = submissionsResult.submissions;

      // TODO: Implement actual export logic based on format
      // For now, return raw data
      return {
        format,
        data: submissions,
        count: submissions.length,
        exportedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to export submissions', { error, formId, userId, format });
      throw new DynamicFormBuilderError('Failed to export submissions', 'EXPORT_FAILED', 500);
    }
  }

  /**
   * Validate submission data against form fields
   */
  private validateSubmissionData(data: Record<string, any>, formFields: any[]): ValidationResult {
    const errors: ValidationError[] = [];

    for (const field of formFields) {
      const fieldValue = data[field.field_key];
      const validation = field.validation_rules ? 
        (typeof field.validation_rules === 'string' ? JSON.parse(field.validation_rules) : field.validation_rules) : {};

      // Check required fields
      if (field.is_required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
        errors.push({
          field: field.field_key,
          code: 'required',
          message: validation.messages?.required || `${field.label} is required`,
          value: fieldValue
        });
        continue;
      }

      // Skip validation for empty optional fields
      if (!field.is_required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
        continue;
      }

      // Type-specific validation
      switch (field.field_type) {
        case 'email':
          if (fieldValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValue)) {
            errors.push({
              field: field.field_key,
              code: 'invalid_email',
              message: 'Invalid email format',
              value: fieldValue
            });
          }
          break;

        case 'number':
          if (fieldValue && isNaN(Number(fieldValue))) {
            errors.push({
              field: field.field_key,
              code: 'invalid_number',
              message: 'Must be a valid number',
              value: fieldValue
            });
          }
          break;

        case 'url':
          if (fieldValue) {
            try {
              new URL(fieldValue);
            } catch {
              errors.push({
                field: field.field_key,
                code: 'invalid_url',
                message: 'Must be a valid URL',
                value: fieldValue
              });
            }
          }
          break;
      }

      // String length validation
      if (typeof fieldValue === 'string') {
        if (validation.minLength && fieldValue.length < validation.minLength) {
          errors.push({
            field: field.field_key,
            code: 'min_length',
            message: validation.messages?.minLength || `Must be at least ${validation.minLength} characters`,
            value: fieldValue
          });
        }

        if (validation.maxLength && fieldValue.length > validation.maxLength) {
          errors.push({
            field: field.field_key,
            code: 'max_length',
            message: validation.messages?.maxLength || `Must be no more than ${validation.maxLength} characters`,
            value: fieldValue
          });
        }
      }

      // Pattern validation
      if (validation.pattern && fieldValue) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(fieldValue)) {
          errors.push({
            field: field.field_key,
            code: 'pattern_mismatch',
            message: validation.messages?.pattern || 'Invalid format',
            value: fieldValue
          });
        }
      }

      // Numeric range validation
      if ((field.field_type === 'number' || field.field_type === 'range') && fieldValue !== undefined) {
        const numValue = Number(fieldValue);
        if (!isNaN(numValue)) {
          if (validation.min !== undefined && numValue < validation.min) {
            errors.push({
              field: field.field_key,
              code: 'min_value',
              message: validation.messages?.min || `Must be at least ${validation.min}`,
              value: fieldValue
            });
          }

          if (validation.max !== undefined && numValue > validation.max) {
            errors.push({
              field: field.field_key,
              code: 'max_value',
              message: validation.messages?.max || `Must be no more than ${validation.max}`,
              value: fieldValue
            });
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Update form analytics after submission
   */
  private async updateFormAnalytics(client: any, formId: string, isRegisteredUser: boolean): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await client.query(`
      INSERT INTO form_analytics (form_id, date, submissions, completed_submissions)
      VALUES ($1, $2, 1, 1)
      ON CONFLICT (form_id, date)
      DO UPDATE SET 
        submissions = form_analytics.submissions + 1,
        completed_submissions = form_analytics.completed_submissions + 1,
        updated_at = CURRENT_TIMESTAMP
    `, [formId, today]);
  }

  /**
   * Batch update status for multiple submissions
   */
  async batchUpdateStatus(
    formId: string,
    submissionIds: string[],
    status: SubmissionStatus,
    userId: string
  ): Promise<{ updated: number; failed: number }> {
    // First, verify the user owns the form
    const formResult = await this.db.query(
      'SELECT id FROM forms WHERE id = $1 AND user_id = $2',
      [formId, userId]
    );

    if (formResult.rows.length === 0) {
      throw new DynamicFormBuilderError(
        'Form not found or access denied',
        403,
        'FORBIDDEN'
      );
    }

    let updated = 0;
    let failed = 0;

    // Update each submission
    for (const submissionId of submissionIds) {
      try {
        const result = await this.db.query(
          `UPDATE form_submissions 
           SET status = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND form_id = $3`,
          [status, submissionId, formId]
        );

        if (result.rowCount && result.rowCount > 0) {
          updated++;
        } else {
          failed++;
        }
      } catch (error) {
        logger.error('Failed to update submission status', { submissionId, error });
        failed++;
      }
    }

    return { updated, failed };
  }

  /**
   * Transform database row to FormSubmission object
   */
  private transformSubmissionRow(row: any): FormSubmission {
    return {
      id: row.id,
      formId: row.form_id,
      submissionNumber: 0, // Not in current schema
      status: (row.status || 'submitted') as SubmissionStatus,
      data: typeof row.submission_data === 'string' ? JSON.parse(row.submission_data) : row.submission_data || {},
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      currentStep: 1, // Not in current schema
      completedSteps: [], // Not in current schema
      submitterId: row.submitter_id,
      submitterEmail: row.submitter_email,
      submitterIp: row.submitter_ip,
      score: undefined, // Not in current schema
      completionTime: undefined, // Not in current schema
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      submittedAt: row.created_at ? new Date(row.created_at) : undefined, // Use created_at as submitted_at
      deletedAt: undefined // Not in current schema
    };
  }
}