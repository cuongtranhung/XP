import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { CreateGroupRequest } from '../../types/group-management';
import groupManagementService from '../../services/groupManagementService';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onGroupCreated
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateGroupRequest>({
    name: '',
    display_name: '',
    description: '',
    group_type: 'custom',
    parent_group_id: undefined
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const handleInputChange = (field: keyof CreateGroupRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Tên nhóm là bắt buộc';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Tên nhóm phải có ít nhất 2 ký tự';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Tên nhóm không được quá 100 ký tự';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.name)) {
      newErrors.name = 'Tên nhóm chỉ được chứa chữ cái, số, gạch dưới và gạch ngang';
    }

    if (!formData.display_name.trim()) {
      newErrors.display_name = 'Tên hiển thị là bắt buộc';
    } else if (formData.display_name.length < 2) {
      newErrors.display_name = 'Tên hiển thị phải có ít nhất 2 ký tự';
    } else if (formData.display_name.length > 255) {
      newErrors.display_name = 'Tên hiển thị không được quá 255 ký tự';
    }

    if (formData.description && formData.description.length > 1000) {
      newErrors.description = 'Mô tả không được quá 1000 ký tự';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const response = await groupManagementService.createGroup(formData);
      
      if (response.success) {
        toast.success('Tạo nhóm mới thành công!');
        handleClose();
        onGroupCreated();
      } else {
        toast.error('Không thể tạo nhóm: ' + response.error);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Lỗi khi tạo nhóm mới');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        name: '',
        display_name: '',
        description: '',
        group_type: 'custom',
        parent_group_id: undefined
      });
      setErrors({});
      onClose();
    }
  };

  const getGroupTypeText = (type: string) => {
    switch (type) {
      case 'department': return 'Phòng ban';
      case 'project': return 'Dự án';
      case 'custom': return 'Tùy chỉnh';
      default: return type;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
          onClick={handleClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Tạo nhóm mới
            </h3>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <span className="sr-only">Đóng</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Group Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Tên nhóm <span className="text-red-500">*</span>
                </label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="vd: it_department, marketing_team"
                  disabled={loading}
                  className={errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Tên nhóm sẽ được sử dụng trong hệ thống (chỉ chữ cái, số, _, -)
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Tên hiển thị <span className="text-red-500">*</span>
                </label>
                <Input
                  id="display_name"
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => handleInputChange('display_name', e.target.value)}
                  placeholder="vd: Phòng Công nghệ thông tin"
                  disabled={loading}
                  className={errors.display_name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                />
                {errors.display_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.display_name}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Tên sẽ hiển thị cho người dùng
                </p>
              </div>

              {/* Group Type */}
              <div>
                <label htmlFor="group_type" className="block text-sm font-medium text-gray-700 mb-1">
                  Loại nhóm <span className="text-red-500">*</span>
                </label>
                <select
                  id="group_type"
                  value={formData.group_type}
                  onChange={(e) => handleInputChange('group_type', e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="custom">Tùy chỉnh</option>
                  <option value="department">Phòng ban</option>
                  <option value="project">Dự án</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Chọn loại nhóm phù hợp với mục đích sử dụng
                </p>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Mô tả về nhóm, mục đích và chức năng..."
                  disabled={loading}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    errors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                  }`}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Tối đa 1000 ký tự
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end space-x-3">
              <Button 
                type="button"
                variant="outline" 
                onClick={handleClose}
                disabled={loading}
              >
                Hủy
              </Button>
              <Button 
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="xs" />
                    <span className="ml-2">Đang tạo...</span>
                  </>
                ) : (
                  '➕ Tạo nhóm'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;