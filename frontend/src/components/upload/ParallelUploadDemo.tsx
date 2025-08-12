/**
 * Parallel Upload Demo Component
 * Demonstrates parallel file upload with toast notifications
 */

import React, { useState, useRef } from 'react';
import { Upload, X, Pause, Play, RotateCcw, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface UploadTask {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'paused';
  progress: number;
  speed: number;
  remainingTime: number;
  error?: string;
  retryCount: number;
}

interface UploadToast extends UploadTask {
  toastId: string;
  showToast: boolean;
}

export const ParallelUploadDemo: React.FC = () => {
  const [tasks, setTasks] = useState<UploadToast[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [maxConcurrent] = useState(3);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadsRef = useRef(new Set<string>());

  // Simulate file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newTasks: UploadToast[] = Array.from(files).map((file, index) => ({
      id: crypto.randomUUID(),
      toastId: `toast-${Date.now()}-${index}`,
      file,
      status: 'pending',
      progress: 0,
      speed: 0,
      remainingTime: 0,
      retryCount: 0,
      showToast: true
    }));

    setTasks(prev => [...prev, ...newTasks]);
    startParallelUpload(newTasks);
  };

  // Parallel upload orchestration
  const startParallelUpload = async (newTasks: UploadToast[]) => {
    if (isUploading) return;
    
    setIsUploading(true);
    const allTasks = [...tasks.filter(t => t.status === 'pending'), ...newTasks];
    const queue = [...allTasks];

    // Process queue with concurrency limit
    const processQueue = async () => {
      while (queue.length > 0 || activeUploadsRef.current.size > 0) {
        // Start new uploads up to concurrency limit
        while (activeUploadsRef.current.size < maxConcurrent && queue.length > 0) {
          const task = queue.shift()!;
          uploadSingleFile(task);
        }
        
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setIsUploading(false);
    };

    processQueue();
  };

  // Upload single file with progress simulation
  const uploadSingleFile = async (task: UploadToast) => {
    activeUploadsRef.current.add(task.id);
    
    // Update task status
    setTasks(prev => prev.map(t => 
      t.id === task.id 
        ? { ...t, status: 'uploading' as const }
        : t
    ));

    try {
      // Simulate upload with realistic progress
      await simulateUpload(task);
      
      // Success
      setTasks(prev => prev.map(t => 
        t.id === task.id 
          ? { ...t, status: 'completed' as const, progress: 100 }
          : t
      ));

      // Auto-hide success toast after 3 seconds
      setTimeout(() => {
        setTasks(prev => prev.map(t => 
          t.id === task.id 
            ? { ...t, showToast: false }
            : t
        ));
      }, 3000);

    } catch (error) {
      // Failure
      setTasks(prev => prev.map(t => 
        t.id === task.id 
          ? { 
              ...t, 
              status: 'failed' as const, 
              error: error instanceof Error ? error.message : 'Upload failed' 
            }
          : t
      ));
    } finally {
      activeUploadsRef.current.delete(task.id);
    }
  };

  // Simulate realistic upload progress
  const simulateUpload = (task: UploadToast): Promise<void> => {
    return new Promise((resolve, reject) => {
      let progress = 0;
      const fileSize = task.file.size;
      const startTime = Date.now();
      
      // Simulate variable upload speed (0.5MB/s to 5MB/s)
      const baseSpeed = 500000 + Math.random() * 4500000; // 0.5-5 MB/s
      
      // Random chance of failure (10%)
      const willFail = Math.random() < 0.1;
      const failAt = willFail ? 30 + Math.random() * 40 : 200; // Fail between 30-70%

      const interval = setInterval(() => {
        // Check if task was cancelled or paused
        const currentTask = tasks.find(t => t.id === task.id);
        if (currentTask?.status === 'paused') {
          clearInterval(interval);
          return;
        }

        progress += (Math.random() * 10 + 5); // 5-15% increment
        
        if (willFail && progress > failAt) {
          clearInterval(interval);
          const errors = [
            'Network connection lost',
            'File too large',
            'Server timeout',
            'Insufficient storage space',
            'Invalid file format'
          ];
          reject(new Error(errors[Math.floor(Math.random() * errors.length)]));
          return;
        }

        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          resolve();
          return;
        }

        // Calculate realistic metrics
        const elapsedTime = (Date.now() - startTime) / 1000;
        const uploadedBytes = (progress / 100) * fileSize;
        const currentSpeed = uploadedBytes / elapsedTime;
        const remainingBytes = fileSize - uploadedBytes;
        const remainingTime = remainingBytes / currentSpeed;

        // Update task progress
        setTasks(prev => prev.map(t => 
          t.id === task.id 
            ? { 
                ...t, 
                progress,
                speed: currentSpeed,
                remainingTime 
              }
            : t
        ));
      }, 200 + Math.random() * 300); // 200-500ms intervals
    });
  };

  // Control actions
  const pauseUpload = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId && t.status === 'uploading'
        ? { ...t, status: 'paused' as const }
        : t
    ));
  };

  const resumeUpload = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status === 'paused') {
      setTasks(prev => prev.map(t => 
        t.id === taskId
          ? { ...t, status: 'pending' as const }
          : t
      ));
      uploadSingleFile(task);
    }
  };

  const cancelUpload = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    activeUploadsRef.current.delete(taskId);
  };

  const retryUpload = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status === 'failed') {
      const updatedTask = {
        ...task,
        status: 'pending' as const,
        progress: 0,
        retryCount: task.retryCount + 1,
        error: undefined
      };
      
      setTasks(prev => prev.map(t => 
        t.id === taskId ? updatedTask : t
      ));
      
      uploadSingleFile(updatedTask);
    }
  };

  const removeToast = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId
        ? { ...t, showToast: false }
        : t
    ));
  };

  // Helper functions
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1048576) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / 1048576).toFixed(1)} MB/s`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading': return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'paused': return <Pause className="w-5 h-5 text-yellow-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  // Statistics
  const stats = {
    total: tasks.length,
    uploading: tasks.filter(t => t.status === 'uploading').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    paused: tasks.filter(t => t.status === 'paused').length
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🚀 Parallel Upload with Toast Notifications
          </h1>
          <p className="text-lg text-gray-600">
            Upload multiple files simultaneously with real-time progress tracking
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div 
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Select Multiple Files
            </h3>
            <p className="text-gray-500 mb-4">
              Click here to select files for parallel upload demonstration
            </p>
            <div className="text-sm text-gray-400">
              <p>Demo supports any file type • Up to {maxConcurrent} concurrent uploads</p>
              <p>10% chance of simulated failure for demonstration</p>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>

        {/* Statistics */}
        {tasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Upload Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.uploading}</div>
                <div className="text-sm text-gray-500">Uploading</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-sm text-gray-500">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-sm text-gray-500">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.paused}</div>
                <div className="text-sm text-gray-500">Paused</div>
              </div>
            </div>
          </div>
        )}

        {/* Toast Container */}
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {tasks.filter(task => task.showToast).map(task => (
            <div
              key={task.toastId}
              className={`
                bg-white rounded-lg shadow-lg border-l-4 p-4 transform transition-all duration-300
                ${task.status === 'uploading' ? 'border-blue-500' : ''}
                ${task.status === 'completed' ? 'border-green-500' : ''}
                ${task.status === 'failed' ? 'border-red-500' : ''}
                ${task.status === 'paused' ? 'border-yellow-500' : ''}
                animate-slide-in
              `}
            >
              {/* Toast Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(task.status)}
                  <span className="font-semibold text-gray-800 truncate">
                    {task.file.name}
                  </span>
                </div>
                <button
                  onClick={() => removeToast(task.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Bar */}
              {task.status === 'uploading' && (
                <div className="mb-2">
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300 relative overflow-hidden"
                      style={{ width: `${task.progress}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {task.progress.toFixed(0)}% • {formatSpeed(task.speed)} • {formatTime(task.remainingTime)} left
                  </div>
                </div>
              )}

              {/* File Info */}
              <div className="text-xs text-gray-500 mb-2">
                {formatFileSize(task.file.size)}
                {task.status === 'completed' && ' • Upload completed'}
                {task.status === 'failed' && task.error && ` • ${task.error}`}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {task.status === 'uploading' && (
                  <>
                    <button
                      onClick={() => pauseUpload(task.id)}
                      className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 flex items-center gap-1"
                    >
                      <Pause className="w-3 h-3" />
                      Pause
                    </button>
                    <button
                      onClick={() => cancelUpload(task.id)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                  </>
                )}
                
                {task.status === 'paused' && (
                  <button
                    onClick={() => resumeUpload(task.id)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    Resume
                  </button>
                )}
                
                {task.status === 'failed' && (
                  <button
                    onClick={() => retryUpload(task.id)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Retry ({task.retryCount}/3)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Upload History */}
        {tasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Upload History</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(task.status)}
                    <div>
                      <p className="font-medium text-gray-800">{task.file.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(task.file.size)}
                        {task.status === 'uploading' && ` • ${task.progress.toFixed(0)}%`}
                        {task.status === 'failed' && task.error && ` • ${task.error}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {task.status === 'uploading' && (
                      <div className="text-sm text-blue-600">
                        {formatSpeed(task.speed)}
                      </div>
                    )}
                    
                    <div className="flex gap-1">
                      {task.status === 'uploading' && (
                        <>
                          <button
                            onClick={() => pauseUpload(task.id)}
                            className="p-1 text-yellow-600 hover:bg-yellow-100 rounded"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => cancelUpload(task.id)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      
                      {task.status === 'paused' && (
                        <button
                          onClick={() => resumeUpload(task.id)}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      
                      {task.status === 'failed' && (
                        <button
                          onClick={() => retryUpload(task.id)}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
};

export default ParallelUploadDemo;