/**
 * Optimized Table Row Component
 * Uses React.memo to prevent unnecessary re-renders
 */

import React, { memo, useCallback, useMemo } from 'react';
import EditableCell from './EditableCell';
import { Eye } from './icons';

interface OptimizedTableRowProps {
  submission: any;
  index: number;
  fields: any[];
  isSelected: boolean;
  onSelect: (submissionId: string) => void;
  onCellSave: (submissionId: string, fieldKey: string, value: any) => Promise<void>;
  onViewDetails: (submission: any) => void;
  currentPage: number;
  itemsPerPage: number;
  cellIdPrefix?: string;
}

// Deep comparison function for memo
const areEqual = (prevProps: OptimizedTableRowProps, nextProps: OptimizedTableRowProps) => {
  // Check if submission data changed
  if (prevProps.submission.id !== nextProps.submission.id) return false;
  if (prevProps.submission.updatedAt !== nextProps.submission.updatedAt) return false;
  
  // Check if selection changed
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  
  // Check if index changed (for row number display)
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.currentPage !== nextProps.currentPage) return false;
  
  // Check if fields structure changed
  if (prevProps.fields.length !== nextProps.fields.length) return false;
  
  // Don't re-render for function changes (they should be stable)
  return true;
};

const OptimizedTableRow: React.FC<OptimizedTableRowProps> = memo(({
  submission,
  index,
  fields,
  isSelected,
  onSelect,
  onCellSave,
  onViewDetails,
  currentPage,
  itemsPerPage,
  cellIdPrefix = 'cell'
}) => {
  // Memoize row number calculation
  const rowNumber = useMemo(() => 
    (currentPage - 1) * itemsPerPage + index + 1,
    [currentPage, itemsPerPage, index]
  );

  // Memoize checkbox handler
  const handleSelect = useCallback(() => {
    onSelect(submission.id);
  }, [onSelect, submission.id]);

  // Memoize view details handler
  const handleViewDetails = useCallback(() => {
    onViewDetails(submission);
  }, [onViewDetails, submission]);

  // Memoize cell save handler
  const handleCellSave = useCallback((fieldKey: string, value: any) => {
    return onCellSave(submission.id, fieldKey, value);
  }, [onCellSave, submission.id]);

  // Memoize row classes
  const rowClasses = useMemo(() => {
    const classes = ['group transition-colors duration-200'];
    if (isSelected) {
      classes.push('bg-blue-50 hover:bg-blue-100');
    } else {
      classes.push('hover:bg-gray-50');
    }
    return classes.join(' ');
  }, [isSelected]);

  return (
    <tr className={rowClasses}>
      {/* Checkbox */}
      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky-checkbox w-12">
        <div className="flex items-center justify-center h-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleSelect}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            aria-label={`Select row ${rowNumber}`}
          />
        </div>
      </td>

      {/* Row Number */}
      <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky-number w-16">
        <div className="flex items-center h-10">
          {rowNumber}
        </div>
      </td>

      {/* Data Cells */}
      {fields.map((field) => (
        <MemoizedDataCell
          key={`${submission.id}-${field.id}`}
          field={field}
          value={submission.data[field.fieldKey]}
          submissionId={submission.id}
          onSave={handleCellSave}
          cellId={`${cellIdPrefix}-${index}-${field.id}`}
        />
      ))}

      {/* Actions */}
      <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
        <div className="flex items-center h-10 space-x-2">
          <button
            onClick={handleViewDetails}
            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors duration-200"
            title="View details"
            aria-label={`View details for row ${rowNumber}`}
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}, areEqual);

// Memoized data cell component
interface DataCellProps {
  field: any;
  value: any;
  submissionId: string;
  onSave: (fieldKey: string, value: any) => Promise<void>;
  cellId: string;
}

const MemoizedDataCell = memo<DataCellProps>(({
  field,
  value,
  submissionId,
  onSave,
  cellId
}) => {
  const handleSave = useCallback((submissionId: string, fieldKey: string, newValue: any) => {
    return onSave(fieldKey, newValue);
  }, [onSave]);

  return (
    <td 
      id={cellId}
      className="px-6 py-2 text-sm text-gray-900 min-w-[150px] max-w-[300px] align-top"
    >
      <div className="w-full min-h-[2.5rem] flex items-start">
        <EditableCell
          value={value}
          fieldType={field.fieldType}
          fieldKey={field.fieldKey}
          submissionId={submissionId}
          options={field.options}
          onSave={handleSave}
          disabled={false}
          className="w-full edit-trigger"
        />
      </div>
    </td>
  );
}, (prev, next) => {
  // Only re-render if value actually changed
  return prev.value === next.value && 
         prev.field.id === next.field.id &&
         prev.submissionId === next.submissionId;
});

MemoizedDataCell.displayName = 'MemoizedDataCell';
OptimizedTableRow.displayName = 'OptimizedTableRow';

export default OptimizedTableRow;