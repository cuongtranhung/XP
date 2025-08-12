/**
 * Focus Trap Component
 * Traps keyboard focus within a container (useful for modals)
 * WCAG 2.1 Criterion 2.4.3 - Focus Order (Level A)
 */

import React, { useEffect, useRef, ReactNode } from 'react';

interface FocusTrapProps {
  children: ReactNode;
  active?: boolean;
  returnFocus?: boolean;
  initialFocus?: string;
  className?: string;
}

export const FocusTrap: React.FC<FocusTrapProps> = ({
  children,
  active = true,
  returnFocus = true,
  initialFocus,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store current focus
    if (returnFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    // Set initial focus
    if (initialFocus && containerRef.current) {
      const initialElement = containerRef.current.querySelector(initialFocus) as HTMLElement;
      if (initialElement) {
        initialElement.focus();
      }
    } else if (containerRef.current) {
      // Focus first focusable element
      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    // Add keydown listener for tab trapping
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!active || !containerRef.current) return;
      
      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements(containerRef.current);
        
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (e.shiftKey) {
          // Shift + Tab
          if (activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
      
      // Escape key handling
      if (e.key === 'Escape') {
        // Dispatch custom event for parent to handle
        const escapeEvent = new CustomEvent('focustrap:escape', { bubbles: true });
        containerRef.current.dispatchEvent(escapeEvent);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      // Return focus to previous element
      if (returnFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, returnFocus, initialFocus]);

  if (!active) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

// Helper function to get all focusable elements
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'details',
    'summary'
  ].join(', ');

  const elements = container.querySelectorAll<HTMLElement>(focusableSelectors);
  return Array.from(elements).filter(el => {
    // Check if element is visible
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}