/**
 * MEGA S4 File Upload Field for Form Builder
 * Integrates with existing Form Builder infrastructure
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Image as ImageIcon, X, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { FormField } from '../../types/formBuilder';

interface MegaS4FileFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  onBlur?: () => void;
  error?: string;
  preview?: boolean;
  authToken?: string;
}

interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileCategory: string;
  validationStatus: string;
  virusScanStatus: string;
  uploadDate: string;
  downloadUrl?: string;
}

interface UploadResult {
  success: boolean;
  attachment?: UploadedFile;
  error?: string;
}

const MegaS4FileField: React.FC<MegaS4FileFieldProps> = ({
  field,
  value,
  onChange,
  onBlur,
  error,
  preview = false,
  authToken
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get uploaded files from value
  const uploadedFiles: UploadedFile[] = Array.isArray(value) ? value : (value ? [value] : []);
  
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

  const uploadFile = async (file: File): Promise<UploadResult> => {
    if (!authToken) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      // For now, use a temporary form ID and field key
      // In real implementation, these would come from form context
      const tempFormId = '550e8400-e29b-41d4-a716-446655440000'; // Placeholder UUID
      const fieldKey = field.fieldKey || 'file-upload';

      const response = await fetch(`http://localhost:5000/api/form-attachments/form/${tempFormId}/field/${fieldKey}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData
      });

      const result = await response.json();
      
      if (!response.ok) {
        return { success: false, error: result.error || 'Upload failed' };
      }

      return { success: true, attachment: result.attachment };
    } catch (error) {
      console.error('Upload error:', error);
      return { success: false, error: 'Network error occurred' };
    }
  };

  const handleFileSelect = useCallback(async (files: FileList | File[]) => {
    if (preview) return;
    
    const fileList = Array.from(files);
    setUploadError('');
    
    for (const file of fileList) {
      const validationError = validateFile(file);
      if (validationError) {
        setUploadError(validationError);
        return;
      }

      setUploading(true);
      
      const result = await uploadFile(file);
      
      if (result.success && result.attachment) {
        // Update the field value
        const newFiles = field.validation?.max === 1 
          ? [result.attachment] // Single file
          : [...uploadedFiles, result.attachment]; // Multiple files
        
        onChange?.(newFiles.length === 1 ? newFiles[0] : newFiles);
      } else {
        setUploadError(result.error || 'Upload failed');
      }
    }
    
    setUploading(false);
    onBlur?.();
  }, [field, uploadedFiles, onChange, onBlur, preview, authToken, maxSize, allowedTypes]);

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

  const handleRemoveFile = (fileToRemove: UploadedFile) => {
    if (preview) return;
    
    const newFiles = uploadedFiles.filter(file => file.id !== fileToRemove.id);
    onChange?.(newFiles.length === 1 ? newFiles[0] : (newFiles.length === 0 ? null : newFiles));
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  const getStatusIcon = (file: UploadedFile) => {
    if (file.validationStatus === 'validated' && file.virusScanStatus === 'clean') {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (file.validationStatus === 'rejected' || file.virusScanStatus === 'infected') {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      {(uploadedFiles.length === 0 || field.validation?.max !== 1) && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            dragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !preview && !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptString}
            multiple={field.validation?.max !== 1}
            onChange={handleInputChange}
            disabled={preview || uploading}
            className="hidden"
          />
          
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <p className="text-sm text-gray-600">Uploading to MEGA S4...</p>
            </div>
          ) : (
            <div>
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">
                {isImageOnly ? 'Drop images here or click to upload' : 'Drop files here or click to upload'}
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
          )}
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

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            Uploaded Files ({uploadedFiles.length})
          </h4>
          {uploadedFiles.map((file) => (
            <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center space-x-3">
                {getFileIcon(file.mimeType)}
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.originalName}</p>
                  <p className="text-xs text-gray-500">
                    {(file.fileSize / 1024).toFixed(1)} KB • {file.fileCategory}
                    • Uploaded {new Date(file.uploadDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusIcon(file)}
                {file.downloadUrl && (
                  <button
                    onClick={() => window.open(file.downloadUrl, '_blank')}
                    className="p-1 text-blue-500 hover:text-blue-600 transition-colors"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
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

      {/* MEGA S4 Badge */}
      <div className="flex justify-end">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
          🛡️ MEGA S4 Storage
        </span>
      </div>
    </div>
  );
};

export default MegaS4FileField;