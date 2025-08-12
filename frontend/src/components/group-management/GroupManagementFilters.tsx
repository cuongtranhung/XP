import React, { useState } from 'react';
import { GroupFilters } from '../../types/group-management';
import { Input } from '../common/Input';
import { Button } from '../common/Button';

interface GroupManagementFiltersProps {
  filters: GroupFilters;
  onFiltersChange: (filters: GroupFilters) => void;
  onReset: () => void;
}

export const GroupManagementFiltersComponent: React.FC<GroupManagementFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset
}) => {
  const [localFilters, setLocalFilters] = useState<GroupFilters>(filters);

  const handleInputChange = (field: keyof GroupFilters, value: any) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleReset = () => {
    const emptyFilters: GroupFilters = {};
    setLocalFilters(emptyFilters);
    onReset();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Bộ lọc tìm kiếm</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleReset}
        >
          🔄 Đặt lại
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tìm kiếm
          </label>
          <Input
            type="text"
            placeholder="Tìm theo tên nhóm, mô tả..."
            value={localFilters.search || ''}
            onChange={(e) => handleInputChange('search', e.target.value)}
            className="w-full"
          />
        </div>

        {/* Group Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Loại nhóm
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={localFilters.group_type || ''}
            onChange={(e) => handleInputChange('group_type', e.target.value || undefined)}
          >
            <option value="">Tất cả loại</option>
            <option value="system">Hệ thống</option>
            <option value="department">Phòng ban</option>
            <option value="project">Dự án</option>
            <option value="custom">Tùy chỉnh</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Trạng thái
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={localFilters.is_active === undefined ? '' : localFilters.is_active.toString()}
            onChange={(e) => {
              const value = e.target.value;
              handleInputChange('is_active', value === '' ? undefined : value === 'true');
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Hoạt động</option>
            <option value="false">Không hoạt động</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* System Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nhóm hệ thống
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={localFilters.is_system === undefined ? '' : localFilters.is_system.toString()}
            onChange={(e) => {
              const value = e.target.value;
              handleInputChange('is_system', value === '' ? undefined : value === 'true');
            }}
          >
            <option value="">Tất cả</option>
            <option value="true">Nhóm hệ thống</option>
            <option value="false">Nhóm người dùng</option>
          </select>
        </div>

        {/* Date Range - Created After */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tạo từ ngày
          </label>
          <Input
            type="date"
            value={localFilters.created_after || ''}
            onChange={(e) => handleInputChange('created_after', e.target.value || undefined)}
            className="w-full"
          />
        </div>

        {/* Date Range - Created Before */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tạo đến ngày
          </label>
          <Input
            type="date"
            value={localFilters.created_before || ''}
            onChange={(e) => handleInputChange('created_before', e.target.value || undefined)}
            className="w-full"
          />
        </div>
      </div>

      {/* Active filters display */}
      <div className="mt-4 flex flex-wrap gap-2">
        {localFilters.search && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Tìm kiếm: {localFilters.search}
            <button
              onClick={() => handleInputChange('search', undefined)}
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:text-blue-600"
            >
              ×
            </button>
          </span>
        )}
        {localFilters.group_type && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Loại: {localFilters.group_type === 'system' ? 'Hệ thống' :
                   localFilters.group_type === 'department' ? 'Phòng ban' :
                   localFilters.group_type === 'project' ? 'Dự án' :
                   localFilters.group_type === 'custom' ? 'Tùy chỉnh' : localFilters.group_type}
            <button
              onClick={() => handleInputChange('group_type', undefined)}
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-green-400 hover:text-green-600"
            >
              ×
            </button>
          </span>
        )}
        {localFilters.is_active !== undefined && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Trạng thái: {localFilters.is_active ? 'Hoạt động' : 'Không hoạt động'}
            <button
              onClick={() => handleInputChange('is_active', undefined)}
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-yellow-400 hover:text-yellow-600"
            >
              ×
            </button>
          </span>
        )}
        {localFilters.is_system !== undefined && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            {localFilters.is_system ? 'Nhóm hệ thống' : 'Nhóm người dùng'}
            <button
              onClick={() => handleInputChange('is_system', undefined)}
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-purple-400 hover:text-purple-600"
            >
              ×
            </button>
          </span>
        )}
        {localFilters.created_after && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Từ: {localFilters.created_after}
            <button
              onClick={() => handleInputChange('created_after', undefined)}
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </span>
        )}
        {localFilters.created_before && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Đến: {localFilters.created_before}
            <button
              onClick={() => handleInputChange('created_before', undefined)}
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </span>
        )}
      </div>
    </div>
  );
};

export default GroupManagementFiltersComponent;