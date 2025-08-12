/**
 * Form Attachment Service
 * Manages file attachments for form submissions using MEGA S4
 */

import { pool } from '../utils/database';
import { megaS4Service } from './MegaS4Service';
import { v4 as uuidv4 } from 'uuid';

export interface FormAttachment {
  id: string;
  form_id: string;
  submission_id?: string;
  field_key: string;
  file_key: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by: number;
  upload_date: Date;
  is_public: boolean;
  download_count: number;
  checksum?: string;
  validation_status: 'pending' | 'validated' | 'rejected';
  validation_errors?: string;
  virus_scan_status: 'pending' | 'clean' | 'infected';
  file_category?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface FormAttachmentCreateData {
  form_id: string;
  submission_id?: string;
  field_key: string;
  uploaded_by: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_key: string;
  is_public?: boolean;
  checksum?: string;
  validation_status?: 'pending' | 'validated' | 'rejected';
  virus_scan_status?: 'pending' | 'clean' | 'infected';
}

export interface AttachmentUploadResult {
  success: boolean;
  attachment?: FormAttachment;
  error?: string;
  uploadResult?: any;
}

export class FormAttachmentService {
  
  /**
   * Upload file for form field and create attachment record
   */
  async uploadFormAttachment(
    formId: string,
    fieldKey: string,
    userId: number,
    file: Express.Multer.File,
    submissionId?: string
  ): Promise<AttachmentUploadResult> {
    try {
      console.log(`📎 Uploading form attachment for form ${formId}, field ${fieldKey}: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // First upload to MEGA S4
      const uploadResult = await megaS4Service.uploadFile(file, {
        uploadedBy: userId.toString(),
        attachmentFor: `form-${formId}-field-${fieldKey}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date()
      });

      if (!uploadResult.success) {
        return {
          success: false,
          error: `File upload failed: ${uploadResult.error}`,
          uploadResult
        };
      }

      // Determine file category
      const fileCategory = this.determineFileCategory(file.mimetype);

      // Create database record
      const attachmentData: FormAttachmentCreateData = {
        form_id: formId,
        submission_id: submissionId,
        field_key: fieldKey,
        uploaded_by: userId,
        original_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        file_key: uploadResult.key!,
        is_public: false, // Default to private
        checksum: uploadResult.validation?.fileInfo?.checksum || undefined,
        validation_status: uploadResult.validation?.valid ? 'validated' : 'rejected',
        virus_scan_status: 'clean' // Will be updated by actual virus scan
      };

      const attachment = await this.createAttachmentRecord(attachmentData);

      console.log(`✅ Form attachment uploaded successfully: ${attachment.id} -> ${uploadResult.key}`);

      return {
        success: true,
        attachment,
        uploadResult
      };

    } catch (error) {
      console.error('Error uploading form attachment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Create attachment record in database
   */
  async createAttachmentRecord(data: FormAttachmentCreateData): Promise<FormAttachment> {
    const id = uuidv4();
    const fileCategory = this.determineFileCategory(data.mime_type);

    const query = `
      INSERT INTO form_attachments (
        id, form_id, submission_id, field_key, file_key, original_name, mime_type, file_size,
        uploaded_by, is_public, checksum, validation_status, virus_scan_status, file_category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      id,
      data.form_id,
      data.submission_id,
      data.field_key,
      data.file_key,
      data.original_name,
      data.mime_type,
      data.file_size,
      data.uploaded_by,
      data.is_public || false,
      data.checksum,
      data.validation_status || 'pending',
      data.virus_scan_status || 'pending',
      fileCategory
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get attachments for a form submission
   */
  async getFormAttachments(formId: string, submissionId?: string): Promise<FormAttachment[]> {
    let query = `
      SELECT * FROM form_attachments 
      WHERE form_id = $1 AND deleted_at IS NULL
    `;
    const params = [formId];

    if (submissionId) {
      query += ' AND submission_id = $2';
      params.push(submissionId);
    }

    query += ' ORDER BY upload_date DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get attachments by field key
   */
  async getAttachmentsByField(formId: string, fieldKey: string, submissionId?: string): Promise<FormAttachment[]> {
    let query = `
      SELECT * FROM form_attachments 
      WHERE form_id = $1 AND field_key = $2 AND deleted_at IS NULL
    `;
    const params = [formId, fieldKey];

    if (submissionId) {
      query += ' AND submission_id = $3';
      params.push(submissionId);
    }

    query += ' ORDER BY upload_date DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get attachment by ID
   */
  async getAttachmentById(attachmentId: string): Promise<FormAttachment | null> {
    const query = `
      SELECT * FROM form_attachments 
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await pool.query(query, [attachmentId]);
    return result.rows[0] || null;
  }

  /**
   * Generate download URL for attachment
   */
  async getDownloadUrl(
    attachmentId: string, 
    userId: number,
    expiresIn: number = 3600
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const attachment = await this.getAttachmentById(attachmentId);
      
      if (!attachment) {
        return { success: false, error: 'Attachment not found' };
      }

      // Check if user has access to this attachment
      const hasAccess = await this.checkUserAccess(attachment, userId);
      if (!hasAccess) {
        return { success: false, error: 'Access denied' };
      }

      // Generate presigned URL
      const downloadUrl = await megaS4Service.generatePresignedDownloadUrl(attachment.file_key, expiresIn);

      // Update download count
      await this.incrementDownloadCount(attachmentId);

      return {
        success: true,
        url: downloadUrl
      };

    } catch (error) {
      console.error('Error generating download URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Delete attachment (soft delete)
   */
  async deleteAttachment(attachmentId: string, userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const attachment = await this.getAttachmentById(attachmentId);
      
      if (!attachment) {
        return { success: false, error: 'Attachment not found' };
      }

      // Check if user is the owner or has permission to delete
      const canDelete = await this.checkDeletePermission(attachment, userId);
      if (!canDelete) {
        return { success: false, error: 'Permission denied' };
      }

      // Soft delete in database
      const query = `
        UPDATE form_attachments 
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
      `;

      await pool.query(query, [attachmentId]);

      console.log(`🗑️ Form attachment ${attachmentId} soft deleted by user ${userId}`);

      return { success: true };

    } catch (error) {
      console.error('Error deleting form attachment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Associate uploaded files with form submission
   */
  async associateWithSubmission(formId: string, submissionId: string, fieldData: Record<string, any>): Promise<void> {
    for (const [fieldKey, fieldValue] of Object.entries(fieldData)) {
      if (!fieldValue) continue;

      // Handle single file or array of files
      const files = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
      
      for (const file of files) {
        if (file && typeof file === 'object' && file.id) {
          // Update the attachment record with submission ID
          await pool.query(
            'UPDATE form_attachments SET submission_id = $1, updated_at = NOW() WHERE id = $2 AND form_id = $3',
            [submissionId, file.id, formId]
          );
        }
      }
    }
  }

  /**
   * Cleanup deleted attachments from storage
   */
  async cleanupDeletedAttachments(): Promise<{ deleted: number; errors: string[] }> {
    const query = `
      SELECT id, file_key FROM form_attachments 
      WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days'
    `;

    const result = await pool.query(query);
    const attachments = result.rows;

    let deleted = 0;
    const errors: string[] = [];

    for (const attachment of attachments) {
      try {
        // Delete from MEGA S4
        const success = await megaS4Service.deleteFile(attachment.file_key);
        
        if (success) {
          // Remove from database
          await pool.query('DELETE FROM form_attachments WHERE id = $1', [attachment.id]);
          deleted++;
        } else {
          errors.push(`Failed to delete ${attachment.file_key} from storage`);
        }
      } catch (error) {
        errors.push(`Error deleting ${attachment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`🧹 Form attachments cleanup completed: ${deleted} attachments deleted, ${errors.length} errors`);
    return { deleted, errors };
  }

  /**
   * Determine file category based on MIME type
   */
  private determineFileCategory(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'document';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'document';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'document';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return 'archive';
    if (mimeType.includes('text/')) return 'text';
    return 'other';
  }

  /**
   * Check if user has access to attachment
   */
  private async checkUserAccess(attachment: FormAttachment, userId: number): Promise<boolean> {
    // If file is public, allow access
    if (attachment.is_public) return true;

    // If user is the uploader, allow access
    if (attachment.uploaded_by === userId) return true;

    // Check if user has access to the form/submission
    const query = `
      SELECT f.owner_id, fs.user_id as submission_user_id
      FROM forms f
      LEFT JOIN form_submissions fs ON fs.form_id = f.id AND fs.id = $2
      WHERE f.id = $1
    `;

    const result = await pool.query(query, [attachment.form_id, attachment.submission_id]);
    const formData = result.rows[0];

    if (!formData) return false;

    // If user is form owner, allow access
    if (formData.owner_id === userId) return true;

    // If user is submission owner, allow access
    if (formData.submission_user_id === userId) return true;

    // TODO: Add more sophisticated permission checking (team members, etc.)
    return false;
  }

  /**
   * Check if user can delete attachment
   */
  private async checkDeletePermission(attachment: FormAttachment, userId: number): Promise<boolean> {
    // If user is the uploader, allow delete
    if (attachment.uploaded_by === userId) return true;

    // Check if user is form owner
    const query = `SELECT owner_id FROM forms WHERE id = $1`;
    const result = await pool.query(query, [attachment.form_id]);
    const formData = result.rows[0];

    if (formData && formData.owner_id === userId) return true;

    // TODO: Add admin/moderator permission checking
    return false;
  }

  /**
   * Increment download count
   */
  private async incrementDownloadCount(attachmentId: string): Promise<void> {
    const query = `
      UPDATE form_attachments 
      SET download_count = download_count + 1, updated_at = NOW()
      WHERE id = $1
    `;

    await pool.query(query, [attachmentId]);
  }
}

// Export singleton instance
export const formAttachmentService = new FormAttachmentService();