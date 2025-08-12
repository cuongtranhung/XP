import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { r2Client, r2Config } from '../config/r2.config';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs-extra';
import sharp from 'sharp';

export interface UploadOptions {
  folder?: string;
  generateThumbnail?: boolean;
  thumbnailSize?: { width: number; height: number };
  metadata?: Record<string, string>;
  contentType?: string;
  isPublic?: boolean;
}

export interface UploadResult {
  key: string;
  bucket: string;
  url: string;
  publicUrl?: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  size: number;
  contentType: string;
  metadata?: Record<string, string>;
}

export class R2StorageService {
  private client: S3Client | null;
  private bucketName: string;
  private isEnabled: boolean;

  constructor() {
    this.client = r2Client;
    this.bucketName = r2Config.bucketName;
    this.isEnabled = r2Config.isConfigured();
    
    if (!this.isEnabled) {
      console.warn('R2 Storage Service is not configured. File uploads will use local storage.');
    }
  }

  /**
   * Check if R2 is configured and available
   */
  isAvailable(): boolean {
    return this.isEnabled && this.client !== null;
  }

  /**
   * Upload file to R2
   */
  async uploadFile(
    file: Express.Multer.File | Buffer,
    filename: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!this.isAvailable()) {
      throw new Error('R2 Storage Service is not configured');
    }

    try {
      // Generate unique key
      const folder = options.folder || 'uploads';
      const timestamp = new Date().toISOString().split('T')[0];
      const uniqueId = uuidv4();
      const ext = path.extname(filename);
      const key = `${folder}/${timestamp}/${uniqueId}${ext}`;

      // Prepare file buffer
      let buffer: Buffer;
      let contentType: string;
      let fileSize: number;

      if (Buffer.isBuffer(file)) {
        buffer = file;
        contentType = options.contentType || 'application/octet-stream';
        fileSize = buffer.length;
      } else {
        buffer = file.buffer;
        contentType = file.mimetype;
        fileSize = file.size;
      }

      // Upload main file
      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          originalName: filename,
          uploadedAt: new Date().toISOString(),
          ...options.metadata,
        },
      };

      // Use multipart upload for large files (>5MB)
      if (fileSize > 5 * 1024 * 1024) {
        const multipartUpload = new Upload({
          client: this.client!,
          params: uploadParams,
          queueSize: 4, // Concurrent parts
          partSize: 5 * 1024 * 1024, // 5MB per part
        });

        await multipartUpload.done();
      } else {
        await this.client!.send(new PutObjectCommand(uploadParams));
      }

      // Generate thumbnail if requested and it's an image
      let thumbnailKey: string | undefined;
      let thumbnailUrl: string | undefined;

      if (options.generateThumbnail && contentType.startsWith('image/')) {
        thumbnailKey = await this.generateThumbnail(
          buffer,
          key,
          options.thumbnailSize
        );
        if (thumbnailKey) {
          thumbnailUrl = await this.getSignedUrl(thumbnailKey);
        }
      }

      // Get URLs
      const url = await this.getSignedUrl(key);
      const publicUrl = this.getPublicUrl(key);

      // Backup to local if enabled
      if (r2Config.enableLocalBackup) {
        await this.backupToLocal(buffer, key);
      }

      return {
        key,
        bucket: this.bucketName,
        url,
        publicUrl,
        thumbnailKey,
        thumbnailUrl,
        size: fileSize,
        contentType,
        metadata: options.metadata,
      };
    } catch (error: any) {
      console.error('R2 upload error:', error);
      throw new Error(`Failed to upload file to R2: ${error.message}`);
    }
  }

  /**
   * Generate thumbnail for image
   */
  private async generateThumbnail(
    buffer: Buffer,
    originalKey: string,
    size = { width: 200, height: 200 }
  ): Promise<string | undefined> {
    if (!this.isAvailable()) return undefined;

    try {
      const thumbnailBuffer = await sharp(buffer)
        .resize(size.width, size.height, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailKey = originalKey.replace(
        /(\.[^.]+)$/,
        `_thumb$1`
      );

      await this.client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: thumbnailKey,
          Body: thumbnailBuffer,
          ContentType: 'image/jpeg',
        })
      );

      return thumbnailKey;
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      return undefined;
    }
  }

  /**
   * Get signed URL for private access
   */
  async getSignedUrl(
    key: string,
    expiresIn = 3600 // 1 hour default
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('R2 Storage Service is not configured');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.client!, command, { expiresIn });
  }

  /**
   * Get public URL if bucket is public
   */
  getPublicUrl(key: string): string | undefined {
    if (r2Config.publicUrl) {
      return `${r2Config.publicUrl}/${key}`;
    }
    return undefined;
  }

  /**
   * Delete file from R2
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('R2 Storage Service is not configured');
    }

    try {
      await this.client!.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      // Delete from local backup if exists
      if (r2Config.enableLocalBackup) {
        const localPath = path.join(r2Config.localStoragePath, key);
        await fs.remove(localPath);
      }
    } catch (error: any) {
      console.error('R2 delete error:', error);
      throw new Error(`Failed to delete file from R2: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      await this.client!.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(
    prefix: string,
    maxKeys = 100
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    if (!this.isAvailable()) return [];

    try {
      const response = await this.client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          MaxKeys: maxKeys,
        })
      );

      return (response.Contents || []).map((item) => ({
        key: item.Key!,
        size: item.Size!,
        lastModified: item.LastModified!,
      }));
    } catch (error) {
      console.error('R2 list error:', error);
      return [];
    }
  }

  /**
   * Backup file to local storage
   */
  private async backupToLocal(
    buffer: Buffer,
    key: string
  ): Promise<void> {
    try {
      const localPath = path.join(r2Config.localStoragePath, key);
      await fs.ensureDir(path.dirname(localPath));
      await fs.writeFile(localPath, buffer);
    } catch (error) {
      console.error('Local backup error:', error);
      // Don't throw - backup is optional
    }
  }

  /**
   * Generate upload presigned URL for direct browser upload
   */
  async getUploadPresignedUrl(
    filename: string,
    contentType: string,
    folder = 'uploads'
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!this.isAvailable()) {
      throw new Error('R2 Storage Service is not configured');
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const uniqueId = uuidv4();
    const ext = path.extname(filename);
    const key = `${folder}/${timestamp}/${uniqueId}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client!, command, {
      expiresIn: 3600, // 1 hour
    });

    return { uploadUrl, key };
  }

  /**
   * Upload file from local path (for migration)
   */
  async uploadFromPath(
    filePath: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const buffer = await fs.readFile(filePath);
    const filename = path.basename(filePath);
    return this.uploadFile(buffer, filename, options);
  }

  /**
   * Download file to local path
   */
  async downloadToPath(key: string, localPath: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('R2 Storage Service is not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client!.send(command);
      const stream = response.Body as NodeJS.ReadableStream;
      
      await fs.ensureDir(path.dirname(localPath));
      const writeStream = fs.createWriteStream(localPath);
      
      stream.pipe(writeStream);
      
      return new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } catch (error: any) {
      console.error('R2 download error:', error);
      throw new Error(`Failed to download file from R2: ${error.message}`);
    }
  }
}

// Export singleton instance
export default new R2StorageService();