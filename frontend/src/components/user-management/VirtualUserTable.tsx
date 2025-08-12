/**
 * Virtual User Management Table
 * High-performance virtualized table for handling large user datasets (10,000+ users)
 * Features: Virtual scrolling, memoized rows, bulk operations, real-time updates
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from 'react';
import { VariableSizeList as List, ListChildComponentProps } from 'react-window';
import { toast } from 'react-hot-toast';
import { UserManagement, UserManagementFilters } from '../../types/user-management';
import userManagementService from '../../services/userManagementService';
import Badge from '../common/Badge';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface VirtualUserTableProps {
  filters?: UserManagementFilters;
  onUserSelect?: (user: UserManagement) => void;
  height?: number;
  className?: string;
}

interface UserRowData {
  users: UserManagement[];
  selectedUsers: Set<string>;
  actionLoading: { [key: string]: boolean };
  onUserSelect?: (user: UserManagement) => void;
  onToggleApproval: (user: UserManagement) => void;
  onToggleBlock: (user: UserManagement) => void;
  onUserSelection: (userId: string) => void;
}

// Memoized User Row Component for optimal performance
const UserRow = React.memo(forwardRef<HTMLDivElement, ListChildComponentProps<UserRowData>>(({ index, style, data }, ref) => {
  const { 
    users, 
    selectedUsers, 
    actionLoading, 
    onUserSelect, 
    onToggleApproval, 
    onToggleBlock, 
    onUserSelection 
  } = data;

  const user = users[index];
  const isSelected = selectedUsers.has(user.id);

  // Memoized handlers to prevent unnecessary re-renders
  const handleUserClick = useCallback(() => {
    onUserSelect?.(user);
  }, [onUserSelect, user]);

  const handleToggleSelection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onUserSelection(user.id);
  }, [onUserSelection, user.id]);

  const handleApprovalToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleApproval(user);
  }, [onToggleApproval, user]);

  const handleBlockToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleBlock(user);
  }, [onToggleBlock, user]);

  // Memoized status color
  const statusColor = useMemo(() => {
    switch (user.status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, [user.status]);

  // Memoized date formatting
  const formattedDate = useMemo(() => {
    return new Date(user.created_at).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [user.created_at]);

  return (
    <div
      ref={ref}
      style={style}
      className={`flex items-center border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50' : ''
      }`}
      onClick={handleUserClick}
    >
      {/* Selection Checkbox */}
      <div className="flex-shrink-0 w-12 px-3 py-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleToggleSelection}
          onClick={handleToggleSelection}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0 px-6 py-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {user.full_name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="ml-4 min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 truncate">
              {user.full_name || 'Chưa có tên'}
            </div>
            <div className="text-sm text-gray-500 truncate">
              {user.email}
            </div>
            {user.username && (
              <div className="text-xs text-gray-400 truncate">
                @{user.username}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Department / Position */}
      <div className="flex-shrink-0 w-48 px-6 py-4">
        <div className="text-sm text-gray-900 truncate">
          {user.department || 'Chưa có phòng ban'}
        </div>
        <div className="text-sm text-gray-500 truncate">
          {user.position || 'Chưa có vị trí'}
        </div>
      </div>

      {/* Status */}
      <div className="flex-shrink-0 w-32 px-6 py-4">
        <Badge className={statusColor}>
          {user.status === 'active' ? 'Hoạt động' : 
           user.status === 'inactive' ? 'Không hoạt động' : 
           user.status === 'pending' ? 'Chờ xử lý' : user.status}
        </Badge>
      </div>

      {/* Approval Status */}
      <div className="flex-shrink-0 w-32 px-6 py-4">
        <Button
          size="sm"
          variant={user.is_approved ? 'success' : 'outline'}
          onClick={handleApprovalToggle}
          disabled={actionLoading[`approval-${user.id}`]}
          className="min-w-[80px]"
        >
          {actionLoading[`approval-${user.id}`] ? (
            <LoadingSpinner size="xs" />
          ) : (
            user.is_approved ? '✅ Đã duyệt' : '⏳ Chờ duyệt'
          )}
        </Button>
      </div>

      {/* Block Status */}
      <div className="flex-shrink-0 w-32 px-6 py-4">
        <Button
          size="sm"
          variant={user.is_blocked ? 'danger' : 'outline'}
          onClick={handleBlockToggle}
          disabled={actionLoading[`block-${user.id}`]}
          className="min-w-[80px]"
        >
          {actionLoading[`block-${user.id}`] ? (
            <LoadingSpinner size="xs" />
          ) : (
            user.is_blocked ? '🚫 Đã chặn' : '✅ Bình thường'
          )}
        </Button>
      </div>

      {/* Created Date */}
      <div className="flex-shrink-0 w-40 px-6 py-4 text-sm text-gray-500">
        {formattedDate}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 w-24 px-6 py-4">
        <Button
          size="sm"
          variant="outline"
          onClick={handleUserClick}
        >
          📝 Chi tiết
        </Button>
      </div>
    </div>
  );
}));

