# Upload Module Implementation Guide

## Quick Start

### Step 1: Install Dependencies

```bash
# Frontend dependencies
npm install axios react-dropzone file-type-ext sharp-browser

# Backend dependencies
npm install multer multer-s3 sharp clamav.js file-type express-rate-limit
```

### Step 2: Create Basic Upload Component

```tsx
// frontend/src/components/upload/FileUpload.tsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Image, FileText } from 'lucide-react';
import api from '../../services/api';

interface FileUploadProps {
  onUpload?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSize?: number;
  accept?: string;
  multiple?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  accept = 'image/*,application/pdf',
  multiple = true
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles].slice(0, maxFiles));
  }, [maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple
  });

  const uploadFiles = async () => {
    setUploading(true);
    const uploadedFiles: UploadedFile[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await api.post('/api/upload/single', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(prev => ({ ...prev, [file.name]: percentCompleted }));
          }
        });

        uploadedFiles.push(response.data);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }

    setUploading(false);
    setFiles([]);
    setProgress({});
    onUpload?.(uploadedFiles);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-sm text-gray-600">
          {isDragActive
            ? 'Drop files here...'
            : 'Drag & drop files here, or click to select'}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Max {maxFiles} files, up to {maxSize / 1024 / 1024}MB each
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Files to upload:
          </h4>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <div className="flex items-center space-x-2">
                  <FileIcon type={file.type} />
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({Math.round(file.size / 1024)}KB)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {progress[file.name] && (
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${progress[file.name]}%` }}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={uploadFiles}
            disabled={uploading}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} file(s)`}
          </button>
        </div>
      )}
    </div>
  );
};

const FileIcon: React.FC<{ type: string }> = ({ type }) => {
  if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
  if (type === 'application/pdf') return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
};
```

### Step 3: Backend Upload Handler

