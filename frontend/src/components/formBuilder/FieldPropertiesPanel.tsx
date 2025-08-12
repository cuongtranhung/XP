/**
 * Field Properties Panel
 * Panel for editing field properties and settings
 */

import React, { memo, useCallback } from 'react';
import { X, Plus, Trash2 } from '../icons';
import { FormField, FieldOption } from '../../types/formBuilder';
import Input from '../common/Input';
import Button from '../common/Button';

interface FieldPropertiesPanelProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onClose: () => void;
}

const FieldPropertiesPanel: React.FC<FieldPropertiesPanelProps> = memo(({
  field,
  onUpdate,
  onClose
}) => {
  const handleValidationChange = useCallback((key: string, value: any) => {
    onUpdate({
      validation: {
        ...field.validation,
        [key]: value
      }
    });
  }, [field.validation, onUpdate]);

  const handleValidationMessageChange = useCallback((key: string, value: string) => {
    onUpdate({
      validation: {
        ...field.validation,
        messages: {
          ...field.validation?.messages,
          [key]: value
        }
      }
    });
  }, [field.validation, onUpdate]);

  const handleOptionChange = useCallback((index: number, updates: Partial<FieldOption>) => {
    const newOptions = [...(field.options || [])];
    // Handle both string and object formats
    const currentOption = newOptions[index];
    if (typeof currentOption === 'string') {
      // Convert string to object format
      newOptions[index] = {
        label: updates.label !== undefined ? updates.label : currentOption,
        value: updates.value !== undefined ? updates.value : currentOption
      };
    } else {
      newOptions[index] = { ...currentOption, ...updates };
    }
    onUpdate({ options: newOptions });
  }, [field.options, onUpdate]);

  const handleAddOption = useCallback(() => {
    const newOptions = [...(field.options || [])];
    newOptions.push({
      label: `Option ${newOptions.length + 1}`,
      value: `option${newOptions.length + 1}`
    });
    onUpdate({ options: newOptions });
  }, [field.options, onUpdate]);

  const handleRemoveOption = useCallback((index: number) => {
    const newOptions = [...(field.options || [])];
    newOptions.splice(index, 1);
    onUpdate({ options: newOptions });
  }, [field.options, onUpdate]);

  const hasOptions = ['select', 'radio', 'checkbox_group'].includes(field.fieldType);
  const hasPlaceholder = ['text', 'textarea', 'email', 'tel', 'url', 'number'].includes(field.fieldType);
  const hasMinMax = ['number', 'range', 'date', 'time', 'datetime-local'].includes(field.fieldType);
  const hasLength = ['text', 'textarea', 'email', 'tel', 'url', 'password'].includes(field.fieldType);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Field Properties</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Properties Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Properties */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Basic Properties</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Key
              </label>
              <Input
                value={field.fieldKey}
                onChange={(e) => onUpdate({ fieldKey: e.target.value })}
                placeholder="field_key"
                className="w-full"
              />
              <p className="mt-1 text-xs text-gray-500">
                Unique identifier for this field (no spaces)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Label
              </label>
              <Input
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder="Field Label"
                className="w-full"
              />
            </div>

            {hasPlaceholder && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Placeholder
                </label>
                <Input
                  value={field.placeholder || ''}
                  onChange={(e) => onUpdate({ placeholder: e.target.value })}
                  placeholder="Placeholder text"
                  className="w-full"
                />
              </div>
            )}

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => onUpdate({ required: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Required</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={field.hidden}
                  onChange={(e) => onUpdate({ hidden: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Hidden</span>
              </label>
            </div>
          </div>
        </div>

        {/* Options (for select, radio, checkbox group) */}
        {hasOptions && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Options</h4>
            <div className="space-y-2">
              {field.options?.map((option, index) => {
                // Handle both string and object formats
                const optionLabel = typeof option === 'string' ? option : option.label;
                const optionValue = typeof option === 'string' ? option : option.value;
                
                return (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={optionLabel}
                      onChange={(e) => handleOptionChange(index, { label: e.target.value })}
                      placeholder="Label"
                      className="flex-1"
                    />
                    <Input
                      value={optionValue}
                      onChange={(e) => handleOptionChange(index, { value: e.target.value })}
                      placeholder="Value"
                      className="flex-1"
                    />
                    <button
                      onClick={() => handleRemoveOption(index)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Option
              </Button>
            </div>
          </div>
        )}

        {/* Validation */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Validation</h4>
          <div className="space-y-4">
            {hasLength && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Length
                  </label>
                  <Input
                    type="number"
                    value={field.validation?.minLength || ''}
                    onChange={(e) => handleValidationChange('minLength', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="0"
                    className="w-full"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Length
                  </label>
                  <Input
                    type="number"
                    value={field.validation?.maxLength || ''}
                    onChange={(e) => handleValidationChange('maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="No limit"
                    className="w-full"
                    min="0"
                  />
                </div>
              </>
            )}

            {hasMinMax && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Value
                  </label>
                  <Input
                    type={field.fieldType === 'number' || field.fieldType === 'range' ? 'number' : field.fieldType}
                    value={field.validation?.min || ''}
                    onChange={(e) => handleValidationChange('min', e.target.value)}
                    placeholder="No minimum"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Value
                  </label>
                  <Input
                    type={field.fieldType === 'number' || field.fieldType === 'range' ? 'number' : field.fieldType}
                    value={field.validation?.max || ''}
                    onChange={(e) => handleValidationChange('max', e.target.value)}
                    placeholder="No maximum"
                    className="w-full"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pattern (RegEx)
              </label>
              <Input
                value={field.validation?.pattern || ''}
                onChange={(e) => handleValidationChange('pattern', e.target.value)}
                placeholder="e.g., ^[A-Z]{3}[0-9]{3}$"
                className="w-full"
              />
              <p className="mt-1 text-xs text-gray-500">
                Regular expression for custom validation
              </p>
            </div>
          </div>
        </div>

        {/* Custom Messages */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Custom Messages</h4>
          <div className="space-y-4">
            {field.required && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Required Message
                </label>
                <Input
                  value={field.validation?.messages?.required || ''}
                  onChange={(e) => handleValidationMessageChange('required', e.target.value)}
                  placeholder={`${field.label} is required`}
                  className="w-full"
                />
              </div>
            )}

            {field.validation?.pattern && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pattern Message
                </label>
                <Input
                  value={field.validation?.messages?.pattern || ''}
                  onChange={(e) => handleValidationMessageChange('pattern', e.target.value)}
                  placeholder="Invalid format"
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.field.id === nextProps.field.id &&
    JSON.stringify(prevProps.field) === JSON.stringify(nextProps.field) &&
    prevProps.onUpdate === nextProps.onUpdate &&
    prevProps.onClose === nextProps.onClose
  );
});

FieldPropertiesPanel.displayName = 'FieldPropertiesPanel';

export default FieldPropertiesPanel;