# Upload Module Design Documentation

## Executive Summary
A lightweight, secure, and reusable file upload module that can be integrated across multiple system components including comments, form builder fields, and any form within the system.

## Core Principles
- **Lightweight**: Minimal dependencies, optimized bundle size
- **Secure**: Multiple layers of security validation
- **Reusable**: Single component, multiple use cases
- **Free**: Uses open-source solutions, no paid services
- **Progressive**: Works without JavaScript, enhanced with it

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                   Frontend Layer                      │
├────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐            │
│  │ Upload Component│  │ Upload Preview  │            │
│  └────────┬────────┘  └────────┬────────┘            │
│           │                     │                      │
│  ┌────────▼─────────────────────▼────────┐            │
│  │        Upload Service                 │            │
│  │  - Chunking                          │            │
│  │  - Progress tracking                 │            │
│  │  - Retry logic                       │            │
│  └────────────────┬─────────────────────┘            │
└───────────────────┼────────────────────────────────┘
                    │
┌───────────────────▼────────────────────────────────┐
│                   Backend Layer                      │
├────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐            │
│  │  Upload Router  │  │   Validation    │            │
│  └────────┬────────┘  └────────┬────────┘            │
│           │                     │                      │
│  ┌────────▼─────────────────────▼────────┐            │
│  │         File Processing Service       │            │
│  │  - Virus scanning                    │            │
│  │  - Image optimization                │            │
│  │  - Metadata extraction               │            │
│  └────────────────┬─────────────────────┘            │
│                   │                                   │
│  ┌────────────────▼─────────────────────┐            │
│  │         Storage Service              │            │
│  │  - Local filesystem                  │            │
│  │  - CDN integration (optional)        │            │
│  └──────────────────────────────────────┘            │
└────────────────────────────────────────────────────┘
```

## Component Design

### 1. Frontend Components

#### FileUpload Component
```typescript
interface FileUploadProps {
  // Core props
  id?: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  minSize?: number;
  
  // UI props
  variant?: 'dropzone' | 'button' | 'inline' | 'minimal';
  showPreview?: boolean;
  showProgress?: boolean;
  disabled?: boolean;
  className?: string;
  
  // Callbacks
  onUpload?: (files: UploadedFile[]) => void;
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: UploadError) => void;
  onRemove?: (fileId: string) => void;
  
  // Integration props
  context?: 'comment' | 'form' | 'field' | 'standalone';
  entityId?: string; // ID of parent entity
  entityType?: string; // Type of parent entity
  
  // Security
  allowedMimeTypes?: string[];
  scanForVirus?: boolean;
  requireAuth?: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
  uploadedAt: Date;
  uploadedBy?: string;
}

interface UploadProgress {
  fileId: string;
  loaded: number;
  total: number;
  percentage: number;
  speed?: number; // bytes per second
  remainingTime?: number; // seconds
}

interface UploadError {
  fileId?: string;
  code: string;
  message: string;
  details?: any;
}
```

#### FilePreview Component
```typescript
interface FilePreviewProps {
  file: UploadedFile | File;
  variant?: 'thumbnail' | 'list' | 'grid';
  showActions?: boolean;
  showMetadata?: boolean;
  onRemove?: () => void;
  onDownload?: () => void;
  onClick?: () => void;
}
```

### 2. Backend API Design

#### Endpoints
```yaml
POST /api/upload/single
  Description: Upload single file
  Body: multipart/form-data
  Response: UploadedFile

POST /api/upload/multiple
  Description: Upload multiple files
  Body: multipart/form-data
  Response: UploadedFile[]

POST /api/upload/chunk
  Description: Upload file chunk for large files
  Body: multipart/form-data with chunk metadata
  Response: ChunkResponse

GET /api/upload/:fileId
  Description: Get file metadata
  Response: UploadedFile

GET /api/upload/:fileId/download
  Description: Download file
  Response: File stream

DELETE /api/upload/:fileId
  Description: Delete file
  Response: Success message

POST /api/upload/:fileId/scan
  Description: Scan file for viruses
  Response: ScanResult
```

### 3. Database Schema

```sql
-- Files table
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  path TEXT NOT NULL,
  
  -- Metadata
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- for video/audio
  metadata JSONB,
  
  -- Security
  virus_scanned BOOLEAN DEFAULT FALSE,
  virus_scan_result JSONB,
  is_safe BOOLEAN DEFAULT TRUE,
  
  -- Relations
  uploaded_by UUID REFERENCES users(id),
  entity_type VARCHAR(50), -- 'comment', 'submission', etc.
  entity_id UUID,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_uploaded_by (uploaded_by),
  INDEX idx_created_at (created_at)
);

-- File chunks for resumable uploads
CREATE TABLE file_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id VARCHAR(255) NOT NULL,
  chunk_number INTEGER NOT NULL,
  chunk_size INTEGER NOT NULL,
  chunk_hash VARCHAR(64),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(upload_id, chunk_number)
);

-- File access logs for audit
CREATE TABLE file_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(20), -- 'view', 'download', 'delete'
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Security Implementation

### 1. File Validation
```typescript
const FILE_VALIDATION_RULES = {
  // Size limits
  maxSize: 10 * 1024 * 1024, // 10MB default
  minSize: 1, // 1 byte minimum
  
  // Type restrictions
  allowedMimeTypes: [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    
    // Text
    'text/plain',
    'text/csv',
    
    // Archives
    'application/zip',
    'application/x-rar-compressed'
  ],
  
  // Dangerous extensions to block
  blockedExtensions: [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr',
    '.vbs', '.js', '.jar', '.msi', '.dll', '.app'
  ],
  
  // Magic number validation
  validateMagicNumbers: true,
  
  // Filename sanitization
  sanitizeFilename: true,
  maxFilenameLength: 255
};
```

### 2. Security Measures
- **File Type Validation**: Check MIME type and file extension
- **Magic Number Validation**: Verify file header bytes
- **Size Limits**: Enforce min/max file sizes
- **Virus Scanning**: Integration with ClamAV (free, open-source)
- **Content Security Policy**: Serve files from separate domain
- **Access Control**: User-based permissions
- **Rate Limiting**: Prevent abuse
- **Secure Storage**: Files stored outside web root
- **Encrypted Storage**: Optional encryption at rest

### 3. Virus Scanning with ClamAV
```typescript
interface VirusScanService {
  scanFile(filePath: string): Promise<ScanResult>;
  updateDefinitions(): Promise<void>;
  getVersion(): Promise<string>;
}

interface ScanResult {
  isClean: boolean;
  virusName?: string;
  scanTime: number;
  engineVersion: string;
}
```

## Integration Examples

### 1. Comment Integration
```tsx
// In CommentPanel component
<FileUpload
  context="comment"
  entityId={commentId}
  entityType="comment"
  variant="inline"
  maxFiles={5}
  maxSize={5 * 1024 * 1024} // 5MB
  accept="image/*,application/pdf"
  onUpload={(files) => {
    // Attach files to comment
    attachFilesToComment(commentId, files);
  }}
/>
```

### 2. Form Builder Field
```tsx
// File upload field type
{
  type: 'file',
  props: {
    multiple: true,
    maxFiles: 10,
    accept: '.pdf,.doc,.docx',
    required: false,
    validation: {
      maxSize: 10485760, // 10MB
      minFiles: 1,
      maxFiles: 10
    }
  }
}
```

### 3. Standalone Form
```tsx
// In any form component
<form onSubmit={handleSubmit}>
  <Input name="title" />
  <Textarea name="description" />
  
  <FileUpload
    context="form"
    entityType="application"
    variant="dropzone"
    multiple={true}
    onUpload={handleFileUpload}
  />
  
  <Button type="submit">Submit</Button>
</form>
```

