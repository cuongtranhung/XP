# 🎨 Upload Module - UI/UX Design Specification

## 📱 Design Overview

### Design Principles
- **Intuitive**: Drag & drop với visual feedback rõ ràng
- **Responsive**: Hoạt động tốt trên mọi thiết bị
- **Accessible**: WCAG 2.1 AA compliant
- **Minimal**: Clean design, không rườm rà
- **Informative**: Feedback rõ ràng về trạng thái

---

## 🎯 Component Variants

### 1. Dropzone Variant (Default)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              ┌──────────────┐                  │
│              │     📁       │                  │
│              │   [Icon]     │                  │
│              └──────────────┘                  │
│                                                 │
│        Drag & drop files here or               │
│            Click to browse                     │
│                                                 │
│     ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─           │
│      Supports: JPG, PNG, PDF, DOC              │
│         Max size: 10MB per file                │
│                                                 │
└─────────────────────────────────────────────────┘
```

**States:**
- Default: Border dashed gray
- Hover: Border solid blue, background blue-50
- Dragging: Border animated blue, background blue-100
- Error: Border red, background red-50

### 2. Button Variant

```
┌─────────────────────────┐
│  📎 Upload Files        │
└─────────────────────────┘
```

### 3. Inline Variant (For Comments)

```
┌─────────────────────────────────────────────────┐
│ Type your comment...                           │
│                                                 │
└─────────────────────────────────────────────────┘
┌──────┬──────┬──────┬───────────────┬──────────┐
│  B   │  I   │  📎  │               │  Send    │
└──────┴──────┴──────┴───────────────┴──────────┘
```

### 4. Minimal Variant (For Form Fields)

```
Field Label *
┌─────────────────────────────────────────────────┐
│  📁 Choose files...           [ Browse ]       │
└─────────────────────────────────────────────────┘
 ↳ No file selected
```

---

## 📊 File Preview States

### Grid View (Images)

```
┌─────────┬─────────┬─────────┬─────────┐
│         │         │         │         │
│  [IMG]  │  [IMG]  │  [IMG]  │  [IMG]  │
│         │         │         │         │
├─────────┼─────────┼─────────┼─────────┤
│image.jpg│photo.png│pic.gif  │logo.svg │
│ 2.4 MB  │ 1.2 MB  │ 856 KB  │ 124 KB  │
│   ✓     │   ⟳     │   ⟳     │   ✗     │
└─────────┴─────────┴─────────┴─────────┘

Legend: ✓ Uploaded  ⟳ Uploading  ✗ Failed
```

### List View (Documents)

```
┌─────────────────────────────────────────────────┐
│ 📄 document.pdf                          2.4 MB │
│ ████████████░░░░░░░ 65%         Cancel         │
├─────────────────────────────────────────────────┤
│ 📊 spreadsheet.xlsx                      1.8 MB │
│ ████████████████████ 100%         ✓ Remove     │
├─────────────────────────────────────────────────┤
│ 📝 report.docx                           3.2 MB │
│ ░░░░░░░░░░░░░░░░░░░ 0%          Retry         │
│ ⚠️ Upload failed - File too large              │
└─────────────────────────────────────────────────┘
```

---

## 🎬 Upload States & Animations

### 1. Idle State
```html
<div class="upload-zone">
  <svg class="upload-icon">📁</svg>
  <p>Drag & drop or click</p>
</div>
```

### 2. Dragging State
```html
<div class="upload-zone dragging">
  <svg class="upload-icon animate-bounce">📥</svg>
  <p>Drop files here!</p>
  <!-- Blue overlay with opacity -->
</div>
```

### 3. Uploading State
```html
<div class="file-item uploading">
  <div class="progress-ring">
    <svg>
      <circle cx="25" cy="25" r="20" 
              stroke-dasharray="126"
              stroke-dashoffset="44" /> <!-- 65% -->
    </svg>
    <span>65%</span>
  </div>
  <div class="file-info">
    <p>document.pdf</p>
    <p>1.5 MB / 2.4 MB • 5 sec remaining</p>
  </div>
