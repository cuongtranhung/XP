import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { Eye, EyeOff, AlertCircle } from '../icons';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  showPasswordToggle = false,
  className,
  type = 'text',
  id,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [inputType, setInputType] = React.useState(type);

  // Handle password visibility toggle
  React.useEffect(() => {
    if (showPasswordToggle && type === 'password') {
      setInputType(showPassword ? 'text' : 'password');
    } else {
      setInputType(type);
    }
  }, [showPassword, type, showPasswordToggle]);

  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  const baseStyles = [
    'block w-full px-3 py-2 border rounded-lg shadow-sm',
    'placeholder:text-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
    'transition-colors duration-200',
    'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed'
  ];

  const stateStyles = {
    default: 'border-gray-300 hover:border-gray-400',
    error: 'border-red-300 focus:ring-red-500 focus:border-red-500',
  };

  const iconBaseStyles = 'w-5 h-5 text-gray-400';

  return (
    <div className="space-y-1">
      {label && (
        <label 
          htmlFor={inputId} 
          className="block text-sm font-medium text-gray-700"
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className={iconBaseStyles}>{leftIcon}</span>
          </div>
        )}
        
        <input
          ref={ref}
          type={inputType}
          id={inputId}
          className={clsx(
            baseStyles,
            error ? stateStyles.error : stateStyles.default,
            leftIcon && 'pl-10',
            (rightIcon || showPasswordToggle) && 'pr-10',
            className
          )}
          {...props}
        />
        
        {/* Right icon or password toggle */}
        {(rightIcon || showPasswordToggle) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {showPasswordToggle && type === 'password' ? (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            ) : rightIcon ? (
              <span className={iconBaseStyles}>{rightIcon}</span>
            ) : null}
          </div>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
      
      {/* Helper text */}
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
export { Input };