UserRow.displayName = 'VirtualUserRow';

const VirtualUserTable: React.FC<VirtualUserTableProps> = ({
  filters = {},
  onUserSelect,
  height = 600,
  className = ''
}) => {
  const [users, setUsers] = useState<UserManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const listRef = useRef<List>(null);
  
  // Memoized row height calculation (can be dynamic based on content)
  const getItemSize = useCallback((index: number) => {
    return 80; // Fixed row height for consistent scrolling performance
  }, []);

  // Load users with optimized filtering
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await userManagementService.getUsers(filters);
      if (response.success) {
        setUsers(response.data);
        setTotal(response.total);
        // Clear selections when data changes
        setSelectedUsers(new Set());
      } else {
        toast.error('Không thể tải danh sách người dùng');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Lỗi khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load users on component mount or filter change
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Optimized toggle approval handler
  const handleToggleApproval = useCallback(async (user: UserManagement) => {
    const actionKey = `approval-${user.id}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      
      const response = await userManagementService.toggleUserApproval(user.id);
      if (response.success) {
        toast.success(response.message);
        // Update user in state with immutable update
        setUsers(prev => prev.map(u => 
          u.id === user.id 
            ? { ...u, is_approved: response.data.is_approved, status: response.data.status }
            : u
        ));
      } else {
        toast.error('Không thể thay đổi trạng thái phê duyệt');
      }
    } catch (error) {
      console.error('Error toggling approval:', error);
      toast.error('Lỗi khi thay đổi trạng thái phê duyệt');
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  }, []);

  // Optimized toggle block handler
  const handleToggleBlock = useCallback(async (user: UserManagement) => {
    const actionKey = `block-${user.id}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      
      const response = await userManagementService.toggleUserBlock(user.id);
      if (response.success) {
        toast.success(response.message);
        // Update user in state with immutable update
        setUsers(prev => prev.map(u => 
          u.id === user.id 
            ? { ...u, is_blocked: response.data.is_blocked, status: response.data.status }
            : u
        ));
      } else {
        toast.error('Không thể thay đổi trạng thái chặn');
      }
    } catch (error) {
      console.error('Error toggling block:', error);
      toast.error('Lỗi khi thay đổi trạng thái chặn');
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  }, []);

  // Optimized user selection handler
  const handleUserSelection = useCallback((userId: string) => {
    setSelectedUsers(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(userId)) {
        newSelected.delete(userId);
      } else {
        newSelected.add(userId);
      }
      return newSelected;
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map(user => user.id)));
    } else {
      setSelectedUsers(new Set());
    }
  }, [users]);

  // Bulk operations handlers
  const handleBulkApprove = useCallback(async () => {
    const selectedUserIds = Array.from(selectedUsers);
    if (selectedUserIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một người dùng');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn phê duyệt ${selectedUserIds.length} người dùng đã chọn?`)) {
      return;
    }

    try {
      setBulkLoading(true);
      const response = await userManagementService.bulkApproveUsers(selectedUserIds);
      if (response.success) {
        toast.success(`Đã phê duyệt thành công ${response.data.successful.length} người dùng`);
        if (response.data.failed.length > 0) {
          toast.error(`Không thể phê duyệt ${response.data.failed.length} người dùng`);
        }
        setSelectedUsers(new Set());
        loadUsers();
      } else {
        toast.error('Không thể thực hiện thao tác phê duyệt hàng loạt');
      }
    } catch (error) {
      console.error('Error bulk approving users:', error);
      toast.error('Lỗi khi phê duyệt hàng loạt');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedUsers, loadUsers]);

  const handleBulkBlock = useCallback(async () => {
    const selectedUserIds = Array.from(selectedUsers);
    if (selectedUserIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một người dùng');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn chặn ${selectedUserIds.length} người dùng đã chọn?`)) {
      return;
    }

    try {
      setBulkLoading(true);
      const response = await userManagementService.bulkBlockUsers(selectedUserIds);
      if (response.success) {
        toast.success(`Đã chặn thành công ${response.data.successful.length} người dùng`);
        if (response.data.failed.length > 0) {
          toast.error(`Không thể chặn ${response.data.failed.length} người dùng`);
        }
        setSelectedUsers(new Set());
        loadUsers();
      } else {
        toast.error('Không thể thực hiện thao tác chặn hàng loạt');
      }
    } catch (error) {
      console.error('Error bulk blocking users:', error);
      toast.error('Lỗi khi chặn hàng loạt');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedUsers, loadUsers]);

  const handleBulkUnblock = useCallback(async () => {
    const selectedUserIds = Array.from(selectedUsers);
    if (selectedUserIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một người dùng');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn bỏ chặn ${selectedUserIds.length} người dùng đã chọn?`)) {
      return;
    }

    try {
      setBulkLoading(true);
      const response = await userManagementService.bulkUnblockUsers(selectedUserIds);
      if (response.success) {
        toast.success(`Đã bỏ chặn thành công ${response.data.successful.length} người dùng`);
        if (response.data.failed.length > 0) {
          toast.error(`Không thể bỏ chặn ${response.data.failed.length} người dùng`);
        }
        setSelectedUsers(new Set());
        loadUsers();
      } else {
        toast.error('Không thể thực hiện thao tác bỏ chặn hàng loạt');
      }
    } catch (error) {
      console.error('Error bulk unblocking users:', error);
      toast.error('Lỗi khi bỏ chặn hàng loạt');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedUsers, loadUsers]);

  // Memoized row data to prevent unnecessary re-renders
  const rowData = useMemo((): UserRowData => ({
    users,
    selectedUsers,
    actionLoading,
    onUserSelect,
    onToggleApproval: handleToggleApproval,
    onToggleBlock: handleToggleBlock,
    onUserSelection: handleUserSelection,
  }), [users, selectedUsers, actionLoading, onUserSelect, handleToggleApproval, handleToggleBlock, handleUserSelection]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Đang tải dữ liệu người dùng...</span>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg mb-2">Không tìm thấy người dùng nào</div>
        <div className="text-gray-400">Thử thay đổi bộ lọc hoặc tìm kiếm</div>
      </div>
    );
  }

  return (
    <div className={`bg-white shadow-sm rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Danh sách người dùng ({total.toLocaleString()})
          </h3>
          <Button
            onClick={loadUsers}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            🔄 Làm mới
          </Button>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.size > 0 && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-800">
                Đã chọn {selectedUsers.size} người dùng
              </span>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="success"
                  onClick={handleBulkApprove}
                  disabled={bulkLoading}
                >
                  {bulkLoading ? <LoadingSpinner size="xs" /> : '✅ Phê duyệt tất cả'}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleBulkBlock}
                  disabled={bulkLoading}
                >
                  {bulkLoading ? <LoadingSpinner size="xs" /> : '🚫 Chặn tất cả'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkUnblock}
                  disabled={bulkLoading}
                >
                  {bulkLoading ? <LoadingSpinner size="xs" /> : '✅ Bỏ chặn tất cả'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedUsers(new Set())}
                >
                  Bỏ chọn
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0 w-12 px-3 py-3">
            <input
              type="checkbox"
              checked={selectedUsers.size === users.length && users.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="flex-1 min-w-0 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Người dùng
          </div>
          <div className="flex-shrink-0 w-48 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Phòng ban / Vị trí
          </div>
          <div className="flex-shrink-0 w-32 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Trạng thái
          </div>
          <div className="flex-shrink-0 w-32 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Phê duyệt
          </div>
          <div className="flex-shrink-0 w-32 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Chặn
          </div>
          <div className="flex-shrink-0 w-40 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Ngày tạo
          </div>
          <div className="flex-shrink-0 w-24 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Thao tác
          </div>
        </div>
      </div>

      {/* Virtual List */}
      <List
        ref={listRef}
        height={height}
        itemCount={users.length}
        itemSize={getItemSize}
        itemData={rowData}
        overscanCount={10} // Render extra rows for smoother scrolling
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        {UserRow}
      </List>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-700">
          Hiển thị <span className="font-medium">{users.length.toLocaleString()}</span> trên tổng số{' '}
          <span className="font-medium">{total.toLocaleString()}</span> người dùng
        </div>
      </div>
    </div>
  );
};

export default VirtualUserTable;