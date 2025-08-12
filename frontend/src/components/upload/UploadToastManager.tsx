import React, { useState, useEffect } from 'react';
import { X, Pause, Play, RotateCcw, CheckCircle, AlertCircle, Clock, Upload } from 'lucide-react';

export interface UploadTask {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'paused';
  progress: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
  error?: string;
  retryCount: number;
  startTime?: number;
  uploadedBytes?: number;
}

interface UploadToastProps {
  task: UploadTask;
  onPause?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
}

const UploadToast: React.FC<UploadToastProps> = ({
  task,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-hide on success after 3 seconds
  useEffect(() => {
    if (task.status === 'completed') {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onRemove?.(task.id), 300); // Remove after animation
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [task.status, task.id, onRemove]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // Format speed
  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1048576) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / 1048576).toFixed(1)} MB/s`;
  };

  // Format time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (task.status) {
      case 'uploading':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'paused':
        return <Pause className="w-5 h-5 text-yellow-500" />;
      default:
        return <Upload className="w-5 h-5 text-gray-500" />;
    }
  };

  // Get border color based on status
  const getBorderColor = () => {
    switch (task.status) {
      case 'uploading': return 'border-blue-500';
      case 'completed': return 'border-green-500';
      case 'failed': return 'border-red-500';
      case 'paused': return 'border-yellow-500';
      default: return 'border-gray-300';
    }
  };

  return (
    <div
      className={`
        bg-white rounded-lg shadow-lg border-l-4 p-4 
        transform transition-all duration-300
        ${getBorderColor()}
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
      style={{ minWidth: '350px', maxWidth: '400px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getStatusIcon()}
          <span className="font-semibold text-gray-800 truncate" title={task.file.name}>
            {task.file.name}
          </span>
        </div>
        <button
          onClick={() => onRemove?.(task.id)}
          className="text-gray-400 hover:text-gray-600 ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      {task.status === 'uploading' && (
        <div className="mb-2">
          <div className="w-full bg-gray-200 rounded-full h-2 mb-1 overflow-hidden">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300 relative"
              style={{ width: `${task.progress}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>{task.progress.toFixed(0)}%</span>
            <span>{formatSpeed(task.speed)}</span>
            <span>{formatTime(task.remainingTime)} left</span>
          </div>
        </div>
      )}

      {/* File Info */}
      <div className="text-xs text-gray-500 mb-2">
        <span>{formatFileSize(task.file.size)}</span>
        {task.status === 'completed' && <span className="ml-2 text-green-600">✓ Upload completed</span>}
        {task.status === 'failed' && task.error && (
          <span className="ml-2 text-red-600">{task.error}</span>
        )}
        {task.status === 'paused' && <span className="ml-2 text-yellow-600">Upload paused</span>}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {task.status === 'uploading' && (
          <>
            <button
              onClick={() => onPause?.(task.id)}
              className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 flex items-center gap-1 transition-colors"
            >
              <Pause className="w-3 h-3" />
              Pause
            </button>
            <button
              onClick={() => onCancel?.(task.id)}
              className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </>
        )}

        {task.status === 'paused' && (
          <>
            <button
              onClick={() => onResume?.(task.id)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 flex items-center gap-1 transition-colors"
            >
              <Play className="w-3 h-3" />
              Resume
            </button>
            <button
              onClick={() => onCancel?.(task.id)}
              className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </>
        )}

        {task.status === 'failed' && (
          <button
            onClick={() => onRetry?.(task.id)}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Retry {task.retryCount > 0 && `(${task.retryCount}/3)`}
          </button>
        )}
      </div>
    </div>
  );
};

interface UploadToastManagerProps {
  tasks: UploadTask[];
  onPause?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
}

export const UploadToastManager: React.FC<UploadToastManagerProps> = ({
  tasks,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove
}) => {
  // Only show active tasks (not completed ones that have been auto-hidden)
  const visibleTasks = tasks.filter(task => 
    task.status !== 'completed' || 
    (Date.now() - (task.startTime || 0)) < 5000 // Show completed for 5 seconds total
  );

  if (visibleTasks.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {visibleTasks.map((task) => (
        <UploadToast
          key={task.id}
          task={task}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onRetry={onRetry}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

// CSS for shimmer animation (add to your global CSS or styled-components)
export const uploadToastStyles = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  .animate-shimmer {
    animation: shimmer 1.5s infinite;
  }
`;