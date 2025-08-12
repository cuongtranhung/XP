# 🚀 Parallel Upload System với Toast Notifications

## Overview
Hệ thống upload song song cho phép upload nhiều file cùng lúc với toast message hiển thị progress của từng file riêng biệt.

## 📊 Architecture

### Upload Queue System
```typescript
interface UploadQueue {
  files: UploadTask[];
  maxConcurrent: number; // 3-5 files cùng lúc
  activeUploads: Set<string>;
  completedUploads: Set<string>;
  failedUploads: Set<string>;
}

interface UploadTask {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'paused';
  progress: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
  error?: string;
  retryCount: number;
  abortController?: AbortController;
}
```

### Toast Management
```typescript
interface UploadToast {
  id: string;
  fileId: string;
  fileName: string;
  status: 'uploading' | 'completed' | 'failed';
  progress: number;
  speed: number;
  remainingTime: number;
  error?: string;
  autoHide: boolean;
  hideDelay: number;
}
```

---

## 🎯 UI Design

### Toast Message Layout

#### Uploading State
```
┌─────────────────────────────────────────────────────┐
│ 📤 Uploading document.pdf                     [ X ] │
│ ████████████░░░░░░░ 65% • 1.2 MB/s • 8s left      │
│ ─────────────────────────────────────────────────── │
│                    [ Pause ] [ Cancel ]             │
└─────────────────────────────────────────────────────┘
```

#### Success State (Auto-hide sau 3s)
```
┌─────────────────────────────────────────────────────┐
│ ✅ document.pdf uploaded successfully          [ X ] │
│ 2.4 MB • Completed in 15 seconds                   │
└─────────────────────────────────────────────────────┘
```

#### Error State (Không auto-hide)
```
┌─────────────────────────────────────────────────────┐
│ ❌ Failed to upload document.pdf               [ X ] │
│ Error: File too large (max 10MB)                   │
│ ─────────────────────────────────────────────────── │
│                      [ Retry ] [ Remove ]           │
└─────────────────────────────────────────────────────┘
```

### Multiple Toasts Stack
```
Right side của screen:

┌─── Toast 1 (Uploading) ───┐
│ 📤 image1.jpg      65%    │
└───────────────────────────┘
┌─── Toast 2 (Uploading) ───┐
│ 📤 image2.jpg      42%    │
└───────────────────────────┘
┌─── Toast 3 (Completed) ───┐
│ ✅ document.pdf ✓         │
└───────────────────────────┘
┌─── Toast 4 (Failed) ──────┐
│ ❌ video.mp4 Failed       │
│    [ Retry ]               │
└───────────────────────────┘
```

---

## 💻 Implementation

### Upload Service với Parallel Processing

