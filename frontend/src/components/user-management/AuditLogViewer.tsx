/**
 * Audit Log Timeline Viewer
 * Interactive timeline component showing user actions, admin actions with filtering and export
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import DatePicker from 'react-datepicker';
import userManagementService from '../../services/userManagementService';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { LoadingSpinner } from '../common/LoadingSpinner';
import Badge from '../common/Badge';
import { useDebounce } from '../../hooks/useDebounce';

interface AuditLogEntry {
  id: string;
  userId?: string;
  adminId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  user?: {
    id: string;
    email: string;
    full_name?: string;
  };
  admin?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

interface AuditLogFilters {
  userId?: string;
  adminId?: string;
  action?: string;
  resource?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

interface AuditLogViewerProps {
  userId?: string;
  className?: string;
}

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  userId,
  className = ''
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<AuditLogFilters>({
    userId
  });
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Debounced search
  const debouncedSearch = useDebounce(filters.search || '', 300);

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      
      // Mock data for now - replace with actual API call
      const mockLogs: AuditLogEntry[] = [
        {
          id: '1',
          userId: '1',
          action: 'LOGIN',
          resource: 'AUTH',
          details: { method: 'email_password' },
          ipAddress: '192.168.1.1',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          user: { id: '1', email: 'john@example.com', full_name: 'John Doe' }
        },
        {
          id: '2',
          adminId: 'admin1',
          userId: '1',
          action: 'APPROVE_USER',
          resource: 'USER',
          resourceId: '1',
          details: { previousStatus: 'pending', newStatus: 'approved' },
          timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          admin: { id: 'admin1', email: 'admin@example.com', full_name: 'Admin User' },
          user: { id: '1', email: 'john@example.com', full_name: 'John Doe' }
        },
        {
          id: '3',
          userId: '2',
          action: 'PROFILE_UPDATE',
          resource: 'PROFILE',
          resourceId: '2',
          details: { 
            changedFields: ['full_name', 'department'],
            oldValues: { full_name: 'Jane Smith', department: 'IT' },
            newValues: { full_name: 'Jane Smith-Johnson', department: 'Engineering' }
          },
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          user: { id: '2', email: 'jane@example.com', full_name: 'Jane Smith-Johnson' }
        },
        {
          id: '4',
          adminId: 'admin1',
          userId: '3',
          action: 'BLOCK_USER',
          resource: 'USER',
          resourceId: '3',
          details: { reason: 'Suspicious activity detected' },
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
          admin: { id: 'admin1', email: 'admin@example.com', full_name: 'Admin User' },
          user: { id: '3', email: 'suspicious@example.com', full_name: 'Suspicious User' }
        }
      ];

      // Apply filters
      let filteredLogs = mockLogs;
      if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
      }
      if (filters.adminId) {
        filteredLogs = filteredLogs.filter(log => log.adminId === filters.adminId);
      }
      if (filters.action) {
        filteredLogs = filteredLogs.filter(log => 
          log.action.toLowerCase().includes(filters.action!.toLowerCase())
        );
      }
      if (filters.resource) {
        filteredLogs = filteredLogs.filter(log => 
          log.resource.toLowerCase().includes(filters.resource!.toLowerCase())
        );
      }
      if (debouncedSearch) {
        filteredLogs = filteredLogs.filter(log => {
          const searchTerm = debouncedSearch.toLowerCase();
          return (
            log.action.toLowerCase().includes(searchTerm) ||
            log.resource.toLowerCase().includes(searchTerm) ||
            log.user?.email.toLowerCase().includes(searchTerm) ||
            log.admin?.email.toLowerCase().includes(searchTerm) ||
            (log.user?.full_name && log.user.full_name.toLowerCase().includes(searchTerm)) ||
            (log.admin?.full_name && log.admin.full_name.toLowerCase().includes(searchTerm))
          );
        });
      }

      setLogs(filteredLogs);
      setTotal(filteredLogs.length);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast.error('Lỗi khi tải nhật ký kiểm toán');
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // Get action badge color
  const getActionColor = useCallback((action: string) => {
    switch (action) {
      case 'LOGIN':
      case 'LOGOUT':
        return 'bg-blue-100 text-blue-800';
      case 'APPROVE_USER':
      case 'CREATE':
        return 'bg-green-100 text-green-800';
      case 'BLOCK_USER':
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      case 'UPDATE':
      case 'PROFILE_UPDATE':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  // Get action icon
  const getActionIcon = useCallback((action: string) => {
    switch (action) {
      case 'LOGIN': return '🔐';
      case 'LOGOUT': return '🚪';
      case 'APPROVE_USER': return '✅';
      case 'BLOCK_USER': return '🚫';
      case 'CREATE': return '➕';
      case 'UPDATE':
      case 'PROFILE_UPDATE': return '📝';
      case 'DELETE': return '🗑️';
      default: return '📋';
    }
  }, []);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return 'Vừa xong';
    } else if (diffMins < 60) {
      return `${diffMins} phút trước`;
    } else if (diffHours < 24) {
      return `${diffHours} giờ trước`;
    } else if (diffDays < 7) {
      return `${diffDays} ngày trước`;
    } else {
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }, []);

  // Export audit logs
  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true);
      
      // Create CSV content
      const headers = ['Timestamp', 'Action', 'Resource', 'User', 'Admin', 'Details', 'IP Address'];
      const csvRows = [headers.join(',')];
      
      logs.forEach(log => {
        const row = [
          new Date(log.timestamp).toLocaleString('vi-VN'),
          log.action,
          log.resource,
          log.user?.email || '',
          log.admin?.email || '',
          JSON.stringify(log.details || {}),
          log.ipAddress || ''
        ];
        csvRows.push(row.map(field => `"${field}"`).join(','));
      });

      // Download CSV
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Xuất nhật ký kiểm toán thành công');
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      toast.error('Lỗi khi xuất nhật ký kiểm toán');
    } finally {
      setIsExporting(false);
    }
  }, [logs]);

  // Render log details
  const renderLogDetails = useCallback((log: AuditLogEntry) => {
    if (!log.details) return null;

    return (
      <div className="mt-2 text-xs text-gray-600 space-y-1">
        {Object.entries(log.details).map(([key, value]) => (
          <div key={key} className="flex">
            <span className="font-medium capitalize mr-2">{key.replace(/_/g, ' ')}:</span>
            <span className="break-words">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
        {log.ipAddress && (
          <div className="flex">
            <span className="font-medium mr-2">IP Address:</span>
            <span>{log.ipAddress}</span>
          </div>
        )}
      </div>
    );
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Đang tải nhật ký kiểm toán...</span>
      </div>
    );
  }

  return (
    <div className={`bg-white shadow-sm rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Nhật ký kiểm toán
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({total} mục)
            </span>
          </h3>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            >
              {isFilterExpanded ? '🔽 Ẩn bộ lọc' : '🔼 Hiện bộ lọc'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={isExporting || logs.length === 0}
            >
              {isExporting ? <LoadingSpinner size="xs" /> : '📄 Xuất CSV'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={loadAuditLogs}
              disabled={loading}
            >
              🔄 Làm mới
            </Button>
          </div>
        </div>

        {/* Filters */}
        {isFilterExpanded && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tìm kiếm</label>
                <Input
                  type="text"
                  placeholder="Hành động, tài nguyên, email..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hành động</label>
                <select
                  value={filters.action || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    action: e.target.value || undefined 
                  }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Tất cả hành động</option>
                  <option value="LOGIN">Đăng nhập</option>
                  <option value="LOGOUT">Đăng xuất</option>
                  <option value="APPROVE_USER">Phê duyệt user</option>
                  <option value="BLOCK_USER">Chặn user</option>
                  <option value="UPDATE">Cập nhật</option>
                  <option value="CREATE">Tạo mới</option>
                  <option value="DELETE">Xóa</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tài nguyên</label>
                <select
                  value={filters.resource || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    resource: e.target.value || undefined 
                  }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Tất cả tài nguyên</option>
                  <option value="AUTH">Xác thực</option>
                  <option value="USER">Người dùng</option>
                  <option value="PROFILE">Hồ sơ</option>
                  <option value="ROLE">Vai trò</option>
                  <option value="GROUP">Nhóm</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFilters({ userId })}
              >
                🔄 Đặt lại bộ lọc
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="px-6 py-4">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-2">Không có nhật ký kiểm toán nào</div>
            <div className="text-gray-400">Thử thay đổi bộ lọc hoặc tìm kiếm</div>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log, index) => (
              <div key={log.id} className="flex items-start space-x-4">
                {/* Timeline indicator */}
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-gray-300">
                    <span className="text-sm">{getActionIcon(log.action)}</span>
                  </div>
                  {index < logs.length - 1 && (
                    <div className="w-0.5 h-16 bg-gray-200 mt-2"></div>
                  )}
                </div>

                {/* Log content */}
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                        <span className="text-sm font-medium text-gray-900">
                          {log.resource}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-700 mb-2">
                        {log.user && (
                          <span>
                            <strong>{log.user.full_name || log.user.email}</strong>
                            {log.admin && <span> (thực hiện bởi <strong>{log.admin.full_name || log.admin.email}</strong>)</span>}
                          </span>
                        )}
                        {!log.user && log.admin && (
                          <span>
                            Thực hiện bởi <strong>{log.admin.full_name || log.admin.email}</strong>
                          </span>
                        )}
                      </div>

                      {renderLogDetails(log)}
                    </div>

                    <div className="flex-shrink-0 text-xs text-gray-500">
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </div>

                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                      >
                        {selectedLog?.id === log.id ? '🔼 Ẩn chi tiết' : '🔽 Xem chi tiết'}
                      </Button>
                      
                      {selectedLog?.id === log.id && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                          {log.metadata && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="text-xs font-medium text-gray-700 mb-1">Metadata:</div>
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogViewer;