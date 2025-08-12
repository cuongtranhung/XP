import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { CreateRoleRequest } from '../../types/role-management';
import roleManagementService from '../../services/roleManagementService';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (role: any) => void;
}

const CreateRoleModal: React.FC<CreateRoleModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<CreateRoleRequest>({
    name: '',
    display_name: '',
    description: '',
    priority: 100
  });
  const [roleType, setRoleType] = useState<'system' | 'custom' | 'department'>('custom');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        display_name: '',
        description: '',
        priority: 100
      });
      setRoleType('custom');
      setIsActive(true);
      setErrors({});
    }
  }, [isOpen]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Tên hệ thống là bắt buộc';
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.name)) {
      newErrors.name = 'Tên hệ thống phải viết thường, bắt đầu bằng chữ cái, chỉ chứa a-z, 0-9, _';
    }

    if (!formData.display_name.trim()) {
      newErrors.display_name = 'Tên hiển thị là bắt buộc';
    }

    if (formData.priority < 1 || formData.priority > 1000) {
      newErrors.priority = 'Mức ưu tiên phải từ 1 đến 1000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      
      const roleData: CreateRoleRequest = {
        ...formData,
        name: formData.name.toLowerCase().trim(),
        display_name: formData.display_name.trim(),
        description: formData.description?.trim() || undefined
      };

      const response = await roleManagementService.createRole(roleData);
      
      if (response.success) {
        toast.success('Tạo vai trò thành công!');
        onSuccess?.(response.data);
        onClose();
      } else {
        toast.error(response.error || 'Không thể tạo vai trò');
        if (response.error?.includes('already exists')) {
          setErrors({ name: 'Tên vai trò đã tồn tại' });
        }
      }
    } catch (error: any) {
      console.error('Error creating role:', error);
      toast.error('Lỗi khi tạo vai trô');
    } finally {
      setSaving(false);
    }
  };

  // Generate name from display name
  const handleDisplayNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, display_name: value }));
    
    // Auto-generate system name if it's empty
    if (!formData.name) {
      const generatedName = value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .replace(/^_+|_+$/g, '');
      
      if (generatedName) {
        setFormData(prev => ({ ...prev, name: generatedName }));
      }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              ✨ Tạo Vai Trò Mới
            </h3>
            <button
              onClick={onClose}
              disabled={saving}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* Basic Information */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              📝 Thông Tin Cơ Bản:
            </h4>
            
            {/* Display Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tên Hiển Thị: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
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

            {/* System Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tên Hệ Thống: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? 'border-red-300' : ''
                }`}
                placeholder="team_lead"
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                ℹ️ Viết thường, không dấu, không khoảng trắng (a-z, 0-9, _)
              </p>
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mô Tả:
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Quản lý các thành viên trong nhóm và điều phối công việc của team..."
                disabled={saving}
              />
            </div>
          </div>

          {/* Configuration */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              ⚙️ Cấu Hình:
            </h4>

            {/* Priority */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mức Độ Ưu Tiên (Priority): <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 100 }))}
                  className={`w-32 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    errors.priority ? 'border-red-300' : ''
                  }`}
                  disabled={saving}
                />
                <span className={`text-sm font-medium ${getPriorityColor(formData.priority)}`}>
                  {getPriorityLevel(formData.priority)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ℹ️ Phạm vi: 1-1000 (cao hơn = quyền lớn hơn)
              </p>
              {errors.priority && (
                <p className="text-red-500 text-xs mt-1">{errors.priority}</p>
              )}
              
              {/* Priority Scale */}
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
                    style={{ width: `${(formData.priority / 1000) * 100}%` }}
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
            </div>

            {/* Role Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Loại Vai Trò:
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="system"
                    checked={roleType === 'system'}
                    onChange={(e) => setRoleType(e.target.value as any)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    disabled={saving}
                  />
                  <span className="ml-3">○ Vai trò hệ thống</span>
                  <span className="ml-2 text-xs text-gray-500">(Không thể xóa sau khi tạo)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="custom"
                    checked={roleType === 'custom'}
                    onChange={(e) => setRoleType(e.target.value as any)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    disabled={saving}
                  />
                  <span className="ml-3">● Vai trò tùy chỉnh</span>
                  <span className="ml-2 text-xs text-gray-500">(Có thể chỉnh sửa và xóa)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="department"
                    checked={roleType === 'department'}
                    onChange={(e) => setRoleType(e.target.value as any)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    disabled={saving}
                  />
                  <span className="ml-3">○ Vai trò phòng ban</span>
                  <span className="ml-2 text-xs text-gray-500">(Gắn với phòng ban cụ thể)</span>
                </label>
              </div>
            </div>

            {/* Status */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trạng Thái:
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={saving}
                />
                <span className="ml-3">☑ Kích hoạt ngay sau khi tạo</span>
              </label>
            </div>
          </div>

          {/* Warning */}
          {roleType === 'system' && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <span className="text-yellow-600 mr-2">⚠️</span>
                <div className="text-sm text-yellow-800">
                  <strong>Lưu ý:</strong> Vai trò hệ thống không thể xóa sau khi tạo. 
                  Chỉ có thể chỉnh sửa mô tả và trạng thái.
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end space-x-3">
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
              {saving ? <LoadingSpinner size="xs" /> : '💾 Tạo Vai Trò'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRoleModal;