import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Readable } from 'stream';
import { fileValidationService, ValidationResult } from './FileValidationService';

interface MegaS4Config {
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  region: string;
  endpoint: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  multipartThreshold: number;
  chunkSize: number;
  presignedUrlExpiry: number;
}

interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  etag?: string;
  size?: number;
  error?: string;
  validation?: ValidationResult;
}

interface MultipartUploadPart {
  ETag: string;
  PartNumber: number;
}

interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  checksum?: string;
  isPublic?: boolean;
}

export class MegaS4Service {
  private s3Client: S3Client;
  private config: MegaS4Config;

  constructor() {
    console.log('MegaS4Service: Loading with endpoint:', process.env.MEGA_S4_ENDPOINT);
    this.config = {
      accessKeyId: process.env.MEGA_S4_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.MEGA_S4_SECRET_ACCESS_KEY || '',
      bucketName: process.env.MEGA_S4_BUCKET_NAME || '',
      region: process.env.MEGA_S4_REGION || 'eu-central-1',
      endpoint: process.env.MEGA_S4_ENDPOINT || 'https://s3.eu-central-1.s4.mega.io',
      maxFileSize: parseInt(process.env.MEGA_S4_MAX_FILE_SIZE || '104857600'),
      allowedMimeTypes: (process.env.MEGA_S4_ALLOWED_FILE_TYPES || '').split(','),
      multipartThreshold: parseInt(process.env.MEGA_S4_MULTIPART_THRESHOLD || '5242880'),
      chunkSize: parseInt(process.env.MEGA_S4_CHUNK_SIZE || '5242880'),
      presignedUrlExpiry: parseInt(process.env.MEGA_S4_PRESIGNED_URL_EXPIRY || '3600'),
    };

    this.s3Client = new S3Client({
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      region: this.config.region,
      endpoint: this.config.endpoint,
      forcePathStyle: true, // Required for S3-compatible services
    });
  }

  /**
   * Generate a unique key for the file
   */
  private generateFileKey(originalName: string, prefix: string = 'uploads'): string {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    const safeName = path.basename(originalName, extension)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return `${prefix}/${year}/${month}/${timestamp}_${randomId}_${safeName}${extension}`;
  }


