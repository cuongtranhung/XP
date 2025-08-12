import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import Badge from '../common/Badge';

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
  category: string;
}

interface GroupPermission {
  permission_id: string;
  resource: string;
  action: string;
  granted_at: string;
  granted_by: string;
}

interface GroupPermissionsModalProps {
  groupId: string;
  groupName: string;
  isOpen: boolean;
  onClose: () => void;
  onPermissionsUpdated: () => void;
}

export const GroupPermissionsModal: React.FC<GroupPermissionsModalProps> = ({
  groupId,
  groupName,
  isOpen,
  onClose,
  onPermissionsUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [groupPermissions, setGroupPermissions] = useState<GroupPermission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Mock permissions data - In real app, this would come from API
  const mockPermissions: Permission[] = [
    // User Management
    { id: 'users_read', resource: 'users', action: 'read', description: 'Xem danh sách người dùng', category: 'user_management' },
    { id: 'users_create', resource: 'users', action: 'create', description: 'Tạo người dùng mới', category: 'user_management' },
    { id: 'users_update', resource: 'users', action: 'update', description: 'Cập nhật thông tin người dùng', category: 'user_management' },
    { id: 'users_delete', resource: 'users', action: 'delete', description: 'Xóa người dùng', category: 'user_management' },
    
    // Group Management
    { id: 'groups_read', resource: 'groups', action: 'read', description: 'Xem danh sách nhóm', category: 'group_management' },
    { id: 'groups_create', resource: 'groups', action: 'create', description: 'Tạo nhóm mới', category: 'group_management' },
    { id: 'groups_update', resource: 'groups', action: 'update', description: 'Cập nhật thông tin nhóm', category: 'group_management' },
    { id: 'groups_delete', resource: 'groups', action: 'delete', description: 'Xóa nhóm', category: 'group_management' },
    { id: 'group_members_manage', resource: 'group_members', action: 'manage', description: 'Quản lý thành viên nhóm', category: 'group_management' },
    
    // Form Builder
    { id: 'forms_read', resource: 'forms', action: 'read', description: 'Xem danh sách form', category: 'form_builder' },
    { id: 'forms_create', resource: 'forms', action: 'create', description: 'Tạo form mới', category: 'form_builder' },
    { id: 'forms_update', resource: 'forms', action: 'update', description: 'Cập nhật form', category: 'form_builder' },
    { id: 'forms_delete', resource: 'forms', action: 'delete', description: 'Xóa form', category: 'form_builder' },
    { id: 'forms_submit', resource: 'forms', action: 'submit', description: 'Nộp form', category: 'form_builder' },
    
    // Comments System
    { id: 'comments_read', resource: 'comments', action: 'read', description: 'Xem bình luận', category: 'comments' },
    { id: 'comments_create', resource: 'comments', action: 'create', description: 'Tạo bình luận', category: 'comments' },
    { id: 'comments_update', resource: 'comments', action: 'update', description: 'Cập nhật bình luận', category: 'comments' },
    { id: 'comments_delete', resource: 'comments', action: 'delete', description: 'Xóa bình luận', category: 'comments' },
    { id: 'comments_moderate', resource: 'comments', action: 'moderate', description: 'Kiểm duyệt bình luận', category: 'comments' },
    
    // System Administration
    { id: 'system_config', resource: 'system', action: 'config', description: 'Cấu hình hệ thống', category: 'system' },
    { id: 'system_audit', resource: 'system', action: 'audit', description: 'Xem nhật ký hệ thống', category: 'system' },
    { id: 'system_backup', resource: 'system', action: 'backup', description: 'Sao lưu hệ thống', category: 'system' }
  ];

  useEffect(() => {
    if (isOpen && groupId) {
      loadPermissions();
    }
  }, [isOpen, groupId]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setAvailablePermissions(mockPermissions);
      
      // Mock group permissions - In real app, this would come from API
      const mockGroupPermissions: GroupPermission[] = [
        { permission_id: 'users_read', resource: 'users', action: 'read', granted_at: new Date().toISOString(), granted_by: 'admin' },
        { permission_id: 'groups_read', resource: 'groups', action: 'read', granted_at: new Date().toISOString(), granted_by: 'admin' }
      ];
      setGroupPermissions(mockGroupPermissions);
      setSelectedPermissions(new Set(mockGroupPermissions.map(p => p.permission_id)));
      
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast.error('Lỗi khi tải danh sách quyền');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const handleSavePermissions = async () => {
    try {
      setSaving(true);
      
      // Mock save - In real app, this would call API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Đã cập nhật quyền nhóm thành công!');
      onPermissionsUpdated();
      onClose();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Lỗi khi cập nhật quyền nhóm');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryText = (category: string) => {
    switch (category) {
      case 'user_management': return 'Quản lý người dùng';
      case 'group_management': return 'Quản lý nhóm';
      case 'form_builder': return 'Xây dựng form';
      case 'comments': return 'Hệ thống bình luận';
      case 'system': return 'Quản trị hệ thống';
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'user_management': return 'bg-blue-100 text-blue-800';
      case 'group_management': return 'bg-green-100 text-green-800';
      case 'form_builder': return 'bg-purple-100 text-purple-800';
      case 'comments': return 'bg-yellow-100 text-yellow-800';
      case 'system': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'read': return 'bg-green-100 text-green-800';
      case 'create': return 'bg-blue-100 text-blue-800';
      case 'update': return 'bg-yellow-100 text-yellow-800';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'manage': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredPermissions = availablePermissions.filter(permission => {
    const matchesSearch = permission.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         permission.resource.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || permission.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(availablePermissions.map(p => p.category)));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Quản lý quyền nhóm
              </h3>
              <p className="text-sm text-gray-600">
                Nhóm: <span className="font-medium">{groupName}</span>
              </p>
            </div>
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

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-gray-600">Đang tải danh sách quyền...</span>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Tìm kiếm quyền..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Category Filter */}
                  <div className="w-full sm:w-64">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">Tất cả phân loại</option>
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {getCategoryText(category)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selected Count */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Đã chọn: <span className="font-medium">{selectedPermissions.size}</span> quyền
                  </div>
                  <div className="text-sm text-gray-600">
                    Hiển thị: <span className="font-medium">{filteredPermissions.length}</span> quyền
                  </div>
                </div>
              </div>

              {/* Permissions List */}
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {filteredPermissions.map((permission) => (
                    <div
                      key={permission.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedPermissions.has(permission.id)
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handlePermissionToggle(permission.id)}
                    >
                      <div className="flex items-center flex-1">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has(permission.id)}
                          onChange={() => handlePermissionToggle(permission.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {permission.description}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getCategoryColor(permission.category)}>
                              {getCategoryText(permission.category)}
                            </Badge>
                            <Badge className={getActionColor(permission.action)}>
                              {permission.action.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {permission.resource}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {filteredPermissions.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Không tìm thấy quyền nào phù hợp
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mt-6 flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button 
              onClick={handleSavePermissions}
              disabled={loading || saving}
            >
              {saving ? (
                <>
                  <LoadingSpinner size="xs" />
                  <span className="ml-2">Đang lưu...</span>
                </>
              ) : (
                '💾 Lưu quyền'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupPermissionsModal;