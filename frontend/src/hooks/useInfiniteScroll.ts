/**
 * Infinite Scroll Hook
 * Provides infinite scrolling functionality with intersection observer
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  enabled?: boolean;
}

export const useInfiniteScroll = ({
  threshold = 0.8,
  rootMargin = '100px',
  hasMore,
  loading,
  onLoadMore,
  enabled = true
}: UseInfiniteScrollOptions) => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  // Cleanup observer
  const cleanup = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  // Setup intersection observer
  const setupObserver = useCallback(() => {
    if (!enabled || !hasMore || loading) {
      cleanup();
      return;
    }

    const options: IntersectionObserverInit = {
      root: null,
      rootMargin,
      threshold
    };

    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      setIsIntersecting(entry.isIntersecting);
      
      if (entry.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    }, options);

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }
  }, [enabled, hasMore, loading, threshold, rootMargin, onLoadMore, cleanup]);

  // Setup and cleanup observer
  useEffect(() => {
    setupObserver();
    return cleanup;
  }, [setupObserver, cleanup]);

  // Manually trigger load
  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      onLoadMore();
    }
  }, [hasMore, loading, onLoadMore]);

  // Reset scroll position
  const resetScroll = useCallback(() => {
    if (sentinelRef.current) {
      const scrollContainer = sentinelRef.current.closest('[data-infinite-scroll-container]');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    }
  }, []);

  return {
    sentinelRef,
    isIntersecting,
    loadMore,
    resetScroll
  };
};

// Hook for virtual infinite scroll with windowing
interface UseVirtualInfiniteScrollOptions<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

export const useVirtualInfiniteScroll = <T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
  hasMore,
  loading,
  onLoadMore
}: UseVirtualInfiniteScrollOptions<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Calculate visible range
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);
  
  // Add overscan
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan);

  // Calculate total height
  const totalHeight = items.length * itemHeight;

  // Check if should load more
  const shouldLoadMore = useCallback(() => {
    const scrollPercentage = (scrollTop + containerHeight) / totalHeight;
    return scrollPercentage > 0.8 && hasMore && !loading;
  }, [scrollTop, containerHeight, totalHeight, hasMore, loading]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
    
    if (shouldLoadMore()) {
      onLoadMore();
    }
  }, [shouldLoadMore, onLoadMore]);

  // Get visible items
  const visibleItems = items.slice(startIndex, endIndex + 1);

  // Calculate offset for visible items
  const offsetY = startIndex * itemHeight;

  return {
    containerRef,
    handleScroll,
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex
  };
};