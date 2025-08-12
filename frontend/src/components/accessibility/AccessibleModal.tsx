/**
 * Accessible Modal Component
 * Fully accessible modal with focus management and ARIA support
 * WCAG 2.1 Compliant - Focus management, keyboard navigation, screen reader support
 */

import React, { useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FocusTrap } from './FocusTrap';
import { AccessibleButton } from './AccessibleButton';

interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  actions?: ReactNode;
  ariaDescribedBy?: string;
  initialFocus?: string;
}

export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  actions,
  ariaDescribedBy,
  initialFocus
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const headingId = useRef(`modal-heading-${Math.random().toString(36).substr(2, 9)}`).current;
  const descriptionId = ariaDescribedBy || `modal-description-${Math.random().toString(36).substr(2, 9)}`;

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      // Announce modal opening to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = `Dialog opened: ${title}`;
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
      
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, title]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4'
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      aria-modal="true"
      role="dialog"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Modal container */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <FocusTrap active={isOpen} returnFocus initialFocus={initialFocus}>
          <div
            ref={modalRef}
            className={`
              relative bg-white rounded-lg shadow-xl transform transition-all
              w-full ${sizeClasses[size]}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2
                  id={headingId}
                  className="text-lg font-semibold text-gray-900"
                >
                  {title}
                </h2>
                
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="
                      text-gray-400 hover:text-gray-500
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                      rounded-md p-1
                    "
                    aria-label="Close dialog"
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div 
              id={descriptionId}
              className="px-6 py-4 max-h-[60vh] overflow-y-auto"
            >
              {children}
            </div>

            {/* Actions */}
            {actions && (
              <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
                {actions}
              </div>
            )}
          </div>
        </FocusTrap>
      </div>
    </div>
  );

  // Portal to render modal at document root
  return createPortal(modalContent, document.body);
};

// Accessible Confirm Dialog
interface AccessibleConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const AccessibleConfirmDialog: React.FC<AccessibleConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning'
}) => {
  const iconColors = {
    danger: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600'
  };

  const buttonVariants = {
    danger: 'danger' as const,
    warning: 'primary' as const,
    info: 'primary' as const
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      initialFocus="[data-focus-confirm]"
      actions={
        <>
          <AccessibleButton
            variant="outline"
            onClick={onCancel}
          >
            {cancelText}
          </AccessibleButton>
          <AccessibleButton
            variant={buttonVariants[variant]}
            onClick={onConfirm}
            data-focus-confirm
          >
            {confirmText}
          </AccessibleButton>
        </>
      }
    >
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${iconColors[variant]}`}>
          {variant === 'danger' && (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          )}
          {variant === 'warning' && (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          )}
          {variant === 'info' && (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          )}
        </div>
        
        {/* Message */}
        <div className="flex-1">
          <p className="text-sm text-gray-700">
            {message}
          </p>
        </div>
      </div>
    </AccessibleModal>
  );
};