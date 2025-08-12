/**
 * Table Header Component
 * Manages table header with title, actions, and controls
 */

import React from 'react';
import { ArrowLeft, Plus, RefreshCw, Upload, Download, RotateCcw, RotateCw, Zap, Columns } from '../icons';
import Button from '../common/Button';
import ColumnVisibilityToggle from '../ColumnVisibilityToggle';

export interface TableHeaderProps {
  formName: string;
  onBack: () => void;
  onRefresh: () => void;
  onAddRow: () => void;
  onImport: () => void;
  onExport: (format: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  historySize: number;
  isRefreshing: boolean;
  isCreatingNewRow: boolean;
  enableVirtualScrolling: boolean;
  onToggleVirtualScrolling: () => void;
  enableResizableColumns: boolean;
  onToggleResizableColumns: () => void;
  enableInfiniteScroll: boolean;
  onToggleInfiniteScroll: () => void;
  columnConfigs: any[];
  visibleColumns: Set<string>;
  onColumnVisibilityChange: (columns: any[]) => void;
}

const TableHeader: React.FC<TableHeaderProps> = ({
  formName,
  onBack,
  onRefresh,
  onAddRow,
  onImport,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  historySize,
  isRefreshing,
  isCreatingNewRow,
  enableVirtualScrolling,
  onToggleVirtualScrolling,
  enableResizableColumns,
  onToggleResizableColumns,
  enableInfiniteScroll,
  onToggleInfiniteScroll,
  columnConfigs,
  visibleColumns,
  onColumnVisibilityChange
}) => {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {formName} - Data Table
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              View and manage form submissions in a spreadsheet-like interface
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Undo/Redo Buttons */}
          <div className="flex items-center border-r pr-2 mr-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo last action"
              title={`Undo (${historySize} actions)`}
              className="mr-1"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo last action"
              title="Redo"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Feature Toggles */}
          <Button
            size="sm"
            variant={enableVirtualScrolling ? 'primary' : 'outline'}
            onClick={onToggleVirtualScrolling}
            aria-label="Toggle virtual scrolling"
            title={enableVirtualScrolling ? 'Disable virtual scrolling' : 'Enable virtual scrolling for better performance'}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Zap className="w-4 h-4" />
          </Button>
          
          <Button
            size="sm"
            variant={enableResizableColumns ? 'primary' : 'outline'}
            onClick={onToggleResizableColumns}
            aria-label="Toggle resizable columns"
            title={enableResizableColumns ? 'Disable resizable columns' : 'Enable column resizing and reordering'}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Columns className="w-4 h-4" />
          </Button>
          
          <Button
            size="sm"
            variant={enableInfiniteScroll ? 'primary' : 'outline'}
            onClick={onToggleInfiniteScroll}
            aria-label="Toggle infinite scroll"
            title={enableInfiniteScroll ? 'Disable infinite scroll' : 'Enable infinite scroll for continuous loading'}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </Button>
          
          {/* Column Visibility Toggle */}
          {columnConfigs.length > 0 && (
            <ColumnVisibilityToggle
              columns={columnConfigs.map(c => ({
                key: c.id,
                label: c.label,
                visible: visibleColumns.has(c.id),
                locked: false
              }))}
              onChange={onColumnVisibilityChange}
            />
          )}
          
          {/* Action Buttons */}
          <Button
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh table data"
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          
          <Button
            size="sm"
            onClick={onAddRow}
            disabled={isCreatingNewRow}
            aria-label="Add new row to table"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isCreatingNewRow ? 'Adding...' : 'Add Row'}
          </Button>
          
          <Button
            size="sm"
            onClick={onImport}
            aria-label="Import data to table"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          
          {/* Export Button with Dropdown */}
          <div className="relative">
            <Button
              size="sm"
              onClick={() => document.getElementById('export-menu')?.classList.toggle('hidden')}
              aria-label="Export table data"
              aria-haspopup="true"
              aria-expanded={false}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Table
            </Button>
            <div id="export-menu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
              <button
                onClick={() => onExport('csv')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Export as CSV
              </button>
              <button
                onClick={() => onExport('xlsx')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Export as Excel
              </button>
              <button
                onClick={() => onExport('json')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Export as JSON
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableHeader;