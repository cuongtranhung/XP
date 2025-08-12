/**
 * Form Permission Service
 * Handles permission checking and enforcement for forms
 * Created: 2025-01-12
 */

import { Pool } from 'pg';
import { logger } from '../../../utils/logger';
import { 
  PermissionLevel,
  CheckPermissionsResponse
} from '../types/multiuser.types';

export class FormPermissionService {
  private db: Pool;

  constructor(dbPool: Pool) {
    this.db = dbPool;
  }

  /**
   * Check all permissions for a user on a form
   */
  async checkPermissions(
    formId: string,
    userId: number
  ): Promise<CheckPermissionsResponse> {
    try {
      // First check if user is the owner
      const ownerCheck = await this.db.query(
        `SELECT owner_id, visibility, status FROM forms 
         WHERE id = $1 AND deleted_at IS NULL`,
        [formId]
      );

      if (ownerCheck.rows.length === 0) {
        return {
          can_view: false,
          can_submit: false,
          can_edit: false,
          can_delete: false,
          permission_source: 'none'
        };
      }

      const form = ownerCheck.rows[0];

      // Owner has all permissions
      if (form.owner_id === userId) {
        return {
          can_view: true,
          can_submit: true,
          can_edit: true,
          can_delete: true,
          permission_source: 'owner'
        };
      }

      // Check for explicit share
      const shareCheck = await this.db.query(
        `SELECT permission_level FROM form_shares 
         WHERE form_id = $1 AND shared_with_user_id = $2
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [formId, userId]
      );

      if (shareCheck.rows.length > 0) {
        const permissionLevel = shareCheck.rows[0].permission_level;
        return this.permissionLevelToResponse(permissionLevel, 'shared');
      }

      // Check public visibility
      if (form.visibility === 'public' && form.status === 'published') {
        return {
          can_view: true,
          can_submit: true,
          can_edit: false,
          can_delete: false,
          permission_source: 'public'
        };
      }

      // No permissions
      return {
        can_view: false,
        can_submit: false,
        can_edit: false,
        can_delete: false,
        permission_source: 'none'
      };

    } catch (error: any) {
      logger.error('Error checking permissions', { 
        error: error.message, 
        formId, 
        userId 
      });
      
      // Return no permissions on error
      return {
        can_view: false,
        can_submit: false,
        can_edit: false,
        can_delete: false,
        permission_source: 'none'
      };
    }
  }

  /**
   * Check if user can view a form
   */
  async canView(formId: string, userId: number): Promise<boolean> {
    const permissions = await this.checkPermissions(formId, userId);
    return permissions.can_view;
  }

  /**
   * Check if user can submit to a form
   */
  async canSubmit(formId: string, userId: number): Promise<boolean> {
    const permissions = await this.checkPermissions(formId, userId);
    return permissions.can_submit;
  }

  /**
   * Check if user can edit a form
   */
  async canEdit(formId: string, userId: number): Promise<boolean> {
    const permissions = await this.checkPermissions(formId, userId);
    return permissions.can_edit;
  }

  /**
   * Check if user can delete a form
   */
  async canDelete(formId: string, userId: number): Promise<boolean> {
    const permissions = await this.checkPermissions(formId, userId);
    return permissions.can_delete;
  }

  /**
   * Enforce a specific permission requirement
   * Throws an error if the user doesn't have the required permission
   */
  async enforcePermission(
    formId: string,
    userId: number,
    requiredPermission: 'view' | 'submit' | 'edit' | 'delete'
  ): Promise<void> {
    const permissions = await this.checkPermissions(formId, userId);
    
    let hasPermission = false;
    let permissionName = requiredPermission;

    switch (requiredPermission) {
      case 'view':
        hasPermission = permissions.can_view;
        break;
      case 'submit':
        hasPermission = permissions.can_submit;
        break;
      case 'edit':
        hasPermission = permissions.can_edit;
        break;
      case 'delete':
        hasPermission = permissions.can_delete;
        break;
    }

    if (!hasPermission) {
      const error = new Error(
        `User ${userId} does not have ${permissionName} permission for form ${formId}`
      );
      (error as any).statusCode = 403;
      (error as any).code = 'PERMISSION_DENIED';
      
      logger.warn('Permission denied', {
        userId,
        formId,
        requiredPermission,
        permissionSource: permissions.permission_source
      });
      
      throw error;
    }

    logger.debug('Permission granted', {
      userId,
      formId,
      requiredPermission,
      permissionSource: permissions.permission_source
    });
  }

  /**
   * Get forms that a user has access to
   */
  async getUserAccessibleForms(
    userId: number,
    includePublic: boolean = true
  ): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM get_accessible_forms($1, $2)`,
        [userId, includePublic]
      );

      return result.rows;

    } catch (error: any) {
      logger.error('Error getting accessible forms', { 
        error: error.message, 
        userId 
      });
      return [];
    }
  }

