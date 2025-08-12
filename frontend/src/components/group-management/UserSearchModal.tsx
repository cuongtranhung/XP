import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { UserForGroupAssignment, BulkMemberResponse } from '../../types/group-management';
import groupManagementService from '../../services/groupManagementService';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { LoadingSpinner } from '../common/LoadingSpinner';
import Badge from '../common/Badge';

interface UserSearchModalProps {
  groupId: string;
  groupName: string;
  isOpen: boolean;
  onClose: () => void;
  onMembersAdded: () => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  groupId,
  groupName,
  isOpen,
  onClose,
  onMembersAdded
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [availableUsers, setAvailableUsers] = useState<UserForGroupAssignment[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedRole, setSelectedRole] = useState<'member' | 'manager' | 'owner'>('member');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  // Debounce search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const debouncedSearch = useCallback((term: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      searchUsers(term, selectedDepartment);
    }, 300);

    setSearchTimeout(timeout);
  }, [selectedDepartment]);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setSearchTerm('');
      setSelectedDepartment('');
      setSelectedUsers(new Set());
      setSelectedRole('member');
      // Load initial users
      searchUsers();
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm) {
      debouncedSearch(searchTerm);
    } else if (isOpen) {
      searchUsers('', selectedDepartment);
    }
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    if (isOpen) {
      searchUsers(searchTerm, selectedDepartment);
    }
  }, [selectedDepartment]);

  const searchUsers = async (search?: string, department?: string) => {
    try {
      setLoading(true);
      const response = await groupManagementService.searchUsersForAssignment(
        groupId,
        search || undefined,
        department || undefined,
        50 // Limit to 50 results
      );

      if (response.success) {
        setAvailableUsers(response.data);
        // Extract unique departments for filter
        const depts = [...new Set(
          response.data
            .map(user => user.department)
            .filter(dept => dept && dept.trim() !== '')
        )];
        setDepartments(depts);
      } else {
        toast.error('Không thể tìm kiếm người dùng: ' + response.error);
        setAvailableUsers([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Lỗi khi tìm kiếm người dùng');
      setAvailableUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === availableUsers.length) {
      // Deselect all
      setSelectedUsers(new Set());
    } else {
      // Select all
      setSelectedUsers(new Set(availableUsers.map(user => user.id.toString())));
    }
  };

  const handleAddSelectedUsers = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Vui lòng chọn ít nhất một người dùng');
      return;
    }

    try {
      setAdding(true);
      const response: BulkMemberResponse = await groupManagementService.addMembersToGroup(
        groupId,
        {
          user_ids: Array.from(selectedUsers),
          role_in_group: selectedRole
        }
      );

      if (response.success) {
        const { successful_count, failed_count, total } = response.data.summary;
        
        if (failed_count === 0) {
          toast.success(`Đã thêm thành công ${successful_count} thành viên vào nhóm`);
        } else {
          toast.success(
            `Đã thêm ${successful_count}/${total} thành viên. ${failed_count} thành viên thêm thất bại.`,
            { duration: 4000 }
          );
        }

        // Show failed users if any
        if (response.data.failed.length > 0) {
          console.log('Failed additions:', response.data.failed);
        }

        onMembersAdded();
        onClose();
      } else {
        toast.error('Không thể thêm thành viên vào nhóm');
      }
    } catch (error) {
      console.error('Error adding members:', error);
      toast.error('Lỗi khi thêm thành viên vào nhóm');
    } finally {
      setAdding(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'member': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'owner': return 'Chủ sở hữu';
      case 'manager': return 'Quản lý';
      case 'member': return 'Thành viên';
      default: return role;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Thêm thành viên vào nhóm: {groupName}
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

          {/* Search and Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tìm kiếm theo tên hoặc email
              </label>
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nhập tên hoặc email..."
                icon="🔍"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lọc theo phòng ban
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vai trò trong nhóm
            </label>
            <div className="flex space-x-4">
              {['member', 'manager', 'owner'].map((role) => (
                <label key={role} className="flex items-center">
                  <input
                    type="radio"
                    value={role}
                    checked={selectedRole === role}
                    onChange={(e) => setSelectedRole(e.target.value as any)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2">
                    <Badge className={getRoleColor(role)}>
                      {getRoleText(role)}
                    </Badge>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* User List */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-md font-medium text-gray-900">
                Danh sách người dùng khả dụng 
                {!loading && ` (${availableUsers.length})`}
              </h4>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAll}
                  disabled={loading || availableUsers.length === 0}
                >
                  {selectedUsers.size === availableUsers.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </Button>
                <span className="text-sm text-gray-600 flex items-center">
                  Đã chọn: {selectedUsers.size}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner size="lg" />
                <span className="ml-3 text-gray-600">Đang tìm kiếm...</span>
              </div>
            ) : availableUsers.length > 0 ? (
              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                {availableUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer ${
                      selectedUsers.has(user.id.toString()) ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleUserSelect(user.id.toString())}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id.toString())}
                      onChange={() => handleUserSelect(user.id.toString())}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    
                    <div className="ml-3 flex-1">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-700">
                              {user.full_name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {user.full_name || 'Chưa có tên'}
                          </div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                          {user.department && (
                            <div className="text-xs text-gray-400">{user.department}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {user.is_approved === false && (
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                          Chờ duyệt
                        </Badge>
                      )}
                      {user.is_blocked && (
                        <Badge className="bg-red-100 text-red-800 text-xs">
                          Bị khóa
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                {searchTerm || selectedDepartment 
                  ? 'Không tìm thấy người dùng phù hợp' 
                  : 'Không có người dùng nào khả dụng để thêm vào nhóm'
                }
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={adding}
            >
              Hủy
            </Button>
            <Button 
              onClick={handleAddSelectedUsers}
              disabled={adding || selectedUsers.size === 0}
            >
              {adding ? (
                <>
                  <LoadingSpinner size="xs" />
                  <span className="ml-2">Đang thêm...</span>
                </>
              ) : (
                `➕ Thêm ${selectedUsers.size} thành viên`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSearchModal;