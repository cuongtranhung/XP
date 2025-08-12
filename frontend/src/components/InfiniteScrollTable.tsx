/**
 * Infinite Scroll Table Component
 * Implements lazy loading with infinite scroll for large datasets
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import TableSkeleton from './TableSkeleton';
import OptimizedTableRow from './OptimizedTableRow';
import EditableCell from './EditableCell';

interface InfiniteScrollTableProps {
  data: any[];
  fields: any[];
  onLoadMore: (page: number) => Promise<{ data: any[]; hasMore: boolean }>;
  onCellSave?: (submissionId: string, fieldKey: string, value: any) => Promise<void>;
  onRowSelect?: (submissionId: string) => void;
  onViewDetails?: (submission: any) => void;
  selectedRows?: Set<string>;
  pageSize?: number;
  threshold?: number; // How many pixels before the end to trigger loading
  className?: string;
  // New row support
  isCreatingNewRow?: boolean;
  newRowData?: Record<string, any> | null;
  isSavingNewRow?: boolean;
  onNewRowCellChange?: (fieldKey: string, value: any) => void;
  onSaveNewRow?: () => void;
  onCancelNewRow?: () => void;
}

const InfiniteScrollTable: React.FC<InfiniteScrollTableProps> = ({
  data: initialData,
  fields,
  onLoadMore,
  onCellSave,
  onRowSelect,
  onViewDetails,
  selectedRows = new Set(),
  pageSize = 20,
  threshold = 100,
  className = '',
  // New row props
  isCreatingNewRow = false,
  newRowData = null,
  isSavingNewRow = false,
  onNewRowCellChange,
  onSaveNewRow,
  onCancelNewRow
}) => {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use intersection observer for the loading trigger
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: `${threshold}px`
  });
  
  // Track if we're currently fetching to prevent duplicate requests
  const isFetchingRef = useRef(false);
  
  // Update data when initialData changes
  useEffect(() => {
    setData(initialData);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, [initialData]);
  
  // Load more data when scrolling near the bottom
  const loadMoreData = useCallback(async () => {
    if (loading || !hasMore || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const nextPage = page + 1;
      const result = await onLoadMore(nextPage);
      
      if (result.data && result.data.length > 0) {
        setData(prev => [...prev, ...result.data]);
        setPage(nextPage);
        setHasMore(result.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more data:', err);
      setError('Failed to load more data. Please try again.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [page, loading, hasMore, onLoadMore]);
  
  // Trigger loading when the sentinel element is in view
  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMoreData();
    }
  }, [inView, hasMore, loading, loadMoreData]);
  
  // Retry loading on error
  const handleRetry = useCallback(() => {
    setError(null);
    loadMoreData();
  }, [loadMoreData]);
  
  // Calculate visible rows for rendering
  const visibleRows = data;
  
  return (
    <div className={`infinite-scroll-table ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {/* Checkbox column */}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                <input
                  type="checkbox"
                  checked={data.length > 0 && data.every(row => selectedRows.has(row.id))}
                  onChange={() => {
                    if (data.every(row => selectedRows.has(row.id))) {
                      // Deselect all
                      data.forEach(row => onRowSelect?.(row.id));
                    } else {
                      // Select all visible
                      data.forEach(row => {
                        if (!selectedRows.has(row.id)) {
                          onRowSelect?.(row.id);
                        }
                      });
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </th>
              
              {/* Row number column */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                #
              </th>
              
              {/* Data columns */}
              {fields.map(field => (
                <th
                  key={field.id}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]"
                >
                  <div className="flex items-center">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </div>
                </th>
              ))}
              
              {/* Actions column */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {/* New Row (when adding) */}
            {isCreatingNewRow && newRowData && (
              <tr className="bg-yellow-50 border-2 border-yellow-300 hover:bg-yellow-100">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 w-12">
                  <div className="flex items-center justify-center h-10">
                    <span className="text-xs text-green-600 font-semibold">NEW</span>
                  </div>
                </td>
                
                <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 w-16">
                  <div className="flex items-center justify-center h-10">
                    <span className="text-xs text-green-600">+</span>
                  </div>
                </td>
                
                {fields.map((field) => (
                  <td key={field.id} className="px-6 py-2 text-sm text-gray-900 min-w-[150px] max-w-[300px] align-top">
                    <div className="w-full min-h-[2.5rem] flex items-start">
                      <EditableCell
                        value={newRowData[field.fieldKey]}
                        fieldType={field.fieldType}
                        fieldKey={field.fieldKey}
                        submissionId="new"
                        options={field.options}
                        onSave={async (submissionId, fieldKey, newValue) => {
                          onNewRowCellChange?.(fieldKey, newValue);
                        }}
                        required={field.required}
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                        className="w-full"
                      />
                    </div>
                  </td>
                ))}
                
                <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={onSaveNewRow}
                      disabled={isSavingNewRow}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {isSavingNewRow ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={onCancelNewRow}
                      disabled={isSavingNewRow}
                      className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}
            
            {visibleRows.map((row, index) => (
              <OptimizedTableRow
                key={row.id}
                submission={row}
                index={index}
                fields={fields}
                isSelected={selectedRows.has(row.id)}
                onSelect={onRowSelect || (() => {})}
                onCellSave={onCellSave || (async () => {})}
                onViewDetails={onViewDetails || (() => {})}
                currentPage={1}
                itemsPerPage={data.length}
                cellIdPrefix={`infinite-cell`}
              />
            ))}
            
            {/* Loading indicator row */}
            {loading && (
              <tr>
                <td colSpan={fields.length + 3} className="px-6 py-4">
                  <div className="flex justify-center items-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-600">Loading more data...</span>
                  </div>
                </td>
              </tr>
            )}
            
            {/* Error row */}
            {error && (
              <tr>
                <td colSpan={fields.length + 3} className="px-6 py-4">
                  <div className="flex justify-center items-center space-x-2">
                    <span className="text-sm text-red-600">{error}</span>
                    <button
                      onClick={handleRetry}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            )}
            
            {/* No more data indicator */}
            {!hasMore && !loading && data.length > 0 && (
              <tr>
                <td colSpan={fields.length + 3} className="px-6 py-4">
                  <div className="text-center text-sm text-gray-500">
                    All {data.length} items loaded
                  </div>
                </td>
              </tr>
            )}
            
            {/* Empty state */}
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={fields.length + 3} className="px-6 py-12">
                  <div className="text-center text-gray-500">
                    <p className="font-medium">No data found</p>
                    <p className="text-sm mt-1">Try adjusting your filters or search criteria</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Invisible sentinel element for intersection observer */}
        {hasMore && (
          <div 
            ref={loadMoreRef} 
            className="h-1" 
            aria-hidden="true"
          />
        )}
      </div>
      
      {/* Loading skeleton for initial load */}
      {loading && data.length === 0 && (
        <TableSkeleton rows={5} columns={fields.length + 3} />
      )}
      
      {/* Scroll to top button */}
      {data.length > pageSize && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-4 right-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
          aria-label="Scroll to top"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default InfiniteScrollTable;