  /**
   * Check if a form is public
   */
  async isFormPublic(formId: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT visibility, status FROM forms 
         WHERE id = $1 AND deleted_at IS NULL`,
        [formId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const form = result.rows[0];
      return form.visibility === 'public' && form.status === 'published';

    } catch (error: any) {
      logger.error('Error checking if form is public', { 
        error: error.message, 
        formId 
      });
      return false;
    }
  }

  /**
   * Get the owner of a form
   */
  async getFormOwner(formId: string): Promise<number | null> {
    try {
      const result = await this.db.query(
        `SELECT owner_id FROM forms WHERE id = $1`,
        [formId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].owner_id;

    } catch (error: any) {
      logger.error('Error getting form owner', { 
        error: error.message, 
        formId 
      });
      return null;
    }
  }

  /**
   * Check if a user has a specific permission level
   */
  async hasPermissionLevel(
    formId: string,
    userId: number,
    requiredLevel: PermissionLevel
  ): Promise<boolean> {
    const permissions = await this.checkPermissions(formId, userId);
    
    // Map permission levels to capabilities
    switch (requiredLevel) {
      case 'view':
        return permissions.can_view;
      case 'submit':
        return permissions.can_submit;
      case 'edit':
        return permissions.can_edit;
      case 'admin':
        return permissions.can_delete; // Admin level maps to delete permission
      default:
        return false;
    }
  }

  /**
   * Get all users who have access to a form
   */
  async getFormAccessList(formId: string): Promise<any[]> {
    try {
      const result = await this.db.query(
        `-- Owner
         SELECT 
           f.owner_id as user_id,
           u.email,
           u.full_name,
           'owner' as permission_level,
           f.created_at as granted_at,
           NULL as expires_at
         FROM forms f
         LEFT JOIN users u ON f.owner_id = u.id
         WHERE f.id = $1
         
         UNION
         
         -- Shared users
         SELECT 
           fs.shared_with_user_id as user_id,
           u.email,
           u.full_name,
           fs.permission_level,
           fs.shared_at as granted_at,
           fs.expires_at
         FROM form_shares fs
         LEFT JOIN users u ON fs.shared_with_user_id = u.id
         WHERE fs.form_id = $1
           AND (fs.expires_at IS NULL OR fs.expires_at > NOW())
         
         ORDER BY permission_level DESC, granted_at DESC`,
        [formId]
      );

      return result.rows;

    } catch (error: any) {
      logger.error('Error getting form access list', { 
        error: error.message, 
        formId 
      });
      return [];
    }
  }

  /**
   * Batch check permissions for multiple forms
   */
  async batchCheckPermissions(
    formIds: string[],
    userId: number
  ): Promise<Map<string, CheckPermissionsResponse>> {
    const results = new Map<string, CheckPermissionsResponse>();

    for (const formId of formIds) {
      const permissions = await this.checkPermissions(formId, userId);
      results.set(formId, permissions);
    }

    return results;
  }

  /**
   * Helper to convert permission level to response object
   */
  private permissionLevelToResponse(
    level: PermissionLevel,
    source: 'owner' | 'shared' | 'public' | 'none'
  ): CheckPermissionsResponse {
    const response: CheckPermissionsResponse = {
      can_view: false,
      can_submit: false,
      can_edit: false,
      can_delete: false,
      permission_source: source
    };

    switch (level) {
      case 'admin':
        response.can_delete = true;
        // Fall through
      case 'edit':
        response.can_edit = true;
        // Fall through
      case 'submit':
        response.can_submit = true;
        // Fall through
      case 'view':
        response.can_view = true;
        break;
    }

    return response;
  }

  /**
   * Update form visibility
   */
  async updateFormVisibility(
    formId: string,
    userId: number,
    visibility: 'private' | 'shared' | 'public' | 'organization'
  ): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user is owner
      const ownerCheck = await client.query(
        `SELECT owner_id FROM forms WHERE id = $1`,
        [formId]
      );

      if (ownerCheck.rows.length === 0) {
        throw new Error('Form not found');
      }

      if (ownerCheck.rows[0].owner_id !== userId) {
        throw new Error('Only the form owner can change visibility');
      }

      // Update visibility
      await client.query(
        `UPDATE forms 
         SET visibility = $1, updated_at = NOW()
         WHERE id = $2`,
        [visibility, formId]
      );

      // If changing to private, remove all shares
      if (visibility === 'private') {
        await client.query(
          `DELETE FROM form_shares WHERE form_id = $1`,
          [formId]
        );
      }

      await client.query('COMMIT');

      logger.info('Form visibility updated', {
        formId,
        visibility,
        userId
      });

      return true;

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error updating form visibility', { 
        error: error.message, 
        formId 
      });
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Validate permission level string
   */
  isValidPermissionLevel(level: string): level is PermissionLevel {
    return ['view', 'submit', 'edit', 'admin'].includes(level);
  }
}