/**
 * Table Filters Component
 * Manages search, status filter, and bulk actions
 */

import React from 'react';
import { Search, Filter, Edit2, Trash2 } from '../icons';
import Button from '../common/Button';
import Input from '../common/Input';

export interface TableFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  filterStatus: string;
  onFilterStatusChange: (status: string) => void;
  onApplyFilters: () => void;
  selectedCount: number;
  onBulkEdit?: () => void;
  onBulkDelete?: () => void;
}

const TableFilters: React.FC<TableFiltersProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  filterStatus,
  onFilterStatusChange,
  onApplyFilters,
  selectedCount,
  onBulkEdit,
  onBulkDelete
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search in table..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearchSubmit()}
            className="pl-10"
            aria-label="Search submissions in table"
          />
        </div>
        
        <select
          value={filterStatus}
          onChange={(e) => onFilterStatusChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          aria-label="Filter submissions by status"
        >
          <option value="all">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="completed">Completed</option>
          <option value="draft">Draft</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={onApplyFilters}
        >
          <Filter className="w-4 h-4 mr-2" />
          Apply Filters
        </Button>
        
        {selectedCount > 0 && (
          <>
            {onBulkEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkEdit}
                className="border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit ({selectedCount})
              </Button>
            )}
            {onBulkDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkDelete}
                className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedCount})
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TableFilters;