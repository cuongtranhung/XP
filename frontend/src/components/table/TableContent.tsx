/**
 * Table Content Component
 * Manages the main table display with different view modes
 */

import React from 'react';
import { RefreshCw } from '../icons';
import ResizableTable from '../ResizableTable';
import InfiniteScrollTable from '../InfiniteScrollTable';
import EditableCell from '../EditableCell';
import { Eye } from '../icons';

export interface TableContentProps {
  form: any;
  submissions: any[];
  sortedSubmissions: any[];
  selectedSubmissions: Set<string>;
  isRefreshing: boolean;
  tableLoading: boolean;
  enableInfiniteScroll: boolean;
  enableResizableColumns: boolean;
  columnConfigs: any[];
  visibleColumns: Set<string>;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  itemsPerPage: number;
  isCreatingNewRow: boolean;
  newRowData: any;
  isSavingNewRow: boolean;
  onLoadMore: (page: number) => Promise<{ data: any[]; hasMore: boolean }>;
  onCellSave: (submissionId: string, fieldKey: string, value: any) => Promise<void>;
  onSelectSubmission: (submissionId: string) => void;
  onSelectAll: () => void;
  onSort: (field: string) => void;
  onColumnResize: (columnId: string, width: number) => void;
  onColumnReorder: (columns: any[]) => void;
  onNewRowCellChange: (fieldKey: string, value: any) => void;
  onSaveNewRow: () => void;
  onCancelNewRow: () => void;
  onViewDetails: (submission: any) => void;
}