```typescript
// backend/src/routes/uploadRoutes.ts
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import ClamAV from 'clamav.js';
import { authenticate } from '../middleware/auth';
import { pool } from '../utils/database';

const router = express.Router();

// Configure storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Configure multer
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    // Allowed MIME types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Initialize ClamAV (optional - for virus scanning)
let clamav: ClamAV | null = null;
try {
  clamav = new ClamAV({
    removeInfected: true,
    debugMode: false,
    scanRecursively: true
  });
} catch (error) {
  console.warn('ClamAV not available - virus scanning disabled');
}

// Single file upload
router.post('/single', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const file = req.file;
    const userId = req.user.id;

    // Virus scan (if available)
    if (clamav) {
      const scanResult = await clamav.scanFile(file.path);
      if (!scanResult.isClean) {
        await fs.remove(file.path);
        return res.status(400).json({ 
          error: 'File contains virus', 
          virus: scanResult.virusName 
        });
      }
    }

    // Process image if needed
    let thumbnailPath = null;
    if (file.mimetype.startsWith('image/')) {
      thumbnailPath = path.join(
        path.dirname(file.path),
        `thumb_${file.filename}`
      );

      await sharp(file.path)
        .resize(200, 200, { fit: 'cover' })
        .toFile(thumbnailPath);
    }

    // Save to database
    const query = `
      INSERT INTO files (
        original_name, stored_name, mime_type, size, path,
        uploaded_by, virus_scanned, is_safe, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;

    const values = [
      file.originalname,
      file.filename,
      file.mimetype,
      file.size,
      file.path,
      userId,
      !!clamav,
      true
    ];

    const result = await pool.query(query, values);
    const uploadedFile = result.rows[0];

    res.json({
      id: uploadedFile.id,
      name: uploadedFile.original_name,
      size: uploadedFile.size,
      type: uploadedFile.mime_type,
      url: `/api/upload/${uploadedFile.id}/download`,
      thumbnailUrl: thumbnailPath ? `/api/upload/${uploadedFile.id}/thumbnail` : null,
      uploadedAt: uploadedFile.created_at
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Multiple file upload
router.post('/multiple', authenticate, upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploadedFiles = [];
    
    for (const file of req.files as Express.Multer.File[]) {
      // Process each file (virus scan, save to DB, etc.)
      // Similar to single file upload logic
      uploadedFiles.push({
        id: uuidv4(),
        name: file.originalname,
        size: file.size,
        type: file.mimetype
      });
    }

    res.json(uploadedFiles);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Download file
router.get('/:fileId/download', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Get file from database
    const query = 'SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL';
    const result = await pool.query(query, [fileId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];
    
    // Check permissions (implement your logic)
    // ...

    // Send file
    res.download(file.path, file.original_name);
    
    // Log access
    await pool.query(
      'INSERT INTO file_access_logs (file_id, user_id, action) VALUES ($1, $2, $3)',
      [fileId, req.user.id, 'download']
    );

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Delete file
router.delete('/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    
    // Check ownership
    const query = 'SELECT * FROM files WHERE id = $1 AND uploaded_by = $2';
    const result = await pool.query(query, [fileId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }

    const file = result.rows[0];
    
    // Soft delete in database
    await pool.query(
      'UPDATE files SET deleted_at = NOW() WHERE id = $1',
      [fileId]
    );
    
    // Delete physical file (optional - you might want to keep it)
    await fs.remove(file.path);
    
    res.json({ message: 'File deleted successfully' });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
```

### Step 4: Integration Examples

#### Comment Integration
```tsx
// In CommentPanel.tsx
import { FileUpload } from '../upload/FileUpload';

const CommentPanel = () => {
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);

  const handleFileUpload = (files: UploadedFile[]) => {
    setAttachments(prev => [...prev, ...files]);
  };

  const handleCommentSubmit = async () => {
    const commentData = {
      content: commentText,
      attachmentIds: attachments.map(f => f.id)
    };
    
    await api.post('/api/comments', commentData);
  };

  return (
    <div>
      <textarea value={commentText} onChange={...} />
      
      <FileUpload
        onUpload={handleFileUpload}
        maxFiles={3}
        maxSize={5 * 1024 * 1024}
        accept="image/*,application/pdf"
      />
      
      {attachments.length > 0 && (
        <div className="mt-2">
          {attachments.map(file => (
            <div key={file.id} className="text-sm">
              📎 {file.name}
            </div>
          ))}
        </div>
      )}
      
      <button onClick={handleCommentSubmit}>Post Comment</button>
    </div>
  );
};
```

#### Form Builder Field
```tsx
// In FormBuilder field types
const FileUploadField = {
  type: 'file',
  component: FileUpload,
  defaultProps: {
    multiple: false,
    maxSize: 10 * 1024 * 1024,
    accept: '*'
  },
  validate: (value: UploadedFile[], rules: any) => {
    if (rules.required && (!value || value.length === 0)) {
      return 'File is required';
    }
    if (rules.maxFiles && value.length > rules.maxFiles) {
      return `Maximum ${rules.maxFiles} files allowed`;
    }
    return null;
  }
};
```

## Security Checklist

- [ ] File type validation (MIME type + extension)
- [ ] File size limits
- [ ] Virus scanning
- [ ] Filename sanitization
- [ ] Store files outside web root
- [ ] Implement rate limiting
- [ ] Add authentication checks
- [ ] Log all file operations
- [ ] Implement access control
- [ ] Use Content Security Policy
- [ ] Validate magic numbers
- [ ] Prevent path traversal attacks

## Performance Tips

1. **Use CDN for static files**: CloudFlare, Fastly
2. **Implement caching**: Browser cache, server cache
3. **Lazy load images**: Load on scroll
4. **Generate thumbnails**: Multiple sizes
5. **Use WebP format**: Better compression
6. **Implement chunked upload**: For large files
7. **Use service workers**: For offline support
8. **Optimize images**: Sharp, ImageMagick
9. **Compress files**: Gzip, Brotli
10. **Use virtual scrolling**: For large file lists

## Testing

```typescript
// Example test for file upload
describe('FileUpload Component', () => {
  it('should upload single file', async () => {
    const onUpload = jest.fn();
    const { getByText, getByLabelText } = render(
      <FileUpload onUpload={onUpload} />
    );

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = getByLabelText('upload');
    
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(getByText('Upload'));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'test.pdf' })
      ]);
    });
  });
});
```

## Deployment Considerations

1. **Storage**: Local vs Cloud (S3, GCS)
2. **Backup**: Regular backups of uploaded files
3. **Monitoring**: Track upload metrics
4. **Scaling**: Horizontal scaling for upload servers
5. **Security**: WAF, DDoS protection
6. **Compliance**: GDPR, data retention policies

## Troubleshooting

### Common Issues:
1. **Large file uploads failing**: Increase timeout, use chunked upload
2. **CORS errors**: Configure CORS properly
3. **Permission denied**: Check file system permissions
4. **Virus scanner timeout**: Increase timeout, use async scanning
5. **Memory issues**: Stream large files, don't buffer

## Next Steps

1. Implement basic upload component
2. Add virus scanning
3. Create thumbnail generation
4. Add chunked upload support
5. Implement access control
6. Add monitoring and analytics
7. Write comprehensive tests
8. Deploy to production