## Performance Optimization

### 1. Chunked Upload for Large Files
```typescript
class ChunkedUploadService {
  private chunkSize = 1024 * 1024; // 1MB chunks
  
  async uploadLargeFile(file: File, onProgress: Function) {
    const chunks = this.createChunks(file);
    const uploadId = this.generateUploadId();
    
    for (let i = 0; i < chunks.length; i++) {
      await this.uploadChunk(uploadId, chunks[i], i);
      onProgress((i + 1) / chunks.length * 100);
    }
    
    return this.finalizeUpload(uploadId);
  }
  
  private createChunks(file: File): Blob[] {
    const chunks: Blob[] = [];
    let start = 0;
    
    while (start < file.size) {
      const end = Math.min(start + this.chunkSize, file.size);
      chunks.push(file.slice(start, end));
      start = end;
    }
    
    return chunks;
  }
}
```

### 2. Image Optimization
```typescript
interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
  generateThumbnail?: boolean;
  thumbnailSize?: number;
}

class ImageOptimizer {
  async optimizeImage(
    file: File,
    options: ImageOptimizationOptions
  ): Promise<OptimizedImage> {
    // Resize image on canvas
    const canvas = await this.resizeImage(file, options);
    
    // Convert to optimal format
    const blob = await this.convertFormat(canvas, options);
    
    // Generate thumbnail if needed
    const thumbnail = options.generateThumbnail
      ? await this.generateThumbnail(canvas, options)
      : null;
    
    return { main: blob, thumbnail };
  }
}
```

### 3. Lazy Loading & Virtual Scrolling
```tsx
// For file lists with many items
<VirtualList
  items={files}
  height={400}
  itemHeight={60}
  renderItem={(file) => (
    <FilePreview
      file={file}
      variant="list"
      showActions={true}
    />
  )}
/>
```

## Accessibility Features

- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Support**: Proper ARIA labels
- **Focus Management**: Logical focus flow
- **Status Announcements**: Upload progress announcements
- **Error Messages**: Clear, actionable error messages

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Progressive enhancement for older browsers
- Fallback to basic file input
- Polyfills for missing features

## Cost Analysis

### Free Solutions Used:
- **Storage**: Local filesystem (free)
- **CDN**: Optional CloudFlare (free tier)
- **Virus Scanning**: ClamAV (open-source)
- **Image Processing**: Sharp.js (open-source)
- **Video Processing**: FFmpeg (open-source)

### Optional Paid Upgrades:
- Cloud storage (S3, GCS)
- Premium CDN
- Advanced virus scanning
- AI-based content moderation

## Implementation Roadmap

### Phase 1: Core Upload (Week 1)
- Basic upload component
- File validation
- Progress tracking
- Database schema

### Phase 2: Security (Week 2)
- Virus scanning integration
- Advanced validation
- Access control
- Audit logging

### Phase 3: Optimization (Week 3)
- Chunked uploads
- Image optimization
- Lazy loading
- Caching strategy

### Phase 4: Integration (Week 4)
- Comment integration
- Form builder integration
- Testing & documentation
- Deployment

## Testing Strategy

### Unit Tests
- Component rendering
- File validation logic
- Upload service methods
- Error handling

### Integration Tests
- Full upload flow
- Virus scanning
- Database operations
- API endpoints

### E2E Tests
- User upload journey
- Multiple file uploads
- Error scenarios
- Cross-browser testing

## Monitoring & Analytics

### Metrics to Track:
- Upload success rate
- Average file size
- Upload duration
- Error frequency
- Storage usage
- Bandwidth consumption

### Logging:
- All file operations
- Security events
- Performance metrics
- User actions

## Conclusion

This Upload Module design provides a comprehensive, secure, and efficient solution that can be easily integrated across your system. It prioritizes security and performance while maintaining simplicity and reusability.