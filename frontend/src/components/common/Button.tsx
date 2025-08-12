import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from '../icons';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg' | 'xs';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}, ref) => {
  const baseStyles = [
    'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'
  ];

  const variants = {
    primary: [
      'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
      'shadow-sm hover:shadow-md'
    ],
    secondary: [
      'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
      'border border-gray-300 hover:border-gray-400'
    ],
    outline: [
      'border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100',
      'hover:border-gray-400'
    ],
    ghost: [
      'text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200'
    ],
    danger: [
      'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
      'shadow-sm hover:shadow-md'
    ],
    success: [
      'bg-green-600 text-white hover:bg-green-700 active:bg-green-800',
      'shadow-sm hover:shadow-md'
    ],
    warning: [
      'bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700',
      'shadow-sm hover:shadow-md'
    ]
  };

  const sizes = {
    xs: 'px-2 py-1 text-xs gap-1',
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2.5'
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <button
      ref={ref}
      className={clsx(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className={clsx('animate-spin', iconSizes[size])} />
      ) : leftIcon ? (
        <span className={iconSizes[size]}>{leftIcon}</span>
      ) : null}
      
      {children}
      
      {!isLoading && rightIcon && (
        <span className={iconSizes[size]}>{rightIcon}</span>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
export { Button };