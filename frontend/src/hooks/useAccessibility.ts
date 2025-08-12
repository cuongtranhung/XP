/**
 * Accessibility Hooks - Phase 4 Implementation
 * Hooks for WCAG 2.1 AAA compliance
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook for keyboard navigation management
 */
export const useKeyboardNavigation = (
  options: {
    enableArrowNavigation?: boolean;
    enableHomeEnd?: boolean;
    enableTypeahead?: boolean;
    wrapNavigation?: boolean;
  } = {}
) => {
  const {
    enableArrowNavigation = true,
    enableHomeEnd = true,
    enableTypeahead = false,
    wrapNavigation = true
  } = options;

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsRef = useRef<(HTMLElement | null)[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Register item for keyboard navigation
  const registerItem = useCallback((index: number) => {
    return (el: HTMLElement | null) => {
      itemsRef.current[index] = el;
    };
  }, []);

  // Focus specific item
  const focusItem = useCallback((index: number) => {
    const item = itemsRef.current[index];
    if (item) {
      item.focus();
      setFocusedIndex(index);
      
      // Announce to screen reader
      const announcement = item.getAttribute('aria-label') || item.textContent;
      if (announcement) {
        announceToScreenReader(`${announcement}, ${index + 1} of ${itemsRef.current.length}`);
      }
    }
  }, []);

  // Navigate to next/previous item
  const navigate = useCallback((direction: 'next' | 'prev' | 'first' | 'last') => {
    const items = itemsRef.current.filter(Boolean);
    const currentIndex = focusedIndex;
    let nextIndex: number;

    switch (direction) {
      case 'next':
        nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
          nextIndex = wrapNavigation ? 0 : items.length - 1;
        }
        break;
      case 'prev':
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = wrapNavigation ? items.length - 1 : 0;
        }
        break;
      case 'first':
        nextIndex = 0;
        break;
      case 'last':
        nextIndex = items.length - 1;
        break;
    }

    focusItem(nextIndex);
  }, [focusedIndex, focusItem, wrapNavigation]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const items = itemsRef.current.filter(Boolean);
    if (items.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        if (enableArrowNavigation) {
          event.preventDefault();
          navigate('next');
        }
        break;
      case 'ArrowUp':
        if (enableArrowNavigation) {
          event.preventDefault();
          navigate('prev');
        }
        break;
      case 'Home':
        if (enableHomeEnd) {
          event.preventDefault();
          navigate('first');
        }
        break;
      case 'End':
        if (enableHomeEnd) {
          event.preventDefault();
          navigate('last');
        }
        break;
      default:
        // Typeahead search
        if (enableTypeahead && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          clearTimeout(searchTimeoutRef.current);
          
          const newQuery = searchQuery + event.key.toLowerCase();
          setSearchQuery(newQuery);
          
          // Find matching item
          const matchIndex = items.findIndex((item) => {
            const text = item?.textContent?.toLowerCase() || '';
            return text.startsWith(newQuery);
          });
          
          if (matchIndex !== -1) {
            focusItem(matchIndex);
          }
          
          // Clear search after delay
          searchTimeoutRef.current = setTimeout(() => {
            setSearchQuery('');
          }, 1000);
        }
    }
  }, [
    enableArrowNavigation,
    enableHomeEnd,
    enableTypeahead,
    navigate,
    searchQuery,
    focusItem
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(searchTimeoutRef.current);
    };
  }, [handleKeyDown]);

  return {
    focusedIndex,
    registerItem,
    focusItem,
    navigate,
    searchQuery
  };
};

/**
 * Hook for focus trap management
 */
