/**
 * Form Service with Multi-User Permission Integration
 * Enhanced FormService that respects multi-user access permissions
 * Created: 2025-01-12
 */

import { Pool } from 'pg';
import { logger } from '../../../utils/logger';
import { pool } from '../../../utils/database';
import { cachedRepositories } from '../../../services/cachedRepositoryService';
import {
  Form,
  FormField,
  FormStep,
  CreateFormRequest,
  UpdateFormRequest,
  ListFormsQuery,
  DynamicFormBuilderError,
  FormStatus,
  FormVisibility
} from '../types';

import { MultiUserServiceManager } from './MultiUserServiceManager';

class FormServiceWithPermissions {
  private db: Pool;
  private serviceManager: MultiUserServiceManager;

  constructor() {
    this.db = pool;
    this.serviceManager = MultiUserServiceManager.getInstance(this.db);
  }

  /**
   * Create a new form with default visibility
   */
  async createForm(userId: string, data: CreateFormRequest): Promise<Form> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Generate unique slug
      const slug = await this.generateUniqueSlug(data.name);

      // Set default visibility if not specified
      const visibility = data.visibility || 'private';

      // Create form with visibility column
      const formQuery = `
        INSERT INTO forms (
          slug, name, description, category, tags, owner_id, team_id, 
          settings, visibility, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const formResult = await client.query(formQuery, [
        slug,
        data.name,
        data.description,
        data.category,
        data.tags || [],
        userId,
        data.teamId,
        JSON.stringify(data.settings || {}),
        visibility,
        'draft'
      ]);

      const form = formResult.rows[0];

      // Create form steps if provided
      if (data.steps && data.steps.length > 0) {
        for (const step of data.steps) {
          await client.query(
            `INSERT INTO form_steps (form_id, title, description, position, settings)
             VALUES ($1, $2, $3, $4, $5)`,
            [form.id, step.title, step.description, step.position, JSON.stringify(step.settings || {})]
          );
        }
      }

      // Create form fields if provided
      if (data.fields && data.fields.length > 0) {
        for (const field of data.fields) {
          await client.query(
            `INSERT INTO form_fields (
              form_id, field_key, field_type, label, placeholder, display_order,
              is_required, validation_rules, options, conditional_logic, step_id, help_text
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              form.id,
              field.fieldKey || `field_${Date.now()}`,
              field.fieldType,
              field.label,
              field.placeholder,
              field.position || 0,
              field.required || false,
              JSON.stringify(field.validation || {}),
              JSON.stringify(field.options || []),
              JSON.stringify(field.conditionalLogic || {}),
              field.stepId,
              null
            ]
          );
        }
      }

      await client.query('COMMIT');

      // Log form creation
      await this.serviceManager.auditService.logAccess(
        form.id,
        parseInt(userId),
        'edit',
        { action: 'create_form', form_name: data.name },
        true
      );

      logger.info('Form created successfully with permissions', {
        formId: form.id,
        userId,
        name: data.name,
        visibility
      });

      return this.transformFormRow(form);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create form', { error, userId, formName: data.name });
      throw new DynamicFormBuilderError('Failed to create form', 'FORM_CREATE_FAILED', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Get form by ID with permission checking
   */
  async getFormById(formId: string, userId?: string): Promise<Form | null> {
    try {
      // Check permissions if userId is provided
      if (userId) {
        const canView = await this.serviceManager.permissionService.canView(formId, parseInt(userId));
        if (!canView) {
          // Log access denied
          await this.serviceManager.auditService.logAccess(
            formId,
            parseInt(userId),
            'view',
            { reason: 'permission_denied' },
            false,
            'No view permission'
          );
          return null;
        }
      }

      // Use cached repository for form lookup
      const form = await cachedRepositories.forms.getById<Form>(
        formId,
        async () => {
          const query = `
            SELECT f.*, u.full_name as owner_name, u.email as owner_email
            FROM forms f
            LEFT JOIN users u ON f.owner_id = u.id
            WHERE f.id = $1 AND f.deleted_at IS NULL
          `;

          const result = await this.db.query(query, [formId]);
          
          if (result.rows.length === 0) {
            return null;
          }

          const form = this.transformFormRow(result.rows[0]);
          
          // Load form fields
          const fieldsResult = await this.db.query(
            `SELECT * FROM form_fields WHERE form_id = $1 ORDER BY display_order`,
            [formId]
          );
          
          form.fields = fieldsResult.rows.map(field => ({
            id: field.id,
            formId: field.form_id,
            fieldKey: field.field_key,
            fieldType: field.field_type,
            label: field.label,
            placeholder: field.placeholder,
            position: field.display_order,
            required: field.is_required,
            hidden: false,
            validation: field.validation_rules,
            options: field.options,
            conditionalLogic: field.conditional_logic,
            stepId: field.step_id,
            createdAt: field.created_at ? new Date(field.created_at) : new Date(),
            updatedAt: field.updated_at ? new Date(field.updated_at) : new Date()
          }));
          
          return form;
        }
      );

      // Log successful access
      if (userId && form) {
        await this.serviceManager.auditService.logAccess(
          formId,
          parseInt(userId),
          'view',
          { form_name: form.name },
          true
        );
      }

      return form;
    } catch (error) {
      logger.error('Failed to get form by ID', { error, formId, userId });
      throw new DynamicFormBuilderError('Failed to retrieve form', 'FORM_FETCH_FAILED', 500);
    }
  }

  /**
   * Get form by slug with permission checking
   */
  async getFormBySlug(slug: string, userId?: string): Promise<Form | null> {
    try {
      const query = `
        SELECT f.*, u.full_name as owner_name, u.email as owner_email
        FROM forms f
        LEFT JOIN users u ON f.owner_id = u.id
        WHERE f.slug = $1 AND f.deleted_at IS NULL
      `;

      const result = await this.db.query(query, [slug]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const form = this.transformFormRow(result.rows[0]);
      
      // Check permissions if userId is provided
      if (userId) {
        const canView = await this.serviceManager.permissionService.canView(form.id, parseInt(userId));
        if (!canView) {
          await this.serviceManager.auditService.logAccess(
            form.id,
            parseInt(userId),
            'view',
            { reason: 'permission_denied', slug },
            false,
            'No view permission'
          );
          return null;
        }
      } else {
        // For anonymous users, only allow public forms
        if (form.visibility !== 'public') {
          return null;
        }
      }

      // Load form fields
      const fieldsResult = await this.db.query(
        `SELECT * FROM form_fields WHERE form_id = $1 ORDER BY display_order`,
        [form.id]
      );
      
      form.fields = fieldsResult.rows.map(field => ({
        id: field.id,
        formId: field.form_id,
        fieldKey: field.field_key,
        fieldType: field.field_type,
        label: field.label,
        placeholder: field.placeholder,
        position: field.display_order,
        required: field.is_required,
        hidden: false,
        validation: field.validation_rules,
        options: field.options,
        conditionalLogic: field.conditional_logic,
        createdAt: new Date(field.created_at),
        updatedAt: new Date(field.updated_at)
      }));
      
      form.steps = [];

      // Log successful access
      if (userId) {
        await this.serviceManager.auditService.logAccess(
          form.id,
          parseInt(userId),
          'view',
          { form_name: form.name, slug },
          true
        );
      }

      return form;
    } catch (error) {
      logger.error('Failed to get form by slug', { error, slug, userId });
      throw new DynamicFormBuilderError('Failed to retrieve form', 'FORM_FETCH_FAILED', 500);
    }
  }

  /**
   * List forms with permission filtering
   */
  async listForms(userId: string, query: ListFormsQuery = {}) {
    try {
      return await cachedRepositories.forms.cacheQuery(
        'list',
        { userId, ...query },
        async () => {
          const {
            page = 1,
            limit = 20,
            status,
            search,
            tags,
            category,
            sort = '-created_at',
            ownerId,
            teamId
          } = query;

          const offset = (page - 1) * Math.min(limit, 100);

          // Get accessible forms using the permission service
          const accessibleForms = await this.serviceManager.permissionService.getUserAccessibleForms(
            parseInt(userId),
            true // Include public forms
          );

          if (accessibleForms.length === 0) {
            return {
              forms: [],
              pagination: {
                page,
                limit,
                total: 0,
                pages: 0,
                hasNext: false,
                hasPrev: false
              }
            };
          }

          // Extract form IDs
          const formIds = accessibleForms.map(af => af.form_id);

          // Build WHERE clause for additional filtering
          const conditions: string[] = ['f.id = ANY($1)'];
          const params: any[] = [formIds];
          let paramCount = 1;

          // Handle deleted/archived forms logic
          if (status === 'archived') {
            conditions.push('f.deleted_at IS NOT NULL');
          } else {
            conditions.push('f.deleted_at IS NULL');
          }

          if (status && status !== 'archived') {
            conditions.push(`f.status = $${++paramCount}`);
            params.push(status);
          }

          if (search) {
            conditions.push(`(f.name ILIKE $${++paramCount} OR f.description ILIKE $${++paramCount})`);
            params.push(`%${search}%`, `%${search}%`);
          }

          if (tags && tags.length > 0) {
            conditions.push(`f.tags && $${++paramCount}`);
            params.push(tags);
          }

          if (category) {
            conditions.push(`f.category = $${++paramCount}`);
            params.push(category);
          }

          if (ownerId) {
            conditions.push(`f.owner_id = $${++paramCount}`);
            params.push(ownerId);
          }

          if (teamId) {
            conditions.push(`f.team_id = $${++paramCount}`);
            params.push(teamId);
          }

          // Build ORDER BY clause
          const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
          const sortDirection = sort.startsWith('-') ? 'DESC' : 'ASC';
          const allowedSortFields = ['created_at', 'updated_at', 'name', 'status'];
          const orderBy = allowedSortFields.includes(sortField) ? 
            `f.${sortField} ${sortDirection}` : 'f.created_at DESC';

          // Count query
          const countQuery = `
            SELECT COUNT(*) as total
            FROM forms f
            WHERE ${conditions.join(' AND ')}
          `;

          // Main query with permission info
          const mainQuery = `
            SELECT 
              f.*,
              u.full_name as owner_name,
              u.email as owner_email,
              (
                SELECT COUNT(*)::int 
                FROM form_submissions fs 
                WHERE fs.form_id = f.id
              ) as submission_count,
              (
                SELECT COUNT(*)::int 
                FROM form_fields ff 
                WHERE ff.form_id = f.id
              ) as field_count
            FROM forms f
            LEFT JOIN users u ON f.owner_id = u.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY ${orderBy}
            LIMIT $${++paramCount} OFFSET $${++paramCount}
          `;

          params.push(limit, offset);

          const [countResult, formsResult] = await Promise.all([
            this.db.query(countQuery, params.slice(0, -2)),
            this.db.query(mainQuery, params)
          ]);

          const total = parseInt(countResult.rows[0].total);
          const totalPages = Math.ceil(total / limit);

          // Map forms with permission information
          const forms = formsResult.rows.map(row => {
            const form = this.transformFormRow(row);
            const accessInfo = accessibleForms.find(af => af.form_id === form.id);
            
            return {
              ...form,
              statistics: {
                submissions: row.submission_count,
                fields: row.field_count
              },
              permissions: {
                access_type: accessInfo?.access_type || 'none',
                permission_level: accessInfo?.permission_level || 'none'
              }
            };
          });

          return {
            forms,
            pagination: {
              page,
              limit,
              total,
              pages: totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1
            }
          };
        },
        600 // 10 minutes cache for lists
      );
    } catch (error) {
      logger.error('Failed to list forms', { error, userId, query });
      throw new DynamicFormBuilderError('Failed to list forms', 'FORMS_LIST_FAILED', 500);
    }
  }

  /**
   * Update form with permission checking
   */
  async updateForm(formId: string, userId: string, data: UpdateFormRequest): Promise<Form> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check edit permission
      await this.serviceManager.permissionService.enforcePermission(
        formId,
        parseInt(userId),
        'edit'
      );

      // Build update query (including visibility if provided)
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      if (data.name !== undefined) {
        updates.push(`name = $${++paramCount}`);
        params.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push(`description = $${++paramCount}`);
        params.push(data.description);
      }

      if (data.category !== undefined) {
        updates.push(`category = $${++paramCount}`);
        params.push(data.category);
      }

      if (data.tags !== undefined) {
        updates.push(`tags = $${++paramCount}`);
        params.push(data.tags);
      }

      if (data.settings !== undefined) {
        updates.push(`settings = $${++paramCount}`);
        params.push(JSON.stringify(data.settings));
      }

      // Handle visibility updates (only owners can change visibility)
      if (data.visibility !== undefined) {
        const isOwner = await this.serviceManager.permissionService.getFormOwner(formId) === parseInt(userId);
        if (isOwner) {
          updates.push(`visibility = $${++paramCount}`);
          params.push(data.visibility);
        } else {
          throw new DynamicFormBuilderError('Only form owners can change visibility', 'ACCESS_DENIED', 403);
        }
      }

      if (data.incrementVersion) {
        updates.push('version = version + 1');
      }

      if (updates.length === 0) {
        throw new DynamicFormBuilderError('No updates provided', 'NO_UPDATES', 400);
      }

      // Update form
      const updateQuery = `
        UPDATE forms 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${++paramCount}
        RETURNING *
      `;
      params.push(formId);

      const result = await client.query(updateQuery, params);

      // Handle fields update if provided
      if (data.fields !== undefined) {
        await client.query('DELETE FROM form_fields WHERE form_id = $1', [formId]);
        
        if (data.fields && data.fields.length > 0) {
          let fieldOrder = 0;
          for (const field of data.fields) {
            const fieldKey = field.fieldKey || field.id || `field_${Date.now()}_${fieldOrder}`;
            const fieldType = field.fieldType || field.type || 'text';
            
            if (!fieldType) {
              throw new Error(`Field type is required for field: ${field.label || fieldKey}`);
            }
            
            await client.query(
              `INSERT INTO form_fields (
                form_id, field_key, field_type, label, placeholder, display_order,
                is_required, validation_rules, options, conditional_logic, step_id, help_text
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                formId,
                fieldKey,
                fieldType,
                field.label,
                field.placeholder,
                field.position || field.displayOrder || fieldOrder,
                field.required || field.isRequired || false,
                JSON.stringify(field.validation || field.validationRules || {}),
                JSON.stringify(field.options || []),
                JSON.stringify(field.conditionalLogic || {}),
                field.stepId,
                field.helpText || null
              ]
            );
            fieldOrder++;
          }
        }
      }

      await client.query('COMMIT');

      // Invalidate form cache after update
      await cachedRepositories.forms.invalidate(formId);

      // Log the update
      await this.serviceManager.auditService.logAccess(
        formId,
        parseInt(userId),
        'edit',
        { 
          action: 'update_form',
          fields_updated: !!data.fields,
          visibility_changed: !!data.visibility
        },
        true
      );

      logger.info('Form updated successfully with permission check', { formId, userId });

      // Return the updated form
      const updatedForm = await this.getFormById(formId, userId);
      return updatedForm || this.transformFormRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to update form', { error, formId, userId });
      throw new DynamicFormBuilderError('Failed to update form', 'FORM_UPDATE_FAILED', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Clone a form with permission checking - delegates to cloning service
   */
  async cloneForm(formId: string, userId: string, newName?: string): Promise<Form> {
    try {
      // Use the multi-user cloning service
      const result = await this.serviceManager.cloneFormWithAudit(
        formId,
        parseInt(userId),
        { new_name: newName }
      );

      if (!result.success || !result.cloned_form_id) {
        throw new DynamicFormBuilderError(result.error || 'Failed to clone form', 'CLONE_FAILED', 500);
      }

      // Return the cloned form
      const clonedForm = await this.getFormById(result.cloned_form_id, userId);
      if (!clonedForm) {
        throw new DynamicFormBuilderError('Cloned form not found', 'FORM_NOT_FOUND', 404);
      }

      return clonedForm;
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to clone form', { error, formId, userId });
      throw new DynamicFormBuilderError('Failed to clone form', 'CLONE_FAILED', 500);
    }
  }

  /**
   * Delete form with permission checking
   */
  async deleteForm(formId: string, userId: string, permanent = false): Promise<void> {
    try {
      // Check delete permission (only owners can delete)
      await this.serviceManager.permissionService.enforcePermission(
        formId,
        parseInt(userId),
        'delete'
      );

      if (permanent) {
        // Hard delete - remove all related data
        await this.db.query('DELETE FROM forms WHERE id = $1', [formId]);
      } else {
        // Soft delete
        await this.db.query(
          'UPDATE forms SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
          [formId]
        );
      }

      // Log deletion
      await this.serviceManager.auditService.logAccess(
        formId,
        parseInt(userId),
        'delete',
        { permanent },
        true
      );

      logger.info('Form deleted successfully with permission check', { formId, userId, permanent });
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to delete form', { error, formId, userId });
      throw new DynamicFormBuilderError('Failed to delete form', 'FORM_DELETE_FAILED', 500);
    }
  }

  /**
   * Publish form with permission checking
   */
  async publishForm(formId: string, userId: string, versionNote?: string): Promise<Form> {
    try {
      // Check edit permission (need edit to publish)
      await this.serviceManager.permissionService.enforcePermission(
        formId,
        parseInt(userId),
        'edit'
      );

      // Only owners can publish
      const isOwner = await this.serviceManager.permissionService.getFormOwner(formId) === parseInt(userId);
      if (!isOwner) {
        throw new DynamicFormBuilderError('Only form owners can publish forms', 'ACCESS_DENIED', 403);
      }

      // Update form status to published
      const result = await this.db.query(`
        UPDATE forms 
        SET 
          status = 'published',
          published_at = CURRENT_TIMESTAMP,
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [formId]);

      // Log publishing
      await this.serviceManager.auditService.logAccess(
        formId,
        parseInt(userId),
        'publish',
        { version_note: versionNote },
        true
      );

      logger.info('Form published successfully with permission check', { formId, userId, versionNote });

      return this.transformFormRow(result.rows[0]);
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to publish form', { error, formId, userId });
      throw new DynamicFormBuilderError('Failed to publish form', 'FORM_PUBLISH_FAILED', 500);
    }
  }

  /**
   * Get form by submission ID with permission checking
   */
  async getFormBySubmissionId(submissionId: string, userId: string): Promise<Form | null> {
    try {
      const query = `
        SELECT f.*, 
               u.full_name as owner_name,
               u.email as owner_email
        FROM forms f
        INNER JOIN form_submissions fs ON f.id = fs.form_id
        LEFT JOIN users u ON f.owner_id = u.id
        WHERE fs.id = $1 AND f.deleted_at IS NULL
      `;
      
      const result = await this.db.query(query, [submissionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const form = this.transformFormRow(result.rows[0]);
      
      // Check if user can view this form
      const canView = await this.serviceManager.permissionService.canView(form.id, parseInt(userId));
      if (!canView) {
        await this.serviceManager.auditService.logAccess(
          form.id,
          parseInt(userId),
          'view',
          { 
            reason: 'permission_denied', 
            context: 'submission_access',
            submission_id: submissionId 
          },
          false,
          'No view permission for submission form'
        );
        return null;
      }
      
      return form;
    } catch (error) {
      logger.error('Failed to get form by submission ID', { error, submissionId, userId });
      throw new DynamicFormBuilderError('Failed to get form', 'FORM_FETCH_FAILED', 500);
    }
  }

  /**
   * Get public statistics with permission checking
   */
  async getPublicStatistics(formId: string, userId?: string): Promise<any> {
    try {
      // Check if form is public or user has view permission
      let canView = false;
      
      if (userId) {
        canView = await this.serviceManager.permissionService.canView(formId, parseInt(userId));
      } else {
        canView = await this.serviceManager.permissionService.isFormPublic(formId);
      }

      if (!canView) {
        throw new DynamicFormBuilderError('Form not found or access denied', 'ACCESS_DENIED', 403);
      }

      // Get basic form info
      const formQuery = `
        SELECT 
          f.id,
          f.name,
          f.status,
          f.created_at,
          f.owner_id,
          f.visibility,
          u.full_name as owner_name,
          COUNT(DISTINCT fs.id) as total_submissions,
          COUNT(DISTINCT CASE WHEN fs.status = 'completed' THEN fs.id END) as completed_submissions,
          COUNT(DISTINCT fs.submitter_id) as unique_submitters,
          MIN(fs.created_at) as first_submission,
          MAX(fs.created_at) as last_submission
        FROM forms f
        LEFT JOIN users u ON f.owner_id = u.id
        LEFT JOIN form_submissions fs ON f.id = fs.form_id
        WHERE f.id = $1
        GROUP BY f.id, f.name, f.status, f.created_at, f.owner_id, f.visibility, u.full_name
      `;

      const result = await this.db.query(formQuery, [formId]);

      if (result.rows.length === 0) {
        throw new DynamicFormBuilderError('Form not found', 'FORM_NOT_FOUND', 404);
      }

      const stats = result.rows[0];

      // Calculate completion rate
      const completionRate = stats.total_submissions > 0 
        ? ((stats.completed_submissions / stats.total_submissions) * 100).toFixed(2)
        : 0;

      // Get daily submission trend (last 7 days)
      const trendQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as submissions
        FROM form_submissions
        WHERE form_id = $1 
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      const trendResult = await this.db.query(trendQuery, [formId]);

      // Log statistics access
      if (userId) {
        await this.serviceManager.auditService.logAccess(
          formId,
          parseInt(userId),
          'view',
          { action: 'view_statistics' },
          true
        );
      }

      return {
        formId: stats.id,
        formName: stats.name,
        formStatus: stats.status,
        formVisibility: stats.visibility,
        owner: {
          id: stats.owner_id,
          name: stats.owner_name
        },
        metrics: {
          totalSubmissions: parseInt(stats.total_submissions) || 0,
          completedSubmissions: parseInt(stats.completed_submissions) || 0,
          uniqueSubmitters: parseInt(stats.unique_submitters) || 0,
          completionRate: parseFloat(completionRate),
          firstSubmission: stats.first_submission,
          lastSubmission: stats.last_submission,
          isActive: stats.last_submission && 
            new Date(stats.last_submission) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        trend: {
          daily: trendResult.rows.map(row => ({
            date: row.date,
            count: parseInt(row.submissions)
          }))
        }
      };
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to get public statistics', { error, formId, userId });
      throw new DynamicFormBuilderError('Failed to get statistics', 'STATISTICS_FAILED', 500);
    }
  }

  /**
   * Generate unique slug for form
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    let baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 0;

    while (true) {
      const existing = await this.db.query(
        'SELECT id FROM forms WHERE slug = $1 LIMIT 1',
        [slug]
      );

      if (existing.rows.length === 0) {
        break;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }

  /**
   * Transform database row to Form object
   */
  private transformFormRow(row: any): Form {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      status: row.status as FormStatus,
      version: row.version,
      category: row.category,
      tags: row.tags || [],
      visibility: row.visibility as FormVisibility,
      ownerId: row.owner_id,
      teamId: row.team_id,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
      fields: [],
      steps: [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined
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
const formServiceWithPermissions = new FormServiceWithPermissions();
export default formServiceWithPermissions;
export { FormServiceWithPermissions };