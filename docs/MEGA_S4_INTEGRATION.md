# 🚀 MEGA S4 Object Storage Integration Guide

## Overview
Tích hợp MEGA S4 Object Storage - dịch vụ lưu trữ S3-compatible với giá cực kỳ cạnh tranh (€2.50/TB) và không tính phí egress.

## 📊 MEGA S4 Features
- **S3-Compatible**: Tương thích hoàn toàn với AWS S3 API
- **Giá rẻ**: €2.50/TB/tháng (khoảng $2.63)
- **Free Egress**: 5X bandwidth miễn phí
- **No API Fees**: Không tính phí API calls
- **Global Access**: Truy cập từ bất kỳ region nào
- **Endpoints**: `s3.<region>.s4.mega.io`

---

## 🔧 Installation

### 1. Cài đặt Dependencies

```bash
# Cho MEGA S4 (S3-compatible)
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Cho MEGA Personal (optional)
npm install megajs

# Utilities
npm install crypto multer dotenv
```

### 2. Environment Variables

```env
# MEGA S4 Configuration
MEGA_S4_ACCESS_KEY=your_access_key_id
MEGA_S4_SECRET_KEY=your_secret_access_key
MEGA_S4_BUCKET_NAME=your_bucket_name
MEGA_S4_REGION=eu-central-1
MEGA_S4_ENDPOINT=https://s3.eu-central-1.s4.mega.io

# Optional: MEGA Personal Account
MEGA_EMAIL=your@email.com
MEGA_PASSWORD=your_password
```

---

## 💻 Backend Implementation

### 1. MEGA S4 Service Class

```typescript
// backend/src/services/MegaS4Service.ts
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

export class MegaS4Service {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    // Khởi tạo MEGA S4 client
    this.client = new S3Client({
      region: process.env.MEGA_S4_REGION || 'eu-central-1',
      endpoint: process.env.MEGA_S4_ENDPOINT || 'https://s3.eu-central-1.s4.mega.io',
      credentials: {
        accessKeyId: process.env.MEGA_S4_ACCESS_KEY!,
        secretAccessKey: process.env.MEGA_S4_SECRET_KEY!,
      },
      forcePathStyle: false, // MEGA S4 supports virtual-hosted style
    });

    this.bucketName = process.env.MEGA_S4_BUCKET_NAME!;
  }

  // Upload file đơn giản
  async uploadFile(
    file: Buffer | Stream, 
    fileName: string, 
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    try {
      const key = this.generateKey(fileName);
      
      // Tạo MD5 hash (MEGA S4 khuyến nghị)
      const md5Hash = crypto.createHash('md5').update(file).digest('base64');

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: mimeType,
        ContentMD5: md5Hash,
        Metadata: {
          ...metadata,
          originalName: fileName,
          uploadedAt: new Date().toISOString()
        }
      });

      await this.client.send(command);

      return {
        success: true,
        key,
        url: this.getPublicUrl(key),
        size: file.length,
        etag: md5Hash
      };
    } catch (error) {
      console.error('MEGA S4 upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  // Upload file lớn với multipart
  async uploadLargeFile(
    file: Buffer,
    fileName: string,
    mimeType: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    const key = this.generateKey(fileName);
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks
    const chunks = this.createChunks(file, chunkSize);

    try {
      // Bắt đầu multipart upload
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: mimeType
      });
      
      const { UploadId } = await this.client.send(createCommand);
      
      // Upload từng chunk
      const uploadPromises = chunks.map(async (chunk, index) => {
        const partNumber = index + 1;
        const uploadPartCommand = new UploadPartCommand({
          Bucket: this.bucketName,
          Key: key,
          PartNumber: partNumber,
          UploadId,
          Body: chunk
        });
        
        const result = await this.client.send(uploadPartCommand);
        
        // Cập nhật progress
        if (onProgress) {
          const progress = ((index + 1) / chunks.length) * 100;
          onProgress(progress);
        }
        
        return {
          ETag: result.ETag,
          PartNumber: partNumber
        };
      });

      const parts = await Promise.all(uploadPromises);

      // Hoàn thành multipart upload
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId,
        MultipartUpload: { Parts: parts }
      });

      await this.client.send(completeCommand);

      return {
        success: true,
        key,
        url: this.getPublicUrl(key),
        size: file.length
      };

    } catch (error) {
      // Hủy upload nếu lỗi
      if (UploadId) {
        await this.abortMultipartUpload(key, UploadId);
      }
      throw error;
    }
  }

  // Tạo presigned URL cho upload trực tiếp từ browser
  async generatePresignedUploadUrl(
    fileName: string,
    mimeType: string,
    expiresIn: number = 300 // 5 phút
  ): Promise<PresignedUrlResult> {
    const key = this.generateKey(fileName);
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: mimeType
    });

    const signedUrl = await getSignedUrl(this.client, command, { 
      expiresIn 
    });

    return {
      signedUrl,
      key,
      publicUrl: this.getPublicUrl(key),
      expiresAt: new Date(Date.now() + expiresIn * 1000)
    };
  }

  // Tạo presigned URL cho download
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600 // 1 giờ
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    return await getSignedUrl(this.client, command, { 
      expiresIn 
    });
  }

  // Download file
  async downloadFile(key: string): Promise<DownloadResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.client.send(command);
      
      return {
        stream: response.Body,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        metadata: response.Metadata
      };
    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  // Xóa file
  async deleteFile(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }

  // Liệt kê files
  async listFiles(
    prefix?: string,
    maxKeys: number = 100
  ): Promise<FileListResult> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys
      });

      const response = await this.client.send(command);
      
      return {
        files: response.Contents?.map(item => ({
          key: item.Key!,
          size: item.Size!,
          lastModified: item.LastModified!,
          etag: item.ETag
        })) || [],
        isTruncated: response.IsTruncated || false,
        nextToken: response.NextContinuationToken
      };
    } catch (error) {
      throw new Error(`List files failed: ${error.message}`);
    }
  }

  // Helper methods
  private generateKey(fileName: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    return `${year}/${month}/${day}/${timestamp}_${sanitizedName}`;
  }

  private getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.eu-central-1.s4.mega.io/${key}`;
  }

  private createChunks(buffer: Buffer, chunkSize: number): Buffer[] {
    const chunks: Buffer[] = [];
    let offset = 0;
    
    while (offset < buffer.length) {
      const end = Math.min(offset + chunkSize, buffer.length);
      chunks.push(buffer.slice(offset, end));
      offset = end;
    }
    
    return chunks;
  }

  private async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId
      });
      
      await this.client.send(command);
    } catch (error) {
      console.error('Failed to abort multipart upload:', error);
    }
  }
}