const TableContent: React.FC<TableContentProps> = ({
  form,
  submissions,
  sortedSubmissions,
  selectedSubmissions,
  isRefreshing,
  tableLoading,
  enableInfiniteScroll,
  enableResizableColumns,
  columnConfigs,
  visibleColumns,
  sortField,
  sortDirection,
  currentPage,
  itemsPerPage,
  isCreatingNewRow,
  newRowData,
  isSavingNewRow,
  onLoadMore,
  onCellSave,
  onSelectSubmission,
  onSelectAll,
  onSort,
  onColumnResize,
  onColumnReorder,
  onNewRowCellChange,
  onSaveNewRow,
  onCancelNewRow,
  onViewDetails
}) => {
  const renderStandardTable = () => (
    <table className="min-w-full divide-y divide-gray-200 table-fixed editable-table">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky-checkbox w-12">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={sortedSubmissions.length > 0 && selectedSubmissions.size === sortedSubmissions.length}
                onChange={onSelectAll}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                title={selectedSubmissions.size === sortedSubmissions.length ? 'Deselect all' : 'Select all'}
              />
            </div>
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky-number w-16">
            #
          </th>
          {form.fields.map((field: any) => (
            <th 
              key={field.id}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 min-w-[150px]"
              onClick={() => onSort(field.fieldKey)}
            >
              <div className="flex items-center">
                <span className="flex items-center">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </span>
                {sortField === field.fieldKey && (
                  <span className="ml-1">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </th>
          ))}
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {/* New Row */}
        {isCreatingNewRow && newRowData && (
          <tr className="new-row bg-yellow-50">
            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky-checkbox w-12">
              <div className="flex items-center justify-center h-10">
                <span className="text-xs text-green-600 font-semibold">NEW</span>
              </div>
            </td>
            <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky-number w-16">
              <div className="flex items-center h-10">
                <span className="text-green-600">+</span>
              </div>
            </td>
            {form.fields.map((field: any) => (
              <td key={field.id} className="px-6 py-2 text-sm text-gray-900 min-w-[150px] max-w-[300px] align-top">
                <EditableCell
                  value={newRowData[field.fieldKey]}
                  fieldType={field.fieldType}
                  fieldKey={field.fieldKey}
                  submissionId="new"
                  options={field.options}
                  onSave={(submissionId, fieldKey, newValue) => {
                    onNewRowCellChange(fieldKey, newValue);
                    return Promise.resolve();
                  }}
                  disabled={isSavingNewRow}
                  isNewRow={true}
                />
              </td>
            ))}
            <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
              <div className="flex items-center h-10 space-x-2">
                <button
                  onClick={onSaveNewRow}
                  disabled={isSavingNewRow}
                  className="p-1.5 text-white bg-green-600 hover:bg-green-700 rounded transition-colors duration-200 disabled:opacity-50"
                  title="Save new row"
                >
                  {isSavingNewRow ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={onCancelNewRow}
                  disabled={isSavingNewRow}
                  className="p-1.5 text-white bg-red-600 hover:bg-red-700 rounded transition-colors duration-200 disabled:opacity-50"
                  title="Cancel new row"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        )}
        
        {/* Data Rows */}
        {sortedSubmissions.map((submission, index) => (
          <tr key={submission.id} className={`hover:bg-gray-50 ${
            selectedSubmissions.has(submission.id) ? 'bg-blue-50' : ''
          }`}>
            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky-checkbox w-12">
              <input
                type="checkbox"
                checked={selectedSubmissions.has(submission.id)}
                onChange={() => onSelectSubmission(submission.id)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </td>
            <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky-number w-16">
              {(currentPage - 1) * itemsPerPage + index + 1}
            </td>
            {form.fields.map((field: any) => (
              <td key={field.id} className="px-6 py-2 text-sm text-gray-900 min-w-[150px] max-w-[300px] align-top">
                <EditableCell
                  value={submission.data[field.fieldKey]}
                  fieldType={field.fieldType}
                  fieldKey={field.fieldKey}
                  submissionId={submission.id}
                  options={field.options}
                  onSave={onCellSave}
                  disabled={false}
                />
              </td>
            ))}
            <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
              <button
                onClick={() => onViewDetails(submission)}
                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors duration-200"
                title="View details"
              >
                <Eye className="w-4 h-4" />
              </button>
            </td>
          </tr>
        ))}
        
        {/* Empty State */}
        {sortedSubmissions.length === 0 && (
          <tr>
            <td colSpan={form.fields.length + 3} className="px-6 py-12 text-center text-gray-500">
              <div className="flex flex-col items-center space-y-2">
                <p className="font-medium">No submissions found</p>
                <p className="text-sm">Data will appear here when form submissions are received</p>
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
      {/* Loading overlay */}
      {(isRefreshing || tableLoading) && (
        <div className="absolute inset-0 bg-white bg-opacity-75 z-20 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-2">
            <RefreshCw className="w-8 h-8 text-green-500 animate-spin" />
            <span className="text-sm text-gray-600 font-medium">
              {isRefreshing ? 'Refreshing table data...' : 'Loading data...'}
            </span>
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        {enableInfiniteScroll && form ? (
          <InfiniteScrollTable
            data={sortedSubmissions}
            fields={form.fields}
            onLoadMore={onLoadMore}
            onCellSave={onCellSave}
            onRowSelect={onSelectSubmission}
            onViewDetails={onViewDetails}
            selectedRows={selectedSubmissions}
            pageSize={itemsPerPage}
            threshold={200}
          />
        ) : enableResizableColumns && form ? (
          <ResizableTable
            columns={columnConfigs.filter(c => visibleColumns.has(c.id))}
            data={sortedSubmissions}
            onColumnResize={onColumnResize}
            onColumnReorder={onColumnReorder}
            renderCell={(value, column, row) => (
              <EditableCell
                value={value}
                fieldType={form.fields.find((f: any) => f.fieldKey === column.key)?.fieldType || 'text'}
                fieldKey={column.key}
                submissionId={row.id}
                options={form.fields.find((f: any) => f.fieldKey === column.key)?.options}
                onSave={onCellSave}
                disabled={false}
              />
            )}
            onSort={(columnKey, direction) => {
              onSort(columnKey);
            }}
          />
        ) : (
          renderStandardTable()
        )}
      </div>
    </div>
  );
};

export default TableContent;