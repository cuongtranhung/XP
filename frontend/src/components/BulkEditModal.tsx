/**
 * Bulk Edit Modal Component
 * Allows batch updates for multiple selected rows
 */

import React, { useState, useCallback, useMemo } from 'react';
import Button from './common/Button';
import Input from './common/Input';
import Badge from './common/Badge';
import { X, Save, AlertTriangle, CheckCircle } from './icons';

interface Field {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  fields: Field[];
  onApply: (updates: Record<string, any>) => Promise<void>;
}

const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  fields,
  onApply
}) => {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Filter out non-editable fields
  const editableFields = useMemo(() => 
    fields.filter(f => 
      !['id', 'createdAt', 'updatedAt', 'submittedAt'].includes(f.fieldKey)
    ),
    [fields]
  );
  
  // Toggle field selection
  const toggleFieldSelection = useCallback((fieldKey: string) => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey);
        // Remove value when deselecting
        setFieldValues(prev => {
          const newValues = { ...prev };
          delete newValues[fieldKey];
          return newValues;
        });
      } else {
        newSet.add(fieldKey);
      }
      return newSet;
    });
  }, []);
  
  // Update field value
  const updateFieldValue = useCallback((fieldKey: string, value: any) => {
    setFieldValues(prev => ({ ...prev, [fieldKey]: value }));
  }, []);
  
  // Apply bulk changes
  const handleApply = async () => {
    if (selectedFields.size === 0) {
      setError('Please select at least one field to update');
      return;
    }
    
    setIsApplying(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Only send updates for selected fields
      const updates: Record<string, any> = {};
      selectedFields.forEach(fieldKey => {
        if (fieldKey in fieldValues) {
          updates[fieldKey] = fieldValues[fieldKey];
        }
      });
      
      await onApply(updates);
      setSuccess(true);
      
      // Reset after success
      setTimeout(() => {
        setSelectedFields(new Set());
        setFieldValues({});
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to apply bulk updates:', err);
      setError('Failed to apply updates. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };
  
  // Render field input based on type
  const renderFieldInput = (field: Field) => {
    const value = fieldValues[field.fieldKey] ?? '';
    
    switch (field.fieldType) {
      case 'select':
      case 'dropdown':
        return (
          <select
            value={value}
            onChange={(e) => updateFieldValue(field.fieldKey, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!selectedFields.has(field.fieldKey)}
          >
            <option value="">-- Select --</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={value === true || value === 'true'}
            onChange={(e) => updateFieldValue(field.fieldKey, e.target.checked)}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            disabled={!selectedFields.has(field.fieldKey)}
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => updateFieldValue(field.fieldKey, e.target.value)}
            placeholder="Enter number"
            disabled={!selectedFields.has(field.fieldKey)}
          />
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => updateFieldValue(field.fieldKey, e.target.value)}
            disabled={!selectedFields.has(field.fieldKey)}
          />
        );
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => updateFieldValue(field.fieldKey, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter text"
            disabled={!selectedFields.has(field.fieldKey)}
          />
        );
      
      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => updateFieldValue(field.fieldKey, e.target.value)}
            placeholder="Enter value"
            disabled={!selectedFields.has(field.fieldKey)}
          />
        );
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Bulk Edit</h2>
            <p className="text-sm text-gray-600 mt-1">
              Update {selectedCount} selected {selectedCount === 1 ? 'row' : 'rows'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {/* Warning */}
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <strong>Warning:</strong> Changes will be applied to all {selectedCount} selected rows.
              This action cannot be undone automatically.
            </div>
          </div>
          
          {/* Success message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <span className="text-sm text-green-800">
                Successfully updated {selectedCount} {selectedCount === 1 ? 'row' : 'rows'}!
              </span>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          {/* Fields */}
          <div className="space-y-4">
            <p className="text-sm text-gray-600 font-medium">
              Select fields to update:
            </p>
            
            {editableFields.map(field => (
              <div
                key={field.id}
                className={`p-4 border rounded-lg transition-colors ${
                  selectedFields.has(field.fieldKey)
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id={`field-${field.id}`}
                    checked={selectedFields.has(field.fieldKey)}
                    onChange={() => toggleFieldSelection(field.fieldKey)}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1">
                    <label
                      htmlFor={`field-${field.id}`}
                      className="block text-sm font-medium text-gray-700 cursor-pointer mb-2"
                    >
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    
                    <div className="mt-2">
                      {renderFieldInput(field)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {editableFields.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                No editable fields available
              </p>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedFields.size} {selectedFields.size === 1 ? 'field' : 'fields'} selected
          </div>
          
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isApplying}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApply}
              disabled={isApplying || selectedFields.size === 0}
            >
              {isApplying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Applying...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Apply Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkEditModal;