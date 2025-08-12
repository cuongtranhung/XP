import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Role, UpdateRoleRequest } from '../../types/role-management';
import roleManagementService from '../../services/roleManagementService';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface EditRoleModalProps {
  role: Role | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (role: Role) => void;
}

const EditRoleModal: React.FC<EditRoleModalProps> = ({
  role,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<UpdateRoleRequest>({
    display_name: '',
    description: '',
    priority: 100,
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Initialize form when role changes
  useEffect(() => {
    if (role && isOpen) {
      setFormData({
        display_name: role.display_name,
        description: role.description || '',
        priority: role.priority,
        is_active: role.is_active
      });
      setErrors({});
    }
  }, [role, isOpen]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.display_name?.trim()) {
      newErrors.display_name = 'Tên hiển thị là bắt buộc';
    }

    if (formData.priority && (formData.priority < 1 || formData.priority > 1000)) {
      newErrors.priority = 'Mức ưu tiên phải từ 1 đến 1000';
    }

    // System roles cannot change priority to avoid conflicts
    if (role?.is_system && formData.priority !== role.priority) {
      newErrors.priority = 'Không thể thay đổi priority của vai trò hệ thống';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!role || !validateForm()) {
      return;
    }

    try {
      setSaving(true);
      
      const updateData: UpdateRoleRequest = {
        display_name: formData.display_name?.trim(),
        description: formData.description?.trim() || undefined,
        priority: formData.priority,
        is_active: formData.is_active
      };

      const response = await roleManagementService.updateRole(role.id, updateData);
      
      if (response.success) {
        toast.success('Cập nhật vai trò thành công!');
        onSuccess?.(response.data);
        onClose();
      } else {
        toast.error(response.error || 'Không thể cập nhật vai trò');
      }
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error('Lỗi khi cập nhật vai trò');
    } finally {
      setSaving(false);
    }
  };

  // Get priority color indicator
  const getPriorityColor = (priority: number): string => {
    if (priority >= 900) return 'text-red-600';
    if (priority >= 500) return 'text-orange-600';
    if (priority >= 100) return 'text-yellow-600';
    return 'text-gray-600';
  };

  // Get priority level text
  const getPriorityLevel = (priority: number): string => {
    if (priority >= 900) return 'Cấp cao (Admin)';
    if (priority >= 500) return 'Cấp trung (Manager)';
    if (priority >= 100) return 'Cấp cơ bản (User)';
    return 'Cấp thấp';
  };

  if (!isOpen || !role) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              ✏️ Chỉnh Sửa Vai Trò
            </h3>
            <button
              onClick={onClose}
              disabled={saving}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              {role.is_system ? '🔒' : '⚙️'} <span className="font-medium">{role.display_name}</span> ({role.name})
            </p>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* Role Info (Read-only) */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-md font-medium text-gray-900 mb-3">
              ℹ️ Thông Tin Vai Trò:
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Tên hệ thống:</span>
                <div className="font-medium">{role.name}</div>
              </div>
              <div>
                <span className="text-gray-500">Loại:</span>
                <div className="font-medium">
                  {role.is_system ? (
                    <span className="text-blue-600">🔒 Hệ thống</span>
                  ) : (
                    <span className="text-green-600">⚙️ Tùy chỉnh</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Ngày tạo:</span>
                <div className="font-medium">
                  {new Date(role.created_at).toLocaleDateString('vi-VN')}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Cập nhật lần cuối:</span>
                <div className="font-medium">
                  {new Date(role.updated_at).toLocaleDateString('vi-VN')}
                </div>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-6">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tên Hiển Thị: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                className={`block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                  errors.display_name ? 'border-red-300' : ''
                }`}
                placeholder="Trưởng Nhóm"
                disabled={saving}
              />
              {errors.display_name && (
                <p className="text-red-500 text-xs mt-1">{errors.display_name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mô Tả:
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Mô tả chi tiết về vai trò này..."
                disabled={saving}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mức Độ Ưu Tiên (Priority): <span className="text-red-500">*</span>
                {role.is_system && (
                  <span className="ml-2 text-xs text-gray-500">
                    🔒 Không thể thay đổi với vai trò hệ thống
                  </span>
                )}
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    priority: parseInt(e.target.value) || role.priority 
                  }))}
                  className={`w-32 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    errors.priority ? 'border-red-300' : ''
                  }`}
                  disabled={saving || role.is_system}
                />
                <span className={`text-sm font-medium ${getPriorityColor(formData.priority || role.priority)}`}>
                  {getPriorityLevel(formData.priority || role.priority)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ℹ️ Phạm vi: 1-1000 (cao hơn = quyền lớn hơn)
              </p>
              {errors.priority && (
                <p className="text-red-500 text-xs mt-1">{errors.priority}</p>
              )}
              
              {/* Priority Scale (only if not system role) */}
              {!role.is_system && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1</span>
                    <span>100</span>
                    <span>500</span>
                    <span>900</span>
                    <span>1000</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                      style={{ width: `${((formData.priority || role.priority) / 1000) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Thấp</span>
                    <span>User</span>
                    <span>Manager</span>
                    <span>Admin</span>
                    <span>Super</span>
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trạng Thái:
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    disabled={saving}
                  />
                  <span className="ml-3">
                    {formData.is_active ? '✅ Vai trò đang hoạt động' : '❌ Vai trò bị vô hiệu hóa'}
                  </span>
                </label>
                {!formData.is_active && (
                  <p className="text-xs text-orange-600 ml-7">
                    ⚠️ Người dùng có vai trò này sẽ không có quyền tương ứng
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {role.is_system && (
                <span className="text-blue-600">
                  🔒 Vai trò hệ thống - Một số trường không thể chỉnh sửa
                </span>
              )}
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={saving}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? <LoadingSpinner size="xs" /> : '💾 Lưu Thay Đổi'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditRoleModal;