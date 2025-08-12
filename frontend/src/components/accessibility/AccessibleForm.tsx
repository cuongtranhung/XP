/**
 * Accessible Form Components
 * Form components with full ARIA support and error handling
 * WCAG 2.1 Criterion 3.3 - Input Assistance (Level A & AA)
 */

import React, { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';

// Accessible Input Component
interface AccessibleInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  srOnly?: boolean;
  required?: boolean;
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({ label, error, hint, srOnly = false, required, id, className = '', ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const ariaDescribedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="mb-4">
        <label
          htmlFor={inputId}
          className={`block text-sm font-medium text-gray-700 mb-1 ${srOnly ? 'sr-only' : ''}`}
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-label="required">
              *
            </span>
          )}
        </label>
        
        {hint && !srOnly && (
          <p id={hintId} className="text-sm text-gray-600 mb-1">
            {hint}
          </p>
        )}
        
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={ariaDescribedBy}
          aria-required={required}
          className={`
            block w-full px-3 py-2 border rounded-md shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${error ? 'border-red-300' : 'border-gray-300'}
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
        
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AccessibleInput.displayName = 'AccessibleInput';

// Accessible Textarea Component
interface AccessibleTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  srOnly?: boolean;
  required?: boolean;
}

export const AccessibleTextarea = forwardRef<HTMLTextAreaElement, AccessibleTextareaProps>(
  ({ label, error, hint, srOnly = false, required, id, className = '', ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${textareaId}-error` : undefined;
    const hintId = hint ? `${textareaId}-hint` : undefined;
    const ariaDescribedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="mb-4">
        <label
          htmlFor={textareaId}
          className={`block text-sm font-medium text-gray-700 mb-1 ${srOnly ? 'sr-only' : ''}`}
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-label="required">
              *
            </span>
          )}
        </label>
        
        {hint && !srOnly && (
          <p id={hintId} className="text-sm text-gray-600 mb-1">
            {hint}
          </p>
        )}
        
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={!!error}
          aria-describedby={ariaDescribedBy}
          aria-required={required}
          className={`
            block w-full px-3 py-2 border rounded-md shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${error ? 'border-red-300' : 'border-gray-300'}
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
        
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AccessibleTextarea.displayName = 'AccessibleTextarea';

// Accessible Select Component
interface AccessibleSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  srOnly?: boolean;
  required?: boolean;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const AccessibleSelect = forwardRef<HTMLSelectElement, AccessibleSelectProps>(
  ({ label, error, hint, srOnly = false, required, options, placeholder, id, className = '', ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${selectId}-error` : undefined;
    const hintId = hint ? `${selectId}-hint` : undefined;
    const ariaDescribedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="mb-4">
        <label
          htmlFor={selectId}
          className={`block text-sm font-medium text-gray-700 mb-1 ${srOnly ? 'sr-only' : ''}`}
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-label="required">
              *
            </span>
          )}
        </label>
        
        {hint && !srOnly && (
          <p id={hintId} className="text-sm text-gray-600 mb-1">
            {hint}
          </p>
        )}
        
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={ariaDescribedBy}
          aria-required={required}
          className={`
            block w-full px-3 py-2 border rounded-md shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${error ? 'border-red-300' : 'border-gray-300'}
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(option => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AccessibleSelect.displayName = 'AccessibleSelect';

// Accessible Checkbox Component
interface AccessibleCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const AccessibleCheckbox = forwardRef<HTMLInputElement, AccessibleCheckboxProps>(
  ({ label, error, hint, id, className = '', ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${checkboxId}-error` : undefined;
    const hintId = hint ? `${checkboxId}-hint` : undefined;
    const ariaDescribedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="mb-4">
        <div className="flex items-start">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            aria-invalid={!!error}
            aria-describedby={ariaDescribedBy}
            className={`
              mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded
              focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              ${className}
            `}
            {...props}
          />
          <div className="ml-2">
            <label
              htmlFor={checkboxId}
              className="text-sm font-medium text-gray-700 cursor-pointer"
            >
              {label}
            </label>
            {hint && (
              <p id={hintId} className="text-xs text-gray-600 mt-0.5">
                {hint}
              </p>
            )}
          </div>
        </div>
        
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AccessibleCheckbox.displayName = 'AccessibleCheckbox';

// Accessible Radio Group Component
interface AccessibleRadioGroupProps {
  label: string;
  name: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const AccessibleRadioGroup: React.FC<AccessibleRadioGroupProps> = ({
  label,
  name,
  options,
  value,
  onChange,
  error,
  hint,
  required
}) => {
  const groupId = `radiogroup-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${groupId}-error` : undefined;
  const hintId = hint ? `${groupId}-hint` : undefined;
  const ariaDescribedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset
      role="radiogroup"
      aria-describedby={ariaDescribedBy}
      aria-required={required}
      aria-invalid={!!error}
      className="mb-4"
    >
      <legend className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </legend>
      
      {hint && (
        <p id={hintId} className="text-sm text-gray-600 mb-2">
          {hint}
        </p>
      )}
      
      <div className="space-y-2">
        {options.map(option => (
          <div key={option.value} className="flex items-center">
            <input
              type="radio"
              id={`${name}-${option.value}`}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange?.(e.target.value)}
              disabled={option.disabled}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <label
              htmlFor={`${name}-${option.value}`}
              className="ml-2 text-sm text-gray-700 cursor-pointer"
            >
              {option.label}
            </label>
          </div>
        ))}
      </div>
      
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
};