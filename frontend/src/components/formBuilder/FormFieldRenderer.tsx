/**
 * Form Field Renderer
 * Renders form fields based on their type
 */

import React, { memo } from 'react';
import { 
  Star, 
  Image as ImageIcon, 
  FileText,
  Calendar,
  Clock,
  CreditCard,
  Pen
} from '../icons';
import { FormField } from '../../types/formBuilder';
import Input from '../common/Input';
import MegaS4FileField from './MegaS4FileField';

interface FormFieldRendererProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  onBlur?: () => void;
  error?: string;
  preview?: boolean;
  authToken?: string; // Add auth token for MEGA S4 uploads
}

const FormFieldRenderer: React.FC<FormFieldRendererProps> = memo(({
  field,
  value,
  onChange,
  onBlur,
  error,
  preview = false,
  authToken
}) => {
  const renderField = () => {
    switch (field.fieldType) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
      case 'password':
        return (
          <Input
            type={field.fieldType}
            placeholder={field.placeholder}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={onBlur}
            disabled={preview}
            className="w-full"
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            placeholder={field.placeholder}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value ? parseFloat(e.target.value) : '')}
            onBlur={onBlur}
            disabled={preview}
            min={field.validation?.min}
            max={field.validation?.max}
            className="w-full"
          />
        );

      case 'textarea':
        return (
          <textarea
            placeholder={field.placeholder}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={onBlur}
            disabled={preview}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
          />
        );

      case 'date':
        return (
          <div className="relative">
            <Input
              type="date"
              value={value || ''}
              onChange={(e) => onChange?.(e.target.value)}
              onBlur={onBlur}
              disabled={preview}
              min={field.validation?.min}
              max={field.validation?.max}
              className="w-full"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        );

      case 'time':
        return (
          <div className="relative">
            <Input
              type="time"
              value={value || ''}
              onChange={(e) => onChange?.(e.target.value)}
              onBlur={onBlur}
              disabled={preview}
              className="w-full"
            />
            <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        );

      case 'datetime-local':
        return (
          <Input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={onBlur}
            disabled={preview}
            min={field.validation?.min}
            max={field.validation?.max}
            className="w-full"
          />
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={onBlur}
            disabled={preview}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">Choose an option</option>
            {field.options?.map((option, index) => {
              const optionValue = typeof option === 'string' ? option : option.value;
              const optionLabel = typeof option === 'string' ? option : option.label;
              return (
                <option key={optionValue || index} value={optionValue}>
                  {optionLabel}
                </option>
              );
            })}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => {
              const optionValue = typeof option === 'string' ? option : option.value;
              const optionLabel = typeof option === 'string' ? option : option.label;
              const optionDisabled = typeof option === 'string' ? false : option.disabled;
              return (
                <label key={optionValue || index} className="flex items-center">
                  <input
                    type="radio"
                    name={field.fieldKey}
                    value={optionValue}
                    checked={value === optionValue}
                    onChange={(e) => onChange?.(e.target.value)}
                    disabled={preview || optionDisabled}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">{optionLabel}</span>
                </label>
              );
            })}
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange?.(e.target.checked)}
              disabled={preview}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              {field.label}
            </span>
          </label>
        );

      case 'checkbox_group':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => {
              const optionValue = typeof option === 'string' ? option : option.value;
              const optionLabel = typeof option === 'string' ? option : option.label;
              return (
                <label key={optionValue || index} className="flex items-center">
                  <input
                    type="checkbox"
                    value={optionValue}
                    checked={Array.isArray(value) && value.includes(optionValue)}
                    onChange={(e) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      if (e.target.checked) {
                        onChange?.([...currentValues, optionValue]);
                      } else {
                        onChange?.(currentValues.filter(v => v !== optionValue));
                      }
                    }}
                  disabled={preview || (typeof option === 'object' ? option.disabled : false)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">{optionLabel}</span>
              </label>
              );
            })}
          </div>
        );

      case 'range':
        return (
          <div>
            <input
              type="range"
              value={value || field.validation?.min || 0}
              onChange={(e) => onChange?.(parseInt(e.target.value))}
              onBlur={onBlur}
              disabled={preview}
              min={field.validation?.min}
              max={field.validation?.max}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{field.validation?.min || 0}</span>
              <span className="font-medium text-gray-700">{value || field.validation?.min || 0}</span>
              <span>{field.validation?.max || 100}</span>
            </div>
          </div>
        );

      case 'rating':
        const maxRating = field.validation?.max || 5;
        const currentRating = value || 0;
        
        return (
          <div className="flex space-x-1">
            {Array.from({ length: maxRating }, (_, i) => i + 1).map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => !preview && onChange?.(rating)}
                disabled={preview}
                className={`p-1 transition-colors ${
                  rating <= currentRating
                    ? 'text-yellow-400 hover:text-yellow-500'
                    : 'text-gray-300 hover:text-gray-400'
                } disabled:cursor-default`}
              >
                <Star
                  className="w-6 h-6"
                  fill={rating <= currentRating ? 'currentColor' : 'none'}
                />
              </button>
            ))}
          </div>
        );

      case 'file':
      case 'image':
        // Use MEGA S4 file upload component
        return (
          <MegaS4FileField
            field={field}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            error={error}
            preview={preview}
            authToken={authToken}
          />
        );

      case 'signature':
        return (
          <div className="border-2 border-gray-300 rounded-lg p-8 text-center bg-gray-50">
            <Pen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Click to sign</p>
          </div>
        );

      case 'address':
        return (
          <div className="space-y-3">
            <Input
              placeholder="Street Address"
              disabled={preview}
              className="w-full"
            />
            <Input
              placeholder="Address Line 2"
              disabled={preview}
              className="w-full"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="City"
                disabled={preview}
                className="w-full"
              />
              <Input
                placeholder="State/Province"
                disabled={preview}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Postal Code"
                disabled={preview}
                className="w-full"
              />
              <Input
                placeholder="Country"
                disabled={preview}
                className="w-full"
              />
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="border-2 border-gray-300 rounded-lg p-6 bg-gray-50">
            <div className="flex items-center justify-center space-x-2 text-gray-600">
              <CreditCard className="w-6 h-6" />
              <span className="text-sm font-medium">Payment processing component</span>
            </div>
          </div>
        );

      case 'section':
        return (
          <div className="border-b-2 border-gray-200 pb-2">
            <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
          </div>
        );

      case 'html':
        return (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: field.placeholder || '<p>HTML content goes here</p>' }}
          />
        );

      case 'hidden':
        return null;

      default:
        return (
          <div className="text-sm text-gray-500">
            Unsupported field type: {field.fieldType}
          </div>
        );
    }
  };

  if (field.fieldType === 'hidden') {
    return null;
  }

  const showLabel = field.fieldType !== 'checkbox' && field.fieldType !== 'section';

  return (
    <div className={field.hidden ? 'hidden' : ''}>
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {renderField()}
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo
  return (
    prevProps.field.id === nextProps.field.id &&
    JSON.stringify(prevProps.field) === JSON.stringify(nextProps.field) &&
    prevProps.value === nextProps.value &&
    prevProps.error === nextProps.error &&
    prevProps.preview === nextProps.preview &&
    prevProps.onChange === nextProps.onChange &&
    prevProps.onBlur === nextProps.onBlur
  );
});

FormFieldRenderer.displayName = 'FormFieldRenderer';

export default FormFieldRenderer;