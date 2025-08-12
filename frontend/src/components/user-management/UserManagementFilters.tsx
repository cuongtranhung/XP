import React, { useState } from 'react';
import { UserManagementFilters } from '../../types/user-management';
import { Input } from '../common/Input';
import { Button } from '../common/Button';

interface UserManagementFiltersProps {
  filters: UserManagementFilters;
  onFiltersChange: (filters: UserManagementFilters) => void;
  onReset: () => void;
}

export const UserManagementFiltersComponent: React.FC<UserManagementFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset
}) => {
  const [localFilters, setLocalFilters] = useState<UserManagementFilters>(filters);

  const handleInputChange = (field: keyof UserManagementFilters, value: any) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleReset = () => {
    const emptyFilters: UserManagementFilters = {};
    setLocalFilters(emptyFilters);
    onReset();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Search Filters</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleReset}
        >
          🔄 Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <Input
            type="text"
            placeholder="Search by email, name, username..."
            value={localFilters.search || ''}
            onChange={(e) => handleInputChange('search', e.target.value)}
            className="w-full"
          />
        </div>

        {/* Department */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Department
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={localFilters.department || ''}
            onChange={(e) => handleInputChange('department', e.target.value || undefined)}
          >
            <option value="">All Departments</option>
            <option value="IT">IT</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
            <option value="Marketing">Marketing</option>
            <option value="Sales">Sales</option>
            <option value="Operations">Operations</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={localFilters.status || ''}
            onChange={(e) => handleInputChange('status', e.target.value || undefined)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Approval Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Approval
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={localFilters.is_approved === undefined ? '' : localFilters.is_approved.toString()}
            onChange={(e) => {
              const value = e.target.value;
              handleInputChange('is_approved', value === '' ? undefined : value === 'true');
            }}
          >
            <option value="">All</option>
            <option value="true">Approved</option>
            <option value="false">Not Approved</option>
          </select>
        </div>

        {/* Block Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Block Status
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={localFilters.is_blocked === undefined ? '' : localFilters.is_blocked.toString()}
            onChange={(e) => {
              const value = e.target.value;
              handleInputChange('is_blocked', value === '' ? undefined : value === 'true');
            }}
          >
            <option value="">All</option>
            <option value="false">Normal</option>
            <option value="true">Blocked</option>
          </select>
        </div>

        {/* Role (placeholder for future implementation) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={localFilters.role || ''}
            onChange={(e) => handleInputChange('role', e.target.value || undefined)}
            disabled
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </div>

      {/* Active filters display */}
      <div className="mt-4 flex flex-wrap gap-2">
        {localFilters.search && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Search: {localFilters.search}
            <button
              onClick={() => handleInputChange('search', undefined)}
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:text-blue-600"
            >
              ×
            </button>
          </span>
        )}
        {localFilters.department && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Department: {localFilters.department}
            <button
              onClick={() => handleInputChange('department', undefined)}
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-green-400 hover:text-green-600"
            >
              ×
            </button>
          </span>
        )}
        {localFilters.status && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Status: {localFilters.status === 'active' ? 'Active' : 
                     localFilters.status === 'inactive' ? 'Inactive' : 
                     localFilters.status === 'pending' ? 'Pending' : localFilters.status}
            <button
              onClick={() => handleInputChange('status', undefined)}
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-yellow-400 hover:text-yellow-600"
            >
              ×
            </button>
          </span>
        )}
        {localFilters.is_approved !== undefined && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Approval: {localFilters.is_approved ? 'Approved' : 'Not Approved'}
            <button
              onClick={() => handleInputChange('is_approved', undefined)}
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-purple-400 hover:text-purple-600"
            >
              ×
            </button>
          </span>
        )}
        {localFilters.is_blocked !== undefined && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Block: {localFilters.is_blocked ? 'Blocked' : 'Normal'}
            <button
              onClick={() => handleInputChange('is_blocked', undefined)}
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

export default UserManagementFiltersComponent;