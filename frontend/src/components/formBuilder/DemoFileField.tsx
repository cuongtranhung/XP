/**
 * Demo File Upload Field - UI Only (No Authentication Required)
 * For testing Form Builder file upload interface without backend
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Image as ImageIcon, X, CheckCircle, AlertCircle } from 'lucide-react';
import { FormField } from '../../types/formBuilder';

interface DemoFileFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  onBlur?: () => void;
  error?: string;
  preview?: boolean;
}

interface DemoFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'selected' | 'uploading' | 'complete' | 'error';
  lastModified: number;
}

const DemoFileField: React.FC<DemoFileFieldProps> = ({
  field,
  value,
  onChange,
  onBlur,
  error,
  preview = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get selected files from value
  const selectedFiles: DemoFile[] = Array.isArray(value) ? value : (value ? [value] : []);
  
  // File type restrictions based on field settings
  const isImageOnly = field.fieldType === 'image';
  const maxSize = field.validation?.maxSize || (100 * 1024 * 1024); // 100MB default
  
  const allowedTypes = isImageOnly 
    ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    : [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'video/mp4', 'video/quicktime'
      ];

  const acceptString = isImageOnly ? 'image/*' : allowedTypes.join(',');

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size exceeds ${(maxSize / 1024 / 1024).toFixed(1)}MB limit`;
    }
    
    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed`;
    }
    
    return null;
  };

  const createDemoFile = (file: File): DemoFile => ({
    id: Math.random().toString(36).substring(7),
    name: file.name,
    size: file.size,
    type: file.type,
    status: 'selected',
    lastModified: file.lastModified
  });

  const handleFileSelect = useCallback(async (files: FileList | File[]) => {
    if (preview) return;
    
    const fileList = Array.from(files);
    setUploadError('');
    
    const validFiles: DemoFile[] = [];
    
    for (const file of fileList) {
      const validationError = validateFile(file);
      if (validationError) {
        setUploadError(validationError);
        return;
      }
      
      validFiles.push(createDemoFile(file));
    }

    // Simulate file processing
    const newFiles = field.validation?.max === 1 
      ? validFiles.slice(0, 1) // Single file
      : [...selectedFiles, ...validFiles].slice(0, field.validation?.max || 10); // Multiple files
    
    // Simulate upload progress
    const filesWithProgress = newFiles.map(file => ({ ...file, status: 'uploading' as const }));
    onChange?.(filesWithProgress.length === 1 ? filesWithProgress[0] : filesWithProgress);
    
    // Simulate completion after delay
    setTimeout(() => {
      const completedFiles = newFiles.map(file => ({ ...file, status: 'complete' as const }));
      onChange?.(completedFiles.length === 1 ? completedFiles[0] : completedFiles);
    }, 1500);
    
    onBlur?.();
  }, [field, selectedFiles, onChange, onBlur, preview, maxSize, allowedTypes]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
    }
  };

  const handleRemoveFile = (fileToRemove: DemoFile) => {
    if (preview) return;
    
    const newFiles = selectedFiles.filter(file => file.id !== fileToRemove.id);
    onChange?.(newFiles.length === 1 ? newFiles[0] : (newFiles.length === 0 ? null : newFiles));
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  const getStatusIcon = (file: DemoFile) => {
    switch (file.status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'uploading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      {(selectedFiles.length === 0 || field.validation?.max !== 1) && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            dragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !preview && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptString}
            multiple={field.validation?.max !== 1}
            onChange={handleInputChange}
            disabled={preview}
            className="hidden"
          />
          
          <div>
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-1">
              {isImageOnly ? 'Drop images here or click to select' : 'Drop files here or click to select'}
            </p>
            <p className="text-xs text-gray-500">
              Max size: {(maxSize / 1024 / 1024).toFixed(1)}MB
              {field.validation?.max && ` • Max files: ${field.validation.max}`}
            </p>
            {isImageOnly ? (
              <p className="text-xs text-gray-500">Supports: JPEG, PNG, GIF, WebP</p>
            ) : (
              <p className="text-xs text-gray-500">Supports: Images, PDF, Word, Excel, Video</p>
            )}
          </div>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
            <p className="text-sm text-red-600">{uploadError}</p>
          </div>
        </div>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            Selected Files ({selectedFiles.length})
          </h4>
          {selectedFiles.map((file) => (
            <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center space-x-3">
                {getFileIcon(file.type)}
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB • {file.status}
                    {file.status === 'uploading' && ' (simulated)'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusIcon(file)}
                {!preview && (
                  <button
                    onClick={() => handleRemoveFile(file)}
                    className="p-1 text-red-500 hover:text-red-600 transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Field Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Demo Mode Badge */}
      <div className="flex justify-end">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
          🧪 Demo Mode (No Upload)
        </span>
      </div>
    </div>
  );
};

export default DemoFileField;