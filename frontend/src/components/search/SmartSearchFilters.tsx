/**
 * Smart Search Filters Component
 * Enhanced filtering with search suggestions and auto-complete
 */

import React, { useState, useCallback } from 'react';
import { UserSearchInput, RoleSearchInput } from './SearchInput';
import { AccessibleInput } from '../accessibility/AccessibleForm';
import { Button } from '../common/Button';

interface SmartSearchFiltersProps {
  onFiltersChange: (filters: any) => void;
  onReset: () => void;
  initialFilters?: any;
}

interface SearchFilters {
  search: string;
  selectedUser?: any;
  selectedRole?: any;
  department: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  tags: string[];
}

export const SmartSearchFilters: React.FC<SmartSearchFiltersProps> = ({
  onFiltersChange,
  onReset,
  initialFilters = {}
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    search: initialFilters.search || '',
    selectedUser: initialFilters.selectedUser,
    selectedRole: initialFilters.selectedRole,
    department: initialFilters.department || '',
    status: initialFilters.status || '',
    dateFrom: initialFilters.dateFrom || '',
    dateTo: initialFilters.dateTo || '',
    tags: initialFilters.tags || []
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'smart'>('smart');

  // Update filters and notify parent
  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    
    // Convert to the format expected by the parent component
    const formattedFilters = {
      search: updatedFilters.search,
      userId: updatedFilters.selectedUser?.id,
      roleId: updatedFilters.selectedRole?.id,
      department: updatedFilters.department,
      status: updatedFilters.status,
      dateFrom: updatedFilters.dateFrom,
      dateTo: updatedFilters.dateTo,
      tags: updatedFilters.tags
    };
    
    onFiltersChange(formattedFilters);
  }, [filters, onFiltersChange]);

  // Handle user selection from search suggestions
  const handleUserSelect = useCallback((user: any) => {
    updateFilters({ selectedUser: user });
  }, [updateFilters]);

  // Handle role selection from search suggestions
  const handleRoleSelect = useCallback((role: any) => {
    updateFilters({ selectedRole: role });
  }, [updateFilters]);

  // Handle search query change
  const handleSearchChange = useCallback((query: string) => {
    updateFilters({ search: query });
  }, [updateFilters]);

  // Handle reset
  const handleReset = useCallback(() => {
    const resetFilters: SearchFilters = {
      search: '',
      selectedUser: undefined,
      selectedRole: undefined,
      department: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      tags: []
    };
    setFilters(resetFilters);
    onReset();
  }, [onReset]);

  // Add tag
  const addTag = useCallback((tag: string) => {
    if (tag && !filters.tags.includes(tag)) {
      updateFilters({ tags: [...filters.tags, tag] });
    }
  }, [filters.tags, updateFilters]);

  // Remove tag
  const removeTag = useCallback((tagToRemove: string) => {
    updateFilters({ tags: filters.tags.filter(tag => tag !== tagToRemove) });
  }, [filters.tags, updateFilters]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('smart')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'smart'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            🎯 Smart Search
          </button>
          <button
            onClick={() => setActiveTab('basic')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'basic'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📋 Basic Filters
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'advanced'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            🔍 Advanced Filters
          </button>
        </nav>
      </div>

      {/* Smart Search Tab */}
      {activeTab === 'smart' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* General Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔍 General Search
              </label>
              <UserSearchInput
                onSelect={handleUserSelect}
                onChange={handleSearchChange}
                placeholder="Search by name, email, or keyword..."
                className="w-full"
              />
            </div>

            {/* Role Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👤 Find by Role
              </label>
              <RoleSearchInput
                onSelect={handleRoleSelect}
                onChange={() => {}} // Role selection is handled by onSelect
                placeholder="Search for specific roles..."
                className="w-full"
              />
            </div>
          </div>

          {/* Selected Filters Display */}
          {(filters.selectedUser || filters.selectedRole) && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Active Selections:</h4>
              <div className="flex flex-wrap gap-2">
                {filters.selectedUser && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                    👤 {filters.selectedUser.firstName} {filters.selectedUser.lastName}
                    <button
                      onClick={() => updateFilters({ selectedUser: undefined })}
                      className="ml-2 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.selectedRole && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                    🏷️ {filters.selectedRole.name}
                    <button
                      onClick={() => updateFilters({ selectedRole: undefined })}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Quick Status Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📊 Quick Status Filters
            </label>
            <div className="flex flex-wrap gap-2">
              {['active', 'pending', 'blocked', 'inactive'].map((status) => (
                <button
                  key={status}
                  onClick={() => updateFilters({ status: filters.status === status ? '' : status })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filters.status === status
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Basic Filters Tab */}
      {activeTab === 'basic' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AccessibleInput
            label="Department"
            value={filters.department}
            onChange={(e) => updateFilters({ department: e.target.value })}
            placeholder="Enter department"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="blocked">Blocked</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      )}

      {/* Advanced Filters Tab */}
      {activeTab === 'advanced' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AccessibleInput
              label="Date From"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilters({ dateFrom: e.target.value })}
            />
            
            <AccessibleInput
              label="Date To"
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilters({ dateTo: e.target.value })}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {filters.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a tag"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    addTag(e.currentTarget.value.trim());
                    e.currentTarget.value = '';
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.querySelector('input[placeholder="Add a tag"]') as HTMLInputElement;
                  if (input && input.value.trim()) {
                    addTag(input.value.trim());
                    input.value = '';
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {Object.values(filters).some(v => v && (Array.isArray(v) ? v.length > 0 : true)) && (
            <span>🎯 Active filters applied</span>
          )}
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset}>
            Clear All
          </Button>
          <Button onClick={() => onFiltersChange(filters)}>
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
};