/**
 * Column Visibility Toggle Component
 * Allows users to show/hide table columns
 */

import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Columns } from '../components/icons';
import Button from './common/Button';

interface Column {
  key: string;
  label: string;
  visible: boolean;
  locked?: boolean; // Cannot be hidden
}

interface ColumnVisibilityToggleProps {
  columns: Column[];
  onChange: (columns: Column[]) => void;
  buttonVariant?: 'primary' | 'secondary' | 'outline';
  className?: string;
}

const ColumnVisibilityToggle: React.FC<ColumnVisibilityToggleProps> = ({
  columns,
  onChange,
  buttonVariant = 'outline',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleColumn = (columnKey: string) => {
    const updatedColumns = columns.map(col =>
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    );
    onChange(updatedColumns);
  };

  const handleToggleAll = (visible: boolean) => {
    const updatedColumns = columns.map(col =>
      col.locked ? col : { ...col, visible }
    );
    onChange(updatedColumns);
  };

  const filteredColumns = columns.filter(col =>
    col.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const visibleCount = columns.filter(col => col.visible).length;
  const totalCount = columns.filter(col => !col.locked).length;

  return (
    <div className={`relative ${className}`}>
      <Button
        ref={buttonRef}
        variant={buttonVariant}
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle column visibility"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Columns className="w-4 h-4 mr-2" />
        Columns ({visibleCount}/{totalCount})
      </Button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Column Visibility
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close column visibility menu"
              >
                ×
              </button>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search columns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Quick Actions */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleToggleAll(true)}
                className="flex-1 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                Show All
              </button>
              <button
                onClick={() => handleToggleAll(false)}
                className="flex-1 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded transition-colors"
              >
                Hide All
              </button>
            </div>
          </div>

          {/* Column List */}
          <div className="max-h-80 overflow-y-auto">
            {filteredColumns.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No columns found
              </div>
            ) : (
              <div className="py-2">
                {filteredColumns.map((column) => (
                  <label
                    key={column.key}
                    className={`flex items-center px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer ${
                      column.locked ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={column.visible}
                      onChange={() => !column.locked && handleToggleColumn(column.key)}
                      disabled={column.locked}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <div className="ml-3 flex-1">
                      <span className="text-sm text-gray-900">{column.label}</span>
                      {column.locked && (
                        <span className="ml-2 text-xs text-gray-500">(Always visible)</span>
                      )}
                    </div>
                    <div className="ml-auto">
                      {column.visible ? (
                        <Eye className="w-4 h-4 text-green-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {visibleCount} of {totalCount} columns visible
              </span>
              <button
                onClick={() => {
                  // Reset to default visibility
                  const defaultColumns = columns.map(col => ({
                    ...col,
                    visible: col.locked || true
                  }));
                  onChange(defaultColumns);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnVisibilityToggle;