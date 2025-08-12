/**
 * Enhanced Properties Panel - Phase 2 Implementation
 * Advanced field configuration with tabbed interface
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Eye, 
  Shield, 
  Palette, 
  Code,
  X,
  ChevronRight,
  Info,
  AlertCircle,
  Check,
  Plus,
  Trash2
} from 'lucide-react';
import { clsx } from 'clsx';

interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  email?: boolean;
  url?: boolean;
}

interface FieldStyling {
  width?: 'full' | 'half' | 'third' | 'quarter';
  labelPosition?: 'top' | 'left' | 'inline' | 'hidden';
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
}

interface FormField {
  id: string;
  fieldType: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  validation?: FieldValidation;
  styling?: FieldStyling;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: any;
  conditionalLogic?: any;
}

interface EnhancedPropertiesPanelProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onClose?: () => void;
  isMobile?: boolean;
  className?: string;
}

type TabType = 'basic' | 'validation' | 'styling' | 'advanced';

export const EnhancedPropertiesPanel: React.FC<EnhancedPropertiesPanelProps> = ({
  field,
  onUpdate,
  onClose,
  isMobile = false,
  className
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const tabs = [
    { id: 'basic' as TabType, label: 'Basic', icon: Settings },
    { id: 'validation' as TabType, label: 'Validation', icon: Shield },
    { id: 'styling' as TabType, label: 'Styling', icon: Palette },
    { id: 'advanced' as TabType, label: 'Advanced', icon: Code }
  ];

  const handleFieldUpdate = (key: string, value: any) => {
    setIsDirty(true);
    onUpdate({ [key]: value });
  };

  const handleNestedUpdate = (category: string, key: string, value: any) => {
    setIsDirty(true);
    const currentValue = (field as any)[category] || {};
    onUpdate({
      [category]: {
        ...currentValue,
        [key]: value
      }
    });
  };

  // Basic Properties Tab
  const BasicPropertiesTab = () => (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Field Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field Label
        </label>
        <input
          type="text"
          value={field.label}
          onChange={(e) => handleFieldUpdate('label', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter field label"
        />
      </div>

      {/* Placeholder */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Placeholder Text
        </label>
        <input
          type="text"
          value={field.placeholder || ''}
          onChange={(e) => handleFieldUpdate('placeholder', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter placeholder text"
        />
      </div>

      {/* Help Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Help Text
        </label>
        <textarea
          value={field.helpText || ''}
          onChange={(e) => handleFieldUpdate('helpText', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={2}
          placeholder="Add helpful instructions for users"
        />
        <p className="mt-1 text-xs text-gray-500">
          This text will appear below the field to guide users
        </p>
      </div>

      {/* Default Value */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Default Value
        </label>
        <input
          type="text"
          value={field.defaultValue || ''}
          onChange={(e) => handleFieldUpdate('defaultValue', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Set a default value"
        />
      </div>

      {/* Options for Select/Radio/Checkbox */}
      {['select', 'radio', 'checkbox'].includes(field.fieldType) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Options
          </label>
          <div className="space-y-2">
            {(field.options || []).map((option, index) => {
              // Handle both string and object formats
              const optionLabel = typeof option === 'string' ? option : option.label;
              const optionValue = typeof option === 'string' ? option : option.value;
              
              return (
                <motion.div
                  key={index}
                  className="flex items-center space-x-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <input
                    type="text"
                    value={optionLabel || ''}
                    onChange={(e) => {
                      const newOptions = [...(field.options || [])];
                      // Convert to object format when updating
                      newOptions[index] = { 
                        label: e.target.value, 
                        value: optionValue || e.target.value 
                      };
                      handleFieldUpdate('options', newOptions);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={`Option ${index + 1}`}
                  />
                  <button
                    onClick={() => {
                      const newOptions = field.options?.filter((_, i) => i !== index);
                      handleFieldUpdate('options', newOptions);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              );
            })}
            <button
              onClick={() => {
                const newOptions = [...(field.options || []), { value: '', label: '' }];
                handleFieldUpdate('options', newOptions);
              }}
              className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add Option</span>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );

  // Validation Properties Tab
  const ValidationPropertiesTab = () => (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Required Field */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div>
          <label className="text-sm font-medium text-gray-700">Required Field</label>
          <p className="text-xs text-gray-500">User must fill this field</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={field.required || false}
            onChange={(e) => handleFieldUpdate('required', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Text Length Validation */}
      {['text', 'textarea', 'email', 'url'].includes(field.fieldType) && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Length
              </label>
              <input
                type="number"
                value={field.validation?.minLength || ''}
                onChange={(e) => handleNestedUpdate('validation', 'minLength', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Length
              </label>
              <input
                type="number"
                value={field.validation?.maxLength || ''}
                onChange={(e) => handleNestedUpdate('validation', 'maxLength', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="No limit"
                min="0"
              />
            </div>
          </div>
        </>
      )}

      {/* Number Validation */}
      {field.fieldType === 'number' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Value
            </label>
            <input
              type="number"
              value={field.validation?.min || ''}
              onChange={(e) => handleNestedUpdate('validation', 'min', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="No minimum"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Value
            </label>
            <input
              type="number"
              value={field.validation?.max || ''}
              onChange={(e) => handleNestedUpdate('validation', 'max', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="No maximum"
            />
          </div>
        </div>
      )}

      {/* Pattern Validation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Validation Pattern (Regex)
        </label>
        <input
          type="text"
          value={field.validation?.pattern || ''}
          onChange={(e) => handleNestedUpdate('validation', 'pattern', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          placeholder="e.g., ^[A-Za-z]+$"
        />
        <p className="mt-1 text-xs text-gray-500">
          Regular expression for custom validation
        </p>
      </div>

      {/* Validation Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Custom Error Message
        </label>
        <input
          type="text"
          value={field.validation?.errorMessage || ''}
          onChange={(e) => handleNestedUpdate('validation', 'errorMessage', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Please enter a valid value"
        />
      </div>
    </motion.div>
  );

  // Styling Properties Tab
  const StylingPropertiesTab = () => (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Field Width */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field Width
        </label>
        <select
          value={field.styling?.width || 'full'}
          onChange={(e) => handleNestedUpdate('styling', 'width', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="full">Full Width</option>
          <option value="half">Half Width</option>
          <option value="third">One Third</option>
          <option value="quarter">One Quarter</option>
        </select>
      </div>

      {/* Label Position */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Label Position
        </label>
        <select
          value={field.styling?.labelPosition || 'top'}
          onChange={(e) => handleNestedUpdate('styling', 'labelPosition', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="top">Top</option>
          <option value="left">Left</option>
          <option value="inline">Inline</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {/* Border Radius */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Border Radius
        </label>
        <select
          value={field.styling?.borderRadius || 'md'}
          onChange={(e) => handleNestedUpdate('styling', 'borderRadius', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="none">None</option>
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
          <option value="xl">Extra Large</option>
          <option value="full">Full</option>
        </select>
      </div>

      {/* Font Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Font Size
        </label>
        <select
          value={field.styling?.fontSize || 'base'}
          onChange={(e) => handleNestedUpdate('styling', 'fontSize', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="xs">Extra Small</option>
          <option value="sm">Small</option>
          <option value="base">Base</option>
          <option value="lg">Large</option>
          <option value="xl">Extra Large</option>
        </select>
      </div>

      {/* Custom CSS Class */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Custom CSS Classes
        </label>
        <input
          type="text"
          value={field.styling?.customClass || ''}
          onChange={(e) => handleNestedUpdate('styling', 'customClass', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., custom-field my-class"
        />
      </div>
    </motion.div>
  );

  // Advanced Properties Tab
  const AdvancedPropertiesTab = () => (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Field Key */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field Key (Name)
        </label>
        <input
          type="text"
          value={field.fieldKey || field.id}
          onChange={(e) => handleFieldUpdate('fieldKey', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
          placeholder="field_name"
        />
        <p className="mt-1 text-xs text-gray-500">
          Used in form submission data
        </p>
      </div>

      {/* Conditional Logic */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Conditional Logic</h4>
        <p className="text-xs text-gray-500 mb-3">
          Show or hide this field based on other field values
        </p>
        <button className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          Configure Conditions
        </button>
      </div>

      {/* Custom Attributes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Custom Attributes
        </label>
        <textarea
          value={field.customAttributes || ''}
          onChange={(e) => handleFieldUpdate('customAttributes', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          rows={3}
          placeholder='{"data-custom": "value"}'
        />
        <p className="mt-1 text-xs text-gray-500">
          JSON format for custom HTML attributes
        </p>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      className={clsx(
        "flex flex-col h-full bg-white",
        isMobile ? "fixed inset-0 z-50" : "w-96 border-l border-gray-200 shadow-sm",
        className
      )}
      initial={{ x: isMobile ? '100%' : 384, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: isMobile ? '100%' : 384, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Field Properties</h3>
          <p className="text-sm text-gray-500">{field.fieldType} field</p>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium transition-all",
                "border-b-2",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Icon className="w-4 h-4" />
              {!isMobile && <span>{tab.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'basic' && <BasicPropertiesTab key="basic" />}
          {activeTab === 'validation' && <ValidationPropertiesTab key="validation" />}
          {activeTab === 'styling' && <StylingPropertiesTab key="styling" />}
          {activeTab === 'advanced' && <AdvancedPropertiesTab key="advanced" />}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {isDirty && (
        <motion.div
          className="px-6 py-3 bg-blue-50 border-t border-blue-200"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="flex items-center space-x-2 text-blue-700">
            <Info className="w-4 h-4" />
            <span className="text-sm">Changes saved automatically</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default EnhancedPropertiesPanel;