// Type definitions
interface UploadResult {
  success: boolean;
  key: string;
  url: string;
  size: number;
  etag?: string;
}

interface PresignedUrlResult {
  signedUrl: string;
  key: string;
  publicUrl: string;
  expiresAt: Date;
}

interface DownloadResult {
  stream: any;
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
}

interface FileListResult {
  files: FileInfo[];
  isTruncated: boolean;
  nextToken?: string;
}

interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
}
```

### 2. Express API Routes

```typescript
// backend/src/routes/megaS4Routes.ts
import express from 'express';
import multer from 'multer';
import { MegaS4Service } from '../services/MegaS4Service';
import { authenticate } from '../middleware/auth';

const router = express.Router();
const megaS4 = new MegaS4Service();

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    // Validate file types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/zip',
      'video/mp4', 'video/mpeg',
      'audio/mpeg', 'audio/wav'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Upload single file
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const result = await megaS4.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      {
        userId: req.user.id,
        purpose: req.body.purpose || 'general'
      }
    );

    // Save to database
    await saveFileRecord({
      key: result.key,
      url: result.url,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user.id
    });

    res.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload multiple files
router.post('/upload-multiple', authenticate, upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    const uploadPromises = files.map(file => 
      megaS4.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype
      )
    );

    const results = await Promise.all(uploadPromises);
    res.json({ success: true, files: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload large file with progress
router.post('/upload-large', authenticate, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Use SSE for progress updates
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const result = await megaS4.uploadLargeFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      (progress) => {
        res.write(`data: ${JSON.stringify({ progress })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ complete: true, result })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Generate presigned upload URL
router.post('/presigned-upload', authenticate, async (req, res) => {
  try {
    const { fileName, mimeType } = req.body;
    
    if (!fileName || !mimeType) {
      return res.status(400).json({ error: 'Missing fileName or mimeType' });
    }

    const result = await megaS4.generatePresignedUploadUrl(
      fileName,
      mimeType,
      300 // 5 minutes
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate presigned download URL
router.get('/presigned-download/:key', authenticate, async (req, res) => {
  try {
    const { key } = req.params;
    
    const url = await megaS4.generatePresignedDownloadUrl(key, 3600);
    
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download file
router.get('/download/:key(*)', authenticate, async (req, res) => {
  try {
    const { key } = req.params;
    
    const result = await megaS4.downloadFile(key);
    
    res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', result.contentLength?.toString() || '0');
    res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
    
    result.stream.pipe(res);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Delete file
router.delete('/delete/:key(*)', authenticate, async (req, res) => {
  try {
    const { key } = req.params;
    
    // Check permissions
    const hasPermission = await checkUserFilePermission(req.user.id, key);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    const success = await megaS4.deleteFile(key);
    
    if (success) {
      // Remove from database
      await removeFileRecord(key);
      res.json({ success: true, message: 'File deleted' });
    } else {
      res.status(500).json({ error: 'Failed to delete file' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List files
router.get('/list', authenticate, async (req, res) => {
  try {
    const { prefix, maxKeys } = req.query;
    
    const result = await megaS4.listFiles(
      prefix as string,
      parseInt(maxKeys as string) || 100
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

## 🎨 Frontend React Components

### 1. MEGA S4 Upload Component

```tsx
// frontend/src/components/upload/MegaS4Upload.tsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { Upload, X, File, Image, FileText, Video, Music, Archive, CheckCircle, AlertCircle } from 'lucide-react';

interface UploadedFile {
  key: string;
  url: string;
  size: number;
  name: string;
  type: string;
}

interface MegaS4UploadProps {
  onUploadComplete?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSize?: number;
  accept?: string;
  uploadMode?: 'direct' | 'presigned';
}

export const MegaS4Upload: React.FC<MegaS4UploadProps> = ({
  onUploadComplete,
  maxFiles = 10,
  maxSize = 100 * 1024 * 1024, // 100MB
  accept = 'image/*,application/pdf,video/*,audio/*',
  uploadMode = 'direct'
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'pending' | 'uploading' | 'success' | 'error'>>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = [...files, ...acceptedFiles].slice(0, maxFiles);
    setFiles(newFiles);
    
    // Initialize status for new files
    acceptedFiles.forEach(file => {
      setUploadStatus(prev => ({
        ...prev,
        [file.name]: 'pending'
      }));
    });
  }, [files, maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: true,
    maxFiles
  });

  // Upload single file via backend
  const uploadFileDirect = async (file: File): Promise<UploadedFile | null> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadStatus(prev => ({ ...prev, [file.name]: 'uploading' }));
      
      const response = await axios.post('/api/mega-s4/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
          }
        }
      });

      setUploadStatus(prev => ({ ...prev, [file.name]: 'success' }));
      
      return {
        key: response.data.key,
        url: response.data.url,
        size: file.size,
        name: file.name,
        type: file.type
      };
    } catch (error) {
      console.error(`Upload failed for ${file.name}:`, error);
      setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
      return null;
    }
  };

  // Upload file using presigned URL
  const uploadFilePresigned = async (file: File): Promise<UploadedFile | null> => {
    try {
      setUploadStatus(prev => ({ ...prev, [file.name]: 'uploading' }));
      
      // Get presigned URL
      const { data } = await axios.post('/api/mega-s4/presigned-upload', {
        fileName: file.name,
        mimeType: file.type
      });

      // Upload directly to MEGA S4
      await axios.put(data.signedUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
          }
        }
      });

      setUploadStatus(prev => ({ ...prev, [file.name]: 'success' }));
      
      return {
        key: data.key,
        url: data.publicUrl,
        size: file.size,
        name: file.name,
        type: file.type
      };
    } catch (error) {
      console.error(`Presigned upload failed for ${file.name}:`, error);
      setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
      return null;
    }
  };

  // Upload all files
  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    const uploadMethod = uploadMode === 'presigned' ? uploadFilePresigned : uploadFileDirect;
    
    // Upload files in parallel (max 3 at a time)
    const uploadPromises = files.map((file, index) => {
      return new Promise<UploadedFile | null>((resolve) => {
        setTimeout(async () => {
          const result = await uploadMethod(file);
          resolve(result);
        }, Math.floor(index / 3) * 100); // Batch delay
      });
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter(r => r !== null) as UploadedFile[];
    
    setUploadedFiles(prev => [...prev, ...successfulUploads]);
    setIsUploading(false);
    
    // Clear successfully uploaded files
    const successfulFileNames = successfulUploads.map(f => f.name);
    setFiles(prev => prev.filter(f => !successfulFileNames.includes(f.name)));
    
    // Callback with uploaded files
    if (onUploadComplete && successfulUploads.length > 0) {
      onUploadComplete(successfulUploads);
    }
  };

  // Remove file from queue
  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(f => f.name !== fileName));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
    setUploadStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[fileName];
      return newStatus;
    });
  };

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (type.startsWith('video/')) return <Video className="w-5 h-5" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5" />;
    if (type === 'application/pdf') return <FileText className="w-5 h-5" />;
    if (type.includes('zip') || type.includes('rar')) return <Archive className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          MEGA S4 Object Storage Upload
        </h2>
        <p className="text-gray-600">
          Upload files to MEGA S4 - S3-compatible storage with no egress fees
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50 scale-[1.02]' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex justify-center mb-4">
          <div className={`
            p-4 rounded-full
            ${isDragActive ? 'bg-blue-100' : 'bg-gray-100'}
          `}>
            <Upload className={`
              w-8 h-8
              ${isDragActive ? 'text-blue-600 animate-bounce' : 'text-gray-400'}
            `} />
          </div>
        </div>

        <p className="text-base font-medium text-gray-700 mb-1">
          {isDragActive 
            ? 'Drop files here!' 
            : 'Drag & drop files here, or click to browse'
          }
        </p>
        <p className="text-sm text-gray-500">
          Max {maxFiles} files, up to {formatSize(maxSize)} each
        </p>
      </div>

      {/* File Queue */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">
              Files to Upload ({files.length}/{maxFiles})
            </h3>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className={`
                px-4 py-2 rounded-lg font-medium transition-all
                ${isUploading 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                }
              `}
            >
              {isUploading ? 'Uploading...' : `Upload ${files.length} Files`}
            </button>
          </div>

          <div className="space-y-3">
            {files.map((file) => {
              const progress = uploadProgress[file.name] || 0;
              const status = uploadStatus[file.name] || 'pending';
              
              return (
                <div
                  key={file.name}
                  className={`
                    p-4 rounded-lg border transition-all
                    ${status === 'error' 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-200 bg-white'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className={`
                        p-2 rounded-lg
                        ${status === 'success' 
                          ? 'bg-green-100 text-green-600'
                          : status === 'error'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-gray-600'
                        }
                      `}>
                        {getFileIcon(file.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatSize(file.size)} • {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {status === 'uploading' && (
                        <div className="w-24">
                          <div className="text-xs text-gray-600 text-right mb-1">
                            {progress}%
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {status === 'success' && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      
                      {status === 'error' && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                      
                      {status === 'pending' && (
                        <button
                          onClick={() => removeFile(file.name)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                        >
                          <X className="w-5 h-5 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Uploaded Files ({uploadedFiles.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="p-4 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                      {getFileIcon(file.type)}
                    </div>
                    
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 break-all">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatSize(file.size)}
                      </p>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                      >
                        View File →
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

### 2. Integration Hook

```typescript
// frontend/src/hooks/useMegaS4Upload.ts
import { useState, useCallback } from 'react';
import axios from 'axios';

interface UploadOptions {
  onProgress?: (progress: number) => void;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

export const useMegaS4Upload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const uploadFile = useCallback(async (
    file: File,
    options?: UploadOptions
  ) => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/mega-s4/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
            options?.onProgress?.(percentCompleted);
          }
        }
      });

      options?.onSuccess?.(response.data);
      return response.data;
    } catch (err) {
      const error = err as Error;
      setError(error);
      options?.onError?.(error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const uploadWithPresignedUrl = useCallback(async (
    file: File,
    options?: UploadOptions
  ) => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Get presigned URL
      const { data } = await axios.post('/api/mega-s4/presigned-upload', {
        fileName: file.name,
        mimeType: file.type
      });

      // Upload to MEGA S4
      await axios.put(data.signedUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
            options?.onProgress?.(percentCompleted);
          }
        }
      });

      const result = {
        key: data.key,
        url: data.publicUrl,
        size: file.size
      };

      options?.onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      options?.onError?.(error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    uploadFile,
    uploadWithPresignedUrl,
    isUploading,
    progress,
    error
  };
};
```

---

## 🔒 Security Best Practices

### 1. File Validation
```typescript
const validateFile = (file: File): boolean => {
  // Check file size
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    throw new Error('File too large');
  }

  // Check file type
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf', 'video/mp4'
  ];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }

  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.mp4'];
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!allowedExtensions.includes(extension)) {
    throw new Error('Invalid file extension');
  }

  return true;
};
```

### 2. Access Control
```typescript
// Implement signed URLs with expiration
const generateSecureUrl = async (key: string): Promise<string> => {
  const url = await megaS4.generatePresignedDownloadUrl(key, 3600); // 1 hour
  return url;
};
```

---

## 📊 Performance Optimization

### 1. Parallel Upload với Queue
```typescript
class UploadQueue {
  private queue: File[] = [];
  private activeUploads = 0;
  private maxConcurrent = 3;