```typescript
// services/ParallelUploadService.ts
export class ParallelUploadService {
  private queue: UploadTask[] = [];
  private activeUploads = new Set<string>();
  private maxConcurrent = 3; // Upload tối đa 3 files cùng lúc
  private toastManager: UploadToastManager;

  constructor() {
    this.toastManager = new UploadToastManager();
  }

  async uploadFiles(files: File[]): Promise<void> {
    // Tạo upload tasks
    const tasks = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending' as const,
      progress: 0,
      speed: 0,
      remainingTime: 0,
      retryCount: 0,
      abortController: new AbortController()
    }));

    // Thêm vào queue
    this.queue.push(...tasks);

    // Bắt đầu xử lý queue
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 || this.activeUploads.size > 0) {
      // Khởi động uploads mới nếu còn slot
      while (
        this.activeUploads.size < this.maxConcurrent && 
        this.queue.length > 0
      ) {
        const task = this.queue.shift()!;
        this.startUpload(task);
      }

      // Chờ một chút trước khi check lại
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async startUpload(task: UploadTask): Promise<void> {
    this.activeUploads.add(task.id);
    task.status = 'uploading';

    // Tạo toast cho file này
    const toast = this.toastManager.createToast(task);

    try {
      await this.uploadSingleFile(task, (progress) => {
        // Cập nhật progress cho task
        task.progress = progress.percentage;
        task.speed = progress.speed;
        task.remainingTime = progress.remainingTime;

        // Cập nhật toast
        this.toastManager.updateToast(toast.id, {
          progress: progress.percentage,
          speed: progress.speed,
          remainingTime: progress.remainingTime
        });
      });

      // Upload thành công
      task.status = 'completed';
      this.toastManager.markSuccess(toast.id);
      
    } catch (error) {
      // Upload thất bại
      task.status = 'failed';
      task.error = error.message;
      this.toastManager.markError(toast.id, error.message);
      
      // Có thể retry
      if (task.retryCount < 3) {
        setTimeout(() => {
          this.retryUpload(task);
        }, 2000);
      }
    } finally {
      this.activeUploads.delete(task.id);
    }
  }

  private async uploadSingleFile(
    task: UploadTask,
    onProgress: (progress: UploadProgress) => void
  ): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append('file', task.file);

    // Tính toán progress với thời gian
    let startTime = Date.now();
    let loadedBytes = 0;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const currentTime = Date.now();
          const elapsedTime = (currentTime - startTime) / 1000;
          
          // Tính speed (bytes per second)
          const speed = e.loaded / elapsedTime;
          
          // Tính remaining time
          const remainingBytes = e.total - e.loaded;
          const remainingTime = remainingBytes / speed;

          onProgress({
            percentage: Math.round((e.loaded / e.total) * 100),
            loaded: e.loaded,
            total: e.total,
            speed,
            remainingTime
          });
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error occurred'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      // Setup abort
      task.abortController?.signal.addEventListener('abort', () => {
        xhr.abort();
      });

      xhr.open('POST', '/api/upload/single');
      xhr.send(formData);
    });
  }

  // Pause/Resume/Cancel methods
  pauseUpload(taskId: string): void {
    const task = this.findTask(taskId);
    if (task) {
      task.abortController?.abort();
      task.status = 'paused';
    }
  }

  resumeUpload(taskId: string): void {
    const task = this.findTask(taskId);
    if (task && task.status === 'paused') {
      task.abortController = new AbortController();
      this.queue.unshift(task); // Đưa lên đầu queue
    }
  }

  cancelUpload(taskId: string): void {
    const task = this.findTask(taskId);
    if (task) {
      task.abortController?.abort();
      task.status = 'failed';
      this.toastManager.removeToast(taskId);
    }
  }

  retryUpload(task: UploadTask): void {
    task.retryCount++;
    task.status = 'pending';
    task.progress = 0;
    task.abortController = new AbortController();
    this.queue.unshift(task);
  }
}
```

### Toast Manager System

