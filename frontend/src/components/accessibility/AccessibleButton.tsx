/**
 * Accessible Button Component
 * Fully accessible button with ARIA support
 * WCAG 2.1 Compliant
 */

import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
  ariaDescribedBy?: string;
  srOnlyText?: string;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText = 'Loading...',
      icon,
      iconPosition = 'left',
      fullWidth = false,
      className = '',
      disabled,
      ariaLabel,
      ariaPressed,
      ariaExpanded,
      ariaControls,
      ariaDescribedBy,
      srOnlyText,
      onClick,
      ...props
    },
    ref
  ) => {
    // Size classes
    const sizeClasses = {
      xs: 'px-2 py-1 text-xs',
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-5 py-2.5 text-lg',
      xl: 'px-6 py-3 text-xl'
    };

    // Variant classes
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
      secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
      success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300',
      outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500 disabled:border-gray-200 disabled:text-gray-400',
      ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 disabled:text-gray-400'
    };

    const baseClasses = `
      inline-flex items-center justify-center
      font-medium rounded-md
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:cursor-not-allowed disabled:opacity-50
      ${sizeClasses[size]}
      ${variantClasses[variant]}
      ${fullWidth ? 'w-full' : ''}
      ${className}
    `;

    // Handle keyboard activation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // Space and Enter should activate button
      if ((e.key === ' ' || e.key === 'Enter') && !disabled && !loading) {
        e.preventDefault();
        onClick?.(e as any);
      }
    };

    return (
      <button
        ref={ref}
        className={baseClasses}
        disabled={disabled || loading}
        aria-label={ariaLabel || (loading ? loadingText : undefined)}
        aria-pressed={ariaPressed}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-describedby={ariaDescribedBy}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {/* Loading state */}
        {loading && (
          <LoadingSpinner size="xs" className="mr-2" />
        )}

        {/* Icon on left */}
        {icon && iconPosition === 'left' && !loading && (
          <span className="mr-2" aria-hidden="true">
            {icon}
          </span>
        )}

        {/* Button content */}
        <span>
          {loading ? loadingText : children}
          {srOnlyText && (
            <span className="sr-only">{srOnlyText}</span>
          )}
        </span>

        {/* Icon on right */}
        {icon && iconPosition === 'right' && !loading && (
          <span className="ml-2" aria-hidden="true">
            {icon}
          </span>
        )}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';