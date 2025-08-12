/**
 * File Upload Demo Component
 * Interactive demo showing all upload variants and states
 */

import React, { useState } from 'react';
import { Upload, X, File, Image, FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react';

// Mock file data for demonstration
const mockFiles = [
  { 
    id: '1', 
    name: 'document.pdf', 
    size: 2458624, 
    type: 'application/pdf', 
    status: 'uploading', 
    progress: 65 
  },
  { 
    id: '2', 
    name: 'image.jpg', 
    size: 1234567, 
    type: 'image/jpeg', 
    status: 'completed', 
    progress: 100,
    preview: 'https://via.placeholder.com/150'
  },
  { 
    id: '3', 
    name: 'spreadsheet.xlsx', 
    size: 3456789, 
    type: 'application/vnd.ms-excel', 
    status: 'error', 
    progress: 0,
    error: 'File too large'
  }
];

export const FileUploadDemo: React.FC = () => {
  const [activeVariant, setActiveVariant] = useState<'dropzone' | 'button' | 'inline' | 'minimal'>('dropzone');
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState(mockFiles);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📤 Upload Module UI Design
          </h1>
          <p className="text-lg text-gray-600">
            Interactive demonstration of all upload component variants
          </p>
        </div>

        {/* Variant Selector */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Select Variant</h2>
          <div className="flex gap-2 flex-wrap">
            {(['dropzone', 'button', 'inline', 'minimal'] as const).map(variant => (
              <button
                key={variant}
                onClick={() => setActiveVariant(variant)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeVariant === variant
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {variant.charAt(0).toUpperCase() + variant.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Active Variant Demo */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">
            {activeVariant.charAt(0).toUpperCase() + activeVariant.slice(1)} Variant
          </h2>
          
          {activeVariant === 'dropzone' && (
            <DropzoneDemo isDragging={isDragging} setIsDragging={setIsDragging} />
          )}
          
          {activeVariant === 'button' && <ButtonVariantDemo />}
          
          {activeVariant === 'inline' && <InlineVariantDemo />}
          
          {activeVariant === 'minimal' && <MinimalVariantDemo />}
        </div>

        {/* File States Demo */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">File States</h2>
          <div className="space-y-3">
            {files.map(file => (
              <FileItem key={file.id} file={file} />
            ))}
          </div>
        </div>

        {/* Grid View Demo */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Grid View (Images)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="relative group cursor-pointer">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src={`https://via.placeholder.com/200?text=Image+${i}`}
                    alt={`Image ${i}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button className="p-2 bg-white rounded-lg text-gray-700 hover:bg-gray-100">
                      👁️
                    </button>
                    <button className="p-2 bg-white rounded-lg text-red-600 hover:bg-gray-100">
                      🗑️
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1 truncate">image{i}.jpg</p>
                <p className="text-xs text-gray-400">{(Math.random() * 5).toFixed(1)} MB</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile View Demo */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Mobile View</h2>
          <div className="max-w-sm mx-auto">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-base font-medium text-gray-700">Tap to upload</p>
              <p className="text-xs text-gray-500 mt-2">Max: 10MB</p>
            </div>
            
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">document.pdf</p>
                    <p className="text-xs text-gray-500">2.4 MB</p>
                  </div>
                </div>
                <div className="text-sm text-blue-600">75%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Dark Mode Demo */}
        <div className="bg-gray-900 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Dark Mode</h2>
          <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-gray-500 hover:bg-gray-800 transition-all">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-base font-medium text-gray-200">
              Drag & drop files here
            </p>
            <p className="text-sm text-gray-400 mt-1">
              or <span className="text-blue-400 hover:underline cursor-pointer">browse</span>
            </p>
            <div className="mt-4 text-xs text-gray-500">
              <p>Supports: JPG, PNG, PDF, DOC</p>
              <p>Max size: 10MB per file</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// Dropzone Component Demo
const DropzoneDemo: React.FC<{
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;
}> = ({ isDragging, setIsDragging }) => {
  return (
    <div
      className={`
        relative border-2 border-dashed rounded-xl p-8
        transition-all duration-200 cursor-pointer
        ${isDragging 
          ? 'border-blue-500 bg-blue-50 scale-[1.02]' 
          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }
      `}
      onMouseEnter={() => setIsDragging(true)}
      onMouseLeave={() => setIsDragging(false)}
    >
      <div className="flex justify-center mb-4">
        <div className={`
          p-4 rounded-full transition-all
          ${isDragging ? 'animate-bounce bg-blue-100' : 'bg-gray-100'}
        `}>
          <Upload className={`
            w-8 h-8 transition-colors
            ${isDragging ? 'text-blue-600' : 'text-gray-400'}
          `} />
        </div>
      </div>

      <div className="text-center">
        <p className="text-base font-medium text-gray-700">
          {isDragging ? 'Drop files here!' : 'Drag & drop files here'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          or <span className="text-blue-600 hover:underline">browse</span>
        </p>
        
        <div className="mt-4 text-xs text-gray-400">
          <p>Supports: JPG, PNG, PDF, DOC</p>
          <p>Max size: 10MB per file</p>
        </div>
      </div>

      {isDragging && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-xl pointer-events-none" />
      )}
    </div>
  );
};

// Button Variant Demo
const ButtonVariantDemo: React.FC = () => (
  <div className="flex gap-4">
    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
      <Upload className="w-4 h-4" />
      Upload Files
    </button>
    
    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
      <Upload className="w-4 h-4" />
      Import Data
    </button>
    
    <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
      <Upload className="w-4 h-4" />
      Choose File
    </button>
  </div>
);

// Inline Variant Demo
const InlineVariantDemo: React.FC = () => (
  <div className="max-w-lg">
    <div className="border border-gray-300 rounded-lg">
      <textarea 
        className="w-full p-3 rounded-t-lg resize-none focus:outline-none"
        rows={3}
        placeholder="Type your comment..."
      />
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-b-lg">
        <div className="flex gap-2">
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <strong>B</strong>
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <em>I</em>
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <Upload className="w-5 h-5" />
          </button>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Send
        </button>
      </div>
    </div>
  </div>
);

// Minimal Variant Demo
const MinimalVariantDemo: React.FC = () => (
  <div className="max-w-lg space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Resume <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
          <span className="text-sm text-gray-500">No file selected</span>
        </div>
        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Browse
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">PDF or DOC, max 5MB</p>
    </div>
    
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Portfolio Images
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
          <span className="text-sm text-gray-700">3 files selected</span>
        </div>
        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Add More
        </button>
      </div>
    </div>
  </div>
);

// File Item Component
const FileItem: React.FC<{ file: any }> = ({ file }) => {
  const getStatusIcon = () => {
    switch (file.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'uploading':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getFileIcon = () => {
    if (file.type.startsWith('image/')) return <Image className="w-6 h-6 text-blue-500" />;
    if (file.type === 'application/pdf') return <FileText className="w-6 h-6 text-red-500" />;
    return <File className="w-6 h-6 text-gray-500" />;
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex-shrink-0">
        {file.preview ? (
          <img src={file.preview} alt={file.name} className="w-12 h-12 object-cover rounded" />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
            {getFileIcon()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
        <p className="text-xs text-gray-500">
          {(file.size / 1048576).toFixed(1)} MB
          {file.status === 'uploading' && ` • ${file.progress}%`}
          {file.status === 'error' && ` • ${file.error}`}
        </p>
        
        {file.status === 'uploading' && (
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${file.progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        {getStatusIcon()}
        {file.status === 'error' && (
          <button className="text-sm text-blue-600 hover:underline">Retry</button>
        )}
        {file.status !== 'uploading' && (
          <button className="text-gray-400 hover:text-red-600">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default FileUploadDemo;