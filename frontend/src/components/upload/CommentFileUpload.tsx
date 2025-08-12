import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, File, Image, FileText, Paperclip, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { UploadToastManager, UploadTask } from './UploadToastManager';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  file?: File; // For local preview before upload
}

interface CommentFileUploadProps {
  onFilesSelected?: (files: File[]) => void;
  onFileUploadComplete?: (file: UploadedFile) => void;
  onFileRemove?: (fileId: string) => void;
  uploadedFiles?: UploadedFile[];
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: string;
  disabled?: boolean;
  className?: string;
  uploadUrl?: string; // Backend upload endpoint
}

export const CommentFileUpload: React.FC<CommentFileUploadProps> = ({
  onFilesSelected,
  onFileUploadComplete,
  onFileRemove,
  uploadedFiles = [],
  maxFiles = 20,
  maxSize = 10 * 1024 * 1024, // 10MB default
  accept = 'image/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx',
  disabled = false,
  className = '',
  uploadUrl = '/api/upload/file' // Default upload endpoint
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const uploadQueueRef = useRef<File[]>([]);
  const currentUploadRef = useRef<XMLHttpRequest | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const currentFileCount = uploadedFiles.length + selectedFiles.length;
    
    // Check max files limit
    if (currentFileCount + fileArray.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    const errors: string[] = [];

    fileArray.forEach(file => {
      // Check file size
      if (file.size > maxSize) {
        errors.push(`${file.name} exceeds ${maxSize / 1024 / 1024}MB limit`);
        return;
      }

      // Check file type if needed
      if (accept && accept !== '*') {
        const acceptedTypes = accept.split(',').map(t => t.trim());
        const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        const isValidType = acceptedTypes.some(type => {
          if (type.includes('*')) {
            // Handle wildcard types like image/*
            const baseType = type.replace('*', '');
            return file.type.startsWith(baseType);
          }
          return file.type === type || fileExtension === type;
        });

        if (!isValidType) {
          errors.push(`${file.name} has invalid file type`);
          return;
        }
      }

      validFiles.push(file);
    });

    // Show errors if any
    if (errors.length > 0) {
      errors.forEach(error => toast.error(error));
    }

    // Add valid files and start sequential upload
    if (validFiles.length > 0) {
      const newFiles = [...selectedFiles, ...validFiles];
      setSelectedFiles(newFiles);
      onFilesSelected?.(newFiles);
      
      // Start parallel upload
      startParallelUpload(validFiles);
    }
  };

  // Start parallel upload process
  const startParallelUpload = async (files: File[]) => {
    if (isUploading) {
      // Add to queue if already uploading
      uploadQueueRef.current.push(...files);
      return;
    }

    try {
      setIsUploading(true);
      
      // Create upload tasks for all files
      const newTasks: UploadTask[] = files.map(file => ({
        id: crypto.randomUUID(),
        file,
        status: 'pending',
        progress: 0,
        speed: 0,
        remainingTime: 0,
        retryCount: 0,
        startTime: Date.now()
      }));

      setUploadTasks(prev => [...prev, ...newTasks]);

      // Process files in parallel (all at once)
      const uploadPromises = newTasks.map(task => uploadSingleFile(task));
      await Promise.all(uploadPromises);

      // Check if there are more files in queue
      if (uploadQueueRef.current.length > 0) {
        const nextBatch = uploadQueueRef.current;
        uploadQueueRef.current = [];
        await startParallelUpload(nextBatch);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Upload single file with progress tracking
  const uploadSingleFile = (task: UploadTask): Promise<void> => {
    return new Promise((resolve) => {
      // Update task status to uploading
      setUploadTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'uploading' } : t
      ));

      const xhr = new XMLHttpRequest();
      currentUploadRef.current = xhr;
      
      const formData = new FormData();
      formData.append('file', task.file);

      let startTime = Date.now();
      let lastLoaded = 0;

      // Upload progress handler
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const currentTime = Date.now();
          const elapsedTime = (currentTime - startTime) / 1000; // in seconds
          const currentLoaded = e.loaded;
          
          // Calculate speed (bytes per second)
          const speed = currentLoaded / elapsedTime;
          
          // Calculate remaining time
          const remainingBytes = e.total - currentLoaded;
          const remainingTime = remainingBytes / speed;

          // Update task progress
          setUploadTasks(prev => prev.map(t => 
            t.id === task.id 
              ? { 
                  ...t, 
                  progress: Math.round((e.loaded / e.total) * 100),
                  speed,
                  remainingTime,
                  uploadedBytes: currentLoaded
                }
              : t
          ));
        }
      });

      // Upload complete handler
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            
            // Mark as completed
            setUploadTasks(prev => prev.map(t => 
              t.id === task.id 
                ? { ...t, status: 'completed', progress: 100 }
                : t
            ));

            // Remove from selected files
            setSelectedFiles(prev => prev.filter(f => f.name !== task.file.name));

            // Notify parent component
            if (onFileUploadComplete) {
              onFileUploadComplete({
                id: response.id || task.id,
                name: task.file.name,
                size: task.file.size,
                type: task.file.type,
                url: response.url || response.path
              });
            }

            // Auto-remove completed task after 3 seconds
            setTimeout(() => {
              setUploadTasks(prev => prev.filter(t => t.id !== task.id));
            }, 3000);

          } catch (error) {
            handleUploadError(task, 'Failed to parse server response');
          }
        } else {
          // Handle specific error cases
          let errorMessage = `Upload failed: ${xhr.statusText}`;
          
          if (xhr.status === 401) {
            errorMessage = 'Authentication required. Please log in again.';
          } else if (xhr.status === 413) {
            errorMessage = 'File too large';
          } else if (xhr.status >= 500) {
            errorMessage = 'Server error. Please try again.';
          }
          
          console.error('Upload failed:', xhr.status, xhr.statusText, xhr.responseText);
          handleUploadError(task, errorMessage);
        }
        resolve();
      });

      // Error handler
      xhr.addEventListener('error', () => {
        console.error('Upload XHR error:', xhr.status, xhr.statusText, xhr.responseText);
        handleUploadError(task, `Network error occurred (${xhr.status})`);
        resolve();
      });

      // Abort handler
      xhr.addEventListener('abort', () => {
        setUploadTasks(prev => prev.map(t => 
          t.id === task.id 
            ? { ...t, status: 'paused' }
            : t
        ));
        resolve();
      });

      // Send request with authentication
      xhr.open('POST', uploadUrl);
      
      // Add authentication header
      const token = localStorage.getItem('auth_token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        console.log('Upload with auth token:', token.substring(0, 20) + '...');
      } else {
        console.warn('No auth token found for upload');
      }
      
      xhr.send(formData);
    });
  };

  // Handle upload error
  const handleUploadError = (task: UploadTask, error: string) => {
    setUploadTasks(prev => prev.map(t => 
      t.id === task.id 
        ? { ...t, status: 'failed', error }
        : t
    ));
  };

  // Control functions
  const pauseUpload = (taskId: string) => {
    const task = uploadTasks.find(t => t.id === taskId);
    if (task && task.status === 'uploading' && currentUploadRef.current) {
      currentUploadRef.current.abort();
      setUploadTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'paused' } : t
      ));
    }
  };

  const resumeUpload = (taskId: string) => {
    const task = uploadTasks.find(t => t.id === taskId);
    if (task && task.status === 'paused') {
      setUploadTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'pending', progress: 0 } : t
      ));
      uploadSingleFile(task);
    }
  };

  const cancelUpload = (taskId: string) => {
    if (currentUploadRef.current) {
      currentUploadRef.current.abort();
    }
    setUploadTasks(prev => prev.filter(t => t.id !== taskId));
    
    const task = uploadTasks.find(t => t.id === taskId);
    if (task) {
      setSelectedFiles(prev => prev.filter(f => f.name !== task.file.name));
    }
  };

  const retryUpload = (taskId: string) => {
    const task = uploadTasks.find(t => t.id === taskId);
    if (task && task.status === 'failed' && task.retryCount < 3) {
      const updatedTask = {
        ...task,
        status: 'pending' as const,
        progress: 0,
        retryCount: task.retryCount + 1,
        error: undefined
      };
      
      setUploadTasks(prev => prev.map(t => 
        t.id === taskId ? updatedTask : t
      ));
      
      uploadSingleFile(updatedTask);
    }
  };

  const removeToast = (taskId: string) => {
    setUploadTasks(prev => prev.filter(t => t.id !== taskId));
  };


  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (!disabled) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Remove selected file (before upload)
  const removeSelectedFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected?.(newFiles);
  };

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type === 'application/pdf') return <FileText className="w-4 h-4 text-red-500" />;
    return <File className="w-4 h-4" />;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div className={`comment-file-upload ${className}`}>
        {/* Drop zone / File input */}
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-3 transition-colors
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={(e) => {
            e.stopPropagation();
            console.log('Upload area clicked - disabled:', disabled, 'isUploading:', isUploading);
            if (!disabled && !isUploading) {
              const fileInput = document.getElementById('comment-file-input');
              console.log('File input element:', fileInput);
              fileInput?.click();
            } else {
              console.log('Click blocked - disabled or uploading');
            }
          }}
        >
          <input
            id="comment-file-input"
            type="file"
            multiple
            accept={accept}
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={disabled || isUploading}
            className="hidden"
          />
          
          <div className="flex items-center justify-center space-x-2 text-sm">
            <Paperclip className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">
              {isUploading ? 'Uploading files...' : 'Click to attach files or drag & drop'}
            </span>
            <span className="text-gray-400">
              (Max {maxFiles} files, {maxSize / 1024 / 1024}MB each)
            </span>
          </div>
        </div>

        {/* Selected files (before upload) */}
        {selectedFiles.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-500 font-medium mb-1">Files to upload ({selectedFiles.length}):</div>
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {selectedFiles.map((file, index) => {
              const isUploading = uploadTasks.some(t => t.file.name === file.name && t.status === 'uploading');
              return (
                <div
                  key={`selected-${index}`}
                  className={`flex items-center justify-between p-2 rounded-md ${
                    isUploading ? 'bg-blue-100' : 'bg-blue-50'
                  }`}
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {getFileIcon(file.type)}
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                    {isUploading && <span className="text-xs text-blue-600">Uploading...</span>}
                  </div>
                  {!isUploading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSelectedFile(index);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* Uploaded files */}
        {uploadedFiles.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-500 font-medium mb-1">Attached files ({uploadedFiles.length}):</div>
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 bg-green-50 rounded-md"
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  {getFileIcon(file.type)}
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {file.name}
                  </a>
                  <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                </div>
                {onFileRemove && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileRemove(file.id);
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            </div>
          </div>
        )}

        {/* File type hint */}
        <div className="mt-1 text-xs text-gray-400">
          Supported: Images, PDFs, Documents (DOC, XLS, TXT)
        </div>
      </div>

      {/* Toast Manager */}
      <UploadToastManager
        tasks={uploadTasks}
        onPause={pauseUpload}
        onResume={resumeUpload}
        onCancel={cancelUpload}
        onRetry={retryUpload}
        onRemove={removeToast}
      />
    </>
  );
};