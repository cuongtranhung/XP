/**
 * Form Clone Service
 * Handles form cloning and template creation
 * Created: 2025-01-12
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../utils/logger';
import { 
  CloneFormRequest,
  CloneFormResponse,
  FormClone
} from '../types/multiuser.types';
import { FormPermissionService } from './FormPermissionService';

export class FormCloneService {
  private db: Pool;
  private permissionService: FormPermissionService;

  constructor(dbPool: Pool) {
    this.db = dbPool;
    this.permissionService = new FormPermissionService(dbPool);
  }

  /**
   * Clone a form for a user
   */
  async cloneForm(
    formId: string,
    userId: number,
    options?: CloneFormRequest
  ): Promise<CloneFormResponse> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user has permission to view the form
      const canView = await this.permissionService.canView(formId, userId);
      if (!canView) {
        throw new Error('You do not have permission to clone this form');
      }

      // Get the original form
      const formResult = await client.query(
        `SELECT * FROM forms WHERE id = $1 AND deleted_at IS NULL`,
        [formId]
      );

      if (formResult.rows.length === 0) {
        throw new Error('Form not found');
      }

      const originalForm = formResult.rows[0];
      const newFormId = uuidv4();
      
      // Prepare new form data
      const newFormName = options?.new_name || `${originalForm.name} (Copy)`;
      const newDescription = options?.new_description || originalForm.description;
      const newVisibility = options?.make_public ? 'public' : 'private';

      // Clone the form
      const cloneResult = await client.query(
        `INSERT INTO forms (
          id, name, description, owner_id, visibility, status,
          fields, settings, validation_rules, conditional_logic,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          NOW(), NOW()
        ) RETURNING *`,
        [
          newFormId,
          newFormName,
          newDescription,
          userId, // New owner
          newVisibility,
          'draft', // Always start as draft
          originalForm.fields,
          originalForm.settings,
          originalForm.validation_rules,
          originalForm.conditional_logic
        ]
      );

      const clonedForm = cloneResult.rows[0];

      // Record the clone relationship
      await client.query(
        `INSERT INTO form_clones (
          id, original_form_id, cloned_form_id, cloned_by_user_id, cloned_at
        ) VALUES ($1, $2, $3, $4, NOW())`,
        [
          uuidv4(),
          formId,
          newFormId,
          userId
        ]
      );

      // Log the cloning action
      await client.query(
        `INSERT INTO form_access_logs (
          id, form_id, user_id, action, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          uuidv4(),
          formId,
          userId,
          'clone',
          JSON.stringify({
            cloned_form_id: newFormId,
            new_name: newFormName
          })
        ]
      );

      await client.query('COMMIT');

      logger.info('Form cloned successfully', {
        originalFormId: formId,
        clonedFormId: newFormId,
        userId
      });

      return {
        success: true,
        cloned_form_id: newFormId,
        cloned_form: {
          ...clonedForm,
          permissions: {
            can_view: true,
            can_submit: true,
            can_edit: true,
            can_delete: true,
            permission_source: 'owner'
          }
        },
        message: 'Form cloned successfully'
      };

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error cloning form', { 
        error: error.message, 
        formId, 
        userId 
      });
      
      return {
        success: false,
        error: error.message || 'Failed to clone form'
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get clone history for a form
   */
  async getCloneHistory(formId: string): Promise<FormClone[]> {
    try {
      const result = await this.db.query(
        `SELECT 
          fc.*,
          f.name as cloned_form_name,
          u.email as cloned_by_email,
          u.full_name as cloned_by_name
         FROM form_clones fc
         LEFT JOIN forms f ON fc.cloned_form_id = f.id
         LEFT JOIN users u ON fc.cloned_by_user_id = u.id
         WHERE fc.original_form_id = $1
         ORDER BY fc.cloned_at DESC`,
        [formId]
      );

      return result.rows;

    } catch (error: any) {
      logger.error('Error getting clone history', { 
        error: error.message, 
        formId 
      });
      return [];
    }
  }

  /**
   * Get the original form for a cloned form
   */
  async getOriginalForm(clonedFormId: string): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT original_form_id FROM form_clones 
         WHERE cloned_form_id = $1`,
        [clonedFormId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].original_form_id;

    } catch (error: any) {
      logger.error('Error getting original form', { 
        error: error.message, 
        clonedFormId 
      });
      return null;
    }
  }

  /**
   * Create a template from a form
   */
  async createTemplate(
    formId: string,
    userId: number,
    templateName: string,
    templateDescription?: string,
    isPublic: boolean = false
  ): Promise<string> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user owns the form
      const ownerCheck = await this.db.query(
        `SELECT owner_id FROM forms WHERE id = $1`,
        [formId]
      );

      if (ownerCheck.rows.length === 0) {
        throw new Error('Form not found');
      }

      if (ownerCheck.rows[0].owner_id !== userId) {
        throw new Error('Only the form owner can create templates');
      }

      // Clone as template
      const cloneResult = await this.cloneForm(formId, userId, {
        new_name: templateName,
        new_description: templateDescription,
        make_public: isPublic
      });

      if (!cloneResult.success || !cloneResult.cloned_form_id) {
        throw new Error(cloneResult.error || 'Failed to create template');
      }

      const templateId = cloneResult.cloned_form_id;

      // Mark as template in settings
      await client.query(
        `UPDATE forms 
         SET settings = jsonb_set(
           COALESCE(settings, '{}'::jsonb),
           '{is_template}',
           'true'::jsonb
         ),
         status = 'published'
         WHERE id = $1`,
        [templateId]
      );

      await client.query('COMMIT');

      logger.info('Template created successfully', {
        originalFormId: formId,
        templateId,
        userId
      });

      return templateId;

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error creating template', { 
        error: error.message, 
        formId, 
        userId 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all templates available to a user
   */
  async getAvailableTemplates(userId: number): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT 
          f.id,
          f.name,
          f.description,
          f.owner_id,
          f.visibility,
          f.created_at,
          u.email as owner_email,
          u.full_name as owner_name,
          COALESCE(
            (SELECT COUNT(*) FROM form_clones WHERE original_form_id = f.id),
            0
          ) as clone_count
         FROM forms f
         LEFT JOIN users u ON f.owner_id = u.id
         WHERE f.settings->>'is_template' = 'true'
           AND f.deleted_at IS NULL
           AND (
             f.owner_id = $1 
             OR f.visibility = 'public'
             OR EXISTS (
               SELECT 1 FROM form_shares fs
               WHERE fs.form_id = f.id 
                 AND fs.shared_with_user_id = $1
                 AND (fs.expires_at IS NULL OR fs.expires_at > NOW())
             )
           )
         ORDER BY clone_count DESC, f.created_at DESC`,
        [userId]
      );

      return result.rows;

    } catch (error: any) {
      logger.error('Error getting available templates', { 
        error: error.message, 
        userId 
      });
      return [];
    }
  }

  /**
   * Clone multiple forms in batch
   */
  async batchCloneForms(
    formIds: string[],
    userId: number,
    options?: CloneFormRequest
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const formId of formIds) {
      const result = await this.cloneForm(formId, userId, options);
      
      if (result.success && result.cloned_form_id) {
        succeeded.push(result.cloned_form_id);
      } else {
        failed.push(formId);
      }
    }

    logger.info('Batch clone completed', {
      total: formIds.length,
      succeeded: succeeded.length,
      failed: failed.length,
      userId
    });

    return { succeeded, failed };
  }

  /**
   * Get statistics about form cloning
   */
  async getCloneStatistics(formId: string): Promise<any> {
    try {
      const result = await this.db.query(
        `SELECT 
          COUNT(*) as total_clones,
          COUNT(DISTINCT cloned_by_user_id) as unique_users,
          MIN(cloned_at) as first_clone,
          MAX(cloned_at) as last_clone,
          ARRAY_AGG(
            DISTINCT jsonb_build_object(
              'form_id', cloned_form_id,
              'form_name', f.name,
              'cloned_at', fc.cloned_at
            ) ORDER BY fc.cloned_at DESC
          ) FILTER (WHERE fc.cloned_at > NOW() - INTERVAL '30 days') as recent_clones
         FROM form_clones fc
         LEFT JOIN forms f ON fc.cloned_form_id = f.id
         WHERE fc.original_form_id = $1`,
        [formId]
      );

      return result.rows[0];

    } catch (error: any) {
      logger.error('Error getting clone statistics', { 
        error: error.message, 
        formId 
      });
      return {
        total_clones: 0,
        unique_users: 0,
        first_clone: null,
        last_clone: null,
        recent_clones: []
      };
    }
  }

  /**
   * Delete clone history for a form
   */
  async deleteCloneHistory(formId: string, userId: number): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user owns the form
      const ownerCheck = await this.db.query(
        `SELECT owner_id FROM forms WHERE id = $1`,
        [formId]
      );

      if (ownerCheck.rows.length === 0) {
        throw new Error('Form not found');
      }

      if (ownerCheck.rows[0].owner_id !== userId) {
        throw new Error('Only the form owner can delete clone history');
      }

      // Delete clone records (but keep the cloned forms)
      await client.query(
        `DELETE FROM form_clones WHERE original_form_id = $1`,
        [formId]
      );

      await client.query('COMMIT');

      logger.info('Clone history deleted', {
        formId,
        userId
      });

      return true;

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error deleting clone history', { 
        error: error.message, 
        formId 
      });
      return false;
    } finally {
      client.release();
    }
  }
}