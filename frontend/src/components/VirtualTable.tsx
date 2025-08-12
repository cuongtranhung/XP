/**
 * Virtual Table Component
 * High-performance table with virtualized rendering
 */

import React, { useCallback, useMemo, useRef, forwardRef, CSSProperties } from 'react';
import { VariableSizeList as List } from 'react-window';
import { useInView } from 'react-intersection-observer';

interface VirtualTableProps {
  data: any[];
  columns: any[];
  rowHeight?: number;
  height?: number;
  width?: string;
  onRowClick?: (row: any, index: number) => void;
  onCellEdit?: (rowIndex: number, columnKey: string, value: any) => void;
  selectedRows?: Set<string>;
  onRowSelect?: (rowId: string) => void;
  renderCell?: (value: any, column: any, row: any) => React.ReactNode;
  className?: string;
}

// Row component wrapped in forwardRef for react-window
const Row = forwardRef<HTMLDivElement, {
  index: number;
  style: CSSProperties;
  data: {
    items: any[];
    columns: any[];
    onRowClick?: (row: any, index: number) => void;
    onCellEdit?: (rowIndex: number, columnKey: string, value: any) => void;
    selectedRows?: Set<string>;
    onRowSelect?: (rowId: string) => void;
    renderCell?: (value: any, column: any, row: any) => React.ReactNode;
  };
}>(({ index, style, data }, ref) => {
  const { 
    items, 
    columns, 
    onRowClick, 
    onCellEdit, 
    selectedRows, 
    onRowSelect,
    renderCell 
  } = data;
  
  const row = items[index];
  const isSelected = selectedRows?.has(row.id);

  return (
    <div
      ref={ref}
      style={style}
      className={`flex items-center border-b border-gray-200 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50' : ''
      }`}
      onClick={() => onRowClick?.(row, index)}
    >
      {/* Checkbox Column */}
      <div className="flex-shrink-0 w-12 px-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onRowSelect?.(row.id);
          }}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
      </div>

      {/* Row Number */}
      <div className="flex-shrink-0 w-16 px-6 text-sm font-medium text-gray-900">
        {index + 1}
      </div>

      {/* Data Cells */}
      {columns.map((column: any) => (
        <div
          key={column.key}
          className="flex-1 px-6 py-4 text-sm text-gray-900 truncate"
          style={{ 
            minWidth: column.width || 150,
            maxWidth: column.maxWidth || 300 
          }}
        >
          {renderCell ? 
            renderCell(row[column.key], column, row) : 
            (row[column.key] ?? '-')
          }
        </div>
      ))}
    </div>
  );
});

Row.displayName = 'VirtualTableRow';

const VirtualTable: React.FC<VirtualTableProps> = ({
  data,
  columns,
  rowHeight = 50,
  height = 600,
  width = '100%',
  onRowClick,
  onCellEdit,
  selectedRows,
  onRowSelect,
  renderCell,
  className = ''
}) => {
  const listRef = useRef<List>(null);
  const [headerRef, headerInView] = useInView({
    threshold: 0,
    rootMargin: '-1px 0px 0px 0px'
  });

  // Memoize the data passed to rows
  const itemData = useMemo(() => ({
    items: data,
    columns,
    onRowClick,
    onCellEdit,
    selectedRows,
    onRowSelect,
    renderCell
  }), [data, columns, onRowClick, onCellEdit, selectedRows, onRowSelect, renderCell]);

  // Calculate dynamic row height based on content
  const getItemSize = useCallback((index: number) => {
    // You can implement dynamic height calculation here
    // For now, using fixed height
    return rowHeight;
  }, [rowHeight]);

  // Handle scroll to row
  const scrollToRow = useCallback((index: number) => {
    listRef.current?.scrollToItem(index, 'smart');
  }, []);

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {/* Fixed Header */}
      <div 
        ref={headerRef}
        className={`bg-gray-50 border-b border-gray-200 sticky top-0 z-10 ${
          !headerInView ? 'shadow-md' : ''
        }`}
      >
        <div className="flex items-center">
          {/* Checkbox Header */}
          <div className="flex-shrink-0 w-12 px-4 py-3">
            <input
              type="checkbox"
              onChange={(e) => {
                // Handle select all
                if (e.target.checked) {
                  data.forEach(row => onRowSelect?.(row.id));
                } else {
                  // Clear all selections
                  selectedRows?.forEach(id => onRowSelect?.(id));
                }
              }}
              checked={selectedRows?.size === data.length && data.length > 0}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          {/* Row Number Header */}
          <div className="flex-shrink-0 w-16 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
            #
          </div>

          {/* Column Headers */}
          {columns.map((column: any) => (
            <div
              key={column.key}
              className="flex-1 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              style={{ 
                minWidth: column.width || 150,
                maxWidth: column.maxWidth || 300 
              }}
              onClick={() => {
                // Handle column sort
                console.log('Sort by', column.key);
              }}
            >
              <div className="flex items-center">
                {column.label}
                {column.required && <span className="text-red-500 ml-1">*</span>}
                {column.sortable !== false && (
                  <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Virtual List Body */}
      <List
        ref={listRef}
        height={height}
        itemCount={data.length}
        itemSize={getItemSize}
        width={width}
        itemData={itemData}
        overscanCount={5} // Render 5 extra rows for smoother scrolling
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        {Row}
      </List>

      {/* Empty State */}
      {data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm mt-1">Data will appear here when available</p>
        </div>
      )}
    </div>
  );
};

export default VirtualTable;