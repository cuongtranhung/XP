/**
 * Enhanced Field Preview - Phase 1 Implementation
 * Improved visual representation of form fields with better UX
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Type, Mail, Phone, Hash, Calendar, CheckSquare, Grid3x3, FileText, Image, Link, Clock } from 'lucide-react';

interface FormField {
  id: string;
  fieldType: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  validation?: any;
}

interface EnhancedFieldPreviewProps {
  field: FormField;
  isSelected?: boolean;
  isDragging?: boolean;
  isMobile?: boolean;
  className?: string;
}

const getFieldIcon = (fieldType: string) => {
  switch (fieldType) {
    case 'text': return Type;
    case 'email': return Mail;
    case 'tel':
    case 'phone': return Phone;
    case 'number': return Hash;
    case 'date': return Calendar;
    case 'datetime-local': return Calendar;
    case 'time': return Clock;
    case 'checkbox': return CheckSquare;
    case 'radio': return CheckSquare;
    case 'select': return Grid3x3;
    case 'textarea': return FileText;
    case 'file': return Image;
    case 'url': return Link;
    default: return Type;
  }
};

const getFieldTypeLabel = (fieldType: string) => {
  switch (fieldType) {
    case 'text': return 'Text Input';
    case 'email': return 'Email';
    case 'tel':
    case 'phone': return 'Phone';
    case 'number': return 'Number';
    case 'date': return 'Date';
    case 'datetime-local': return 'Date & Time';
    case 'time': return 'Time';
    case 'checkbox': return 'Checkbox';
    case 'radio': return 'Radio Button';
    case 'select': return 'Dropdown';
    case 'textarea': return 'Textarea';
    case 'file': return 'File Upload';
    case 'url': return 'URL';
    default: return 'Field';
  }
};

const renderFieldPreview = (field: FormField, isMobile: boolean = false) => {
  const commonClasses = clsx(
    "w-full px-3 py-3 bg-gray-50 border border-gray-300 rounded-lg text-sm",
    "focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors",
    isMobile ? "text-base" : "text-sm"
  );

  switch (field.fieldType) {
    case 'textarea':
      return (
        <textarea
          placeholder={field.placeholder || 'Enter your text here...'}
          className={clsx(commonClasses, "resize-none")}
          rows={3}
          disabled
        />
      );

    case 'select':
      return (
        <select className={commonClasses} disabled>
          <option>{field.placeholder || 'Select an option'}</option>
          {field.options?.map((option, index) => {
            const value = typeof option === 'string' ? option : option.value;
            const label = typeof option === 'string' ? option : option.label;
            return (
              <option key={index} value={value}>
                {label}
              </option>
            );
          })}
        </select>
      );

    case 'checkbox':
      return (
        <div className="space-y-2">
          {field.options?.slice(0, 2).map((option, index) => {
            const label = typeof option === 'string' ? option : option.label;
            return (
              <label key={index} className="flex items-center space-x-3">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled 
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            );
          })}
          {(field.options?.length || 0) > 2 && (
            <span className="text-xs text-gray-500 ml-7">
              +{(field.options?.length || 0) - 2} more options
            </span>
          )}
        </div>
      );

    case 'radio':
      return (
        <div className="space-y-2">
          {field.options?.slice(0, 2).map((option, index) => {
            const label = typeof option === 'string' ? option : option.label;
            return (
              <label key={index} className="flex items-center space-x-3">
                <input 
                  type="radio" 
                  name={`preview-${field.id}`}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  disabled 
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            );
          })}
          {(field.options?.length || 0) > 2 && (
            <span className="text-xs text-gray-500 ml-7">
              +{(field.options?.length || 0) - 2} more options
            </span>
          )}
        </div>
      );

    case 'file':
      return (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
          <p className="text-xs text-gray-500 mt-1">PNG, JPG, PDF up to 10MB</p>
        </div>
      );

    default:
      return (
        <input
          type={field.fieldType}
          placeholder={field.placeholder || `Enter ${(field.label || 'value').toLowerCase()}...`}
          className={commonClasses}
          disabled
        />
      );
  }
};

export const EnhancedFieldPreview: React.FC<EnhancedFieldPreviewProps> = ({
  field,
  isSelected = false,
  isDragging = false,
  isMobile = false,
  className
}) => {
  const Icon = getFieldIcon(field.fieldType);
  const fieldTypeLabel = getFieldTypeLabel(field.fieldType);

  return (
    <motion.div
      className={clsx(
        "relative bg-white rounded-lg border-2 transition-all duration-200",
        isSelected 
          ? "border-blue-500 shadow-lg shadow-blue-100" 
          : "border-gray-200",
        isDragging && "shadow-2xl shadow-gray-900/20 rotate-2",
        className
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: isDragging ? 1.05 : 1,
        rotate: isDragging ? 2 : 0
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      layout
    >
      {/* Field Header */}
      <motion.div 
        className={clsx(
          "flex items-center justify-between p-4 border-b border-gray-100",
          isSelected && "bg-blue-50"
        )}
        layout
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <motion.div
            className={clsx(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              isSelected 
                ? "bg-blue-100 text-blue-600" 
                : "bg-gray-100 text-gray-600"
            )}
            whileHover={{ scale: 1.1 }}
          >
            <Icon className="w-4 h-4" />
          </motion.div>
          
          <div className="min-w-0 flex-1">
            <h4 className={clsx(
              "font-medium truncate",
              isSelected ? "text-blue-900" : "text-gray-900"
            )}>
              {field.label || 'Untitled Field'}
              {field.required && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </h4>
            <p className={clsx(
              "text-xs truncate",
              isSelected ? "text-blue-600" : "text-gray-500"
            )}>
              {fieldTypeLabel}
            </p>
          </div>
        </div>

        {/* Field Status Indicators */}
        <div className="flex items-center space-x-2">
          {field.required && (
            <motion.div
              className="w-2 h-2 bg-red-400 rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
              title="Required field"
            />
          )}
          
          {field.validation && Object.keys(field.validation).length > 0 && (
            <motion.div
              className="w-2 h-2 bg-orange-400 rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              title="Has validation rules"
            />
          )}
        </div>
      </motion.div>

      {/* Field Preview */}
      <motion.div 
        className="p-4"
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {renderFieldPreview(field, isMobile)}
      </motion.div>

      {/* Selection Indicator */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg -z-10"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Drag Handle for Mobile */}
      {isMobile && (
        <motion.div
          className="absolute left-2 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gray-300 rounded-full opacity-0 group-active:opacity-100"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.3 }}
        />
      )}
    </motion.div>
  );
};

export default EnhancedFieldPreview;