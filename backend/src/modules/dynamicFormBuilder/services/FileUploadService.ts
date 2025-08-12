/**
 * File Upload Service
 * Handles file uploads for form submissions
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { pool } from '../../../utils/database';

// Simple AppError class for error handling
class AppError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'AppError';
  }
}

interface FileUploadResult {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
}

interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

export class FileUploadService {
  private uploadDir: string;
  private uploadUrl: string;
  
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'forms');
    this.uploadUrl = process.env.UPLOAD_URL ?? '/uploads/forms';
  }

  /**
   * Initialize upload directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Upload file for form submission
   */
  async uploadFile(
    file: Express.Multer.File,
    formId: string,
    submissionId: string,
    fieldKey: string,
    validationOptions?: FileValidationOptions
  ): Promise<FileUploadResult> {
    try {
      // Validate file
      this.validateFile(file, validationOptions);

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      const relativePath = path.join(formId, submissionId, uniqueFilename);
      const absolutePath = path.join(this.uploadDir, relativePath);

      // Create directory structure
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });

      // Save file
      await fs.writeFile(absolutePath, file.buffer);

      // Generate thumbnail for images
      let thumbnailUrl: string | undefined;
      if (file.mimetype.startsWith('image/')) {
        thumbnailUrl = await this.generateThumbnail(
          absolutePath,
          relativePath,
          formId,
          submissionId
        );
      }

      // Save file metadata to database
      const query = `
        INSERT INTO form_submission_files (
          id, submission_id, field_key, filename, original_name,
          mime_type, size, path, thumbnail_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const fileId = uuidv4();
      const result = await pool.query(query, [
        fileId,
        submissionId,
        fieldKey,
        uniqueFilename,
        file.originalname,
        file.mimetype,
        file.size,
        relativePath,
        thumbnailUrl ? path.join(formId, submissionId, `thumb_${uniqueFilename}`) : null
      ]);

      return {
        id: fileId,
        filename: uniqueFilename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `${this.uploadUrl}/${relativePath}`,
        thumbnailUrl: thumbnailUrl ? `${this.uploadUrl}/${thumbnailUrl}` : undefined
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw new AppError('Failed to upload file', 500);
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    formId: string,
    submissionId: string,
    fieldKey: string,
    validationOptions?: FileValidationOptions
  ): Promise<FileUploadResult[]> {
    const uploadPromises = files.map(file =>
      this.uploadFile(file, formId, submissionId, fieldKey, validationOptions)
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Generate thumbnail for image
   */
  private async generateThumbnail(
    originalPath: string,
    relativePath: string,
    formId: string,
    submissionId: string
  ): Promise<string> {
    try {
      const thumbnailFilename = `thumb_${path.basename(originalPath)}`;
      const thumbnailRelativePath = path.join(formId, submissionId, thumbnailFilename);
      const thumbnailAbsolutePath = path.join(this.uploadDir, thumbnailRelativePath);

      await sharp(originalPath)
        .resize(200, 200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailAbsolutePath);

      return thumbnailRelativePath;
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      // Don't throw error, just return undefined
      return '';
    }
  }

  /**
   * Validate file against options
   */
  private validateFile(file: Express.Multer.File, options?: FileValidationOptions): void {
    if (!options) return;

    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      throw new AppError(
        `File size exceeds maximum allowed size of ${options.maxSize / 1048576}MB`,
        400
      );
    }

    // Check mime type
    if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
      throw new AppError(
        `File type ${file.mimetype} is not allowed`,
        400
      );
    }

    // Check file extension
    if (options.allowedExtensions) {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      if (!options.allowedExtensions.includes(fileExtension)) {
        throw new AppError(
          `File extension ${fileExtension} is not allowed`,
          400
        );
      }
    }

    // Security checks
    this.performSecurityChecks(file);
  }

  /**
   * Perform security checks on uploaded file
   */
  private performSecurityChecks(file: Express.Multer.File): void {
    // Check for null bytes in filename
    if (file.originalname.includes('\0')) {
      throw new AppError('Invalid filename', 400);
    }

    // Check for path traversal attempts
    const normalizedPath = path.normalize(file.originalname);
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      throw new AppError('Invalid filename', 400);
    }

    // Check for double extensions
    const extensions = file.originalname.split('.');
    if (extensions.length > 2) {
      // Allow only specific double extensions
      const allowedDoubleExtensions = ['.tar.gz', '.tar.bz2'];
      const lastTwo = `.${extensions[extensions.length - 2]}.${extensions[extensions.length - 1]}`;
      if (!allowedDoubleExtensions.includes(lastTwo)) {
        throw new AppError('Invalid filename', 400);
      }
    }
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string, submissionId: string): Promise<void> {
    try {
      // Get file info from database
      const query = 'SELECT * FROM form_submission_files WHERE id = $1 AND submission_id = $2';
      const result = await pool.query(query, [fileId, submissionId]);

      if (result.rows.length === 0) {
        throw new AppError('File not found', 404);
      }

      const file = result.rows[0];

      // Delete physical files
      const filePath = path.join(this.uploadDir, file.path);
      await fs.unlink(filePath).catch(() => {}); // Ignore if file doesn't exist

      if (file.thumbnail_path) {
        const thumbnailPath = path.join(this.uploadDir, file.thumbnail_path);
        await fs.unlink(thumbnailPath).catch(() => {});
      }

      // Delete from database
      await pool.query('DELETE FROM form_submission_files WHERE id = $1', [fileId]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('File deletion error:', error);
      throw new AppError('Failed to delete file', 500);
    }
  }

  /**
   * Get file validation options for a field
   */
  getFieldValidationOptions(field: any): FileValidationOptions {
    const options: FileValidationOptions = {};

    if (field.validation?.maxSize) {
      options.maxSize = field.validation.maxSize;
    }

    if (field.fieldType === 'image') {
      options.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      options.allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    } else if (field.fieldType === 'file') {
      // Default allowed types for generic file upload
      options.allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
      ];
      options.allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];
    }

    // Override with field-specific allowed types
    if (field.validation?.allowedTypes) {
      options.allowedTypes = field.validation.allowedTypes;
    }

    if (field.validation?.allowedExtensions) {
      options.allowedExtensions = field.validation.allowedExtensions;
    }

    return options;
  }

  /**
   * Clean up orphaned files
   */
  async cleanupOrphanedFiles(): Promise<void> {
    try {
      // Get all files older than 24 hours that don't have a submission
      const query = `
        SELECT f.* FROM form_submission_files f
        LEFT JOIN form_submissions s ON f.submission_id = s.id
        WHERE s.id IS NULL AND f.created_at < NOW() - INTERVAL '24 hours'
      `;

      const result = await pool.query(query);

      for (const file of result.rows) {
        await this.deleteFile(file.id, file.submission_id);
      }

      console.log(`Cleaned up ${result.rows.length} orphaned files`);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{ totalSize: number; thumbnailSize: number; fileCount: number }> {
    try {
      // Calculate total size from uploaded files
      const uploadsDir = path.join(this.uploadDir, 'forms');
      const thumbnailsDir = path.join(this.uploadDir, 'forms', 'thumbnails');
      
      let totalSize = 0;
      let thumbnailSize = 0;
      let fileCount = 0;

      // Check if directories exist
      if (fsSync.existsSync(uploadsDir)) {
        const files = fsSync.readdirSync(uploadsDir, { recursive: true });
        for (const file of files) {
          const filePath = path.join(uploadsDir, file as string);
          const stats = fsSync.statSync(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
            fileCount++;
          }
        }
      }

      if (fsSync.existsSync(thumbnailsDir)) {
        const thumbnails = fsSync.readdirSync(thumbnailsDir);
        for (const thumb of thumbnails) {
          const thumbPath = path.join(thumbnailsDir, thumb);
          const stats = fsSync.statSync(thumbPath);
          if (stats.isFile()) {
            thumbnailSize += stats.size;
          }
        }
      }

      return {
        totalSize,
        thumbnailSize,
        fileCount
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        totalSize: 0,
        thumbnailSize: 0,
        fileCount: 0
      };
    }
  }
}

export default new FileUploadService();