  async addFiles(files: File[]) {
    this.queue.push(...files);
    this.processQueue();
  }

  private async processQueue() {
    while (this.queue.length > 0 && this.activeUploads < this.maxConcurrent) {
      const file = this.queue.shift()!;
      this.activeUploads++;
      
      this.uploadFile(file).finally(() => {
        this.activeUploads--;
        this.processQueue();
      });
    }
  }

  private async uploadFile(file: File) {
    // Upload logic
  }
}
```

### 2. Chunked Upload cho Large Files
```typescript
const uploadLargeFile = async (file: File) => {
  const chunkSize = 5 * 1024 * 1024; // 5MB chunks
  const chunks = Math.ceil(file.size / chunkSize);
  
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    // Upload chunk
    await uploadChunk(chunk, i, chunks);
  }
};
```

---

## 🎯 Testing

### Test Upload Endpoint
```bash
# Test single file upload
curl -X POST http://localhost:3000/api/mega-s4/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/file.jpg"

# Test presigned URL
curl -X POST http://localhost:3000/api/mega-s4/presigned-upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.jpg","mimeType":"image/jpeg"}'
```

---

## 📈 Cost Analysis

### MEGA S4 Pricing
- **Storage**: €2.50/TB/month (~$2.63)
- **Bandwidth**: 5X storage included FREE
- **API Calls**: FREE (no charges)
- **Minimum**: Pro Flexi €15/month (3TB base)

### So sánh với các dịch vụ khác:
| Service | Storage | Egress | API Calls |
|---------|---------|--------|-----------|
| MEGA S4 | €2.50/TB | FREE (5X) | FREE |
| AWS S3 | $23/TB | $90/TB | Charged |
| Cloudflare R2 | $15/TB | FREE | FREE |
| Backblaze B2 | $5/TB | $10/TB | FREE |

---

## 🚀 Deployment Checklist

- [ ] Create MEGA S4 account và Pro Flexi subscription
- [ ] Generate Access Keys từ MEGA dashboard
- [ ] Create S4 bucket
- [ ] Configure CORS policy cho bucket
- [ ] Set environment variables
- [ ] Deploy backend với MEGA S4 routes
- [ ] Integrate frontend components
- [ ] Test upload/download functionality
- [ ] Setup monitoring và logging
- [ ] Configure backup strategy

---

## 📚 Resources

- [MEGA S4 Documentation](https://github.com/meganz/s4-specs)
- [MEGA S4 Help Center](https://help.mega.io/megas4)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)
- [S3 API Reference](https://docs.aws.amazon.com/AmazonS3/latest/API/)

---

## 🎉 Summary

MEGA S4 Object Storage là giải pháp tuyệt vời cho Upload Module với:
- ✅ Giá cực kỳ cạnh tranh (€2.50/TB)
- ✅ Không tính phí egress (5X bandwidth free)
- ✅ S3-compatible API
- ✅ Không giới hạn API calls
- ✅ Global access từ mọi region
- ✅ Dễ tích hợp với existing S3 tools

Perfect cho startups và projects cần storage scalable với chi phí thấp!