export const useFocusTrap = (
  containerRef: React.RefObject<HTMLElement>,
  options: {
    enabled?: boolean;
    returnFocus?: boolean;
    initialFocus?: React.RefObject<HTMLElement>;
    allowOutsideClick?: boolean;
  } = {}
) => {
  const {
    enabled = true,
    returnFocus = true,
    initialFocus,
    allowOutsideClick = false
  } = options;

  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    
    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Set initial focus
    const setInitialFocus = () => {
      if (initialFocus?.current) {
        initialFocus.current.focus();
      } else {
        const firstFocusable = container.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    };

    setInitialFocus();

    // Get focusable elements
    const getFocusableElements = () => {
      return container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
    };

    // Handle tab key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = Array.from(getFocusableElements());
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Handle clicks outside
    const handleClickOutside = (event: MouseEvent) => {
      if (!allowOutsideClick && !container.contains(event.target as Node)) {
        event.preventDefault();
        event.stopPropagation();
        setInitialFocus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside, true);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside, true);

      // Return focus
      if (returnFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [enabled, containerRef, returnFocus, initialFocus, allowOutsideClick]);
};

/**
 * Hook for roving tabindex pattern
 */
export const useRovingTabIndex = (
  itemCount: number,
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
  } = {}
) => {
  const {
    orientation = 'vertical',
    loop = true
  } = options;

  const [activeIndex, setActiveIndex] = useState(0);

  const getRovingProps = useCallback((index: number) => {
    return {
      tabIndex: index === activeIndex ? 0 : -1,
      'data-roving-index': index
    };
  }, [activeIndex]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    let handled = false;

    switch (event.key) {
      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'both') {
          nextIndex = loop 
            ? (index + 1) % itemCount 
            : Math.min(index + 1, itemCount - 1);
          handled = true;
        }
        break;
      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'both') {
          nextIndex = loop 
            ? (index - 1 + itemCount) % itemCount 
            : Math.max(index - 1, 0);
          handled = true;
        }
        break;
      case 'ArrowDown':
        if (orientation === 'vertical' || orientation === 'both') {
          nextIndex = loop 
            ? (index + 1) % itemCount 
            : Math.min(index + 1, itemCount - 1);
          handled = true;
        }
        break;
      case 'ArrowUp':
        if (orientation === 'vertical' || orientation === 'both') {
          nextIndex = loop 
            ? (index - 1 + itemCount) % itemCount 
            : Math.max(index - 1, 0);
          handled = true;
        }
        break;
      case 'Home':
        nextIndex = 0;
        handled = true;
        break;
      case 'End':
        nextIndex = itemCount - 1;
        handled = true;
        break;
    }

    if (handled) {
      event.preventDefault();
      setActiveIndex(nextIndex);
    }
  }, [itemCount, orientation, loop]);

  return {
    activeIndex,
    setActiveIndex,
    getRovingProps,
    handleKeyDown
  };
};

/**
 * Hook for live region announcements
 */
export const useLiveRegion = (
  mode: 'polite' | 'assertive' = 'polite'
) => {
  const [announcement, setAnnouncement] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  const announce = useCallback((message: string, delay = 100) => {
    clearTimeout(timeoutRef.current);
    
    // Clear first to ensure screen reader picks up the change
    setAnnouncement('');
    
    timeoutRef.current = setTimeout(() => {
      setAnnouncement(message);
      
      // Clear after announcement
      timeoutRef.current = setTimeout(() => {
        setAnnouncement('');
      }, 1000);
    }, delay);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const liveRegionProps = {
    role: mode === 'assertive' ? 'alert' : 'status',
    'aria-live': mode,
    'aria-atomic': true,
    'aria-relevant': 'additions text',
    className: 'sr-only'
  };

  return {
    announcement,
    announce,
    liveRegionProps
  };
};

/**
 * Hook for reduced motion preference
 */
export const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    setReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return reducedMotion;
};

/**
 * Hook for high contrast mode detection
 */
export const useHighContrast = () => {
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    
    setHighContrast(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setHighContrast(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return highContrast;
};

/**
 * Hook for color scheme preference
 */
export const useColorScheme = () => {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    setColorScheme(mediaQuery.matches ? 'dark' : 'light');

    const handleChange = (event: MediaQueryListEvent) => {
      setColorScheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return colorScheme;
};

// Helper function to announce to screen readers
function announceToScreenReader(message: string) {
  const event = new CustomEvent('aria-announce', {
    detail: { message }
  });
  window.dispatchEvent(event);
}