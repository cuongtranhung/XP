/**
 * Validated Input Component
 * Provides real-time validation with inline error messages
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, CheckCircle, Info } from './icons';

interface ValidationRule {
  type: 'required' | 'email' | 'url' | 'pattern' | 'minLength' | 'maxLength' | 'min' | 'max' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any) => boolean;
}

interface ValidatedInputProps {
  value: any;
  onChange: (value: any) => void;
  onValidation?: (isValid: boolean, errors: string[]) => void;
  fieldType?: string;
  fieldKey: string;
  label?: string;
  placeholder?: string;
  rules?: ValidationRule[];
  options?: Array<{ label: string; value: string }>;
  disabled?: boolean;
  className?: string;
  showValidationIcon?: boolean;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  debounceMs?: number;
}

const ValidatedInput: React.FC<ValidatedInputProps> = ({
  value,
  onChange,
  onValidation,
  fieldType = 'text',
  fieldKey,
  label,
  placeholder,
  rules = [],
  options,
  disabled = false,
  className = '',
  showValidationIcon = true,
  validateOnBlur = true,
  validateOnChange = false,
  debounceMs = 300
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [errors, setErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [touched, setTouched] = useState(false);
  const [validationTimer, setValidationTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  // Validation functions
  const validators = useMemo(() => ({
    required: (val: any) => {
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === 'string') return val.trim().length > 0;
      return val !== null && val !== undefined && val !== '';
    },
    email: (val: string) => {
      if (!val) return true; // Empty is valid unless required
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    },
    url: (val: string) => {
      if (!val) return true;
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    },
    pattern: (val: string, pattern: string) => {
      if (!val) return true;
      return new RegExp(pattern).test(val);
    },
    minLength: (val: string, min: number) => {
      if (!val) return true;
      return val.length >= min;
    },
    maxLength: (val: string, max: number) => {
      if (!val) return true;
      return val.length <= max;
    },
    min: (val: number, min: number) => {
      if (val === null || val === undefined || String(val) === '') return true;
      return Number(val) >= min;
    },
    max: (val: number, max: number) => {
      if (val === null || val === undefined || String(val) === '') return true;
      return Number(val) <= max;
    }
  }), []);
  
  // Validate value against rules
  const validate = useCallback((val: any) => {
    const validationErrors: string[] = [];
    
    for (const rule of rules) {
      let isValid = true;
      
      switch (rule.type) {
        case 'required':
          isValid = validators.required(val);
          break;
        case 'email':
          isValid = validators.email(val);
          break;
        case 'url':
          isValid = validators.url(val);
          break;
        case 'pattern':
          isValid = validators.pattern(val, rule.value);
          break;
        case 'minLength':
          isValid = validators.minLength(val, rule.value);
          break;
        case 'maxLength':
          isValid = validators.maxLength(val, rule.value);
          break;
        case 'min':
          isValid = validators.min(val, rule.value);
          break;
        case 'max':
          isValid = validators.max(val, rule.value);
          break;
        case 'custom':
          if (rule.validator) {
            isValid = rule.validator(val);
          }
          break;
      }
      
      if (!isValid) {
        validationErrors.push(rule.message);
      }
    }
    
    setErrors(validationErrors);
    onValidation?.(validationErrors.length === 0, validationErrors);
    return validationErrors.length === 0;
  }, [rules, validators, onValidation]);
  
  // Debounced validation
  const debouncedValidate = useCallback((val: any) => {
    if (validationTimer) {
      clearTimeout(validationTimer);
    }
    
    setIsValidating(true);
    const timer = setTimeout(() => {
      validate(val);
      setIsValidating(false);
    }, debounceMs);
    
    setValidationTimer(timer);
  }, [validate, debounceMs, validationTimer]);
  
  // Handle value change
  const handleChange = useCallback((newValue: any) => {
    setLocalValue(newValue);
    onChange(newValue);
    
    if (validateOnChange && touched) {
      if (debounceMs > 0) {
        debouncedValidate(newValue);
      } else {
        validate(newValue);
      }
    }
  }, [onChange, validateOnChange, touched, debounceMs, validate, debouncedValidate]);
  
  // Handle blur
  const handleBlur = useCallback(() => {
    setTouched(true);
    if (validateOnBlur) {
      validate(localValue);
    }
  }, [validateOnBlur, validate, localValue]);
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (validationTimer) {
        clearTimeout(validationTimer);
      }
    };
  }, [validationTimer]);
  
  // Determine validation state
  const hasErrors = errors.length > 0 && touched;
  const isValid = errors.length === 0 && touched && rules.length > 0;
  
  // Render input based on type
  const renderInput = () => {
    const baseClasses = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
      hasErrors 
        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
        : isValid 
        ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
    } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${className}`;
    
    switch (fieldType) {
      case 'select':
      case 'dropdown':
        return (
          <select
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            className={baseClasses}
            aria-invalid={hasErrors}
            aria-describedby={hasErrors ? `${fieldKey}-error` : undefined}
          >
            <option value="">-- Select --</option>
            {options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      
      case 'textarea':
        return (
          <textarea
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            rows={3}
            className={baseClasses}
            aria-invalid={hasErrors}
            aria-describedby={hasErrors ? `${fieldKey}-error` : undefined}
          />
        );
      
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={localValue === true || localValue === 'true'}
            onChange={(e) => handleChange(e.target.checked)}
            onBlur={handleBlur}
            disabled={disabled}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            aria-invalid={hasErrors}
            aria-describedby={hasErrors ? `${fieldKey}-error` : undefined}
          />
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={baseClasses}
            aria-invalid={hasErrors}
            aria-describedby={hasErrors ? `${fieldKey}-error` : undefined}
          />
        );
      
      case 'email':
        return (
          <input
            type="email"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder || 'email@example.com'}
            disabled={disabled}
            className={baseClasses}
            aria-invalid={hasErrors}
            aria-describedby={hasErrors ? `${fieldKey}-error` : undefined}
          />
        );
      
      case 'url':
        return (
          <input
            type="url"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder || 'https://example.com'}
            disabled={disabled}
            className={baseClasses}
            aria-invalid={hasErrors}
            aria-describedby={hasErrors ? `${fieldKey}-error` : undefined}
          />
        );
      
      case 'date':
        return (
          <input
            type="date"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            className={baseClasses}
            aria-invalid={hasErrors}
            aria-describedby={hasErrors ? `${fieldKey}-error` : undefined}
          />
        );
      
      default:
        return (
          <input
            type="text"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={baseClasses}
            aria-invalid={hasErrors}
            aria-describedby={hasErrors ? `${fieldKey}-error` : undefined}
          />
        );
    }
  };
  
  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {rules.some(r => r.type === 'required') && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
      )}
      
      <div className="relative">
        {renderInput()}
        
        {/* Validation icon */}
        {showValidationIcon && touched && !isValidating && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
            {hasErrors ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : isValid ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : null}
          </div>
        )}
        
        {/* Loading indicator */}
        {isValidating && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
      
      {/* Error messages */}
      {hasErrors && (
        <div id={`${fieldKey}-error`} className="mt-1 space-y-1">
          {errors.map((error, index) => (
            <p key={index} className="text-sm text-red-600 flex items-start">
              <AlertCircle className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
              {error}
            </p>
          ))}
        </div>
      )}
      
      {/* Hint text */}
      {!hasErrors && placeholder && touched && (
        <p className="mt-1 text-sm text-gray-500 flex items-start">
          <Info className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
          {placeholder}
        </p>
      )}
    </div>
  );
};

export default ValidatedInput;