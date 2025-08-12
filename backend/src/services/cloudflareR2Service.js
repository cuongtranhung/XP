const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

class CloudflareR2Service {
  constructor() {
    // Initialize S3 client with R2 configuration
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
    
    this.bucketName = process.env.R2_BUCKET_NAME || 'XProject';
    this.publicUrl = process.env.R2_PUBLIC_URL || '';
  }

  /**
   * Generate unique file key
   */
  generateFileKey(originalName, folder = 'uploads') {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '-');
    return `${folder}/${timestamp}-${randomString}-${sanitizedName}${ext}`;
  }

  /**
   * Upload file to R2
   */
  async uploadFile(fileBuffer, originalName, options = {}) {
    const {
      folder = 'uploads',
      contentType = 'application/octet-stream',
      metadata = {}
    } = options;

    try {
      const key = this.generateFileKey(originalName, folder);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: {
          originalName,
          uploadDate: new Date().toISOString(),
          ...metadata
        }
      });

      await this.client.send(command);

      return {
        success: true,
        key,
        url: `${this.publicUrl}/${key}`,
        size: fileBuffer.length,
        contentType,
        originalName
      };
    } catch (error) {
      console.error('R2 upload error:', error);
      
      // Check if it's a credential error
      if (error.Code === 'InvalidArgument' && error.message.includes('Credential')) {
        throw new Error('Invalid R2 credentials. Please check your access key configuration.');
      }
      
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload multiple files in parallel with concurrency limit
   */
  async uploadMultiple(files, options = {}) {
    const {
      folder = 'uploads',
      concurrency = 3,
      onProgress
    } = options;

    const results = [];
    const total = files.length;
    let completed = 0;

    // Process files in batches
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (file) => {
        try {
          const result = await this.uploadFile(
            file.buffer,
            file.originalname,
            {
              folder,
              contentType: file.mimetype,
              metadata: file.metadata || {}
            }
          );
          
          completed++;
          
          if (onProgress) {
            onProgress({
              file: file.originalname,
              completed,
              total,
              progress: (completed / total) * 100,
              result
            });
          }
          
          return result;
        } catch (error) {
          completed++;
          
          if (onProgress) {
            onProgress({
              file: file.originalname,
              completed,
              total,
              progress: (completed / total) * 100,
              error: error.message
            });
          }
          
          return {
            success: false,
            originalName: file.originalname,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Generate presigned URL for direct upload from client
   */
  async generatePresignedUploadUrl(fileName, options = {}) {
    const {
      folder = 'uploads',
      contentType = 'application/octet-stream',
      expiresIn = 3600 // 1 hour
    } = options;

    try {
      const key = this.generateFileKey(fileName, folder);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

      return {
        url,
        key,
        publicUrl: `${this.publicUrl}/${key}`,
        expiresIn
      };
    } catch (error) {
      console.error('Presigned URL generation error:', error);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for file download
   */
  async generatePresignedDownloadUrl(key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('Presigned download URL error:', error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * Delete file from R2
   */
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.client.send(command);

      return {
        success: true,
        message: `File ${key} deleted successfully`
      };
    } catch (error) {
      console.error('R2 delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * List files in bucket
   */
  async listFiles(options = {}) {
    const {
      prefix = '',
      maxKeys = 100,
      continuationToken
    } = options;

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken
      });

      const response = await this.client.send(command);

      return {
        files: (response.Contents || []).map(file => ({
          key: file.Key,
          size: file.Size,
          lastModified: file.LastModified,
          url: `${this.publicUrl}/${file.Key}`
        })),
        isTruncated: response.IsTruncated,
        nextContinuationToken: response.NextContinuationToken
      };
    } catch (error) {
      console.error('R2 list error:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.client.send(command);
      
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata,
        url: `${this.publicUrl}/${key}`
      };
    } catch (error) {
      console.error('R2 metadata error:', error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file, options = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedMimeTypes = [],
      allowedExtensions = []
    } = options;

    const errors = [];

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size (${file.size} bytes) exceeds maximum allowed size of ${maxSize} bytes`);
    }

    // Check MIME type
    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    // Check file extension
    if (allowedExtensions.length > 0) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        errors.push(`File extension ${ext} is not allowed`);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }

    return true;
  }

  /**
   * Get content type from file extension
   */
  getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes = {
      // Images
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      
      // Documents
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      
      // Archives
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      
      // Media
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      
      // Code
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}

module.exports = CloudflareR2Service;