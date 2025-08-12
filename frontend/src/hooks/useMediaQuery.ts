/**
 * Enhanced Media Query Hook - Phase 1 Implementation
 * Responsive breakpoint detection with improved browser support
 */

import { useState, useEffect } from 'react';

/**
 * Custom hook to detect media query matches
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @returns boolean indicating if the media query matches
 */
export const useMediaQuery = (query: string): boolean => {
  // Initialize with false to avoid hydration mismatches in SSR
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);

    // Define the event handler
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add event listener with fallback for older browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      // Fallback for older browsers
      (mediaQuery as any).addListener(handleMediaChange);
    }

    // Cleanup function
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else {
        // Fallback for older browsers
        (mediaQuery as any).removeListener(handleMediaChange);
      }
    };
  }, [query]);

  return matches;
};

/**
 * Predefined breakpoint hooks for common use cases
 * Using Tailwind CSS breakpoints for consistency
 */
export const useBreakpoint = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isLargeScreen = useMediaQuery('(min-width: 1280px)');
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeScreen,
    // Derived states
    isMobileOrTablet: isMobile || isTablet,
    isTabletOrDesktop: isTablet || isDesktop
  };
};

// Legacy preset hooks for backward compatibility
export const useIsMobile = () => useMediaQuery('(max-width: 768px)');
export const useIsTablet = () => useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const useIsLandscape = () => useMediaQuery('(orientation: landscape)');
export const useIsPortrait = () => useMediaQuery('(orientation: portrait)');
export const useIsTouchDevice = () => useMediaQuery('(hover: none) and (pointer: coarse)');
export const useIsHighDensity = () => useMediaQuery('(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)');

export default useMediaQuery;