  /**
   * Upload a single file to MEGA S4
   */
  async uploadFile(
    file: Express.Multer.File,
    metadata?: Partial<FileMetadata>
  ): Promise<UploadResult> {
    try {
      console.log(`🔍 Starting basic validation for file: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      
      // Basic file validation
      const validationResult = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[],
        fileInfo: {
          size: file.size,
          detectedMimeType: file.mimetype,
          checksum: 'basic-validation'
        }
      };

      // Basic size check
      if (file.size === 0) {
        validationResult.valid = false;
        validationResult.errors.push('File is empty');
      }

      if (file.size > this.config.maxFileSize) {
        validationResult.valid = false;
        validationResult.errors.push(`File size ${(file.size / 1048576).toFixed(2)}MB exceeds maximum allowed size of ${(this.config.maxFileSize / 1048576).toFixed(2)}MB`);
      }

      // Basic MIME type check
      if (this.config.allowedMimeTypes.length > 0 && 
          this.config.allowedMimeTypes[0] !== '' && 
          !this.config.allowedMimeTypes.includes(file.mimetype)) {
        validationResult.valid = false;
        validationResult.errors.push(`File type ${file.mimetype} is not allowed. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`);
      }

      console.log(`📊 Basic validation result: ${validationResult.valid ? 'PASSED' : 'FAILED'} (${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings)`);

      if (!validationResult.valid) {
        return { 
          success: false, 
          error: `File validation failed: ${validationResult.errors.join(', ')}`,
          validation: validationResult
        };
      }

      // Check if file exceeds multipart threshold
      if (file.size > this.config.multipartThreshold) {
        console.log(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds multipart threshold ${(this.config.multipartThreshold / 1024 / 1024).toFixed(2)}MB, using multipart upload`);
        
        // Write buffer to temp file for multipart upload
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `${Date.now()}_${file.originalname}`);
        
        try {
          await fs.promises.writeFile(tempFilePath, file.buffer);
          const result = await this.uploadLargeFile(tempFilePath, file.originalname, file.mimetype, metadata);
          
          // Add validation result to multipart upload result
          if (result.success) {
            result.validation = validationResult;
          }
          
          // Clean up temp file
          try {
            await fs.promises.unlink(tempFilePath);
          } catch (cleanupError) {
            console.warn('Failed to cleanup temp file:', cleanupError);
          }
          
          return result;
        } catch (tempError) {
          console.error('Error with temp file handling:', tempError);
          // Fall back to regular upload
        }
      }

      console.log(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB is below multipart threshold, using regular upload`);

      // Generate unique key
      const key = this.generateFileKey(file.originalname);

      // Calculate checksum
      const checksum = crypto
        .createHash('md5')
        .update(file.buffer)
        .digest('base64');

      // Prepare metadata
      const fullMetadata: Record<string, string> = {
        'original-name': file.originalname,
        'mime-type': file.mimetype,
        'size': file.size.toString(),
        'checksum': checksum,
        'uploaded-at': new Date().toISOString(),
        ...Object.entries(metadata || {}).reduce((acc, [k, v]) => {
          acc[k.replace(/([A-Z])/g, '-$1').toLowerCase()] = String(v);
          return acc;
        }, {} as Record<string, string>),
      };

      // Upload to MEGA S4
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: fullMetadata,
      });

      const response = await this.s3Client.send(command);

      return {
        success: true,
        key,
        url: await this.getFileUrl(key),
        etag: response.ETag,
        size: file.size,
        validation: validationResult,
      };
    } catch (error) {
      console.error('Error uploading file to MEGA S4:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Upload file using multipart upload for large files
   */
  async uploadLargeFile(
    filePath: string,
    originalName: string,
    mimeType: string,
    metadata?: Partial<FileMetadata>
  ): Promise<UploadResult> {
    try {
      const stats = await fs.promises.stat(filePath);
      
      // Validate file
      const validation = this.validateFile(Buffer.alloc(0), mimeType, stats.size);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const key = this.generateFileKey(originalName);

      // Initialize multipart upload
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: this.config.bucketName,
        Key: key,
        ContentType: mimeType,
        Metadata: {
          'original-name': originalName,
          'mime-type': mimeType,
          'size': stats.size.toString(),
          'uploaded-at': new Date().toISOString(),
        },
      });

      const { UploadId } = await this.s3Client.send(createCommand);
      if (!UploadId) {
        throw new Error('Failed to initialize multipart upload');
      }

      // Upload parts
      const parts: MultipartUploadPart[] = [];
      const fileStream = fs.createReadStream(filePath, {
        highWaterMark: this.config.chunkSize,
      });

      let partNumber = 1;
      const uploadPromises: Promise<void>[] = [];

      for await (const chunk of fileStream) {
        const currentPartNumber = partNumber++;
        const uploadPromise = (async () => {
          const uploadPartCommand = new UploadPartCommand({
            Bucket: this.config.bucketName,
            Key: key,
            UploadId,
            PartNumber: currentPartNumber,
            Body: chunk as Buffer,
          });

          const { ETag } = await this.s3Client.send(uploadPartCommand);
          if (ETag) {
            parts[currentPartNumber - 1] = {
              ETag,
              PartNumber: currentPartNumber,
            };
          }
        })();

        uploadPromises.push(uploadPromise);

        // Limit concurrent uploads to 5
        if (uploadPromises.length >= 5) {
          await Promise.race(uploadPromises);
        }
      }

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      // Complete multipart upload
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: this.config.bucketName,
        Key: key,
        UploadId,
        MultipartUpload: {
          Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        },
      });

      const completeResponse = await this.s3Client.send(completeCommand);

      return {
        success: true,
        key,
        url: await this.getFileUrl(key),
        etag: completeResponse.ETag,
        size: stats.size,
      };
    } catch (error) {
      console.error('Error in multipart upload:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generate a presigned URL for direct browser upload
   */
  async generatePresignedUploadUrl(
    originalName: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<{ url: string; key: string; fields?: Record<string, string> }> {
    const key = this.generateFileKey(originalName);

    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      ContentType: mimeType,
      Metadata: {
        'original-name': originalName,
        'mime-type': mimeType,
        'uploaded-at': new Date().toISOString(),
        ...metadata,
      },
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.config.presignedUrlExpiry,
    });

    return { url, key };
  }

  /**
   * Generate a presigned URL for file download
   */
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Download a file from MEGA S4
   */
  async downloadFile(key: string): Promise<{ stream: Readable; metadata: Record<string, string> }> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error('File not found');
    }

    return {
      stream: response.Body as Readable,
      metadata: response.Metadata || {},
    };
  }

  /**
   * Delete a file from MEGA S4
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting file from MEGA S4:', error);
      return false;
    }
  }

  /**
   * List files in a specific path
   */
  async listFiles(
    prefix: string = '',
    maxKeys: number = 100
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.s3Client.send(command);

      return (response.Contents || []).map((item) => ({
        key: item.Key || '',
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
      }));
    } catch (error) {
      console.error('Error listing files from MEGA S4:', error);
      return [];
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<Record<string, string> | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      return response.Metadata || null;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return null;
    }
  }

  /**
   * Copy a file within MEGA S4
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<boolean> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.config.bucketName,
        CopySource: `${this.config.bucketName}/${sourceKey}`,
        Key: destinationKey,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Error copying file in MEGA S4:', error);
      return false;
    }
  }

  /**
   * Move a file (copy and delete)
   */
  async moveFile(sourceKey: string, destinationKey: string): Promise<boolean> {
    const copied = await this.copyFile(sourceKey, destinationKey);
    if (copied) {
      return await this.deleteFile(sourceKey);
    }
    return false;
  }

  /**
   * Get public URL for a file (if bucket is configured for public access)
   */
  async getFileUrl(key: string): Promise<string> {
    // For private buckets, generate a presigned URL
    // For public buckets, return the direct URL
    return await this.generatePresignedDownloadUrl(key, 86400); // 24 hours
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate storage usage for a specific prefix
   */
  async calculateStorageUsage(prefix: string = ''): Promise<{ totalSize: number; fileCount: number }> {
    let totalSize = 0;
    let fileCount = 0;
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await this.s3Client.send(command);
      
      if (response.Contents) {
        fileCount += response.Contents.length;
        totalSize += response.Contents.reduce((sum, item) => sum + (item.Size || 0), 0);
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return { totalSize, fileCount };
  }
}

// Export singleton instance
export const megaS4Service = new MegaS4Service();