```typescript
// components/upload/UploadToastManager.tsx
export class UploadToastManager {
  private toasts = new Map<string, UploadToast>();
  private container: HTMLElement;

  constructor() {
    this.createContainer();
  }

  createToast(task: UploadTask): UploadToast {
    const toast: UploadToast = {
      id: `toast-${task.id}`,
      fileId: task.id,
      fileName: task.file.name,
      status: 'uploading',
      progress: 0,
      speed: 0,
      remainingTime: 0,
      autoHide: false,
      hideDelay: 3000
    };

    this.toasts.set(toast.id, toast);
    this.renderToast(toast);
    return toast;
  }

  updateToast(toastId: string, updates: Partial<UploadToast>): void {
    const toast = this.toasts.get(toastId);
    if (toast) {
      Object.assign(toast, updates);
      this.renderToast(toast);
    }
  }

  markSuccess(toastId: string): void {
    this.updateToast(toastId, {
      status: 'completed',
      progress: 100,
      autoHide: true
    });

    // Auto-hide sau 3 giây
    setTimeout(() => {
      this.removeToast(toastId);
    }, 3000);
  }

  markError(toastId: string, error: string): void {
    this.updateToast(toastId, {
      status: 'failed',
      error,
      autoHide: false // Không auto-hide để user có thể retry
    });
  }

  removeToast(toastId: string): void {
    const element = document.getElementById(toastId);
    if (element) {
      element.classList.add('slide-out');
      setTimeout(() => {
        element.remove();
        this.toasts.delete(toastId);
      }, 300);
    }
  }

  private renderToast(toast: UploadToast): void {
    const existing = document.getElementById(toast.id);
    if (existing) {
      // Update existing toast
      this.updateToastElement(existing, toast);
    } else {
      // Create new toast
      const element = this.createToastElement(toast);
      this.container.appendChild(element);
      
      // Animate in
      setTimeout(() => {
        element.classList.add('slide-in');
      }, 10);
    }
  }

  private createToastElement(toast: UploadToast): HTMLElement {
    const div = document.createElement('div');
    div.id = toast.id;
    div.className = `upload-toast ${toast.status}`;
    
    this.updateToastElement(div, toast);
    return div;
  }

  private updateToastElement(element: HTMLElement, toast: UploadToast): void {
    element.innerHTML = this.getToastHTML(toast);
    
    // Attach event listeners
    this.attachEventListeners(element, toast);
  }

  private getToastHTML(toast: UploadToast): string {
    const icon = this.getStatusIcon(toast.status);
    const progressBar = toast.status === 'uploading' 
      ? this.getProgressBar(toast.progress)
      : '';
    const actions = this.getActions(toast);
    const details = this.getDetails(toast);

    return `
      <div class="toast-header">
        <span class="icon">${icon}</span>
        <span class="filename">${toast.fileName}</span>
        <button class="close-btn" data-action="close">×</button>
      </div>
      ${progressBar}
      <div class="toast-details">${details}</div>
      ${actions}
    `;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'uploading': return '📤';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '📁';
    }
  }

  private getProgressBar(progress: number): string {
    return `
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
    `;
  }

  private getDetails(toast: UploadToast): string {
    switch (toast.status) {
      case 'uploading':
        return `${toast.progress}% • ${this.formatSpeed(toast.speed)} • ${this.formatTime(toast.remainingTime)} left`;
      case 'completed':
        return `Upload completed successfully`;
      case 'failed':
        return `Error: ${toast.error}`;
      default:
        return '';
    }
  }

  private getActions(toast: UploadToast): string {
    switch (toast.status) {
      case 'uploading':
        return `
          <div class="toast-actions">
            <button data-action="pause" data-file-id="${toast.fileId}">Pause</button>
            <button data-action="cancel" data-file-id="${toast.fileId}">Cancel</button>
          </div>
        `;
      case 'failed':
        return `
          <div class="toast-actions">
            <button data-action="retry" data-file-id="${toast.fileId}">Retry</button>
            <button data-action="remove" data-file-id="${toast.fileId}">Remove</button>
          </div>
        `;
      default:
        return '';
    }
  }

  private attachEventListeners(element: HTMLElement, toast: UploadToast): void {
    element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      const fileId = target.dataset.fileId;

      switch (action) {
        case 'close':
          this.removeToast(toast.id);
          break;
        case 'pause':
          this.uploadService.pauseUpload(fileId!);
          break;
        case 'cancel':
          this.uploadService.cancelUpload(fileId!);
          break;
        case 'retry':
          this.uploadService.retryUpload(fileId!);
          break;
        case 'remove':
          this.removeToast(toast.id);
          break;
      }
    });
  }

  private formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1048576) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / 1048576).toFixed(1)} MB/s`;
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'upload-toast-container';
    this.container.className = 'fixed top-4 right-4 z-50 space-y-2';
    document.body.appendChild(this.container);
  }
}
```

### React Component Integration

```tsx
// components/upload/FileUploadWithToasts.tsx
export const FileUploadWithToasts: React.FC<FileUploadProps> = (props) => {
  const uploadService = new ParallelUploadService();

  const handleFilesSelected = async (files: File[]) => {
    // Validate files
    const validFiles = files.filter(file => validateFile(file));
    
    if (validFiles.length === 0) {
      toast.error('No valid files to upload');
      return;
    }

    // Show summary toast
    toast.info(`Starting upload of ${validFiles.length} files...`);

    // Start parallel upload với toast tracking
    await uploadService.uploadFiles(validFiles);

    // Callback to parent
    props.onUpload?.(validFiles);
  };

  return (
    <div>
      <FileUpload {...props} onFilesSelected={handleFilesSelected} />
      
      {/* Upload Toast Container - Automatically managed */}
      <div id="upload-toast-container" />
    </div>
  );
};
```

---

## 🎨 CSS Styles

```css
/* upload-toasts.css */

/* Toast container */
.upload-toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 400px;
}

/* Individual toast */
.upload-toast {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  padding: 1rem;
  border-left: 4px solid #3b82f6;
  transition: all 0.3s ease;
  transform: translateX(100%);
  opacity: 0;
}

.upload-toast.slide-in {
  transform: translateX(0);
  opacity: 1;
}

.upload-toast.slide-out {
  transform: translateX(100%);
  opacity: 0;
}

/* Status variants */
.upload-toast.uploading {
  border-left-color: #3b82f6; /* Blue */
}

.upload-toast.completed {
  border-left-color: #10b981; /* Green */
}

