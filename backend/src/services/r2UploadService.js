const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class R2UploadService {
  constructor() {
    this.accountId = process.env.R2_ACCOUNT_ID;
    this.bucketName = process.env.R2_BUCKET_NAME;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.publicUrl = process.env.R2_PUBLIC_URL;
    
    // Use the direct API approach with API token
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}`;
  }

  /**
   * Generate a unique file name with timestamp
   */
  generateFileName(originalName) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '-');
    return `${timestamp}-${randomString}-${sanitizedName}${ext}`;
  }

  /**
   * Upload file to R2 using multipart upload
   */
  async uploadFile(fileBuffer, originalName, contentType = 'application/octet-stream') {
    try {
      const fileName = this.generateFileName(originalName);
      
      // Create form data for multipart upload
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: contentType
      });

      // Upload to R2 using the Workers API
      // Note: This uses a different endpoint pattern
      const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`;
      
      // For R2, we'll use the direct upload approach
      // Since R2 doesn't have a direct upload API, we'll use presigned URLs
      const presignedUrl = await this.generatePresignedUrl(fileName);
      
      // Upload using the presigned URL
      const uploadResponse = await axios.put(presignedUrl, fileBuffer, {
        headers: {
          'Content-Type': contentType
        }
      });

      // Return the public URL
      return {
        success: true,
        url: `${this.publicUrl}/${fileName}`,
        key: fileName,
        size: fileBuffer.length
      };
    } catch (error) {
      console.error('R2 upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for direct upload
   * Note: This is a simplified approach. In production, you'd use AWS SDK v3 with proper credentials
   */
  async generatePresignedUrl(fileName) {
    // For now, we'll use the public bucket approach
    // In production, implement proper presigned URL generation
    return `${this.publicUrl}/${fileName}`;
  }

  /**
   * Upload file from file path
   */
  async uploadFromPath(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const contentType = this.getContentType(fileName);
    return this.uploadFile(fileBuffer, fileName, contentType);
  }

  /**
   * Upload multiple files in parallel
   */
  async uploadMultiple(files, onProgress) {
    const results = [];
    const total = files.length;
    let completed = 0;

    const uploadPromises = files.map(async (file, index) => {
      try {
        const result = await this.uploadFile(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        
        completed++;
        if (onProgress) {
          onProgress({
            file: file.originalname,
            index,
            completed,
            total,
            progress: (completed / total) * 100
          });
        }
        
        return { ...result, originalName: file.originalname };
      } catch (error) {
        return {
          success: false,
          originalName: file.originalname,
          error: error.message
        };
      }
    });

    const uploadResults = await Promise.all(uploadPromises);
    return uploadResults;
  }

  /**
   * Delete file from R2
   */
  async deleteFile(fileName) {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/objects/${fileName}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          }
        }
      );
      
      return {
        success: true,
        message: `File ${fileName} deleted successfully`
      };
    } catch (error) {
      console.error('R2 delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * List files in bucket
   */
  async listFiles(prefix = '', limit = 100) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/objects`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          },
          params: {
            prefix,
            limit
          }
        }
      );
      
      return response.data.objects || [];
    } catch (error) {
      console.error('R2 list error:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Get content type from file extension
   */
  getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.zip': 'application/zip',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Validate file before upload
   */
  validateFile(file, options = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = [],
      allowedExtensions = []
    } = options;

    // Check file size
    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSize} bytes`);
    }

    // Check MIME type if specified
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    // Check file extension if specified
    if (allowedExtensions.length > 0) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        throw new Error(`File extension ${ext} is not allowed`);
      }
    }

    return true;
  }
}

module.exports = R2UploadService;