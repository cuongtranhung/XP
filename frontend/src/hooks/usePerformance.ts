import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce, useDebouncedCallback } from './useDebounce';

/**
 * Performance optimization hooks collection
 */

// Prevent unnecessary re-renders with stable callbacks
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList = []
): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, deps);
  
  return useCallback(
    ((...args) => callbackRef.current(...args)) as T,
    []
  );
}

// Lazy state initialization for expensive computations
export function useLazyState<T>(
  initializer: () => T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    // Only run initializer once
    return initializer();
  });
  
  return [state, setState];
}

// Intersection observer for lazy loading
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { threshold: 0.1, ...options }
    );
    
    observer.observe(element);
    
    return () => observer.disconnect();
  }, [ref, options.threshold, options.root, options.rootMargin]);
  
  return isIntersecting;
}

// Virtual scrolling hook for large lists
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 3
) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    
    return {
      startIndex,
      endIndex,
      visibleItems: items.slice(startIndex, endIndex + 1),
      offsetY: startIndex * itemHeight,
      totalHeight: items.length * itemHeight
    };
  }, [scrollTop, items.length, itemHeight, containerHeight, overscan]);
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  return {
    ...visibleRange,
    handleScroll
  };
}

// Prefetch data for faster navigation
export function usePrefetch() {
  const cache = useRef(new Map<string, any>());
  
  const prefetch = useCallback(async (key: string, fetcher: () => Promise<any>) => {
    if (cache.current.has(key)) {
      return cache.current.get(key);
    }
    
    const data = await fetcher();
    cache.current.set(key, data);
    
    // Clear cache after 5 minutes
    setTimeout(() => {
      cache.current.delete(key);
    }, 5 * 60 * 1000);
    
    return data;
  }, []);
  
  const getCached = useCallback((key: string) => {
    return cache.current.get(key);
  }, []);
  
  const clearCache = useCallback((key?: string) => {
    if (key) {
      cache.current.delete(key);
    } else {
      cache.current.clear();
    }
  }, []);
  
  return { prefetch, getCached, clearCache };
}

// Measure component render performance
export function useRenderMetrics(componentName: string) {
  const renderCount = useRef(0);
  const renderStartTime = useRef<number>();
  
  useEffect(() => {
    renderCount.current++;
    
    if (process.env.NODE_ENV === 'development') {
      const renderTime = renderStartTime.current 
        ? performance.now() - renderStartTime.current 
        : 0;
      
      if (renderTime > 16) { // Longer than one frame (60fps)
        console.warn(
          `[Performance] ${componentName} slow render: ${renderTime.toFixed(2)}ms (render #${renderCount.current})`
        );
      }
    }
    
    renderStartTime.current = performance.now();
  });
  
  return {
    renderCount: renderCount.current
  };
}

// Batch state updates for better performance
export function useBatchedState<T extends Record<string, any>>(
  initialState: T
): [T, (updates: Partial<T>) => void] {
  const [state, setState] = useState<T>(initialState);
  const pendingUpdates = useRef<Partial<T>>({});
  const updateTimeout = useRef<NodeJS.Timeout>();
  
  const batchUpdate = useCallback((updates: Partial<T>) => {
    pendingUpdates.current = { ...pendingUpdates.current, ...updates };
    
    if (updateTimeout.current) {
      clearTimeout(updateTimeout.current);
    }
    
    updateTimeout.current = setTimeout(() => {
      setState(prev => ({ ...prev, ...pendingUpdates.current }));
      pendingUpdates.current = {};
    }, 0);
  }, []);
  
  useEffect(() => {
    return () => {
      if (updateTimeout.current) {
        clearTimeout(updateTimeout.current);
      }
    };
  }, []);
  
  return [state, batchUpdate];
}

// Export all hooks
export {
  useDebounce,
  useDebouncedCallback
};