.upload-toast.failed {
  border-left-color: #ef4444; /* Red */
}

/* Toast header */
.toast-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.toast-header .icon {
  font-size: 1.25rem;
  margin-right: 0.5rem;
}

.toast-header .filename {
  flex: 1;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-header .close-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: colors 0.2s;
}

.toast-header .close-btn:hover {
  color: #6b7280;
  background-color: #f3f4f6;
}

/* Progress bar */
.progress-bar {
  width: 100%;
  height: 6px;
  background-color: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  border-radius: 3px;
  transition: width 0.3s ease;
  position: relative;
}

/* Animated progress bar */
.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: progress-shine 1.5s infinite;
}

@keyframes progress-shine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Toast details */
.toast-details {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

/* Toast actions */
.toast-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.toast-actions button {
  padding: 0.25rem 0.75rem;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toast-actions button:hover {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.toast-actions button[data-action="retry"] {
  background-color: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.toast-actions button[data-action="retry"]:hover {
  background-color: #1d4ed8;
}

.toast-actions button[data-action="cancel"],
.toast-actions button[data-action="remove"] {
  color: #dc2626;
  border-color: #fecaca;
}

.toast-actions button[data-action="cancel"]:hover,
.toast-actions button[data-action="remove"]:hover {
  background-color: #fef2f2;
  border-color: #dc2626;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .upload-toast-container {
    left: 1rem;
    right: 1rem;
    max-width: none;
  }
  
  .upload-toast {
    padding: 0.75rem;
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .upload-toast {
    background: #374151;
    color: white;
  }
  
  .toast-header .filename {
    color: #f3f4f6;
  }
  
  .toast-details {
    color: #9ca3af;
  }
  
  .toast-actions button {
    background: #4b5563;
    color: #f3f4f6;
    border-color: #6b7280;
  }
}
```

---

## 🔧 Configuration Options

```typescript
interface ParallelUploadConfig {
  maxConcurrent: number; // 3-5 files đồng thời
  retryAttempts: number; // Số lần thử lại
  retryDelay: number; // Delay giữa các lần retry
  chunkSize: number; // Cho large files
  toastPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  toastDuration: {
    success: number; // 3000ms
    error: number; // 0 (không auto-hide)
    uploading: number; // 0 (không auto-hide)
  };
  showSpeed: boolean; // Hiển thị upload speed
  showRemainingTime: boolean; // Hiển thị thời gian còn lại
  allowPause: boolean; // Cho phép pause upload
  allowCancel: boolean; // Cho phép cancel upload
}
```

---

## 📊 Performance Considerations

### Optimization Strategies
1. **Connection Pool**: Giới hạn số connection đồng thời
2. **Bandwidth Management**: Tự động điều chỉnh speed
3. **Memory Management**: Chunked upload cho large files
4. **Network Retry**: Intelligent retry với exponential backoff
5. **Toast Cleanup**: Auto-remove old toasts

### Network Monitoring
```typescript
// Monitor network speed và adjust concurrent uploads
class NetworkMonitor {
  adjustConcurrency(networkSpeed: number) {
    if (networkSpeed < 1_000_000) { // < 1MB/s
      return 2; // Giảm xuống 2 files
    } else if (networkSpeed < 5_000_000) { // < 5MB/s
      return 3; // 3 files
    } else {
      return 5; // 5 files cho connection nhanh
    }
  }
}
```

---

## ✅ Features Summary

### ✅ Parallel Upload Features:
- **Song song upload** 3-5 files cùng lúc
- **Queue management** thông minh
- **Automatic retry** với exponential backoff
- **Pause/Resume** individual files
- **Cancel** uploads
- **Network speed adaptation**

### ✅ Toast Notification Features:
- **Real-time progress** cho từng file
- **Upload speed** hiển thị (MB/s)
- **Time remaining** estimation
- **Success notifications** (auto-hide 3s)
- **Error notifications** (persistent with retry)
- **Action buttons** (Pause, Cancel, Retry)
- **Mobile responsive** design
- **Dark mode** support
- **Smooth animations** (slide in/out)

### ✅ User Experience:
- **Non-blocking** - user có thể làm việc khác
- **Transparent** - thấy progress của tất cả files
- **Control** - có thể pause/cancel/retry
- **Feedback** - biết ngay kết quả success/error
- **Performance** - tối ưu bandwidth và memory

Hệ thống này cho phép upload hàng chục file cùng lúc với experience rất smooth và professional!