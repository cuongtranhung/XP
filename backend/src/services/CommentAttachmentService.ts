import { pool } from '../utils/database';
import { megaS4Service } from './MegaS4Service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

export interface CommentAttachment {
  id: string;
  comment_id: string;
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

export interface CommentAttachmentCreateData {
  comment_id: string;
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
  attachment?: CommentAttachment;
  error?: string;
  uploadResult?: any;
}

export class CommentAttachmentService {
  
  /**
   * Upload file and create attachment record
   */
  async uploadAttachment(
    commentId: string,
    userId: number,
    file: Express.Multer.File
  ): Promise<AttachmentUploadResult> {
    try {
      console.log(`📎 Uploading attachment for comment ${commentId}: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // First upload to MEGA S4
      const uploadResult = await megaS4Service.uploadFile(file, {
        uploadedBy: userId.toString(),
        attachmentFor: `comment-${commentId}`,
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

      // For temporary uploads, we create a proper UUID for the attachment
      const attachmentId = uuidv4();
      
      // For temp uploads, we'll use NULL comment_id and update it later
      const attachmentData: CommentAttachmentCreateData = {
        comment_id: commentId.startsWith('temp-') ? null as any : commentId, // NULL for temp uploads
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

      // Create attachment record in database with specific ID for temp uploads
      const attachment = commentId.startsWith('temp-') 
        ? await this.createTempAttachmentRecord(attachmentData, attachmentId)
        : await this.createAttachmentRecord(attachmentData);
      
      if (commentId.startsWith('temp-')) {
        console.log(`📋 Temporary attachment created: ${attachment.id} (with DB record for later linking)`);
      }

      console.log(`✅ Attachment uploaded successfully: ${attachment.id} -> ${uploadResult.key}`);

      return {
        success: true,
        attachment,
        uploadResult
      };

    } catch (error) {
      console.error('Error uploading attachment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Create attachment record in database
   */
  async createAttachmentRecord(data: CommentAttachmentCreateData): Promise<CommentAttachment> {
    const id = uuidv4();
    return this.createAttachmentRecordWithId(data, id);
  }

  /**
   * Create temporary attachment record (with NULL comment_id)
   */
  async createTempAttachmentRecord(data: CommentAttachmentCreateData, id: string): Promise<CommentAttachment> {
    const fileCategory = this.determineFileCategory(data.mime_type);

    const query = `
      INSERT INTO comment_attachments (
        id, comment_id, file_key, original_name, mime_type, file_size,
        uploaded_by, is_public, checksum, validation_status, virus_scan_status, file_category
      ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
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
   * Create attachment record with specific ID
   */
  async createAttachmentRecordWithId(data: CommentAttachmentCreateData, id: string): Promise<CommentAttachment> {
    const fileCategory = this.determineFileCategory(data.mime_type);

    const query = `
      INSERT INTO comment_attachments (
        id, comment_id, file_key, original_name, mime_type, file_size,
        uploaded_by, is_public, checksum, validation_status, virus_scan_status, file_category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      id,
      data.comment_id,
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
   * Get attachments for a comment
   */
  async getCommentAttachments(commentId: string): Promise<CommentAttachment[]> {
    const query = `
      SELECT * FROM comment_attachments 
      WHERE comment_id = $1 AND deleted_at IS NULL
      ORDER BY upload_date DESC
    `;

    const result = await pool.query(query, [commentId]);
    return result.rows;
  }

  /**
   * Get attachment by ID
   */
  async getAttachmentById(attachmentId: string): Promise<CommentAttachment | null> {
    const query = `
      SELECT * FROM comment_attachments 
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
        UPDATE comment_attachments 
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
      `;

      await pool.query(query, [attachmentId]);

      console.log(`🗑️ Attachment ${attachmentId} soft deleted by user ${userId}`);

      return { success: true };

    } catch (error) {
      console.error('Error deleting attachment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get attachment statistics for comments
   */
  async getAttachmentStats(commentIds: string[]): Promise<{ [commentId: string]: any }> {
    if (commentIds.length === 0) return {};

    const query = `
      SELECT * FROM comment_attachment_stats 
      WHERE comment_id = ANY($1)
    `;

    const result = await pool.query(query, [commentIds]);
    
    const stats: { [commentId: string]: any } = {};
    result.rows.forEach(row => {
      stats[row.comment_id] = {
        totalAttachments: parseInt(row.total_attachments) || 0,
        validAttachments: parseInt(row.valid_attachments) || 0,
        imageAttachments: parseInt(row.image_attachments) || 0,
        documentAttachments: parseInt(row.document_attachments) || 0,
        totalSizeBytes: parseInt(row.total_size_bytes) || 0,
        validSizeBytes: parseInt(row.valid_size_bytes) || 0,
        lastAttachmentDate: row.last_attachment_date
      };
    });

    return stats;
  }

  /**
   * Cleanup deleted attachments from storage
   */
  async cleanupDeletedAttachments(): Promise<{ deleted: number; errors: string[] }> {
    const query = `
      SELECT id, file_key FROM comment_attachments 
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
          await pool.query('DELETE FROM comment_attachments WHERE id = $1', [attachment.id]);
          deleted++;
        } else {
          errors.push(`Failed to delete ${attachment.file_key} from storage`);
        }
      } catch (error) {
        errors.push(`Error deleting ${attachment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`🧹 Cleanup completed: ${deleted} attachments deleted, ${errors.length} errors`);
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
  private async checkUserAccess(attachment: CommentAttachment, userId: number): Promise<boolean> {
    // If file is public, allow access
    if (attachment.is_public) return true;

    // If user is the uploader, allow access
    if (attachment.uploaded_by === userId) return true;

    // Check if user is the comment author or has permission to access the comment
    const query = `
      SELECT sc.user_id, fs.form_id
      FROM submission_comments sc
      JOIN form_submissions fs ON sc.submission_id = fs.id
      WHERE sc.id = $1
    `;

    const result = await pool.query(query, [attachment.comment_id]);
    const commentData = result.rows[0];

    if (!commentData) return false;

    // If user is comment author, allow access
    if (commentData.user_id === userId) return true;

    // TODO: Add more sophisticated permission checking
    // For now, allow access to all authenticated users
    return true;
  }

  /**
   * Check if user can delete attachment
   */
  private async checkDeletePermission(attachment: CommentAttachment, userId: number): Promise<boolean> {
    // If user is the uploader, allow delete
    if (attachment.uploaded_by === userId) return true;

    // TODO: Add admin/moderator permission checking
    return false;
  }

  /**
   * Increment download count
   */
  private async incrementDownloadCount(attachmentId: string): Promise<void> {
    const query = `
      UPDATE comment_attachments 
      SET download_count = download_count + 1, updated_at = NOW()
      WHERE id = $1
    `;

    await pool.query(query, [attachmentId]);
  }
}

// Export singleton instance
export const commentAttachmentService = new CommentAttachmentService();