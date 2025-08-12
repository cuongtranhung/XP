/**
 * Submission Service with Multi-User Permission Integration
 * Enhanced SubmissionService that respects multi-user access permissions
 * Created: 2025-01-12
 */

import { Pool } from 'pg';
import { logger } from '../../../utils/logger';
import { getDb } from '../database';
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

import { MultiUserServiceManager } from './MultiUserServiceManager';
import { FormServiceWithPermissions } from './FormServiceWithPermissions';

export class SubmissionServiceWithPermissions {
  private db: Pool;
  private serviceManager: MultiUserServiceManager;
  private formService: FormServiceWithPermissions;

  constructor() {
    this.db = getDb();
    this.serviceManager = MultiUserServiceManager.getInstance(this.db);
    this.formService = new FormServiceWithPermissions();
  }

  /**
   * Create a new form submission with permission checking
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
    logger.info('Starting createSubmission with permissions', { formId, submitterId, submitterIp });
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check submit permission for the form
      if (submitterId) {
        const canSubmit = await this.serviceManager.permissionService.canSubmit(formId, parseInt(submitterId));
        if (!canSubmit) {
          // Log access denied
          await this.serviceManager.auditService.logAccess(
            formId,
            parseInt(submitterId),
            'submit',
            { reason: 'no_submit_permission' },
            false,
            'User does not have submit permission'
          );
          throw new DynamicFormBuilderError('You do not have permission to submit to this form', 'ACCESS_DENIED', 403);
        }
      } else {
        // For anonymous submissions, check if form is public
        const isPublic = await this.serviceManager.permissionService.isFormPublic(formId);
        if (!isPublic) {
          await this.serviceManager.auditService.logAccess(
            formId,
            null,
            'submit',
            { reason: 'form_not_public' },
            false,
            'Anonymous submission not allowed on private form'
          );
          throw new DynamicFormBuilderError('This form does not allow anonymous submissions', 'ACCESS_DENIED', 403);
        }
      }

      // Get form to validate against
      const form = await this.formService.getFormById(formId, submitterId);
      if (!form) {
        throw new DynamicFormBuilderError('Form not found', 'FORM_NOT_FOUND', 404);
      }

      if (form.status !== 'published') {
        throw new DynamicFormBuilderError('Form is not published', 'FORM_NOT_PUBLISHED', 400);
      }

      // Get form fields for validation
      const fieldsQuery = 'SELECT * FROM form_fields WHERE form_id = $1 ORDER BY display_order';
      const fieldsResult = await client.query(fieldsQuery, [formId]);
      const formFields = fieldsResult.rows;

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

      // Determine status
      const status: SubmissionStatus = importOptions?.status || 
        (data.partial ? 'processing' : 'submitted');
      const submittedAt = (importOptions?.submittedAt || 
        (status === 'submitted' ? new Date() : null));

      // Calculate completion time if submitted
      let completionTime: number | undefined;
      if (status === 'submitted' && data.metadata && (data.metadata as any).startTime) {
        completionTime = Math.round((Date.now() - (data.metadata as any).startTime) / 1000);
      }

      const submitterEmail = importOptions?.userEmail || data.submitterEmail || null;
      const submitterName = importOptions?.userName || data.submitterName || null;

      // Create submission
      const insertQuery = `
        INSERT INTO form_submissions (
          form_id, status, submission_data, metadata, 
          submitter_id, submitter_ip, submitter_email
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

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

      await client.query('COMMIT');

      // Log successful submission
      await this.serviceManager.auditService.logAccess(
        formId,
        submitterId ? parseInt(submitterId) : null,
        'submit',
        {
          submission_id: submission.id,
          status,
          completion_time: completionTime
        },
        true,
        undefined,
        {
          ip: submitterIp,
          sessionId: data.metadata?.sessionId as string
        }
      );

      logger.info('Form submission created with permission check', {
        formId,
        submissionId: submission.id,
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
        errorMessage: (error as any).message
      });
      throw new DynamicFormBuilderError('Failed to create submission', 'SUBMISSION_CREATE_FAILED', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Get submission by ID with permission checking
   */
  async getSubmissionById(submissionId: string, userId?: string): Promise<FormSubmission | null> {
    try {
      // First get the submission to know which form it belongs to
      const submissionQuery = `
        SELECT s.*, f.id as form_id, f.name as form_name, f.owner_id as form_owner_id
        FROM form_submissions s
        JOIN forms f ON s.form_id = f.id
        WHERE s.id = $1
      `;
      
      const result = await this.db.query(submissionQuery, [submissionId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const submissionRow = result.rows[0];
      const formId = submissionRow.form_id;

      // Check permission to view this form's submissions
      if (userId) {
        // Check if user can view this form
        const canView = await this.serviceManager.permissionService.canView(formId, parseInt(userId));
        
        // Additional check: user can always view their own submissions
        const isOwnSubmission = submissionRow.submitter_id === userId;
        
        if (!canView && !isOwnSubmission) {
          await this.serviceManager.auditService.logAccess(
            formId,
            parseInt(userId),
            'view',
            { 
              reason: 'no_view_permission',
              submission_id: submissionId,
              context: 'submission_access'
            },
            false,
            'No permission to view submission'
          );
          return null;
        }
      } else {
        // Anonymous users can only view submissions of public forms
        const isPublic = await this.serviceManager.permissionService.isFormPublic(formId);
        if (!isPublic) {
          return null;
        }
      }

      // Log successful access
      if (userId) {
        await this.serviceManager.auditService.logAccess(
          formId,
          parseInt(userId),
          'view',
          { 
            submission_id: submissionId,
            context: 'submission_view'
          },
          true
        );
      }

      return this.transformSubmissionRow(submissionRow);
    } catch (error) {
      logger.error('Failed to get submission by ID', { error, submissionId, userId });
      throw new DynamicFormBuilderError('Failed to retrieve submission', 'SUBMISSION_FETCH_FAILED', 500);
    }
  }

  /**
   * List form submissions with permission filtering
   */
  async listSubmissions(formId: string, userId: string, query: ListSubmissionsQuery = {}) {
    try {
      // Check if user can view this form's submissions
      const canView = await this.serviceManager.permissionService.canView(formId, parseInt(userId));
      if (!canView) {
        await this.serviceManager.auditService.logAccess(
          formId,
          parseInt(userId),
          'view',
          { 
            reason: 'no_view_permission',
            context: 'submissions_list'
          },
          false,
          'No permission to view form submissions'
        );
        throw new DynamicFormBuilderError('You do not have permission to view submissions for this form', 'ACCESS_DENIED', 403);
      }

      // Get form info for additional context
      const form = await this.formService.getFormById(formId, userId);
      if (!form) {
        throw new DynamicFormBuilderError('Form not found', 'FORM_NOT_FOUND', 404);
      }

      // Check if user is owner (owners can see all submissions)
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

      // Non-owners can only see their own submissions unless they have admin permission
      if (!isOwner) {
        const canAdmin = await this.serviceManager.permissionService.hasPermissionLevel(formId, parseInt(userId), 'admin');
        if (!canAdmin) {
          conditions.push(`s.submitter_id = $${++paramCount}`);
          params.push(userId);
        }
      }

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

      // Log submissions list access
      await this.serviceManager.auditService.logAccess(
        formId,
        parseInt(userId),
        'view',
        { 
          context: 'submissions_list',
          count: submissions.length,
          is_owner: isOwner
        },
        true
      );

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
   * Update submission with permission checking
   */
  async updateSubmission(
    submissionId: string,
    data: Partial<CreateSubmissionRequest>,
    userId?: string
  ): Promise<FormSubmission> {
    try {
      if (!userId) {
        throw new DynamicFormBuilderError('Authentication required', 'AUTH_REQUIRED', 401);
      }

      // Check submission exists
      const existing = await this.getSubmissionById(submissionId, userId);
      if (!existing) {
        throw new DynamicFormBuilderError('Submission not found', 'SUBMISSION_NOT_FOUND', 404);
      }

      // Check permissions
      const formId = existing.formId;
      const canEdit = await this.serviceManager.permissionService.canEdit(formId, parseInt(userId));
      const isOwnSubmission = existing.submitterId === userId;

      // Users can edit if they have edit permission on the form OR if it's their own submission (and form allows editing submissions)
      if (!canEdit && !isOwnSubmission) {
        await this.serviceManager.auditService.logAccess(
          formId,
          parseInt(userId),
          'edit',
          { 
            reason: 'no_edit_permission',
            submission_id: submissionId,
            context: 'submission_update'
          },
          false,
          'No permission to update submission'
        );
        throw new DynamicFormBuilderError('Access denied', 'ACCESS_DENIED', 403);
      }

      // Allow updating submitted/completed submissions only with edit permission (not just own submission)
      if (existing.status !== 'draft' && !canEdit) {
        throw new DynamicFormBuilderError('Only users with edit permission can update completed submissions', 'SUBMISSION_NOT_EDITABLE', 400);
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

      // Log submission update
      await this.serviceManager.auditService.logAccess(
        formId,
        parseInt(userId),
        'edit',
        { 
          submission_id: submissionId,
          context: 'submission_update',
          is_own_submission: isOwnSubmission
        },
        true
      );

      logger.info('Submission updated with permission check', { submissionId, userId });

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
   * Delete submission with permission checking
   */
  async deleteSubmission(submissionId: string, userId: string): Promise<void> {
    try {
      const submission = await this.getSubmissionById(submissionId, userId);
      if (!submission) {
        throw new DynamicFormBuilderError('Submission not found', 'SUBMISSION_NOT_FOUND', 404);
      }

      const formId = submission.formId;

      // Check delete permission (typically only form owners or admins can delete)
      const canDelete = await this.serviceManager.permissionService.canDelete(formId, parseInt(userId));
      const isOwnSubmission = submission.submitterId === userId;

      // Allow deletion if user can delete on the form OR if it's their own submission
      if (!canDelete && !isOwnSubmission) {
        await this.serviceManager.auditService.logAccess(
          formId,
          parseInt(userId),
          'delete',
          { 
            reason: 'no_delete_permission',
            submission_id: submissionId,
            context: 'submission_delete'
          },
          false,
          'No permission to delete submission'
        );
        throw new DynamicFormBuilderError('Access denied', 'ACCESS_DENIED', 403);
      }

      // Delete submission
      await this.db.query(
        'DELETE FROM form_submissions WHERE id = $1',
        [submissionId]
      );

      // Log successful deletion
      await this.serviceManager.auditService.logAccess(
        formId,
        parseInt(userId),
        'delete',
        { 
          submission_id: submissionId,
          context: 'submission_delete',
          is_own_submission: isOwnSubmission
        },
        true
      );

      logger.info('Submission deleted with permission check', { submissionId, userId });
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to delete submission', { error, submissionId, userId });
      throw new DynamicFormBuilderError('Failed to delete submission', 'SUBMISSION_DELETE_FAILED', 500);
    }
  }

  /**
   * Export submissions with permission checking
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
      // Check if user can export (requires edit or admin permission)
      const canEdit = await this.serviceManager.permissionService.canEdit(formId, parseInt(userId));
      if (!canEdit) {
        await this.serviceManager.auditService.logAccess(
          formId,
          parseInt(userId),
          'export',
          { 
            reason: 'no_export_permission',
            context: 'submissions_export',
            format
          },
          false,
          'No permission to export submissions'
        );
        throw new DynamicFormBuilderError('You do not have permission to export submissions', 'ACCESS_DENIED', 403);
      }

      // Get submissions
      const submissionsResult = await this.listSubmissions(formId, userId, {
        limit: 10000, // Large limit for export
        dateFrom: options.dateFrom,
        dateTo: options.dateTo
      });

      const submissions = submissionsResult.submissions;

      // Log export action
      await this.serviceManager.auditService.logAccess(
        formId,
        parseInt(userId),
        'export',
        { 
          context: 'submissions_export',
          format,
          count: submissions.length,
          include_metadata: options.includeMetadata
        },
        true
      );

      // TODO: Implement actual export logic based on format
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
   * Batch update status for multiple submissions with permission checking
   */
  async batchUpdateStatus(
    formId: string,
    submissionIds: string[],
    status: SubmissionStatus,
    userId: string
  ): Promise<{ updated: number; failed: number }> {
    try {
      // Check edit permission
      const canEdit = await this.serviceManager.permissionService.canEdit(formId, parseInt(userId));
      if (!canEdit) {
        await this.serviceManager.auditService.logAccess(
          formId,
          parseInt(userId),
          'edit',
          { 
            reason: 'no_edit_permission',
            context: 'batch_status_update',
            submission_count: submissionIds.length
          },
          false,
          'No permission for batch update'
        );
        throw new DynamicFormBuilderError('You do not have permission to batch update submissions', 'ACCESS_DENIED', 403);
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

      // Log batch update
      await this.serviceManager.auditService.logAccess(
        formId,
        parseInt(userId),
        'edit',
        { 
          context: 'batch_status_update',
          new_status: status,
          total_submissions: submissionIds.length,
          updated_count: updated,
          failed_count: failed
        },
        true
      );

      return { updated, failed };
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to batch update submission status', { error, formId, userId });
      throw new DynamicFormBuilderError('Failed to batch update submissions', 'BATCH_UPDATE_FAILED', 500);
    }
  }

  /**
   * Get submission statistics with permission checking
   */
  async getSubmissionStatistics(formId: string, userId: string): Promise<any> {
    try {
      // Check view permission
      const canView = await this.serviceManager.permissionService.canView(formId, parseInt(userId));
      if (!canView) {
        await this.serviceManager.auditService.logAccess(
          formId,
          parseInt(userId),
          'view',
          { 
            reason: 'no_view_permission',
            context: 'submission_statistics'
          },
          false,
          'No permission to view submission statistics'
        );
        throw new DynamicFormBuilderError('You do not have permission to view statistics', 'ACCESS_DENIED', 403);
      }

      const statsQuery = `
        SELECT 
          COUNT(*) as total_submissions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_submissions,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_submissions,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_submissions,
          COUNT(DISTINCT submitter_id) as unique_submitters,
          MIN(created_at) as first_submission,
          MAX(created_at) as last_submission
        FROM form_submissions
        WHERE form_id = $1
      `;

      const result = await this.db.query(statsQuery, [formId]);
      const stats = result.rows[0];

      // Calculate completion rate
      const completionRate = stats.total_submissions > 0 
        ? ((stats.completed_submissions / stats.total_submissions) * 100).toFixed(2)
        : 0;

      // Log statistics access
      await this.serviceManager.auditService.logAccess(
        formId,
        parseInt(userId),
        'view',
        { context: 'submission_statistics' },
        true
      );

      return {
        total_submissions: parseInt(stats.total_submissions) || 0,
        completed_submissions: parseInt(stats.completed_submissions) || 0,
        draft_submissions: parseInt(stats.draft_submissions) || 0,
        processing_submissions: parseInt(stats.processing_submissions) || 0,
        unique_submitters: parseInt(stats.unique_submitters) || 0,
        completion_rate: parseFloat(completionRate),
        first_submission: stats.first_submission,
        last_submission: stats.last_submission
      };
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to get submission statistics', { error, formId, userId });
      throw new DynamicFormBuilderError('Failed to get statistics', 'STATISTICS_FAILED', 500);
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
      submittedAt: row.created_at ? new Date(row.created_at) : undefined,
      deletedAt: undefined // Not in current schema
    };
  }

  /**
   * Get service manager instance for advanced operations
   */
  getServiceManager(): MultiUserServiceManager {
    return this.serviceManager;
  }
}

// Export singleton instance
const submissionServiceWithPermissions = new SubmissionServiceWithPermissions();
export default submissionServiceWithPermissions;
export { SubmissionServiceWithPermissions };