import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { UserManagement, UserManagementFilters } from '../../types/user-management';
import userManagementService from '../../services/userManagementService';
import Badge from '../common/Badge';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import Avatar from '../common/Avatar';
import RoleBadge from '../role-management/RoleBadge';

interface UserManagementTableProps {
  filters?: UserManagementFilters;
  onUserSelect?: (user: UserManagement) => void;
  onManageRoles?: (user: UserManagement) => void;
  onBulkRoleAssignment?: (userIds: string[]) => void;
}

export const UserManagementTable: React.FC<UserManagementTableProps> = ({
  filters = {},
  onUserSelect,
  onManageRoles,
  onBulkRoleAssignment
}) => {
  const [users, setUsers] = useState<UserManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Load users
  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userManagementService.getUsers(filters);
      if (response.success) {
        setUsers(response.data);
        setTotal(response.total);
      } else {
        toast.error('Không thể tải danh sách người dùng');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Lỗi khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  // Load users on component mount or filter change
  useEffect(() => {
    loadUsers();
  }, [filters]);

  // Toggle user approval
  const handleToggleApproval = async (user: UserManagement) => {
    const actionKey = `approval-${user.id}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      
      const response = await userManagementService.toggleUserApproval(user.id);
      if (response.success) {
        toast.success(response.message);
        // Update user in state
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
  };

  // Toggle user block
  const handleToggleBlock = async (user: UserManagement) => {
    const actionKey = `block-${user.id}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      
      const response = await userManagementService.toggleUserBlock(user.id);
      if (response.success) {
        toast.success(response.message);
        // Update user in state
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
  };

  // Handle bulk operations
  const handleBulkApprove = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Vui lòng chọn ít nhất một người dùng');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn phê duyệt ${selectedUsers.length} người dùng đã chọn?`)) {
      return;
    }

    try {
      setBulkLoading(true);
      const response = await userManagementService.bulkApproveUsers(selectedUsers);
      if (response.success) {
        toast.success(`Đã phê duyệt thành công ${response.data.successful.length} người dùng`);
        if (response.data.failed.length > 0) {
          toast.error(`Không thể phê duyệt ${response.data.failed.length} người dùng`);
        }
        setSelectedUsers([]);
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
  };

  const handleBulkBlock = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Vui lòng chọn ít nhất một người dùng');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn chặn ${selectedUsers.length} người dùng đã chọn?`)) {
      return;
    }

    try {
      setBulkLoading(true);
      const response = await userManagementService.bulkBlockUsers(selectedUsers);
      if (response.success) {
        toast.success(`Đã chặn thành công ${response.data.successful.length} người dùng`);
        if (response.data.failed.length > 0) {
          toast.error(`Không thể chặn ${response.data.failed.length} người dùng`);
        }
        setSelectedUsers([]);
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
  };

  const handleBulkUnblock = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Vui lòng chọn ít nhất một người dùng');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn bỏ chặn ${selectedUsers.length} người dùng đã chọn?`)) {
      return;
    }

    try {
      setBulkLoading(true);
      const response = await userManagementService.bulkUnblockUsers(selectedUsers);
      if (response.success) {
        toast.success(`Đã bỏ chặn thành công ${response.data.successful.length} người dùng`);
        if (response.data.failed.length > 0) {
          toast.error(`Không thể bỏ chặn ${response.data.failed.length} người dùng`);
        }
        setSelectedUsers([]);
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
  };

  // Handle select all
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUsers(users.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  // Handle individual selection
  const handleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle manage roles
  const handleManageRoles = (user: UserManagement) => {
    if (onManageRoles) {
      onManageRoles(user);
    } else {
      toast.info('Chức năng quản lý vai trò sẽ được triển khai sớm');
    }
  };

  // Handle bulk role assignment
  const handleBulkRoleAssignment = () => {
    if (onBulkRoleAssignment && selectedUsers.length > 0) {
      onBulkRoleAssignment(selectedUsers);
    } else {
      toast.info('Chức năng gán vai trò hàng loạt sẽ được triển khai sớm');
    }
  };

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
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Danh sách người dùng ({total})
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
        {selectedUsers.length > 0 && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-800">
                Đã chọn {selectedUsers.length} người dùng
              </span>
              <div className="flex space-x-2 flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleBulkRoleAssignment}
                  disabled={bulkLoading}
                  title="Gán vai trò cho các user đã chọn"
                >
                  👥 Gán vai trò
                </Button>
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
                  onClick={() => setSelectedUsers([])}
                >
                  Bỏ chọn
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === users.length && users.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Người dùng
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phòng ban / Vị trí
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vai trò
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trạng thái
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phê duyệt
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Chặn
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ngày tạo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className={`hover:bg-gray-50 ${selectedUsers.includes(user.id) ? 'bg-blue-50' : ''}`}>
                {/* Selection Checkbox */}
                <td className="px-3 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => handleUserSelection(user.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </td>

                {/* User Info */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Avatar
                        src={user.avatar_url}
                        name={user.full_name || user.email}
                        size="md"
                        alt={`Avatar của ${user.full_name || user.email}`}
                      />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.full_name || 'Chưa có tên'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.email}
                      </div>
                      {user.username && (
                        <div className="text-xs text-gray-400">
                          @{user.username}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Department / Position */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {user.department || 'Chưa có phòng ban'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {user.position || 'Chưa có vị trí'}
                  </div>
                </td>

                {/* Roles */}
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {user.roles && user.roles.length > 0 ? (
                      user.roles.map((userRole, index) => {
                        const role = {
                          id: userRole.role_id,
                          name: userRole.name,
                          display_name: userRole.display_name,
                          description: userRole.description,
                          priority: userRole.priority,
                          is_system: userRole.is_system,
                          is_active: userRole.is_active,
                          created_at: '',
                          updated_at: ''
                        };
                        return (
                          <RoleBadge
                            key={`${userRole.role_id}-${index}`}
                            role={role}
                            userRole={userRole}
                            size="xs"
                            showExpiration={true}
                          />
                        );
                      })
                    ) : (
                      <span className="text-xs text-gray-400 italic">Chưa có vai trò</span>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge className={getStatusColor(user.status)}>
                    {user.status === 'active' ? 'Hoạt động' : 
                     user.status === 'inactive' ? 'Không hoạt động' : 
                     user.status === 'pending' ? 'Chờ xử lý' : user.status}
                  </Badge>
                </td>

                {/* Approval Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <Button
                    size="sm"
                    variant={user.is_approved ? 'success' : 'outline'}
                    onClick={() => handleToggleApproval(user)}
                    disabled={actionLoading[`approval-${user.id}`]}
                    className="min-w-[80px]"
                  >
                    {actionLoading[`approval-${user.id}`] ? (
                      <LoadingSpinner size="xs" />
                    ) : (
                      user.is_approved ? '✅ Đã duyệt' : '⏳ Chờ duyệt'
                    )}
                  </Button>
                </td>

                {/* Block Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <Button
                    size="sm"
                    variant={user.is_blocked ? 'danger' : 'outline'}
                    onClick={() => handleToggleBlock(user)}
                    disabled={actionLoading[`block-${user.id}`]}
                    className="min-w-[80px]"
                  >
                    {actionLoading[`block-${user.id}`] ? (
                      <LoadingSpinner size="xs" />
                    ) : (
                      user.is_blocked ? '🚫 Đã chặn' : '✅ Bình thường'
                    )}
                  </Button>
                </td>

                {/* Created Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(user.created_at)}
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleManageRoles(user)}
                      title="Quản lý vai trò"
                    >
                      👥 Vai trò
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUserSelect?.(user)}
                    >
                      📝 Chi tiết
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-700">
          Hiển thị <span className="font-medium">{users.length}</span> trên tổng số{' '}
          <span className="font-medium">{total}</span> người dùng
        </div>
      </div>
    </div>
  );
};

export default UserManagementTable;