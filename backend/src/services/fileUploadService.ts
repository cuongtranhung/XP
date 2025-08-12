/**
 * File Upload Service
 * Comprehensive file upload management with security, validation, and processing
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as mime from 'mime-types';
import { Pool } from 'pg';
import multer from 'multer';
import { Request } from 'express';
import redisClient from '../config/redis';
import logger from '../utils/logger';

// Types
export interface FileMetadata {
  fileId: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  hash: string;
  uploadedBy: string;
  uploadedAt: Date;
  lastAccessed?: Date;
  downloadCount: number;
  isPublic: boolean;
  expiresAt?: Date;
  tags: string[];
  description?: string;
  category?: string;
  version: number;
  parentId?: string; // For versioning
  status: 'uploading' | 'processing' | 'ready' | 'error' | 'deleted';
  metadata: Record<string, any>;
}

export interface UploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  uploadPath: string;
  tempPath: string;
  enableVirus: boolean;
  enableDuplication: boolean;
  enableCompression: boolean;
  enableThumbnails: boolean;
  retentionDays?: number;
  enableEncryption?: boolean;
}

export interface UploadResult {
  success: boolean;
  file?: FileMetadata;
  error?: string;
  warnings?: string[];
  processingStatus?: 'pending' | 'completed' | 'failed';
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedName: string;
  detectedMimeType: string;
}

export interface ChunkInfo {
  chunkId: string;
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
  hash: string;
  uploadedAt: Date;
}

export interface ResumeableUpload {
  uploadId: string;
  fileId: string;
  filename: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  createdAt: Date;
  expiresAt: Date;
  userId: string;
  status: 'active' | 'completed' | 'cancelled' | 'expired';
}

export interface UploadProgress {
  uploadId: string;
  progress: number; // 0-100
  uploadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
  status: string;
}

export interface SecurityScanResult {
  isSafe: boolean;
  threats: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  scanTime: Date;
  scanEngine: string;
}

class FileUploadService extends EventEmitter {
  private config: UploadConfig;
  private pool: Pool;
  private multerConfig: multer.Multer;
  private isInitialized: boolean = false;

  constructor() {
    super();
    
    this.config = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/csv',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip', 'application/x-zip-compressed'
      ],
      allowedExtensions: [
        '.jpg', '.jpeg', '.png', '.gif', '.webp',
        '.pdf', '.txt', '.csv',
        '.doc', '.docx', '.xls', '.xlsx',
        '.zip'
      ],
      uploadPath: './uploads',
      tempPath: './temp',
      enableVirus: true,
      enableDuplication: true,
      enableCompression: true,
      enableThumbnails: true,
      retentionDays: 365,
      enableEncryption: false
    };

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Initialize the file upload service
   */
  async initialize(config?: Partial<UploadConfig>): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Create directories
      await this.ensureDirectories();
      
      // Create database tables
      await this.createTables();
      
      // Setup multer configuration
      this.setupMulter();
      
      // Start cleanup job
      this.startCleanupJob();
      
      this.isInitialized = true;
      logger.info('File upload service initialized');
    } catch (error) {
      logger.error('Failed to initialize file upload service:', error);
      throw error;
    }
  }

  /**
   * Create necessary directories
   */
  private async ensureDirectories(): Promise<void> {
    const directories = [
      this.config.uploadPath,
      this.config.tempPath,
      path.join(this.config.uploadPath, 'images'),
      path.join(this.config.uploadPath, 'documents'),
      path.join(this.config.uploadPath, 'thumbnails'),
      path.join(this.config.uploadPath, 'chunks')
    ];

    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const queries = [
      `
        CREATE TABLE IF NOT EXISTS files (
          file_id VARCHAR(255) PRIMARY KEY,
          original_name VARCHAR(500) NOT NULL,
          filename VARCHAR(255) NOT NULL,
          mimetype VARCHAR(100) NOT NULL,
          size BIGINT NOT NULL,
          path TEXT NOT NULL,
          hash VARCHAR(64) NOT NULL,
          uploaded_by VARCHAR(255) NOT NULL,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_accessed TIMESTAMP,
          download_count INTEGER DEFAULT 0,
          is_public BOOLEAN DEFAULT false,
          expires_at TIMESTAMP,
          tags TEXT[],
          description TEXT,
          category VARCHAR(100),
          version INTEGER DEFAULT 1,
          parent_id VARCHAR(255),
          status VARCHAR(50) DEFAULT 'ready',
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES files(file_id) ON DELETE SET NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
        CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
        CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
        CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
        CREATE INDEX IF NOT EXISTS idx_files_tags ON files USING GIN(tags);
        CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_id);
      `,
      `
        CREATE TABLE IF NOT EXISTS file_chunks (
          chunk_id VARCHAR(255) PRIMARY KEY,
          file_id VARCHAR(255) NOT NULL,
          chunk_index INTEGER NOT NULL,
          total_chunks INTEGER NOT NULL,
          chunk_size INTEGER NOT NULL,
          hash VARCHAR(64) NOT NULL,
          path TEXT NOT NULL,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(file_id, chunk_index)
        );
        
        CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id ON file_chunks(file_id);
      `,
      `
        CREATE TABLE IF NOT EXISTS resumeable_uploads (
          upload_id VARCHAR(255) PRIMARY KEY,
          file_id VARCHAR(255) NOT NULL,
          filename VARCHAR(500) NOT NULL,
          total_size BIGINT NOT NULL,
          chunk_size INTEGER NOT NULL,
          total_chunks INTEGER NOT NULL,
          uploaded_chunks INTEGER[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'active'
        );
        
        CREATE INDEX IF NOT EXISTS idx_resumeable_uploads_user ON resumeable_uploads(user_id);
        CREATE INDEX IF NOT EXISTS idx_resumeable_uploads_status ON resumeable_uploads(status);
      `,
      `
        CREATE TABLE IF NOT EXISTS file_security_scans (
          scan_id VARCHAR(255) PRIMARY KEY,
          file_id VARCHAR(255) NOT NULL,
          is_safe BOOLEAN NOT NULL,
          threats JSONB,
          scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          scan_engine VARCHAR(100),
          FOREIGN KEY (file_id) REFERENCES files(file_id) ON DELETE CASCADE
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS file_access_logs (
          log_id BIGSERIAL PRIMARY KEY,
          file_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255),
          action VARCHAR(50) NOT NULL,
          ip_address INET,
          user_agent TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (file_id) REFERENCES files(file_id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_file_access_logs_file ON file_access_logs(file_id);
        CREATE INDEX IF NOT EXISTS idx_file_access_logs_user ON file_access_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_file_access_logs_timestamp ON file_access_logs(timestamp);
      `
    ];

    for (const query of queries) {
      await this.pool.query(query);
    }
  }

  /**
   * Setup multer configuration
   */
  private setupMulter(): void {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const category = this.categorizeFile(file.mimetype);
        const dest = path.join(this.config.uploadPath, category);
        cb(null, dest);
      },
      filename: (req, file, cb) => {
        const uniqueName = this.generateUniqueFilename(file.originalname);
        cb(null, uniqueName);
      }
    });

    this.multerConfig = multer({
      storage,
      limits: {
        fileSize: this.config.maxFileSize,
        files: 10, // Maximum 10 files per request
        fieldSize: 1024 * 1024 // 1MB field size limit
      },
      fileFilter: (req, file, cb) => {
        const validation = this.validateFile(file);
        if (validation.isValid) {
          cb(null, true);
        } else {
          cb(new Error(validation.errors.join(', ')));
        }
      }
    });
  }

  /**
   * Get multer middleware
   */
  getMulterMiddleware(): multer.Multer {
    if (!this.isInitialized) {
      throw new Error('FileUploadService not initialized');
    }
    return this.multerConfig;
  }

  /**
   * Upload single file
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    options: {
      isPublic?: boolean;
      expiresAt?: Date;
      tags?: string[];
      description?: string;
      category?: string;
    } = {}
  ): Promise<UploadResult> {
    try {
      // Validate file
      const validation = this.validateFile({
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      } as any);

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          warnings: validation.warnings
        };
      }

      // Calculate file hash
      const hash = await this.calculateFileHash(file.path);
      
      // Check for duplicates
      if (this.config.enableDuplication) {
        const duplicate = await this.findDuplicateFile(hash, userId);
        if (duplicate) {
          // Remove the uploaded file since we found a duplicate
          await fs.unlink(file.path);
          return {
            success: true,
            file: duplicate,
            warnings: ['File already exists, returning existing file']
          };
        }
      }

      // Create file metadata
      const fileId = this.generateFileId();
      const metadata: FileMetadata = {
        fileId,
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        hash,
        uploadedBy: userId,
        uploadedAt: new Date(),
        downloadCount: 0,
        isPublic: options.isPublic || false,
        expiresAt: options.expiresAt,
        tags: options.tags || [],
        description: options.description,
        category: options.category || this.categorizeFile(file.mimetype),
        version: 1,
        status: 'processing',
        metadata: {}
      };

      // Save to database
      await this.saveFileMetadata(metadata);

      // Security scan if enabled
      if (this.config.enableVirus) {
        const scanResult = await this.performSecurityScan(fileId, file.path);
        if (!scanResult.isSafe) {
          // Delete file and update status
          await fs.unlink(file.path);
          await this.updateFileStatus(fileId, 'error');
          
          return {
            success: false,
            error: `Security scan failed: ${scanResult.threats.map(t => t.description).join(', ')}`
          };
        }
      }

      // Post-processing
      await this.postProcessFile(fileId, metadata);

      // Update status to ready
      await this.updateFileStatus(fileId, 'ready');
      metadata.status = 'ready';

      // Log access
      await this.logFileAccess(fileId, userId, 'upload');

      this.emit('fileUploaded', { fileId, userId, metadata });

      return {
        success: true,
        file: metadata,
        processingStatus: 'completed'
      };
    } catch (error) {
      logger.error('File upload failed:', error);
      
      // Clean up file if exists
      if (file.path) {
        try {
          await fs.unlink(file.path);
        } catch {
          // Ignore cleanup errors
        }
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: Express.Multer.File[],
    userId: string,
    options: {
      isPublic?: boolean;
      expiresAt?: Date;
      tags?: string[];
      description?: string;
      category?: string;
    } = {}
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    for (const file of files) {
      const result = await this.uploadFile(file, userId, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Start resumeable upload
   */
  async startResumeableUpload(
    filename: string,
    totalSize: number,
    userId: string,
    chunkSize: number = 1024 * 1024 // 1MB default chunk size
  ): Promise<ResumeableUpload> {
    try {
      const uploadId = this.generateUploadId();
      const fileId = this.generateFileId();
      const totalChunks = Math.ceil(totalSize / chunkSize);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      const upload: ResumeableUpload = {
        uploadId,
        fileId,
        filename,
        totalSize,
        chunkSize,
        totalChunks,
        uploadedChunks: [],
        createdAt: new Date(),
        expiresAt,
        userId,
        status: 'active'
      };

      // Save to database
      await this.saveResumeableUpload(upload);

      return upload;
    } catch (error) {
      logger.error('Failed to start resumeable upload:', error);
      throw error;
    }
  }

  /**
   * Upload chunk for resumeable upload
   */
  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunkData: Buffer,
    userId: string
  ): Promise<{
    success: boolean;
    progress: number;
    isComplete: boolean;
    fileId?: string;
  }> {
    try {
      // Get upload info
      const upload = await this.getResumeableUpload(uploadId);
      if (!upload) {
        throw new Error('Upload not found');
      }

      if (upload.userId !== userId) {
        throw new Error('Unauthorized');
      }

      if (upload.status !== 'active') {
        throw new Error('Upload is not active');
      }

      // Check if chunk already uploaded
      if (upload.uploadedChunks.includes(chunkIndex)) {
        return {
          success: true,
          progress: (upload.uploadedChunks.length / upload.totalChunks) * 100,
          isComplete: upload.uploadedChunks.length === upload.totalChunks
        };
      }

      // Save chunk
      const chunkPath = path.join(
        this.config.uploadPath,
        'chunks',
        `${uploadId}_${chunkIndex}`
      );
      
      await fs.writeFile(chunkPath, chunkData);

      // Calculate chunk hash
      const chunkHash = crypto.createHash('sha256')
        .update(chunkData)
        .digest('hex');

      // Save chunk info
      const chunkInfo: ChunkInfo = {
        chunkId: `${uploadId}_${chunkIndex}`,
        fileId: upload.fileId,
        chunkIndex,
        totalChunks: upload.totalChunks,
        chunkSize: chunkData.length,
        hash: chunkHash,
        uploadedAt: new Date()
      };

      await this.saveChunkInfo(chunkInfo);

      // Update upload progress
      upload.uploadedChunks.push(chunkIndex);
      await this.updateResumeableUpload(upload);

      const progress = (upload.uploadedChunks.length / upload.totalChunks) * 100;
      const isComplete = upload.uploadedChunks.length === upload.totalChunks;

      // If complete, assemble file
      if (isComplete) {
        await this.assembleChunks(upload);
        upload.status = 'completed';
        await this.updateResumeableUpload(upload);
      }

      return {
        success: true,
        progress,
        isComplete,
        fileId: isComplete ? upload.fileId : undefined
      };
    } catch (error) {
      logger.error('Chunk upload failed:', error);
      throw error;
    }
  }

  /**
   * Get upload progress
   */
  async getUploadProgress(uploadId: string): Promise<UploadProgress | null> {
    try {
      const upload = await this.getResumeableUpload(uploadId);
      if (!upload) return null;

      const uploadedBytes = upload.uploadedChunks.length * upload.chunkSize;
      const progress = (uploadedBytes / upload.totalSize) * 100;

      return {
        uploadId,
        progress,
        uploadedBytes,
        totalBytes: upload.totalSize,
        speed: 0, // Would need to track over time
        remainingTime: 0, // Would need to calculate based on speed
        status: upload.status
      };
    } catch (error) {
      logger.error('Failed to get upload progress:', error);
      return null;
    }
  }

  /**
   * Cancel resumeable upload
   */
  async cancelResumeableUpload(uploadId: string, userId: string): Promise<boolean> {
    try {
      const upload = await this.getResumeableUpload(uploadId);
      if (!upload) return false;

      if (upload.userId !== userId) {
        throw new Error('Unauthorized');
      }

      // Update status
      upload.status = 'cancelled';
      await this.updateResumeableUpload(upload);

      // Clean up chunks
      await this.cleanupChunks(uploadId);

      return true;
    } catch (error) {
      logger.error('Failed to cancel upload:', error);
      return false;
    }
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string, userId?: string): Promise<FileMetadata | null> {
    try {
      const query = `
        SELECT * FROM files
        WHERE file_id = $1
        AND (is_public = true OR uploaded_by = $2)
        AND status != 'deleted'
      `;

      const result = await this.pool.query(query, [fileId, userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.mapRowToFileMetadata(row);
    } catch (error) {
      logger.error('Failed to get file:', error);
      return null;
    }
  }

  /**
   * Get files for user
   */
  async getUserFiles(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      category?: string;
      tags?: string[];
      search?: string;
    } = {}
  ): Promise<{ files: FileMetadata[]; total: number }> {
    try {
      let query = `
        SELECT COUNT(*) OVER() as total_count, *
        FROM files
        WHERE uploaded_by = $1 AND status != 'deleted'
      `;
      
      const params: any[] = [userId];
      let paramIndex = 2;

      if (options.category) {
        query += ` AND category = $${paramIndex}`;
        params.push(options.category);
        paramIndex++;
      }

      if (options.tags && options.tags.length > 0) {
        query += ` AND tags && $${paramIndex}`;
        params.push(options.tags);
        paramIndex++;
      }

      if (options.search) {
        query += ` AND (
          original_name ILIKE $${paramIndex} OR 
          description ILIKE $${paramIndex}
        )`;
        params.push(`%${options.search}%`);
        paramIndex++;
      }

      query += ` ORDER BY uploaded_at DESC`;

      if (options.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(options.limit);
        paramIndex++;
      }

      if (options.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(options.offset);
        paramIndex++;
      }

      const result = await this.pool.query(query, params);
      
      const files = result.rows.map(row => this.mapRowToFileMetadata(row));
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

      return { files, total };
    } catch (error) {
      logger.error('Failed to get user files:', error);
      return { files: [], total: 0 };
    }
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      const file = await this.getFile(fileId, userId);
      if (!file) return false;

      if (file.uploadedBy !== userId) {
        throw new Error('Unauthorized');
      }

      // Soft delete - update status
      await this.updateFileStatus(fileId, 'deleted');

      // Physical delete will be handled by cleanup job
      
      // Log access
      await this.logFileAccess(fileId, userId, 'delete');

      this.emit('fileDeleted', { fileId, userId });

      return true;
    } catch (error) {
      logger.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Download file
   */
  async downloadFile(
    fileId: string,
    userId?: string
  ): Promise<{ stream: NodeJS.ReadableStream; metadata: FileMetadata } | null> {
    try {
      const file = await this.getFile(fileId, userId);
      if (!file) return null;

      // Check file exists
      try {
        await fs.access(file.path);
      } catch {
        logger.error(`File not found on disk: ${file.path}`);
        return null;
      }

      // Update access stats
      await this.updateDownloadStats(fileId);
      
      // Log access
      if (userId) {
        await this.logFileAccess(fileId, userId, 'download');
      }

      // Create read stream
      const stream = require('fs').createReadStream(file.path);

      this.emit('fileDownloaded', { fileId, userId });

      return { stream, metadata: file };
    } catch (error) {
      logger.error('Failed to download file:', error);
      return null;
    }
  }

  /**
   * Validate file
   */
  private validateFile(file: {
    originalname: string;
    mimetype: string;
    size: number;
  }): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (file.size > this.config.maxFileSize) {
      errors.push(`File size exceeds maximum allowed (${this.formatFileSize(this.config.maxFileSize)})`);
    }

    // Check MIME type
    const detectedMimeType = mime.lookup(file.originalname) || file.mimetype;
    if (this.config.allowedMimeTypes.length > 0 && 
        !this.config.allowedMimeTypes.includes(detectedMimeType)) {
      errors.push(`File type not allowed: ${detectedMimeType}`);
    }

    // Check extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (this.config.allowedExtensions.length > 0 && 
        !this.config.allowedExtensions.includes(ext)) {
      errors.push(`File extension not allowed: ${ext}`);
    }

    // Sanitize filename
    const sanitizedName = this.sanitizeFilename(file.originalname);
    if (sanitizedName !== file.originalname) {
      warnings.push('Filename was sanitized for security');
    }

    // Check for potential security issues
    if (this.hasSuspiciousContent(file.originalname)) {
      warnings.push('Filename contains potentially suspicious content');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedName,
      detectedMimeType
    };
  }

  /**
   * Generate unique filename
   */
  private generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    
    return `${name}_${timestamp}_${random}${ext}`;
  }

  /**
   * Generate file ID
   */
  private generateFileId(): string {
    return `file_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate upload ID
   */
  private generateUploadId(): string {
    return `upload_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Calculate file hash
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = require('fs').createReadStream(filePath);
      
      stream.on('data', (data: Buffer) => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Find duplicate file by hash
   */
  private async findDuplicateFile(hash: string, userId: string): Promise<FileMetadata | null> {
    const query = `
      SELECT * FROM files
      WHERE hash = $1 AND uploaded_by = $2 AND status = 'ready'
      ORDER BY uploaded_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [hash, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToFileMetadata(result.rows[0]);
  }

  /**
   * Categorize file by MIME type
   */
  private categorizeFile(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'images';
    if (mimetype.startsWith('video/')) return 'videos';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.includes('pdf')) return 'documents';
    if (mimetype.includes('word') || mimetype.includes('excel') || 
        mimetype.includes('powerpoint') || mimetype.includes('text')) return 'documents';
    if (mimetype.includes('zip') || mimetype.includes('tar') || 
        mimetype.includes('rar')) return 'archives';
    
    return 'other';
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\.\./g, '__')
      .replace(/^\.+/g, '')
      .substring(0, 255);
  }

  /**
   * Check for suspicious content
   */
  private hasSuspiciousContent(filename: string): boolean {
    const suspicious = [
      '.exe', '.bat', '.cmd', '.com', '.scr', '.pif',
      '.vbs', '.js', '.jar', '.ps1', '.php'
    ];
    
    const lowerName = filename.toLowerCase();
    return suspicious.some(ext => lowerName.includes(ext));
  }

  /**
   * Perform security scan
   */
  private async performSecurityScan(
    fileId: string,
    filePath: string
  ): Promise<SecurityScanResult> {
    // Simplified security scan - in production, integrate with actual antivirus
    const scanResult: SecurityScanResult = {
      isSafe: true,
      threats: [],
      scanTime: new Date(),
      scanEngine: 'internal'
    };

    try {
      // Read first 1KB to check for suspicious patterns
      const buffer = await fs.readFile(filePath, { encoding: null });
      const content = buffer.toString('binary', 0, Math.min(1024, buffer.length));

      // Check for suspicious patterns
      const suspiciousPatterns = [
        /virus/gi,
        /malware/gi,
        /trojan/gi,
        /<script.*>/gi,
        /eval\s*\(/gi,
        /base64_decode/gi
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          scanResult.isSafe = false;
          scanResult.threats.push({
            type: 'suspicious_content',
            severity: 'medium',
            description: 'File contains suspicious patterns'
          });
          break;
        }
      }

      // Save scan result
      await this.saveScanResult(fileId, scanResult);
      
      return scanResult;
    } catch (error) {
      logger.error('Security scan failed:', error);
      
      return {
        isSafe: false,
        threats: [{
          type: 'scan_error',
          severity: 'high',
          description: 'Unable to complete security scan'
        }],
        scanTime: new Date(),
        scanEngine: 'internal'
      };
    }
  }

  /**
   * Post-process file (thumbnails, compression, etc.)
   */
  private async postProcessFile(fileId: string, metadata: FileMetadata): Promise<void> {
    try {
      // Generate thumbnails for images
      if (this.config.enableThumbnails && metadata.mimetype.startsWith('image/')) {
        await this.generateThumbnail(fileId, metadata.path);
      }

      // Compress if needed
      if (this.config.enableCompression && this.shouldCompress(metadata.mimetype)) {
        await this.compressFile(fileId, metadata.path);
      }

      // Extract metadata
      const extractedMetadata = await this.extractFileMetadata(metadata.path, metadata.mimetype);
      
      // Update metadata
      await this.updateFileMetadata(fileId, { metadata: extractedMetadata });
    } catch (error) {
      logger.error(`Post-processing failed for ${fileId}:`, error);
    }
  }

  /**
   * Generate thumbnail
   */
  private async generateThumbnail(fileId: string, filePath: string): Promise<void> {
    // Placeholder - in production, use sharp or similar library
    const thumbnailPath = path.join(
      this.config.uploadPath,
      'thumbnails',
      `${fileId}_thumb.jpg`
    );

    // For now, just copy the original file
    await fs.copyFile(filePath, thumbnailPath);
  }

  /**
   * Compress file
   */
  private async compressFile(fileId: string, filePath: string): Promise<void> {
    // Placeholder - implement compression logic
  }

  /**
   * Should compress file
   */
  private shouldCompress(mimetype: string): boolean {
    const compressibleTypes = [
      'text/', 'application/json', 'application/xml',
      'application/javascript', 'application/css'
    ];
    
    return compressibleTypes.some(type => mimetype.startsWith(type));
  }

  /**
   * Extract file metadata
   */
  private async extractFileMetadata(filePath: string, mimetype: string): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};

    try {
      const stats = await fs.stat(filePath);
      metadata.fileSize = stats.size;
      metadata.lastModified = stats.mtime;
      metadata.created = stats.birthtime;

      // Extract image metadata
      if (mimetype.startsWith('image/')) {
        // Placeholder - use exif library in production
        metadata.imageType = mimetype.split('/')[1];
      }

      // Extract document metadata
      if (mimetype.includes('pdf')) {
        // Placeholder - use pdf library in production
        metadata.documentType = 'pdf';
      }
    } catch (error) {
      logger.error('Failed to extract metadata:', error);
    }

    return metadata;
  }

  /**
   * Save file metadata to database
   */
  private async saveFileMetadata(metadata: FileMetadata): Promise<void> {
    const query = `
      INSERT INTO files (
        file_id, original_name, filename, mimetype, size, path,
        hash, uploaded_by, uploaded_at, is_public, expires_at,
        tags, description, category, version, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `;

    await this.pool.query(query, [
      metadata.fileId,
      metadata.originalName,
      metadata.filename,
      metadata.mimetype,
      metadata.size,
      metadata.path,
      metadata.hash,
      metadata.uploadedBy,
      metadata.uploadedAt,
      metadata.isPublic,
      metadata.expiresAt,
      metadata.tags,
      metadata.description,
      metadata.category,
      metadata.version,
      metadata.status,
      JSON.stringify(metadata.metadata)
    ]);
  }

  /**
   * Update file status
   */
  private async updateFileStatus(fileId: string, status: string): Promise<void> {
    await this.pool.query(
      `UPDATE files SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE file_id = $2`,
      [status, fileId]
    );
  }

  /**
   * Update file metadata
   */
  private async updateFileMetadata(fileId: string, updates: Partial<FileMetadata>): Promise<void> {
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = this.camelToSnake(key);
      sets.push(`${dbField} = $${paramIndex}`);
      values.push(key === 'metadata' ? JSON.stringify(value) : value);
      paramIndex++;
    }

    if (sets.length === 0) return;

    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(fileId);

    const query = `UPDATE files SET ${sets.join(', ')} WHERE file_id = $${paramIndex}`;
    await this.pool.query(query, values);
  }

  /**
   * Update download stats
   */
  private async updateDownloadStats(fileId: string): Promise<void> {
    await this.pool.query(
      `UPDATE files 
       SET download_count = download_count + 1, 
           last_accessed = CURRENT_TIMESTAMP 
       WHERE file_id = $1`,
      [fileId]
    );
  }

  /**
   * Log file access
   */
  private async logFileAccess(
    fileId: string,
    userId: string,
    action: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO file_access_logs (file_id, user_id, action, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [fileId, userId, action, ipAddress, userAgent]
    );
  }

  /**
   * Save security scan result
   */
  private async saveScanResult(fileId: string, result: SecurityScanResult): Promise<void> {
    const scanId = `scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    await this.pool.query(
      `INSERT INTO file_security_scans (scan_id, file_id, is_safe, threats, scan_time, scan_engine)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [scanId, fileId, result.isSafe, JSON.stringify(result.threats), result.scanTime, result.scanEngine]
    );
  }

  /**
   * Save resumeable upload
   */
  private async saveResumeableUpload(upload: ResumeableUpload): Promise<void> {
    await this.pool.query(
      `INSERT INTO resumeable_uploads (
        upload_id, file_id, filename, total_size, chunk_size,
        total_chunks, uploaded_chunks, expires_at, user_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        upload.uploadId,
        upload.fileId,
        upload.filename,
        upload.totalSize,
        upload.chunkSize,
        upload.totalChunks,
        upload.uploadedChunks,
        upload.expiresAt,
        upload.userId,
        upload.status
      ]
    );
  }

  /**
   * Get resumeable upload
   */
  private async getResumeableUpload(uploadId: string): Promise<ResumeableUpload | null> {
    const result = await this.pool.query(
      `SELECT * FROM resumeable_uploads WHERE upload_id = $1`,
      [uploadId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      uploadId: row.upload_id,
      fileId: row.file_id,
      filename: row.filename,
      totalSize: row.total_size,
      chunkSize: row.chunk_size,
      totalChunks: row.total_chunks,
      uploadedChunks: row.uploaded_chunks,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      userId: row.user_id,
      status: row.status
    };
  }

  /**
   * Update resumeable upload
   */
  private async updateResumeableUpload(upload: ResumeableUpload): Promise<void> {
    await this.pool.query(
      `UPDATE resumeable_uploads 
       SET uploaded_chunks = $1, status = $2 
       WHERE upload_id = $3`,
      [upload.uploadedChunks, upload.status, upload.uploadId]
    );
  }

  /**
   * Save chunk info
   */
  private async saveChunkInfo(chunk: ChunkInfo): Promise<void> {
    await this.pool.query(
      `INSERT INTO file_chunks (
        chunk_id, file_id, chunk_index, total_chunks,
        chunk_size, hash, path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        chunk.chunkId,
        chunk.fileId,
        chunk.chunkIndex,
        chunk.totalChunks,
        chunk.chunkSize,
        chunk.hash,
        path.join(this.config.uploadPath, 'chunks', chunk.chunkId)
      ]
    );
  }

  /**
   * Assemble chunks into final file
   */
  private async assembleChunks(upload: ResumeableUpload): Promise<void> {
    const finalPath = path.join(
      this.config.uploadPath,
      this.categorizeFile('application/octet-stream'),
      upload.filename
    );

    const writeStream = require('fs').createWriteStream(finalPath);

    try {
      // Sort chunks by index
      const sortedChunks = upload.uploadedChunks.sort((a, b) => a - b);

      for (const chunkIndex of sortedChunks) {
        const chunkPath = path.join(
          this.config.uploadPath,
          'chunks',
          `${upload.uploadId}_${chunkIndex}`
        );

        const chunkData = await fs.readFile(chunkPath);
        writeStream.write(chunkData);
      }

      writeStream.end();

      // Wait for stream to finish
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Clean up chunks
      await this.cleanupChunks(upload.uploadId);

      // Create file metadata
      const stats = await fs.stat(finalPath);
      const hash = await this.calculateFileHash(finalPath);

      const metadata: FileMetadata = {
        fileId: upload.fileId,
        originalName: upload.filename,
        filename: path.basename(finalPath),
        mimetype: mime.lookup(upload.filename) || 'application/octet-stream',
        size: stats.size,
        path: finalPath,
        hash,
        uploadedBy: upload.userId,
        uploadedAt: new Date(),
        downloadCount: 0,
        isPublic: false,
        tags: [],
        version: 1,
        status: 'ready',
        metadata: {}
      };

      await this.saveFileMetadata(metadata);
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

  /**
   * Cleanup chunks
   */
  private async cleanupChunks(uploadId: string): Promise<void> {
    try {
      const pattern = path.join(this.config.uploadPath, 'chunks', `${uploadId}_*`);
      const glob = require('glob');
      const files = glob.sync(pattern);

      for (const file of files) {
        await fs.unlink(file);
      }

      // Remove from database
      await this.pool.query(
        `DELETE FROM file_chunks WHERE chunk_id LIKE $1`,
        [`${uploadId}_%`]
      );
    } catch (error) {
      logger.error('Failed to cleanup chunks:', error);
    }
  }

  /**
   * Map database row to FileMetadata
   */
  private mapRowToFileMetadata(row: any): FileMetadata {
    return {
      fileId: row.file_id,
      originalName: row.original_name,
      filename: row.filename,
      mimetype: row.mimetype,
      size: parseInt(row.size),
      path: row.path,
      hash: row.hash,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
      lastAccessed: row.last_accessed,
      downloadCount: row.download_count,
      isPublic: row.is_public,
      expiresAt: row.expires_at,
      tags: row.tags || [],
      description: row.description,
      category: row.category,
      version: row.version,
      parentId: row.parent_id,
      status: row.status,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Start cleanup job
   */
  private startCleanupJob(): void {
    // Run cleanup every 6 hours
    setInterval(async () => {
      try {
        await this.cleanupExpiredFiles();
        await this.cleanupExpiredUploads();
        await this.cleanupOldLogs();
      } catch (error) {
        logger.error('Cleanup job failed:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours
  }

  /**
   * Cleanup expired files
   */
  private async cleanupExpiredFiles(): Promise<void> {
    const expiredFiles = await this.pool.query(
      `SELECT file_id, path FROM files 
       WHERE (expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP)
       OR (status = 'deleted' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days')`
    );

    for (const row of expiredFiles.rows) {
      try {
        // Delete physical file
        await fs.unlink(row.path);
        
        // Remove from database
        await this.pool.query(`DELETE FROM files WHERE file_id = $1`, [row.file_id]);
        
        logger.info(`Cleaned up expired file: ${row.file_id}`);
      } catch (error) {
        logger.error(`Failed to cleanup file ${row.file_id}:`, error);
      }
    }
  }

  /**
   * Cleanup expired uploads
   */
  private async cleanupExpiredUploads(): Promise<void> {
    const expiredUploads = await this.pool.query(
      `SELECT upload_id FROM resumeable_uploads 
       WHERE expires_at < CURRENT_TIMESTAMP OR status = 'cancelled'`
    );

    for (const row of expiredUploads.rows) {
      await this.cleanupChunks(row.upload_id);
      await this.pool.query(
        `DELETE FROM resumeable_uploads WHERE upload_id = $1`,
        [row.upload_id]
      );
    }
  }

  /**
   * Cleanup old logs
   */
  private async cleanupOldLogs(): Promise<void> {
    const retentionDays = this.config.retentionDays || 90;
    
    await this.pool.query(
      `DELETE FROM file_access_logs 
       WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '${retentionDays} days'`
    );
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    uploadCount24h: number;
    downloadCount24h: number;
    storageByCategory: Record<string, number>;
  }> {
    const [totalStats, dailyStats, categoryStats] = await Promise.all([
      this.pool.query(
        `SELECT COUNT(*) as count, SUM(size) as total_size 
         FROM files WHERE status = 'ready'`
      ),
      this.pool.query(
        `SELECT 
           COUNT(*) FILTER (WHERE uploaded_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours') as uploads,
           COUNT(*) FILTER (WHERE last_accessed >= CURRENT_TIMESTAMP - INTERVAL '24 hours') as downloads
         FROM files`
      ),
      this.pool.query(
        `SELECT category, SUM(size) as total_size 
         FROM files WHERE status = 'ready' 
         GROUP BY category`
      )
    ]);

    const storageByCategory: Record<string, number> = {};
    for (const row of categoryStats.rows) {
      storageByCategory[row.category] = parseInt(row.total_size);
    }

    return {
      totalFiles: parseInt(totalStats.rows[0].count),
      totalSize: parseInt(totalStats.rows[0].total_size || '0'),
      uploadCount24h: parseInt(dailyStats.rows[0].uploads),
      downloadCount24h: parseInt(dailyStats.rows[0].downloads),
      storageByCategory
    };
  }
}

// Export singleton instance
const fileUploadService = new FileUploadService();
export default fileUploadService;