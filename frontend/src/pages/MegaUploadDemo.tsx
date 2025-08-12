import React, { useState } from 'react';
import MegaS4Upload from '../components/upload/MegaS4Upload';
import { useMegaS4Upload } from '../hooks/useMegaS4Upload';
import { 
  Cloud, 
  HardDrive, 
  Upload, 
  FileText, 
  Download,
  Trash2,
  RefreshCw,
  Info
} from 'lucide-react';

const MegaUploadDemo: React.FC = () => {
  const [variant, setVariant] = useState<'dropzone' | 'button' | 'inline' | 'minimal'>('dropzone');
  const [uploadMethod, setUploadMethod] = useState<'direct' | 'presigned' | 'auto'>('auto');
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  const {
    listFiles,
    getStorageUsage,
    deleteFile,
    getDownloadUrl,
  } = useMegaS4Upload();

  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [fileList, setFileList] = useState<any[]>([]);

  // Load storage info
  const loadStorageInfo = async () => {
    const usage = await getStorageUsage();
    if (usage) {
      setStorageInfo(usage);
    }
  };

  // Load file list
  const loadFileList = async () => {
    const files = await listFiles('', 50);
    setFileList(files);
  };

  // Handle file deletion
  const handleDelete = async (key: string) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      const deleted = await deleteFile(key);
      if (deleted) {
        loadFileList();
        loadStorageInfo();
      }
    }
  };

  // Handle download
  const handleDownload = async (key: string, fileName: string) => {
    const url = await getDownloadUrl(key, 3600);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    }
  };

  React.useEffect(() => {
    loadStorageInfo();
    loadFileList();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">MEGA S4 Upload Demo</h1>
                <p className="text-sm text-gray-500">Test file uploads to MEGA S4 Object Storage</p>
              </div>
            </div>
            <button
              onClick={() => {
                loadStorageInfo();
                loadFileList();
              }}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Files</h2>

              {/* Configuration */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Component Variant</label>
                    <select
                      value={variant}
                      onChange={(e) => setVariant(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="dropzone">Dropzone</option>
                      <option value="button">Button</option>
                      <option value="inline">Inline</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Upload Method</label>
                    <select
                      value={uploadMethod}
                      onChange={(e) => setUploadMethod(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="auto">Auto (Smart)</option>
                      <option value="direct">Direct (Backend)</option>
                      <option value="presigned">Presigned (Direct to S3)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Upload Component */}
              <MegaS4Upload
                variant={variant}
                uploadMethod={uploadMethod}
                multiple={true}
                maxFiles={10}
                maxSize={104857600} // 100MB
                onUploadComplete={(files) => {
                  setUploadedFiles(prev => [...prev, ...files]);
                  loadFileList();
                  loadStorageInfo();
                }}
              />

              {/* Info Box */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Upload Methods:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• <strong>Auto:</strong> Chooses best method based on file size</li>
                    <li>• <strong>Direct:</strong> Upload through backend (secure, slower)</li>
                    <li>• <strong>Presigned:</strong> Direct to S3 (faster, requires CORS)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Recent Uploads */}
            {uploadedFiles.length > 0 && (
              <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Uploads</h2>
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{file.originalName}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1048576).toFixed(2)} MB • {file.mimeType}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownload(file.key, file.originalName)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(file.key)}
                          className="p-1.5 text-gray-500 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Storage Info */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <HardDrive className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Storage Usage</h3>
              </div>
              {storageInfo ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Used Space</span>
                      <span className="font-medium text-gray-900">{storageInfo.totalSizeGB} GB</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min((parseFloat(storageInfo.totalSizeGB) / 3) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">of 3 TB available</p>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Files</span>
                      <span className="font-medium text-gray-900">{storageInfo.fileCount}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              )}
            </div>

            {/* File List */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">All Files</h3>
              {fileList.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {fileList.map((file, index) => {
                    const fileName = file.key.split('/').pop() || file.key;
                    return (
                      <div key={index} className="group p-2 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <p className="text-xs text-gray-700 truncate" title={fileName}>
                              {fileName}
                            </p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDownload(file.key, fileName)}
                              className="p-1 text-gray-400 hover:text-blue-600"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(file.key)}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {(file.size / 1048576).toFixed(2)} MB • {new Date(file.lastModified).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No files uploaded yet</p>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-900 mb-2">Test Instructions</h4>
              <ul className="text-xs text-yellow-800 space-y-1">
                <li>1. Select a variant type above</li>
                <li>2. Choose upload method (Auto recommended)</li>
                <li>3. Drag & drop or select files to upload</li>
                <li>4. Files will be uploaded to MEGA S4</li>
                <li>5. View uploaded files in the sidebar</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MegaUploadDemo;