</div>
```

### 4. Success State
```html
<div class="file-item success">
  <svg class="check-icon animate-scale">✓</svg>
  <p>Upload complete!</p>
</div>
```

### 5. Error State
```html
<div class="file-item error">
  <svg class="error-icon">⚠️</svg>
  <p>Upload failed</p>
  <button>Retry</button>
</div>
```

---

## 💻 Implementation Code

### React Component Structure

```tsx
// FileUpload.tsx - Full implementation
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Image, FileText, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  variant?: 'dropzone' | 'button' | 'inline' | 'minimal';
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number;
  accept?: string;
  onUpload?: (files: File[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  variant = 'dropzone',
  multiple = true,
  maxFiles = 5,
  maxSize = 10485760, // 10MB
  accept = 'image/*,application/pdf',
  onUpload
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle accepted files
    setFiles(prev => [...prev, ...acceptedFiles].slice(0, maxFiles));
    
    // Handle rejected files
    rejectedFiles.forEach(rejection => {
      console.error('File rejected:', rejection);
    });
  }, [maxFiles]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple
  });

  // Render based on variant
  switch (variant) {
    case 'dropzone':
      return (
        <div className="w-full">
          {/* Dropzone Area */}
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-xl p-8
              transition-all duration-200 cursor-pointer
              ${isDragActive ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-gray-300 hover:border-gray-400'}
              ${isDragReject ? 'border-red-500 bg-red-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            {/* Icon with animation */}
            <div className="flex justify-center mb-4">
              <div className={`
                p-4 rounded-full bg-gray-100
                ${isDragActive ? 'animate-bounce bg-blue-100' : ''}
              `}>
                <Upload className={`
                  w-8 h-8
                  ${isDragActive ? 'text-blue-600' : 'text-gray-400'}
                `} />
              </div>
            </div>

            {/* Text */}
            <div className="text-center">
              <p className="text-base font-medium text-gray-700">
                {isDragActive ? 'Drop files here!' : 'Drag & drop files here'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or <span className="text-blue-600 hover:underline">browse</span>
              </p>
              
              {/* File type info */}
              <div className="mt-4 text-xs text-gray-400">
                <p>Supports: JPG, PNG, PDF, DOC</p>
                <p>Max size: {(maxSize / 1048576).toFixed(0)}MB per file</p>
              </div>
            </div>

            {/* Drag overlay */}
            {isDragActive && (
              <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-xl pointer-events-none" />
            )}
          </div>

          {/* File Preview List */}
          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Files ({files.length}/{maxFiles})
              </h3>
              
              {files.map((file, index) => (
                <FilePreviewItem
                  key={index}
                  file={file}
                  progress={uploadProgress[file.name]}
                  onRemove={() => {
                    setFiles(prev => prev.filter((_, i) => i !== index));
                  }}
                />
              ))}
            </div>
          )}
        </div>
      );

    case 'button':
      return (
        <button
          {...getRootProps()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <input {...getInputProps()} />
          <Upload className="w-4 h-4" />
          Upload Files
        </button>
      );

    case 'inline':
      return (
        <button
          {...getRootProps()}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <input {...getInputProps()} />
          <Upload className="w-5 h-5" />
        </button>
      );

    case 'minimal':
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
            <span className="text-sm text-gray-500">
              {files.length > 0 ? `${files.length} files selected` : 'No file selected'}
            </span>
          </div>
          <button
            {...getRootProps()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <input {...getInputProps()} />
            Browse
          </button>
        </div>
      );

    default:
      return null;
  }
};

// File Preview Item Component
const FilePreviewItem: React.FC<{
  file: File;
  progress?: number;
  onRemove: () => void;
}> = ({ file, progress = 0, onRemove }) => {
  const isImage = file.type.startsWith('image/');
  const [preview, setPreview] = useState<string | null>(null);

  // Generate preview for images
  React.useEffect(() => {
    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [file, isImage]);

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      {/* File icon or preview */}
      <div className="flex-shrink-0">
        {isImage && preview ? (
          <img src={preview} alt={file.name} className="w-12 h-12 object-cover rounded" />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
            <FileIcon type={file.type} />
          </div>
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
        <p className="text-xs text-gray-500">
          {formatFileSize(file.size)}
          {progress > 0 && progress < 100 && ` • ${progress}%`}
        </p>
        
        {/* Progress bar */}
        {progress > 0 && progress < 100 && (
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0">
        {progress === 100 ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : progress > 0 ? (
          <button className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button onClick={onRemove} className="text-gray-400 hover:text-red-600">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

// Helper Components
const FileIcon: React.FC<{ type: string }> = ({ type }) => {
  if (type.startsWith('image/')) return <Image className="w-6 h-6 text-blue-500" />;
  if (type === 'application/pdf') return <FileText className="w-6 h-6 text-red-500" />;
  return <File className="w-6 h-6 text-gray-500" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};
```

---

## 🎨 CSS Styles

```css
/* upload.module.css */

/* Dropzone styles */
.upload-zone {
  @apply relative border-2 border-dashed border-gray-300 rounded-xl;
  @apply p-8 text-center cursor-pointer transition-all duration-200;
  @apply hover:border-gray-400 hover:bg-gray-50;
}

.upload-zone.dragging {
  @apply border-blue-500 bg-blue-50 scale-[1.02];
  animation: pulse 2s infinite;
}

.upload-zone.error {
  @apply border-red-500 bg-red-50;
}

/* File preview grid */
.file-grid {
  @apply grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4;
}

.file-grid-item {
  @apply relative group cursor-pointer;
  @apply border border-gray-200 rounded-lg overflow-hidden;
  @apply hover:shadow-lg transition-shadow;
}

.file-grid-item img {
  @apply w-full h-32 object-cover;
}

.file-grid-item .overlay {
  @apply absolute inset-0 bg-black bg-opacity-50 opacity-0;
  @apply group-hover:opacity-100 transition-opacity;
  @apply flex items-center justify-center gap-2;
}

/* Progress ring */
.progress-ring {
  @apply relative w-12 h-12;
}

.progress-ring svg {
  @apply transform -rotate-90;
}

.progress-ring circle {
  @apply stroke-current text-blue-600;
  stroke-width: 3;
  fill: none;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.3s ease;
}

/* Animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes scale-in {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.animate-scale-in {
  animation: scale-in 0.3s ease-out;
}

/* Status indicators */
.status-uploading {
  @apply text-blue-600 bg-blue-50;
}

.status-success {
  @apply text-green-600 bg-green-50;
}

.status-error {
  @apply text-red-600 bg-red-50;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .upload-zone {
    @apply p-6;
  }
  
  .file-grid {
    @apply grid-cols-2;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .upload-zone {
    @apply border-gray-600 hover:border-gray-500;
    @apply hover:bg-gray-800;
  }
  
  .upload-zone.dragging {
    @apply border-blue-400 bg-blue-900 bg-opacity-20;
  }
}
```

---

## 📱 Mobile Design

### Mobile Dropzone
```
┌─────────────────────────┐
│                         │
│         📁             │
│                         │
│    Tap to upload       │
│                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│   Max: 10MB            │
│                         │
└─────────────────────────┘
```

### Mobile File List
```
┌─────────────────────────┐
│ 📄 document.pdf    2.4MB│
│ ████████░░░ 75%        │
├─────────────────────────┤
│ 🖼️ image.jpg       1.2MB│
│ ✓ Uploaded             │
└─────────────────────────┘
```

---

## 🌈 Theme Variations

### Light Theme (Default)
- Background: white
- Border: gray-300
- Hover: gray-400
- Active: blue-500
- Text: gray-700

### Dark Theme
- Background: gray-800
- Border: gray-600
- Hover: gray-500
- Active: blue-400
- Text: gray-200

### Custom Brand Colors
```css
:root {
  --upload-primary: #3B82F6;
  --upload-secondary: #10B981;
  --upload-danger: #EF4444;
  --upload-warning: #F59E0B;
}
```

---

## ♿ Accessibility Features

### ARIA Labels
```html
<div role="button" 
     aria-label="Upload files"
     aria-describedby="upload-help"
     tabindex="0">
  
  <input type="file" 
         aria-label="Choose files to upload"
         multiple />
  
  <div id="upload-help" class="sr-only">
    Drag and drop files or click to browse. 
    Supports JPG, PNG, PDF up to 10MB.
  </div>
</div>
```

### Keyboard Navigation
- `Tab` - Navigate between elements
- `Space/Enter` - Activate upload
- `Delete` - Remove selected file
- `Escape` - Cancel upload

### Screen Reader Announcements
```javascript
// Announce upload progress
announceToScreenReader(`Uploading ${file.name}, ${progress}% complete`);

// Announce completion
announceToScreenReader(`${file.name} uploaded successfully`);

// Announce errors
announceToScreenReader(`Failed to upload ${file.name}: ${error.message}`);
```

---

## 🔄 Integration Examples

### In Comment Section
```tsx
<CommentBox>
  <textarea placeholder="Write a comment..." />
  <div className="flex justify-between items-center mt-2">
    <FileUpload variant="inline" maxFiles={3} />
    <button>Post Comment</button>
  </div>
</CommentBox>
```

### In Form Builder
```tsx
<FormField>
  <label>Attachments</label>
  <FileUpload 
    variant="minimal"
    multiple={true}
    accept=".pdf,.doc,.docx"
  />
  <span className="text-xs text-gray-500">
    Upload supporting documents
  </span>
</FormField>
```

### Standalone Page
```tsx
<UploadPage>
  <h1>Upload Documents</h1>
  <FileUpload 
    variant="dropzone"
    maxFiles={10}
    maxSize={20971520} // 20MB
    onUpload={handleBulkUpload}
  />
  <UploadedFilesList files={uploadedFiles} />
</UploadPage>
```

---

## 📊 Metrics & Analytics

### Track User Interactions
```javascript
// Track upload events
analytics.track('file_upload_started', {
  fileCount: files.length,
  totalSize: totalBytes,
  fileTypes: uniqueTypes
});

analytics.track('file_upload_completed', {
  fileId: file.id,
  uploadTime: duration,
  fileSize: file.size
});

analytics.track('file_upload_failed', {
  error: error.code,
  fileType: file.type,
  fileSize: file.size
});
```

---

## 🎯 Performance Considerations

### Optimizations
1. **Lazy load** dropzone library
2. **Virtual scrolling** for large file lists
3. **Image compression** before upload
4. **Chunk large files** (>5MB)
5. **Cache thumbnails** locally
6. **Debounce** drag events
7. **Web Workers** for file processing

### Bundle Size
```
react-dropzone: ~25KB (gzipped: 8KB)
UI Components: ~15KB (gzipped: 5KB)
Total: ~40KB (gzipped: 13KB)
```

---

## 🔍 Testing Scenarios

### Visual Regression Tests
1. Default state
2. Hover state
3. Dragging state
4. Files uploaded state
5. Error state
6. Mobile view
7. Dark mode

### Interaction Tests
1. Click to upload
2. Drag and drop
3. Multiple file selection
4. File removal
5. Upload cancellation
6. Retry failed uploads
7. Keyboard navigation

---

## 📝 Design Tokens

```javascript
const uploadTokens = {
  colors: {
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    neutral: '#6B7280'
  },
  spacing: {
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem'
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem'
  },
  animation: {
    duration: '200ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  }
};
```

---

## ✅ Design Checklist

- [ ] Responsive on all devices
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Dark mode support
- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Success feedback
- [ ] Progress indicators
- [ ] Keyboard navigation
- [ ] Touch-friendly on mobile
- [ ] Cross-browser compatible
- [ ] Performance optimized