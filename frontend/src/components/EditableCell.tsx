/**
 * Editable Cell Component
 * Allows inline editing of table cells with different input types
 */

import React, { useState, useRef, useEffect } from 'react';
import { Check, X, Loader } from './icons';
import ValidatedInput from './ValidatedInput';

interface EditableCellProps {
  value: any;
  fieldType: string;
  fieldKey: string;
  submissionId: string;
  options?: Array<{ label: string; value: string }>;
  onSave: (submissionId: string, fieldKey: string, newValue: any) => Promise<void>;
  disabled?: boolean;
  className?: string;
  isNewRow?: boolean;
  validationRules?: any[];
  required?: boolean;
  placeholder?: string; // Added missing placeholder prop
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  fieldType,
  fieldKey,
  submissionId,
  options,
  onSave,
  disabled = false,
  className = '',
  isNewRow = false
}) => {
  const [isEditing, setIsEditing] = useState(isNewRow); // Start editing if it's a new row
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<any>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Select all text for easy replacement
      if (inputRef.current.select) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  // Update edit value when prop value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleStartEdit = () => {
    if (!disabled && !isEditing) {
      setIsEditing(true);
      setEditValue(value);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
  };

  const handleSave = async () => {
    if (!isNewRow && editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setHasError(false);
    try {
      await onSave(submissionId, fieldKey, editValue);
      if (!isNewRow) {
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to save:', error);
      setHasError(true);
      // Revert on error
      if (!isNewRow) {
        setEditValue(value);
      }
      // Keep editing mode open on error for retry
      setTimeout(() => setHasError(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Base input styles for consistent dimensions
  const baseInputClass = `w-full px-2 py-1.5 text-sm border rounded transition-all duration-200 
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
    ${
      hasError 
        ? 'border-red-500 bg-red-50' 
        : 'border-gray-300 bg-white hover:border-gray-400'
    } 
    ${isSaving ? 'opacity-60 cursor-wait' : 'cursor-text'}
    h-8 min-h-[2rem]`; // Fixed height to prevent layout shifts

  const renderInput = () => {
    switch (fieldType) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return (
          <input
            ref={inputRef}
            type={fieldType}
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={baseInputClass}
            disabled={isSaving}
            placeholder="Enter value..."
          />
        );

      case 'number':
        return (
          <input
            ref={inputRef}
            type="number"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={baseInputClass}
            disabled={isSaving}
            placeholder="0"
          />
        );

      case 'textarea':
        return (
          <textarea
            ref={inputRef}
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={`${baseInputClass} resize-none h-16`}
            rows={2}
            disabled={isSaving}
            placeholder="Enter text..."
          />
        );

      case 'select':
      case 'radio':
        return (
          <select
            ref={inputRef}
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={baseInputClass}
            disabled={isSaving}
          >
            <option value="">-- Select --</option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center justify-center h-8">
            <input
              ref={inputRef}
              type="checkbox"
              checked={editValue === true || editValue === 'true'}
              onChange={(e) => setEditValue(e.target.checked)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              disabled={isSaving}
            />
          </div>
        );

      case 'date':
        return (
          <input
            ref={inputRef}
            type="date"
            value={editValue ? new Date(editValue).toISOString().split('T')[0] : ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={baseInputClass}
            disabled={isSaving}
          />
        );

      default:
        return (
          <input
            ref={inputRef}
            type="text"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={baseInputClass}
            disabled={isSaving}
            placeholder="Enter value..."
          />
        );
    }
  };

  const renderValue = () => {
    const baseDisplayClass = "flex items-center h-8 px-2 py-1.5 text-sm text-gray-900 min-h-[2rem] transition-colors duration-200";
    
    if (value === null || value === undefined || value === '') {
      return (
        <span className={`${baseDisplayClass} text-gray-400 italic`}>
          Click to edit
        </span>
      );
    }

    switch (fieldType) {
      case 'checkbox':
        return (
          <div className={`${baseDisplayClass} justify-center`}>
            <span className={`text-lg ${value ? 'text-green-600' : 'text-red-600'}`}>
              {value ? '✓' : '✗'}
            </span>
          </div>
        );
      case 'date':
        return (
          <span className={baseDisplayClass}>
            {new Date(value).toLocaleDateString()}
          </span>
        );
      case 'file':
        if (typeof value === 'object' && value.filename) {
          return (
            <div className={baseDisplayClass}>
              <a 
                href={value.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {value.originalName || value.filename}
              </a>
            </div>
          );
        }
        return <span className={`${baseDisplayClass} text-gray-400 italic`}>No file</span>;
      default:
        const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
          Array.isArray(value) ? value.join(', ') :
          typeof value === 'object' ? JSON.stringify(value) :
          String(value);
        
        return (
          <span className={`${baseDisplayClass} truncate`} title={displayValue}>
            {displayValue}
          </span>
        );
    }
  };

  if (isEditing) {
    return (
      <div 
        ref={cellRef}
        className={`relative w-full ${className}`}
      >
        <div className="relative flex items-center space-x-1">
          <div className="flex-1 relative">
            {renderInput()}
            
            {/* Loading indicator overlay */}
            {isSaving && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                <Loader className="w-4 h-4 animate-spin text-blue-600" />
              </div>
            )}
            
            {/* Error indicator */}
            {hasError && (
              <div className="absolute -top-1 -right-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
          
          {/* Action buttons for complex fields */}
          {(fieldType === 'textarea' || hasError) && (
            <div className="flex space-x-1 ml-1">
              {hasError && (
                <button
                  onClick={handleSave}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title="Retry save"
                  disabled={isSaving}
                >
                  <Check className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={handleCancel}
                className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                title="Cancel (Esc)"
                disabled={isSaving}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        
        {/* Help text */}
        <div className="absolute top-full left-0 mt-1 text-xs text-gray-500 whitespace-nowrap z-10">
          {isSaving ? 'Saving...' : hasError ? 'Failed to save - click to retry' : 'Press Enter to save, Esc to cancel'}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cellRef}
      className={`
        w-full relative group
        ${!disabled && fieldType !== 'file' ? 'cursor-pointer' : 'cursor-default'}
        ${!disabled && fieldType !== 'file' ? 'hover:bg-blue-50 hover:shadow-sm' : ''}
        rounded transition-all duration-200
        ${className}
      `}
      onClick={handleStartEdit}
      title={!disabled && fieldType !== 'file' ? 'Click to edit' : ''}
    >
      {renderValue()}
      
      {/* Edit indicator */}
      {!disabled && fieldType !== 'file' && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
        </div>
      )}
    </div>
  );
};

export default EditableCell;