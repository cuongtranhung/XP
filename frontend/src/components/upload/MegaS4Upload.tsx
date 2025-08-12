import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { 
  Upload, 
  X, 
  File, 
  Image, 
  FileText, 
  Film, 
  Music, 
  Archive, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

interface UploadedFile {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  etag?: string;
}

interface FileWithProgress extends File {
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  uploadedData?: UploadedFile;
}

interface MegaS4UploadProps {
  variant?: 'dropzone' | 'button' | 'inline' | 'minimal';
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: Record<string, string[]>;
  uploadMethod?: 'direct' | 'presigned' | 'auto';
  onUploadComplete?: (files: UploadedFile[]) => void;
  onFileRemove?: (key: string) => void;
  className?: string;
}

const MegaS4Upload: React.FC<MegaS4UploadProps> = ({
  variant = 'dropzone',
  multiple = true,
  maxFiles = 10,
  maxSize = 104857600, // 100MB default
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  },
  uploadMethod = 'auto',
  onUploadComplete,
  onFileRemove,
  className = '',
}) => {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Generate unique ID for file tracking
  const generateFileId = () => `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Get file icon based on MIME type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />;
    if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
    if (mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-purple-500" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-green-500" />;
    if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive className="w-5 h-5 text-yellow-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  };

  // Upload file using direct method (through backend)
  const uploadDirect = async (file: FileWithProgress): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      `${API_BASE_URL}/api/mega-s4/upload/single`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          
          setFiles(prev => prev.map(f => 
            f.id === file.id 
              ? { ...f, progress, status: 'uploading' as const }
              : f
          ));
        },
      }
    );

    if (response.data.success) {
      return response.data.file;
    }
    throw new Error(response.data.error || 'Upload failed');
  };

  // Upload file using presigned URL (direct to S3)
  const uploadPresigned = async (file: FileWithProgress): Promise<UploadedFile> => {
    // First, get presigned URL from backend
    const presignedResponse = await axios.post(`${API_BASE_URL}/api/mega-s4/upload/presigned-url`, {
      fileName: file.name,
      mimeType: file.type,
      metadata: {
        originalName: file.name,
        size: file.size.toString(),
      },
    });

    if (!presignedResponse.data.success) {
      throw new Error('Failed to get upload URL');
    }

    const { uploadUrl, key } = presignedResponse.data;

    // Upload directly to MEGA S4
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent) => {
        const progress = progressEvent.total
          ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
          : 0;
        
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { ...f, progress, status: 'uploading' as const }
            : f
        ));
      },
    });

    // Get download URL
    const downloadUrlResponse = await axios.get(`${API_BASE_URL}/api/mega-s4/download-url/${key}`);
    
    return {
      key,
      url: downloadUrlResponse.data.downloadUrl,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
    };
  };

  // Choose upload method based on file size and configuration
  const uploadFile = async (file: FileWithProgress): Promise<UploadedFile> => {
    try {
      let uploadedFile: UploadedFile;

      if (uploadMethod === 'presigned' || (uploadMethod === 'auto' && file.size > 5242880)) {
        // Use presigned URL for files > 5MB or when explicitly set
        uploadedFile = await uploadPresigned(file);
      } else {
        // Use direct upload for smaller files
        uploadedFile = await uploadDirect(file);
      }

      // Update file status
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, progress: 100, status: 'completed' as const, uploadedData: uploadedFile }
          : f
      ));

      return uploadedFile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, status: 'failed' as const, error: errorMessage }
          : f
      ));

      throw error;
    }
  };

  // Handle file drop/selection
  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    rejectedFiles.forEach(rejection => {
      const error = rejection.errors[0];
      if (error.code === 'file-too-large') {
        toast.error(`${rejection.file.name} is too large. Max size is ${formatFileSize(maxSize)}`);
      } else if (error.code === 'file-invalid-type') {
        toast.error(`${rejection.file.name} has an invalid file type`);
      } else {
        toast.error(`${rejection.file.name} was rejected: ${error.message}`);
      }
    });

    // Convert to FileWithProgress
    const newFiles: FileWithProgress[] = acceptedFiles.map(file => ({
      ...file,
      id: generateFileId(),
      progress: 0,
      status: 'pending' as const,
    }));

    // Check max files limit
    if (files.length + newFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Add files to state
    setFiles(prev => [...prev, ...newFiles]);
    
    // Start uploading
    setIsUploading(true);
    
    try {
      const uploadPromises = newFiles.map(file => uploadFile(file));
      const uploaded = await Promise.all(uploadPromises);
      
      setUploadedFiles(prev => [...prev, ...uploaded]);
      
      if (onUploadComplete) {
        onUploadComplete(uploaded);
      }
      
      toast.success(`Successfully uploaded ${uploaded.length} file(s)`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Some files failed to upload');
    } finally {
      setIsUploading(false);
    }
  }, [files, maxFiles, maxSize, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple,
    disabled: isUploading,
  });

  // Remove file from list
  const removeFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file?.uploadedData && onFileRemove) {
      onFileRemove(file.uploadedData.key);
    }
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Render file list
  const renderFileList = () => (
    <div className="mt-6 space-y-3">
      {files.map(file => (
        <div
          key={file.id}
          className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
        >
          {/* File icon */}
          <div className="flex-shrink-0">
            {getFileIcon(file.type)}
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
            <p className="text-xs text-gray-500">
              {formatFileSize(file.size)}
              {file.status === 'uploading' && ` • ${file.progress}%`}
              {file.status === 'completed' && ' • Uploaded'}
              {file.status === 'failed' && ` • ${file.error}`}
            </p>
            
            {/* Progress bar */}
            {file.status === 'uploading' && (
              <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${file.progress}%` }}
                />
              </div>
            )}
          </div>

          {/* Status icon */}
          <div className="flex-shrink-0">
            {file.status === 'pending' && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
            {file.status === 'uploading' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
            {file.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
            {file.status === 'failed' && <AlertCircle className="w-5 h-5 text-red-500" />}
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex gap-1">
            {file.status === 'completed' && file.uploadedData && (
              <>
                <button
                  onClick={() => window.open(file.uploadedData!.url, '_blank')}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="View file"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <a
                  href={file.uploadedData.url}
                  download={file.uploadedData.originalName}
                  className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </a>
              </>
            )}
            <button
              onClick={() => removeFile(file.id)}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  // Render based on variant
  switch (variant) {
    case 'dropzone':
      return (
        <div className={`w-full ${className}`}>
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-xl p-8
              transition-all duration-200 cursor-pointer
              ${isDragActive ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-gray-300 hover:border-gray-400'}
              ${isDragReject ? 'border-red-500 bg-red-50' : ''}
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            {/* Icon */}
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
              
              {/* File info */}
              <div className="mt-4 text-xs text-gray-400">
                <p>Max size: {formatFileSize(maxSize)} per file</p>
                {maxFiles > 1 && <p>Max files: {maxFiles}</p>}
              </div>
            </div>

            {/* Overlay */}
            {isDragActive && (
              <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-xl pointer-events-none" />
            )}
          </div>

          {/* File list */}
          {files.length > 0 && renderFileList()}
        </div>
      );

    case 'button':
      return (
        <div className={className}>
          <button
            {...getRootProps()}
            disabled={isUploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload to MEGA S4
              </>
            )}
          </button>
          {files.length > 0 && renderFileList()}
        </div>
      );

    case 'inline':
      return (
        <button
          {...getRootProps()}
          disabled={isUploading}
          className={`p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 rounded-lg transition-colors ${className}`}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
        </button>
      );

    case 'minimal':
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <div className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
            <span className="text-sm text-gray-500">
              {files.length > 0 
                ? `${files.length} file(s) selected` 
                : 'No files selected'}
            </span>
          </div>
          <button
            {...getRootProps()}
            disabled={isUploading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <input {...getInputProps()} />
            {isUploading ? 'Uploading...' : 'Browse'}
          </button>
        </div>
      );

    default:
      return null;
  }
};

export default MegaS4Upload;