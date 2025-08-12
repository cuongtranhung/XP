import React, { useState } from 'react';
import { Upload, X, File, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
}

const R2UploadTest: React.FC = () => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      progress: 0,
      status: 'pending' as const
    }));
    
    setFiles(prev => [...prev, ...uploadFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadSingleFile = async (uploadFile: UploadFile) => {
    const formData = new FormData();
    formData.append('file', uploadFile.file);

    try {
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'uploading' as const }
          : f
      ));

      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/upload/single',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            
            setFiles(prev => prev.map(f => 
              f.id === uploadFile.id 
                ? { ...f, progress: percentCompleted }
                : f
            ));
          }
        }
      );

      // Update status to success
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { 
              ...f, 
              status: 'success' as const, 
              progress: 100,
              url: response.data.data.url 
            }
          : f
      ));

      toast.success(`Uploaded ${uploadFile.file.name} successfully!`);
      return response.data;
    } catch (error: any) {
      // Update status to error
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { 
              ...f, 
              status: 'error' as const,
              error: error.response?.data?.message || error.message 
            }
          : f
      ));

      toast.error(`Failed to upload ${uploadFile.file.name}`);
      throw error;
    }
  };

  const uploadAllFiles = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      toast.error('No files to upload');
      return;
    }

    setIsUploading(true);

    try {
      // Upload files in parallel with concurrency limit
      const concurrency = 3;
      const results = [];
      
      for (let i = 0; i < pendingFiles.length; i += concurrency) {
        const batch = pendingFiles.slice(i, i + concurrency);
        const batchPromises = batch.map(file => uploadSingleFile(file));
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
      }

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (successful > 0) {
        toast.success(`Successfully uploaded ${successful} file(s)`);
      }
      if (failed > 0) {
        toast.error(`Failed to upload ${failed} file(s)`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const uploadMultiple = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      toast.error('No files to upload');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      pendingFiles.forEach(f => {
        formData.append('files', f.file);
      });

      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/upload/multiple',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Update file statuses based on response
      const { successful, failed } = response.data.data;
      
      setFiles(prev => prev.map(f => {
        const successFile = successful.find((s: any) => s.originalName === f.file.name);
        const failedFile = failed.find((s: any) => s.originalName === f.file.name);
        
        if (successFile) {
          return { ...f, status: 'success' as const, progress: 100, url: successFile.url };
        } else if (failedFile) {
          return { ...f, status: 'error' as const, error: failedFile.error };
        }
        return f;
      }));

      toast.success(response.data.message);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Upload failed');
      
      // Mark all pending files as error
      setFiles(prev => prev.map(f => 
        f.status === 'pending' 
          ? { ...f, status: 'error' as const, error: 'Upload failed' }
          : f
      ));
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Cloudflare R2 Upload Test</h2>
      
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-600 mb-2">
          Drag and drop files here, or click to select
        </p>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="file-input"
        />
        <label
          htmlFor="file-input"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"
        >
          Select Files
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Files ({files.length})</h3>
          <div className="space-y-2">
            {files.map(file => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center flex-1">
                  <File className="h-5 w-5 text-gray-400 mr-3" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {file.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.file.size)}
                    </p>
                    {file.status === 'uploading' && (
                      <div className="mt-1">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {file.progress}%
                        </p>
                      </div>
                    )}
                    {file.error && (
                      <p className="text-xs text-red-500 mt-1">{file.error}</p>
                    )}
                    {file.url && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-700 mt-1 inline-block"
                      >
                        View file
                      </a>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center ml-4">
                  {file.status === 'pending' && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  )}
                  {file.status === 'uploading' && (
                    <Loader className="h-5 w-5 text-blue-500 animate-spin" />
                  )}
                  {file.status === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Upload Buttons */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={uploadAllFiles}
              disabled={isUploading || files.filter(f => f.status === 'pending').length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Upload Files (Parallel)'}
            </button>
            
            <button
              onClick={uploadMultiple}
              disabled={isUploading || files.filter(f => f.status === 'pending').length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Upload Files (Batch)'}
            </button>
            
            <button
              onClick={() => setFiles([])}
              disabled={isUploading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default R2UploadTest;