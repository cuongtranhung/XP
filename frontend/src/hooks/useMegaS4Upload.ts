import { useState, useCallback } from 'react';
import axios, { AxiosProgressEvent } from 'axios';
import toast from 'react-hot-toast';

interface UploadedFile {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  etag?: string;
}

interface UploadProgress {
  [fileId: string]: number;
}

interface UploadOptions {
  method?: 'direct' | 'presigned' | 'auto';
  maxSize?: number;
  allowedTypes?: string[];
  onProgress?: (fileId: string, progress: number) => void;
  onSuccess?: (file: UploadedFile) => void;
  onError?: (error: Error, fileName: string) => void;
}

export const useMegaS4Upload = (options: UploadOptions = {}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<{ [fileId: string]: string }>({});

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const {
    method = 'auto',
    maxSize = 104857600, // 100MB
    allowedTypes = [],
    onProgress,
    onSuccess,
    onError,
  } = options;

  // Validate file
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check size
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size ${(file.size / 1048576).toFixed(2)}MB exceeds maximum ${(maxSize / 1048576).toFixed(2)}MB`,
      };
    }

    // Check type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`,
      };
    }

    return { valid: true };
  };

  // Upload using direct method
  const uploadDirect = async (
    file: File,
    fileId: string,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
  ): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      `${API_BASE_URL}/api/mega-s4/upload/single`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
      }
    );

    if (response.data.success) {
      return response.data.file;
    }
    throw new Error(response.data.error || 'Upload failed');
  };

  // Upload using presigned URL
  const uploadPresigned = async (
    file: File,
    fileId: string,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
  ): Promise<UploadedFile> => {
    // Get presigned URL
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

    // Upload to MEGA S4
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress,
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

  // Upload single file
  const uploadFile = useCallback(async (file: File): Promise<UploadedFile | null> => {
    const fileId = `${file.name}-${Date.now()}`;

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      const error = new Error(validation.error);
      setErrors(prev => ({ ...prev, [fileId]: validation.error! }));
      if (onError) onError(error, file.name);
      toast.error(validation.error!);
      return null;
    }

    setIsUploading(true);
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fileId];
      return newErrors;
    });

    try {
      const progressHandler = (progressEvent: AxiosProgressEvent) => {
        const progress = progressEvent.total
          ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
          : 0;
        
        setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
        if (onProgress) onProgress(fileId, progress);
      };

      let uploadedFile: UploadedFile;

      // Choose upload method
      if (method === 'presigned' || (method === 'auto' && file.size > 5242880)) {
        uploadedFile = await uploadPresigned(file, fileId, progressHandler);
      } else {
        uploadedFile = await uploadDirect(file, fileId, progressHandler);
      }

      setUploadedFiles(prev => [...prev, uploadedFile]);
      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
      
      if (onSuccess) onSuccess(uploadedFile);
      toast.success(`${file.name} uploaded successfully`);
      
      return uploadedFile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setErrors(prev => ({ ...prev, [fileId]: errorMessage }));
      
      if (onError) onError(error as Error, file.name);
      toast.error(`Failed to upload ${file.name}: ${errorMessage}`);
      
      return null;
    } finally {
      setIsUploading(false);
      // Clean up progress after a delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }, 2000);
    }
  }, [method, maxSize, allowedTypes, onProgress, onSuccess, onError]);

  // Upload multiple files
  const uploadFiles = useCallback(async (files: File[]): Promise<UploadedFile[]> => {
    const uploadPromises = files.map(file => uploadFile(file));
    const results = await Promise.all(uploadPromises);
    return results.filter((result): result is UploadedFile => result !== null);
  }, [uploadFile]);

  // Delete file from MEGA S4
  const deleteFile = useCallback(async (key: string): Promise<boolean> => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/mega-s4/delete/${key}`);
      
      if (response.data.success) {
        setUploadedFiles(prev => prev.filter(f => f.key !== key));
        toast.success('File deleted successfully');
        return true;
      }
      
      throw new Error(response.data.error || 'Delete failed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete failed';
      toast.error(`Failed to delete file: ${errorMessage}`);
      return false;
    }
  }, []);

  // Get download URL
  const getDownloadUrl = useCallback(async (key: string, expiresIn: number = 3600): Promise<string | null> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/mega-s4/download-url/${key}`, {
        params: { expiresIn },
      });

      if (response.data.success) {
        return response.data.downloadUrl;
      }

      throw new Error(response.data.error || 'Failed to get download URL');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get download URL';
      toast.error(errorMessage);
      return null;
    }
  }, []);

  // List files
  const listFiles = useCallback(async (prefix: string = '', maxKeys: number = 100) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/mega-s4/list`, {
        params: { prefix, maxKeys },
      });

      if (response.data.success) {
        return response.data.files;
      }

      throw new Error(response.data.error || 'Failed to list files');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to list files';
      toast.error(errorMessage);
      return [];
    }
  }, []);

  // Get storage usage
  const getStorageUsage = useCallback(async (prefix: string = '') => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/mega-s4/usage`, {
        params: { prefix },
      });

      if (response.data.success) {
        return response.data.usage;
      }

      throw new Error(response.data.error || 'Failed to get usage');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get usage';
      toast.error(errorMessage);
      return null;
    }
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setUploadProgress({});
    setUploadedFiles([]);
    setErrors({});
  }, []);

  return {
    uploadFile,
    uploadFiles,
    deleteFile,
    getDownloadUrl,
    listFiles,
    getStorageUsage,
    reset,
    isUploading,
    uploadProgress,
    uploadedFiles,
    errors,
  };
};