import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { UserManagementFilters } from '../../types/user-management';
import userManagementService from '../../services/userManagementService';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters?: UserManagementFilters;
  onDataUpdated?: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  currentFilters = {},
  onDataUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xlsx'>('csv');
  const [exportLoading, setExportLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Handle export
  const handleExport = async () => {
    try {
      setExportLoading(true);
      const response = await userManagementService.exportUsers(currentFilters, exportFormat);
      
      if (response.success) {
        toast.success(`Đang chuẩn bị tải xuống ${response.data.totalRecords} bản ghi`);
        // Download the file
        await userManagementService.downloadExportFile(response.data.url, response.data.filename);
        toast.success('Tải xuống thành công');
      } else {
        toast.error('Không thể xuất dữ liệu');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Lỗi khi xuất dữ liệu');
    } finally {
      setExportLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['text/csv', 'application/json', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Chỉ hỗ trợ file CSV, JSON hoặc XLSX');
        return;
      }
      setImportFile(file);
      setImportResult(null);
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!importFile) {
      toast.error('Vui lòng chọn file để nhập');
      return;
    }

    try {
      setImportLoading(true);
      const response = await userManagementService.importUsers(importFile);
      
      if (response.success) {
        setImportResult(response.data);
        toast.success(`Nhập thành công ${response.data.imported}/${response.data.total} bản ghi`);
        if (response.data.failed > 0) {
          toast.error(`${response.data.failed} bản ghi không thể nhập`);
        }
        onDataUpdated?.();
      } else {
        toast.error('Không thể nhập dữ liệu');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Lỗi khi nhập dữ liệu');
    } finally {
      setImportLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Xuất / Nhập dữ liệu người dùng
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">Đóng</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('export')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'export'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📤 Xuất dữ liệu
              </button>
              <button
                onClick={() => setActiveTab('import')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'import'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📥 Nhập dữ liệu
              </button>
            </nav>
          </div>

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div>
                <p className="text-gray-600 mb-4">
                  Xuất dữ liệu người dùng với bộ lọc hiện tại thành file để sử dụng ngoại tuyến
                </p>

                {/* Export Format Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Định dạng file
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setExportFormat('csv')}
                      className={`p-3 border rounded-lg text-center ${
                        exportFormat === 'csv' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                      }`}
                    >
                      <div className="text-sm font-medium">CSV</div>
                      <div className="text-xs text-gray-500">Excel tương thích</div>
                    </button>
                    <button
                      onClick={() => setExportFormat('xlsx')}
                      className={`p-3 border rounded-lg text-center ${
                        exportFormat === 'xlsx' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                      }`}
                    >
                      <div className="text-sm font-medium">XLSX</div>
                      <div className="text-xs text-gray-500">Excel format</div>
                    </button>
                    <button
                      onClick={() => setExportFormat('json')}
                      className={`p-3 border rounded-lg text-center ${
                        exportFormat === 'json' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                      }`}
                    >
                      <div className="text-sm font-medium">JSON</div>
                      <div className="text-xs text-gray-500">Cấu trúc dữ liệu</div>
                    </button>
                  </div>
                </div>

                {/* Current Filters Display */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Bộ lọc hiện tại:</h4>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(currentFilters).length > 0 ? (
                      Object.entries(currentFilters).map(([key, value]) => (
                        value && (
                          <span key={key} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {key}: {value.toString()}
                          </span>
                        )
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">Không có bộ lọc (tất cả dữ liệu)</span>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleExport}
                  disabled={exportLoading}
                  className="w-full"
                >
                  {exportLoading ? (
                    <>
                      <LoadingSpinner size="xs" />
                      <span className="ml-2">Đang chuẩn bị xuất...</span>
                    </>
                  ) : (
                    `📤 Xuất dữ liệu (.${exportFormat})`
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <div>
                <p className="text-gray-600 mb-4">
                  Nhập dữ liệu người dùng từ file CSV, JSON hoặc XLSX
                </p>

                {/* File Upload */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chọn file để nhập
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                          <span>Chọn file</span>
                          <input
                            type="file"
                            className="sr-only"
                            accept=".csv,.json,.xlsx"
                            onChange={handleFileSelect}
                          />
                        </label>
                        <p className="pl-1">hoặc kéo thả file vào đây</p>
                      </div>
                      <p className="text-xs text-gray-500">CSV, JSON, XLSX tới 10MB</p>
                    </div>
                  </div>
                  
                  {importFile && (
                    <div className="mt-2 text-sm text-gray-600">
                      Đã chọn: <strong>{importFile.name}</strong> ({(importFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                {/* Import Instructions */}
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-yellow-800 mb-1">Lưu ý quan trọng:</h4>
                  <ul className="text-xs text-yellow-700 space-y-1">
                    <li>• File phải có các cột: email, full_name, department, position</li>
                    <li>• Email phải là duy nhất trong hệ thống</li>
                    <li>• Các trường bắt buộc: email</li>
                    <li>• Dữ liệu trùng lặp sẽ được cập nhật</li>
                  </ul>
                </div>

                <Button
                  onClick={handleImport}
                  disabled={!importFile || importLoading}
                  className="w-full"
                >
                  {importLoading ? (
                    <>
                      <LoadingSpinner size="xs" />
                      <span className="ml-2">Đang nhập dữ liệu...</span>
                    </>
                  ) : (
                    '📥 Bắt đầu nhập dữ liệu'
                  )}
                </Button>

                {/* Import Results */}
                {importResult && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Kết quả nhập dữ liệu:</h4>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                        <div className="text-xs text-gray-600">Thành công</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                        <div className="text-xs text-gray-600">Thất bại</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{importResult.total}</div>
                        <div className="text-xs text-gray-600">Tổng cộng</div>
                      </div>
                    </div>

                    {importResult.errors && importResult.errors.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-red-800 mb-2">Lỗi chi tiết:</h5>
                        <div className="max-h-40 overflow-y-auto">
                          {importResult.errors.slice(0, 10).map((error: any, index: number) => (
                            <div key={index} className="text-xs text-red-700 mb-1">
                              Dòng {error.row}: {error.field} - {error.message}
                            </div>
                          ))}
                          {importResult.errors.length > 10 && (
                            <div className="text-xs text-gray-500">
                              ... và {importResult.errors.length - 10} lỗi khác
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportImportModal;