/**
 * Form Sharing Service
 * Handles form sharing between users with granular permissions
 * Created: 2025-01-12
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../utils/logger';
import { 
  FormShare, 
  PermissionLevel, 
  AccessibleForm,
  ShareFormRequest,
  ShareFormResponse 
} from '../types/multiuser.types';

export class FormSharingService {
  private db: Pool;

  constructor(dbPool: Pool) {
    this.db = dbPool;
  }

  /**
   * Share a form with another user
   */
  async shareForm(
    formId: string,
    sharedWithUserId: number,
    sharedByUserId: number,
    permissionLevel: PermissionLevel = 'view',
    expiresAt?: Date,
    notes?: string
  ): Promise<ShareFormResponse> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check if form exists and user is owner
      const formCheck = await client.query(
        `SELECT owner_id, name FROM forms 
         WHERE id = $1 AND deleted_at IS NULL`,
        [formId]
      );

      if (formCheck.rows.length === 0) {
        throw new Error('Form not found');
      }

      if (formCheck.rows[0].owner_id !== sharedByUserId) {
        throw new Error('Only the form owner can share this form');
      }

      // Check if already shared
      const existingShare = await client.query(
        `SELECT id, permission_level FROM form_shares 
         WHERE form_id = $1 AND shared_with_user_id = $2`,
        [formId, sharedWithUserId]
      );

      let share: FormShare;

      if (existingShare.rows.length > 0) {
        // Update existing share
        const updateResult = await client.query(
          `UPDATE form_shares 
           SET permission_level = $1, 
               expires_at = $2, 
               notes = $3,
               shared_at = NOW()
           WHERE form_id = $4 AND shared_with_user_id = $5
           RETURNING *`,
          [permissionLevel, expiresAt, notes, formId, sharedWithUserId]
        );
        share = updateResult.rows[0];
        
        logger.info('Form share updated', {
          formId,
          sharedWithUserId,
          permissionLevel,
          updatedBy: sharedByUserId
        });
      } else {
        // Create new share
        const insertResult = await client.query(
          `INSERT INTO form_shares 
           (id, form_id, shared_with_user_id, shared_by_user_id, 
            permission_level, expires_at, notes, shared_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING *`,
          [
            uuidv4(),
            formId,
            sharedWithUserId,
            sharedByUserId,
            permissionLevel,
            expiresAt,
            notes
          ]
        );
        share = insertResult.rows[0];

        logger.info('Form shared successfully', {
          formId,
          sharedWithUserId,
          permissionLevel,
          sharedBy: sharedByUserId
        });
      }

      // Log the sharing action
      await client.query(
        `INSERT INTO form_access_logs 
         (id, form_id, user_id, action, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          uuidv4(),
          formId,
          sharedByUserId,
          'share',
          JSON.stringify({
            shared_with: sharedWithUserId,
            permission: permissionLevel,
            expires_at: expiresAt
          })
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        share,
        message: 'Form shared successfully'
      };

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error sharing form', { error: error.message, formId });
      
      return {
        success: false,
        error: error.message || 'Failed to share form'
      };
    } finally {
      client.release();
    }
  }

  /**
   * Remove form sharing for a user
   */
  async unshareForm(
    formId: string,
    userId: number,
    unsharedBy: number
  ): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user is owner
      const formCheck = await client.query(
        `SELECT owner_id FROM forms WHERE id = $1`,
        [formId]
      );

      if (formCheck.rows.length === 0) {
        throw new Error('Form not found');
      }

      if (formCheck.rows[0].owner_id !== unsharedBy) {
        throw new Error('Only the form owner can unshare this form');
      }

      // Delete the share
      const deleteResult = await client.query(
        `DELETE FROM form_shares 
         WHERE form_id = $1 AND shared_with_user_id = $2`,
        [formId, userId]
      );

      if (deleteResult.rowCount === 0) {
        throw new Error('Share not found');
      }

      // Log the action
      await client.query(
        `INSERT INTO form_access_logs 
         (id, form_id, user_id, action, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          uuidv4(),
          formId,
          unsharedBy,
          'unshare',
          JSON.stringify({ unshared_user: userId })
        ]
      );

      await client.query('COMMIT');

      logger.info('Form unshared successfully', {
        formId,
        userId,
        unsharedBy
      });

      return true;

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error unsharing form', { error: error.message, formId });
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Get all shares for a form
   */
  async getFormShares(formId: string, requesterId: number): Promise<FormShare[]> {
    try {
      // Check if requester is owner
      const formCheck = await this.db.query(
        `SELECT owner_id FROM forms WHERE id = $1`,
        [formId]
      );

      if (formCheck.rows.length === 0) {
        throw new Error('Form not found');
      }

      if (formCheck.rows[0].owner_id !== requesterId) {
        throw new Error('Only the form owner can view shares');
      }

      // Get all shares with user details
      const result = await this.db.query(
        `SELECT 
          fs.*,
          u.email as shared_with_email,
          u.full_name as shared_with_name,
          sharer.email as shared_by_email,
          sharer.full_name as shared_by_name
         FROM form_shares fs
         LEFT JOIN users u ON fs.shared_with_user_id = u.id
         LEFT JOIN users sharer ON fs.shared_by_user_id = sharer.id
         WHERE fs.form_id = $1
         ORDER BY fs.shared_at DESC`,
        [formId]
      );

      return result.rows;

    } catch (error: any) {
      logger.error('Error getting form shares', { error: error.message, formId });
      return [];
    }
  }

  /**
   * Get all forms shared with a user
   */
  async getUserSharedForms(userId: number): Promise<AccessibleForm[]> {
    try {
      const result = await this.db.query(
        `SELECT 
          f.id as form_id,
          f.name as form_name,
          f.owner_id,
          f.visibility,
          fs.permission_level,
          'shared' as access_type,
          fs.shared_at,
          fs.expires_at,
          u.email as owner_email,
          u.full_name as owner_name
         FROM form_shares fs
         INNER JOIN forms f ON fs.form_id = f.id
         LEFT JOIN users u ON f.owner_id = u.id
         WHERE fs.shared_with_user_id = $1
           AND f.deleted_at IS NULL
           AND (fs.expires_at IS NULL OR fs.expires_at > NOW())
         ORDER BY fs.shared_at DESC`,
        [userId]
      );

      return result.rows;

    } catch (error: any) {
      logger.error('Error getting user shared forms', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Update share permission level
   */
  async updateSharePermission(
    formId: string,
    userId: number,
    newPermission: PermissionLevel,
    updatedBy: number
  ): Promise<FormShare | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check ownership
      const formCheck = await client.query(
        `SELECT owner_id FROM forms WHERE id = $1`,
        [formId]
      );

      if (formCheck.rows.length === 0) {
        throw new Error('Form not found');
      }

      if (formCheck.rows[0].owner_id !== updatedBy) {
        throw new Error('Only the form owner can update permissions');
      }

      // Update permission
      const updateResult = await client.query(
        `UPDATE form_shares 
         SET permission_level = $1
         WHERE form_id = $2 AND shared_with_user_id = $3
         RETURNING *`,
        [newPermission, formId, userId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Share not found');
      }

      // Log the action
      await client.query(
        `INSERT INTO form_access_logs 
         (id, form_id, user_id, action, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          uuidv4(),
          formId,
          updatedBy,
          'permission_change',
          JSON.stringify({
            user_id: userId,
            new_permission: newPermission
          })
        ]
      );

      await client.query('COMMIT');

      logger.info('Share permission updated', {
        formId,
        userId,
        newPermission,
        updatedBy
      });

      return updateResult.rows[0];

    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error updating share permission', { error: error.message });
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a share has expired and clean up if needed
   */
  async cleanupExpiredShares(): Promise<number> {
    try {
      const result = await this.db.query(
        `DELETE FROM form_shares 
         WHERE expires_at IS NOT NULL AND expires_at < NOW()`
      );

      if (result.rowCount > 0) {
        logger.info(`Cleaned up ${result.rowCount} expired shares`);
      }

      return result.rowCount;

    } catch (error: any) {
      logger.error('Error cleaning up expired shares', { error: error.message });
      return 0;
    }
  }

  /**
   * Bulk share a form with multiple users
   */
  async bulkShareForm(
    formId: string,
    userIds: number[],
    sharedBy: number,
    permissionLevel: PermissionLevel = 'view'
  ): Promise<{ succeeded: number[]; failed: number[] }> {
    const succeeded: number[] = [];
    const failed: number[] = [];

    for (const userId of userIds) {
      const result = await this.shareForm(
        formId,
        userId,
        sharedBy,
        permissionLevel
      );

      if (result.success) {
        succeeded.push(userId);
      } else {
        failed.push(userId);
      }
    }

    logger.info('Bulk share completed', {
      formId,
      total: userIds.length,
      succeeded: succeeded.length,
      failed: failed.length
    });

    return { succeeded, failed };
  }
}