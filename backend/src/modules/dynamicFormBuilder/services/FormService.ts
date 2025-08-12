/**
 * Form Service
 * Core business logic for form management
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

class FormService {
  private db: Pool;

  constructor() {
    this.db = pool;
  }

  /**
   * Get form (wrapper for getFormById for backwards compatibility)
   */
  async getForm(formId: string, userId?: string): Promise<Form | null> {
    return this.getFormById(formId, userId);
  }

  /**
   * Create a new form
   */
  async createForm(userId: string, data: CreateFormRequest): Promise<Form> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Generate unique slug
      const slug = await this.generateUniqueSlug(data.name);

      // Create form
      const formQuery = `
        INSERT INTO forms (
          slug, name, description, category, tags, owner_id, team_id, settings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
        JSON.stringify(data.settings || {})
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
              null // helpText - not in FormField type yet
            ]
          );
        }
      }

      await client.query('COMMIT');

      logger.info('Form created successfully', {
        formId: form.id,
        userId,
        name: data.name
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
   * Get form by ID
   */
  async getFormById(formId: string, userId?: string): Promise<Form | null> {
    try {
      // Use cached repository for form lookup
      return await cachedRepositories.forms.getById<Form>(
        formId,
        async () => {
          let query = `
            SELECT f.*, u.full_name as owner_name, u.email as owner_email
            FROM forms f
            LEFT JOIN users u ON f.owner_id = u.id
            WHERE f.id = $1 AND f.deleted_at IS NULL
          `;
          const params = [formId];

          // No access control - allow all users to view forms
          // Keep userId parameter for future use (e.g., tracking who viewed)

          const result = await this.db.query(query, params);
          
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
            hidden: false,  // Add missing property
            validation: field.validation_rules,
            options: field.options,
            conditionalLogic: field.conditional_logic,
            stepId: field.step_id,
            createdAt: field.created_at ? new Date(field.created_at) : new Date(),
            updatedAt: field.updated_at ? new Date(field.updated_at) : new Date()
          }));
          
          // Debug log
          logger.info(`Form ${formId} loaded with ${form.fields?.length || 0} fields`);
          
          return form;
        }
      );
    } catch (error) {
      logger.error('Failed to get form by ID', { error, formId });
      throw new DynamicFormBuilderError('Failed to retrieve form', 'FORM_FETCH_FAILED', 500);
    }
  }

  /**
   * Get form by slug
   */
  async getFormBySlug(slug: string, userId?: string): Promise<Form | null> {
    try {
      let query = `
        SELECT f.*, u.full_name as owner_name, u.email as owner_email
        FROM forms f
        LEFT JOIN users u ON f.owner_id = u.id
        WHERE f.slug = $1 AND f.deleted_at IS NULL
      `;
      const params = [slug];

      // No access control - allow all users to view forms by slug
      // Keep userId parameter for future use

      const result = await this.db.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }

      const form = this.transformFormRow(result.rows[0]);
      
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
      
      // Load form steps if any
      // TODO: Fix form_steps table column issue
      // const stepsResult = await this.db.query(
      //   `SELECT * FROM form_steps WHERE form_id = $1 ORDER BY step_number`,
      //   [form.id]
      // );
      
      // form.steps = stepsResult.rows.map(step => ({
      //   id: step.id,
      //   formId: step.form_id,
      //   title: step.title,
      //   description: step.description,
      //   order: step.step_number,
      //   createdAt: new Date(step.created_at),
      //   updatedAt: new Date(step.updated_at)
      // }));
      form.steps = [];

      logger.info(`Form ${form.slug} loaded with ${form.fields.length} fields`);

      return form;
    } catch (error) {
      logger.error('Failed to get form by slug', { error, slug });
      throw new DynamicFormBuilderError('Failed to retrieve form', 'FORM_FETCH_FAILED', 500);
    }
  }

  /**
   * List forms with pagination and filtering
   */
  async listForms(userId: string, query: ListFormsQuery = {}) {
    try {
      // Create cache key for this query
      const queryParams = { userId, ...query };
      
      return await cachedRepositories.forms.cacheQuery(
        'list',
        queryParams,
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

      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      // Handle deleted/archived forms logic
      if (status === 'archived') {
        // For archived status: show only soft-deleted forms
        conditions.push('f.deleted_at IS NOT NULL');
      } else {
        // For all other cases: show only non-deleted forms
        conditions.push('f.deleted_at IS NULL');
      }

      // No access control - show all forms to all users
      // Optional: Add filter for "My Forms" if requested
      if (query.filterOwner === 'mine') {
        conditions.push(`f.owner_id = $${++paramCount}`);
        params.push(userId);
      } else if (query.filterOwner === 'others') {
        conditions.push(`f.owner_id != $${++paramCount}`);
        params.push(userId);
      }
      // If filterOwner is 'all' or undefined, show all forms

      if (status && status !== 'archived') {
        // For archived status, we don't filter by f.status since soft-deleted forms 
        // retain their original status (draft/published) but are considered archived
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

      // Main query
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

      const forms = formsResult.rows.map(row => ({
        ...this.transformFormRow(row),
        statistics: {
          submissions: row.submission_count,
          fields: row.field_count
        }
      }));

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
   * Update form
   */
  async updateForm(formId: string, userId: string, data: UpdateFormRequest): Promise<Form> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check ownership
      const ownershipCheck = await client.query(
        'SELECT owner_id FROM forms WHERE id = $1 AND deleted_at IS NULL',
        [formId]
      );

      if (ownershipCheck.rows.length === 0) {
        throw new DynamicFormBuilderError('Form not found', 'FORM_NOT_FOUND', 404);
      }

      if (ownershipCheck.rows[0].owner_id !== userId) {
        throw new DynamicFormBuilderError('Access denied', 'ACCESS_DENIED', 403);
      }

      // Build update query
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
        // Delete existing fields
        await client.query('DELETE FROM form_fields WHERE form_id = $1', [formId]);
        
        // Insert new fields
        if (data.fields && data.fields.length > 0) {
          let fieldOrder = 0;
          for (const field of data.fields) {
            // Generate unique field key for each field
            const fieldKey = field.fieldKey || field.id || `field_${Date.now()}_${fieldOrder}`;
            
            // Log field data for debugging
            logger.info('Processing field for update', {
              fieldKey,
              fieldType: field.fieldType,
              type: field.type,
              hasType: !!field.type,
              hasFieldType: !!field.fieldType,
              fieldData: field
            });
            
            // Ensure field_type is never null
            const fieldType = field.fieldType || field.type || 'text';
            
            if (!fieldType) {
              logger.error('Field type is missing', { field, fieldKey });
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

      logger.info('Form updated successfully', { formId, userId });

      // Return the updated form with fields
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
   * Clone a form with all its fields
   * Any user can clone any published form
   */
  async cloneForm(formId: string, userId: string, newName?: string): Promise<Form> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Get original form (no access control for published forms)
      const formQuery = `
        SELECT f.*, 
               array_agg(
                 json_build_object(
                   'id', ff.id,
                   'field_key', ff.field_key,
                   'field_type', ff.field_type,
                   'label', ff.label,
                   'placeholder', ff.placeholder,
                   'default_value', ff.default_value,
                   'is_required', ff.is_required,
                   'is_hidden', ff.is_hidden,
                   'display_order', ff.display_order,
                   'step_id', ff.step_id,
                   'validation_rules', ff.validation_rules,
                   'conditional_logic', ff.conditional_logic,
                   'options', ff.options
                 ) ORDER BY ff.display_order
               ) FILTER (WHERE ff.id IS NOT NULL) as fields
        FROM forms f
        LEFT JOIN form_fields ff ON f.id = ff.form_id
        WHERE f.id = $1
        GROUP BY f.id
      `;
      
      const formResult = await client.query(formQuery, [formId]);
      
      if (formResult.rows.length === 0) {
        throw new DynamicFormBuilderError('Form not found', 'FORM_NOT_FOUND', 404);
      }

      const originalForm = formResult.rows[0];
      
      // Check if form is published or user is owner (owners can clone their own forms)
      if (originalForm.status !== 'published' && originalForm.owner_id !== userId) {
        throw new DynamicFormBuilderError('Can only clone published forms or your own forms', 'ACCESS_DENIED', 403);
      }

      // Generate unique slug for cloned form
      const baseSlug = slugify(newName || `Copy of ${originalForm.name}`);
      let slug = baseSlug;
      let counter = 1;
      
      while (true) {
        const slugCheck = await client.query(
          'SELECT id FROM forms WHERE slug = $1',
          [slug]
        );
        
        if (slugCheck.rows.length === 0) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create new form with cloned data
      const insertFormQuery = `
        INSERT INTO forms (
          name, slug, description, status, category, tags, 
          owner_id, team_id, settings, visibility, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const formValues = [
        newName || `Copy of ${originalForm.name}`,
        slug,
        originalForm.description,
        'draft', // Cloned forms always start as draft
        originalForm.category,
        originalForm.tags,
        userId, // New owner
        null, // Clear team_id for cloned form
        originalForm.settings,
        'private', // Cloned forms start as private
        1 // Reset version
      ];

      const newFormResult = await client.query(insertFormQuery, formValues);
      const newForm = newFormResult.rows[0];

      // Clone all fields if they exist
      if (originalForm.fields && originalForm.fields.length > 0) {
        for (const field of originalForm.fields) {
          const insertFieldQuery = `
            INSERT INTO form_fields (
              form_id, field_key, field_type, label, placeholder,
              default_value, is_required, is_hidden, display_order,
              step_id, validation_rules, conditional_logic, options
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `;

          const fieldValues = [
            newForm.id,
            field.field_key,
            field.field_type,
            field.label,
            field.placeholder,
            field.default_value,
            field.is_required,
            field.is_hidden,
            field.display_order,
            field.step_id,
            field.validation_rules,
            field.conditional_logic,
            field.options
          ];

          await client.query(insertFieldQuery, fieldValues);
        }
      }

      await client.query('COMMIT');

      logger.info('Form cloned successfully', {
        originalFormId: formId,
        newFormId: newForm.id,
        userId
      });

      // Return the new form with fields
      return this.getFormById(newForm.id, userId);
    } catch (error) {
      await client.query('ROLLBACK');
      
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to clone form', { error, formId, userId });
      throw new DynamicFormBuilderError('Failed to clone form', 'CLONE_FAILED', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Get form by submission ID (for comment system)
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
      
      // Check if user can access this form
      if (form.status === 'draft' && form.ownerId !== userId) {
        return null;
      }
      
      return form;
    } catch (error) {
      logger.error('Failed to get form by submission ID', { error, submissionId, userId });
      throw new DynamicFormBuilderError('Failed to get form', 'FORM_FETCH_FAILED', 500);
    }
  }

  /**
   * Get public statistics for a form
   * Available for all users to see basic metrics
   */
  async getPublicStatistics(formId: string): Promise<any> {
    try {
      // Get basic form info
      const formQuery = `
        SELECT 
          f.id,
          f.name,
          f.status,
          f.created_at,
          f.owner_id,
          u.full_name as owner_name,
          COUNT(DISTINCT fs.id) as total_submissions,
          COUNT(DISTINCT CASE WHEN fs.status = 'completed' THEN fs.id END) as completed_submissions,
          COUNT(DISTINCT fs.submitter_id) as unique_submitters,
          MIN(fs.created_at) as first_submission,
          MAX(fs.created_at) as last_submission
        FROM forms f
        LEFT JOIN users u ON f.owner_id = u.id
        LEFT JOIN form_submissions fs ON f.id = fs.form_id
        WHERE f.id = $1 AND f.status = 'published'
        GROUP BY f.id, f.name, f.status, f.created_at, f.owner_id, u.full_name
      `;

      const result = await this.db.query(formQuery, [formId]);

      if (result.rows.length === 0) {
        throw new DynamicFormBuilderError('Form not found or not published', 'FORM_NOT_FOUND', 404);
      }

      const stats = result.rows[0];

      // Calculate additional metrics
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

      return {
        formId: stats.id,
        formName: stats.name,
        formStatus: stats.status,
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

      logger.error('Failed to get public statistics', { error, formId });
      throw new DynamicFormBuilderError('Failed to get statistics', 'STATISTICS_FAILED', 500);
    }
  }

  /**
   * Delete form (soft delete)
   */
  async deleteForm(formId: string, userId: string, permanent = false): Promise<void> {
    try {
      // Check ownership
      const ownershipCheck = await this.db.query(
        'SELECT owner_id FROM forms WHERE id = $1 AND deleted_at IS NULL',
        [formId]
      );

      if (ownershipCheck.rows.length === 0) {
        throw new DynamicFormBuilderError('Form not found', 'FORM_NOT_FOUND', 404);
      }

      if (ownershipCheck.rows[0].owner_id !== userId) {
        throw new DynamicFormBuilderError('Access denied', 'ACCESS_DENIED', 403);
      }

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

      logger.info('Form deleted successfully', { formId, userId, permanent });
    } catch (error) {
      if (error instanceof DynamicFormBuilderError) {
        throw error;
      }

      logger.error('Failed to delete form', { error, formId, userId });
      throw new DynamicFormBuilderError('Failed to delete form', 'FORM_DELETE_FAILED', 500);
    }
  }

  /**
   * Publish form
   */
  async publishForm(formId: string, userId: string, versionNote?: string): Promise<Form> {
    try {
      // Check ownership
      const ownershipCheck = await this.db.query(
        'SELECT owner_id, status FROM forms WHERE id = $1 AND deleted_at IS NULL',
        [formId]
      );

      if (ownershipCheck.rows.length === 0) {
        throw new DynamicFormBuilderError('Form not found', 'FORM_NOT_FOUND', 404);
      }

      if (ownershipCheck.rows[0].owner_id !== userId) {
        throw new DynamicFormBuilderError('Access denied', 'ACCESS_DENIED', 403);
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

      logger.info('Form published successfully', { formId, userId, versionNote });

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
   * Generate unique slug for form
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    // Create base slug from name
    let baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 0;

    // Check for uniqueness
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
      fields: [], // Initialize empty fields array, will be populated later
      steps: [],  // Initialize empty steps array, will be populated later
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined
    };
  }
}

// Export singleton instance as default
const formServiceInstance = new FormService();
export default formServiceInstance;
// Also export the class for type usage
export { FormService };