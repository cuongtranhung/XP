import React from 'react';
import { clsx } from 'clsx';
import { CheckCircle, AlertCircle, XCircle, Info, X } from '../icons';

interface AlertProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  dismissible = false,
  onDismiss,
  className
}) => {
  const variants = {
    success: {
      container: 'bg-green-50 border-green-200 text-green-800',
      icon: CheckCircle,
      iconColor: 'text-green-400'
    },
    error: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: XCircle,
      iconColor: 'text-red-400'
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: AlertCircle,
      iconColor: 'text-yellow-400'
    },
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: Info,
      iconColor: 'text-blue-400'
    }
  };

  const variant = variants[type];
  const Icon = variant.icon;

  return (
    <div className={clsx(
      'border rounded-lg p-4',
      variant.container,
      className
    )}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Icon className={clsx('w-5 h-5', variant.iconColor)} />
        </div>
        
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium mb-1">
              {title}
            </h3>
          )}
          <p className="text-sm">
            {message}
          </p>
        </div>
        
        {dismissible && onDismiss && (
          <div className="ml-auto pl-3">
            <button
              onClick={onDismiss}
              className={clsx(
                'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
                type === 'success' && 'text-green-500 hover:bg-green-100 focus:ring-green-600',
                type === 'error' && 'text-red-500 hover:bg-red-100 focus:ring-red-600',
                type === 'warning' && 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-600',
                type === 'info' && 'text-blue-500 hover:bg-blue-100 focus:ring-blue-600'
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alert;