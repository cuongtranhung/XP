import { useEffect, useRef, useState } from 'react';
import { useCallback } from 'react';

interface AccessibilityOptions {
  enableAnnouncements?: boolean;
  enableFocusTrap?: boolean;
  enableHighContrast?: boolean;
  enableReducedMotion?: boolean;
}

export const useAccessibility = (options: AccessibilityOptions = {}) => {
  const [announcement, setAnnouncement] = useState('');
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const focusTrapRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Check user preferences
  useEffect(() => {
    const checkPreferences = () => {
      // Check for reduced motion preference
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(motionQuery.matches);

      // Check for high contrast preference
      const contrastQuery = window.matchMedia('(prefers-contrast: high)');
      setIsHighContrast(contrastQuery.matches);
    };

    checkPreferences();

    // Listen for changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');

    const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    const handleContrastChange = (e: MediaQueryListEvent) => setIsHighContrast(e.matches);

    motionQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, []);

  // Focus trap implementation
  const setupFocusTrap = useCallback((element: HTMLElement) => {
    if (!options.enableFocusTrap) return;

    focusTrapRef.current = element;
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Get all focusable elements
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus first element
    firstFocusable.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    element.addEventListener('keydown', handleKeyDown);

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
      // Restore previous focus
      previousFocusRef.current?.focus();
    };
  }, [options.enableFocusTrap]);

  // Screen reader announcements
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!options.enableAnnouncements) return;

    setAnnouncement(message);
    
    // Clear announcement after it's been read
    setTimeout(() => setAnnouncement(''), 100);
  }, [options.enableAnnouncements]);

  // Get ARIA props for gallery container
  const getGalleryProps = () => ({
    role: 'dialog',
    'aria-modal': true,
    'aria-label': 'Image gallery viewer',
    'aria-describedby': 'gallery-instructions',
    'data-high-contrast': isHighContrast,
    'data-reduced-motion': prefersReducedMotion,
  });

  // Get ARIA props for image
  const getImageProps = (index: number, total: number, alt?: string) => ({
    role: 'img',
    'aria-label': alt || `Image ${index + 1} of ${total}`,
    'aria-roledescription': 'gallery image',
    tabIndex: 0,
  });

  // Get ARIA props for navigation buttons
  const getNavButtonProps = (direction: 'prev' | 'next', disabled: boolean) => ({
    'aria-label': direction === 'prev' ? 'Previous image' : 'Next image',
    'aria-disabled': disabled,
    tabIndex: disabled ? -1 : 0,
  });

  // Get ARIA props for control buttons
  const getControlButtonProps = (action: string, pressed?: boolean) => ({
    'aria-label': action,
    'aria-pressed': pressed,
    tabIndex: 0,
  });

  return {
    // State
    announcement,
    isHighContrast,
    prefersReducedMotion,
    
    // Methods
    announce,
    setupFocusTrap,
    
    // Props generators
    getGalleryProps,
    getImageProps,
    getNavButtonProps,
    getControlButtonProps,
    
    // Utility
    focusableSelector: 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  };
};

export default useAccessibility;