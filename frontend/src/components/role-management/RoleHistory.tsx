import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Button } from '../common/Button';

interface RoleHistoryEntry {
  id: string;
  action: 'created' | 'updated' | 'deleted' | 'assigned' | 'removed' | 'expired';
  role_id: string;
  role_name: string;
  role_display_name: string;
  user_id?: string;
  user_email?: string;
  performed_by: string;
  performed_by_email: string;
  timestamp: string;
  details: {
    field?: string;
    old_value?: any;
    new_value?: any;
    reason?: string;
    expires_at?: string;
  };
}

interface RoleHistoryProps {
  roleId?: string; // If provided, show history for specific role
  userId?: string; // If provided, show role history for specific user
  className?: string;
}

const RoleHistory: React.FC<RoleHistoryProps> = ({ roleId, userId, className = '' }) => {
  const [history, setHistory] = useState<RoleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Load history
  useEffect(() => {
    loadHistory();
  }, [roleId, userId, dateRange]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      // Mock history data - in real app, fetch from API
      const mockHistory: RoleHistoryEntry[] = [
        {
          id: '1',
          action: 'assigned',
          role_id: 'role1',
          role_name: 'admin',
          role_display_name: 'Administrator',
          user_id: 'user1',
          user_email: 'john@xp.vn',
          performed_by: 'admin',
          performed_by_email: 'admin@xp.vn',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'Promoted to admin role',
            expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
          }
        },
        {
          id: '2',
          action: 'updated',
          role_id: 'role2',
          role_name: 'manager',
          role_display_name: 'Manager',
          performed_by: 'admin',
          performed_by_email: 'admin@xp.vn',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          details: {
            field: 'priority',
            old_value: 500,
            new_value: 550,
            reason: 'Adjusted priority for better hierarchy'
          }
        },
        {
          id: '3',
          action: 'created',
          role_id: 'role3',
          role_name: 'developer',
          role_display_name: 'Developer',
          performed_by: 'admin',
          performed_by_email: 'admin@xp.vn',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          details: {
            reason: 'New role for development team'
          }
        },
        {
          id: '4',
          action: 'removed',
          role_id: 'role4',
          role_name: 'intern',
          role_display_name: 'Intern',
          user_id: 'user2',
          user_email: 'intern@xp.vn',
          performed_by: 'hr',
          performed_by_email: 'hr@xp.vn',
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          details: {
            reason: 'Internship period ended'
          }
        },
        {
          id: '5',
          action: 'expired',
          role_id: 'role5',
          role_name: 'temp_admin',
          role_display_name: 'Temporary Admin',
          user_id: 'user3',
          user_email: 'temp@xp.vn',
          performed_by: 'system',
          performed_by_email: 'system@xp.vn',
          timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          details: {
            reason: 'Role automatically expired'
          }
        }
      ];
      
      // Filter by roleId or userId if provided
      let filteredHistory = mockHistory;
      if (roleId) {
        filteredHistory = filteredHistory.filter(h => h.role_id === roleId);
      }
      if (userId) {
        filteredHistory = filteredHistory.filter(h => h.user_id === userId);
      }
      
      // Filter by date range
      const now = new Date();
      if (dateRange !== 'all') {
        const daysAgo = dateRange === 'today' ? 0 : dateRange === '7d' ? 7 : 30;
        const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        filteredHistory = filteredHistory.filter(h => new Date(h.timestamp) >= cutoffDate);
      }
      
      setHistory(filteredHistory);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Không thể tải lịch sử');
    } finally {
      setLoading(false);
    }
  };

  // Toggle entry expansion
  const toggleExpanded = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  // Get action icon and color
  const getActionStyle = (action: string) => {
    switch (action) {
      case 'created':
        return { icon: '✨', color: 'text-green-600', bg: 'bg-green-50' };
      case 'updated':
        return { icon: '✏️', color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'deleted':
        return { icon: '🗑️', color: 'text-red-600', bg: 'bg-red-50' };
      case 'assigned':
        return { icon: '➕', color: 'text-purple-600', bg: 'bg-purple-50' };
      case 'removed':
        return { icon: '➖', color: 'text-orange-600', bg: 'bg-orange-50' };
      case 'expired':
        return { icon: '⏰', color: 'text-gray-600', bg: 'bg-gray-50' };
      default:
        return { icon: '📝', color: 'text-gray-600', bg: 'bg-gray-50' };
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} phút trước`;
    } else if (diffHours < 24) {
      return `${diffHours} giờ trước`;
    } else if (diffHours < 48) {
      return 'Hôm qua';
    } else {
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Filter history by action type
  const filteredHistory = filter === 'all' 
    ? history 
    : history.filter(h => h.action === filter);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
        <div className="p-6">
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Đang tải lịch sử...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              📜 Lịch Sử Vai Trò
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {roleId ? 'Lịch sử thay đổi của vai trò' : 
               userId ? 'Lịch sử vai trò của người dùng' : 
               'Tất cả hoạt động liên quan đến vai trò'}
            </p>
          </div>
          
          {/* Date Range Filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="today">Hôm nay</option>
            <option value="7d">7 ngày</option>
            <option value="30d">30 ngày</option>
            <option value="all">Tất cả</option>
          </select>
        </div>
      </div>

      {/* Action Filter */}
      <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Lọc:</span>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs rounded-md ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Tất cả ({history.length})
            </button>
            <button
              onClick={() => setFilter('assigned')}
              className={`px-3 py-1 text-xs rounded-md ${
                filter === 'assigned'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              ➕ Gán ({history.filter(h => h.action === 'assigned').length})
            </button>
            <button
              onClick={() => setFilter('removed')}
              className={`px-3 py-1 text-xs rounded-md ${
                filter === 'removed'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              ➖ Xóa ({history.filter(h => h.action === 'removed').length})
            </button>
            <button
              onClick={() => setFilter('updated')}
              className={`px-3 py-1 text-xs rounded-md ${
                filter === 'updated'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              ✏️ Sửa ({history.filter(h => h.action === 'updated').length})
            </button>
          </div>
        </div>
      </div>

      {/* History Timeline */}
      <div className="p-6">
        {filteredHistory.length > 0 ? (
          <div className="space-y-4">
            {filteredHistory.map((entry) => {
              const style = getActionStyle(entry.action);
              const isExpanded = expandedEntries.has(entry.id);
              
              return (
                <div key={entry.id} className={`${style.bg} rounded-lg p-4`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {/* Action Icon */}
                      <div className={`text-2xl ${style.color}`}>
                        {style.icon}
                      </div>
                      
                      {/* Entry Details */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`font-medium ${style.color}`}>
                            {entry.action === 'created' && 'Tạo vai trò'}
                            {entry.action === 'updated' && 'Cập nhật vai trò'}
                            {entry.action === 'deleted' && 'Xóa vai trò'}
                            {entry.action === 'assigned' && 'Gán vai trò'}
                            {entry.action === 'removed' && 'Xóa vai trò'}
                            {entry.action === 'expired' && 'Vai trò hết hạn'}
                          </span>
                          <span className="text-gray-900 font-medium">
                            {entry.role_display_name}
                          </span>
                          {entry.user_email && (
                            <>
                              <span className="text-gray-500">cho</span>
                              <span className="text-gray-900">{entry.user_email}</span>
                            </>
                          )}
                        </div>
                        
                        <div className="mt-1 text-sm text-gray-600">
                          Bởi <span className="font-medium">{entry.performed_by_email}</span>
                          {' • '}
                          {formatTimestamp(entry.timestamp)}
                        </div>
                        
                        {/* Expandable Details */}
                        {entry.details && Object.keys(entry.details).length > 0 && (
                          <button
                            onClick={() => toggleExpanded(entry.id)}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                          >
                            {isExpanded ? '▼ Thu gọn' : '▶ Xem chi tiết'}
                          </button>
                        )}
                        
                        {isExpanded && entry.details && (
                          <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                            {entry.details.field && (
                              <div className="text-sm">
                                <span className="text-gray-600">Trường thay đổi:</span>{' '}
                                <span className="font-medium">{entry.details.field}</span>
                              </div>
                            )}
                            {entry.details.old_value !== undefined && (
                              <div className="text-sm">
                                <span className="text-gray-600">Giá trị cũ:</span>{' '}
                                <span className="font-medium line-through text-red-600">
                                  {JSON.stringify(entry.details.old_value)}
                                </span>
                              </div>
                            )}
                            {entry.details.new_value !== undefined && (
                              <div className="text-sm">
                                <span className="text-gray-600">Giá trị mới:</span>{' '}
                                <span className="font-medium text-green-600">
                                  {JSON.stringify(entry.details.new_value)}
                                </span>
                              </div>
                            )}
                            {entry.details.reason && (
                              <div className="text-sm">
                                <span className="text-gray-600">Lý do:</span>{' '}
                                <span className="italic">{entry.details.reason}</span>
                              </div>
                            )}
                            {entry.details.expires_at && (
                              <div className="text-sm">
                                <span className="text-gray-600">Hết hạn:</span>{' '}
                                <span className="font-medium">
                                  {new Date(entry.details.expires_at).toLocaleDateString('vi-VN')}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-5xl mb-4">📭</div>
            <p className="text-gray-500">Không có lịch sử nào trong khoảng thời gian này</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {filteredHistory.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Hiển thị {filteredHistory.length} mục</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success('Export feature will be implemented later')}
            >
              📤 Xuất CSV
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleHistory;