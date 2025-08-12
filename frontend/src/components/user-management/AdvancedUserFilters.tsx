/**
 * Advanced User Management Filters
 * Enhanced filtering with date ranges, complex search, and saved filter presets
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { UserManagementFilters } from '../../types/user-management';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useDebounce } from '../../hooks/useDebounce';
import "react-datepicker/dist/react-datepicker.css";

interface AdvancedUserFiltersProps {
  filters: UserManagementFilters & {
    createdFromDate?: string;
    createdToDate?: string;
    lastLoginFromDate?: string;
    lastLoginToDate?: string;
  };
  onFiltersChange: (filters: UserManagementFilters & {
    createdFromDate?: string;
    createdToDate?: string;
    lastLoginFromDate?: string;
    lastLoginToDate?: string;
  }) => void;
  onReset: () => void;
}

interface FilterPreset {
  id: string;
  name: string;
  filters: UserManagementFilters & {
    createdFromDate?: string;
    createdToDate?: string;
    lastLoginFromDate?: string;
    lastLoginToDate?: string;
  };
  description?: string;
}

const defaultPresets: FilterPreset[] = [
  {
    id: 'pending-approval',
    name: 'Chờ phê duyệt',
    filters: { is_approved: false, status: 'pending' },
    description: 'Người dùng chưa được phê duyệt'
  },
  {
    id: 'active-users',
    name: 'Người dùng hoạt động',
    filters: { status: 'active', is_approved: true, is_blocked: false },
    description: 'Người dùng đang hoạt động bình thường'
  },
  {
    id: 'blocked-users',
    name: 'Người dùng bị chặn',
    filters: { is_blocked: true },
    description: 'Người dùng đã bị chặn'
  },
  {
    id: 'recent-registrations',
    name: 'Đăng ký gần đây',
    filters: { 
      createdFromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    description: 'Người dùng đăng ký trong 7 ngày qua'
  }
];

const AdvancedUserFilters: React.FC<AdvancedUserFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchOperator, setSearchOperator] = useState<'AND' | 'OR'>('AND');
  const [searchTerms, setSearchTerms] = useState<string[]>(['']);
  const [presets, setPresets] = useState<FilterPreset[]>(defaultPresets);
  const [customPresetName, setCustomPresetName] = useState('');

  // Debounced search to improve performance
  const debouncedSearch = useDebounce(filters.search || '', 300);

  // Update search when debounced value changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch]);

  // Parse complex search query
  const parseSearchQuery = useCallback((query: string) => {
    if (!query.trim()) return '';
    
    // Simple implementation - can be enhanced with more complex operators
    const terms = query.split(/\s+(AND|OR)\s+/i);
    return terms.join(' ');
  }, []);

  // Handle complex search
  const handleSearchChange = useCallback((value: string) => {
    const parsedQuery = parseSearchQuery(value);
    onFiltersChange({ ...filters, search: parsedQuery });
  }, [filters, onFiltersChange, parseSearchQuery]);

  // Handle date range changes
  const handleDateRangeChange = useCallback((
    field: 'createdFromDate' | 'createdToDate' | 'lastLoginFromDate' | 'lastLoginToDate',
    date: Date | null
  ) => {
    const dateValue = date ? date.toISOString().split('T')[0] : undefined;
    onFiltersChange({ ...filters, [field]: dateValue });
  }, [filters, onFiltersChange]);

  // Apply preset filter
  const applyPreset = useCallback((preset: FilterPreset) => {
    onFiltersChange({ ...preset.filters });
  }, [onFiltersChange]);

  // Save current filters as preset
  const saveCurrentAsPreset = useCallback(() => {
    if (!customPresetName.trim()) return;

    const newPreset: FilterPreset = {
      id: `custom-${Date.now()}`,
      name: customPresetName,
      filters: { ...filters },
      description: 'Bộ lọc tùy chỉnh'
    };

    setPresets(prev => [...prev, newPreset]);
    setCustomPresetName('');

    // Save to localStorage
    try {
      const customPresets = JSON.parse(localStorage.getItem('userManagementPresets') || '[]');
      customPresets.push(newPreset);
      localStorage.setItem('userManagementPresets', JSON.stringify(customPresets));
    } catch (error) {
      console.error('Error saving preset:', error);
    }
  }, [customPresetName, filters]);

  // Load custom presets from localStorage
  useEffect(() => {
    try {
      const customPresets = JSON.parse(localStorage.getItem('userManagementPresets') || '[]');
      setPresets(prev => [...defaultPresets, ...customPresets]);
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  }, []);

  // Reset all filters
  const handleReset = useCallback(() => {
    setSearchTerms(['']);
    setSearchOperator('AND');
    onReset();
  }, [onReset]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.department) count++;
    if (filters.status) count++;
    if (filters.is_approved !== undefined) count++;
    if (filters.is_blocked !== undefined) count++;
    if (filters.role) count++;
    if (filters.group) count++;
    if (filters.createdFromDate) count++;
    if (filters.createdToDate) count++;
    if (filters.lastLoginFromDate) count++;
    if (filters.lastLoginToDate) count++;
    return count;
  }, [filters]);

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Bộ lọc nâng cao
          {activeFilterCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {activeFilterCount} bộ lọc
            </span>
          )}
        </h3>
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '📈 Thu gọn' : '📊 Mở rộng'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={activeFilterCount === 0}
          >
            🔄 Đặt lại
          </Button>
        </div>
      </div>

      {/* Quick Filter Presets */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">Bộ lọc nhanh:</div>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant="outline"
              onClick={() => applyPreset(preset)}
              className="text-xs"
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Basic Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {/* Enhanced Search */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tìm kiếm nâng cao
          </label>
          <div className="relative">
            <Input
              type="text"
              placeholder="Tên, email, username... (hỗ trợ AND/OR)"
              value={filters.search || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pr-10"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Ví dụ: "John AND admin" hoặc "gmail.com OR yahoo.com"
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Trạng thái</label>
          <select
            value={filters.status || ''}
            onChange={(e) => onFiltersChange({ 
              ...filters, 
              status: e.target.value || undefined 
            })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Không hoạt động</option>
            <option value="pending">Chờ xử lý</option>
          </select>
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phòng ban</label>
              <Input
                type="text"
                placeholder="Nhập tên phòng ban"
                value={filters.department || ''}
                onChange={(e) => onFiltersChange({ 
                  ...filters, 
                  department: e.target.value || undefined 
                })}
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vai trò</label>
              <Input
                type="text"
                placeholder="Nhập vai trò"
                value={filters.role || ''}
                onChange={(e) => onFiltersChange({ 
                  ...filters, 
                  role: e.target.value || undefined 
                })}
              />
            </div>

            {/* Group */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nhóm</label>
              <Input
                type="text"
                placeholder="Nhập tên nhóm"
                value={filters.group || ''}
                onChange={(e) => onFiltersChange({ 
                  ...filters, 
                  group: e.target.value || undefined 
                })}
              />
            </div>
          </div>

          {/* Boolean Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trạng thái phê duyệt</label>
              <select
                value={filters.is_approved === undefined ? '' : filters.is_approved.toString()}
                onChange={(e) => onFiltersChange({ 
                  ...filters, 
                  is_approved: e.target.value === '' ? undefined : e.target.value === 'true'
                })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Tất cả</option>
                <option value="true">Đã phê duyệt</option>
                <option value="false">Chưa phê duyệt</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trạng thái chặn</label>
              <select
                value={filters.is_blocked === undefined ? '' : filters.is_blocked.toString()}
                onChange={(e) => onFiltersChange({ 
                  ...filters, 
                  is_blocked: e.target.value === '' ? undefined : e.target.value === 'true'
                })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Tất cả</option>
                <option value="false">Bình thường</option>
                <option value="true">Đã chặn</option>
              </select>
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            {/* Created Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ngày tạo tài khoản</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Từ ngày</label>
                  <DatePicker
                    selected={filters.createdFromDate ? new Date(filters.createdFromDate) : null}
                    onChange={(date) => handleDateRangeChange('createdFromDate', date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Chọn ngày bắt đầu"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    maxDate={new Date()}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Đến ngày</label>
                  <DatePicker
                    selected={filters.createdToDate ? new Date(filters.createdToDate) : null}
                    onChange={(date) => handleDateRangeChange('createdToDate', date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Chọn ngày kết thúc"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    maxDate={new Date()}
                    minDate={filters.createdFromDate ? new Date(filters.createdFromDate) : undefined}
                  />
                </div>
              </div>
            </div>

            {/* Last Login Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lần đăng nhập cuối</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Từ ngày</label>
                  <DatePicker
                    selected={filters.lastLoginFromDate ? new Date(filters.lastLoginFromDate) : null}
                    onChange={(date) => handleDateRangeChange('lastLoginFromDate', date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Chọn ngày bắt đầu"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    maxDate={new Date()}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Đến ngày</label>
                  <DatePicker
                    selected={filters.lastLoginToDate ? new Date(filters.lastLoginToDate) : null}
                    onChange={(date) => handleDateRangeChange('lastLoginToDate', date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Chọn ngày kết thúc"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    maxDate={new Date()}
                    minDate={filters.lastLoginFromDate ? new Date(filters.lastLoginFromDate) : undefined}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Current Preset */}
          <div className="border-t pt-4">
            <div className="flex items-center space-x-3">
              <Input
                type="text"
                placeholder="Tên bộ lọc tùy chỉnh"
                value={customPresetName}
                onChange={(e) => setCustomPresetName(e.target.value)}
                className="flex-1 max-w-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={saveCurrentAsPreset}
                disabled={!customPresetName.trim() || activeFilterCount === 0}
              >
                💾 Lưu bộ lọc
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedUserFilters;