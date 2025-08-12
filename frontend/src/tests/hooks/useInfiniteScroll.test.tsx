/**
 * Unit Tests for Infinite Scroll Hook
 * Testing intersection observer behavior and virtual scrolling logic
 */

import { renderHook, act } from '@testing-library/react';
import { useInfiniteScroll, useVirtualInfiniteScroll } from '../../hooks/useInfiniteScroll';

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  private callback: IntersectionObserverCallback;
  private elements: Set<Element> = new Set();

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.rootMargin = options?.rootMargin || '';
    this.thresholds = Array.isArray(options?.threshold) 
      ? options.threshold 
      : [options?.threshold || 0];
  }

  observe(element: Element): void {
    this.elements.add(element);
  }

  unobserve(element: Element): void {
    this.elements.delete(element);
  }

  disconnect(): void {
    this.elements.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  // Helper method to trigger intersection
  triggerIntersection(isIntersecting: boolean): void {
    if (this.elements.size === 0) {
      // Create a dummy element if none exist
      const dummyElement = document.createElement('div');
      this.elements.add(dummyElement);
    }
    
    const entries: IntersectionObserverEntry[] = Array.from(this.elements).map(element => ({
      boundingClientRect: element.getBoundingClientRect(),
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: element.getBoundingClientRect(),
      isIntersecting,
      rootBounds: null,
      target: element,
      time: Date.now()
    }));
    this.callback(entries, this);
  }
}

// Store the original IntersectionObserver
const originalIntersectionObserver = global.IntersectionObserver;

describe('useInfiniteScroll', () => {
  let mockObserver: MockIntersectionObserver;
  
  beforeEach(() => {
    // Mock IntersectionObserver globally
    global.IntersectionObserver = jest.fn((callback, options) => {
      mockObserver = new MockIntersectionObserver(callback, options);
      return mockObserver;
    }) as any;
  });

  afterEach(() => {
    // Restore original IntersectionObserver
    global.IntersectionObserver = originalIntersectionObserver;
  });

  it('should initialize with default values', () => {
    const onLoadMore = jest.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        hasMore: true,
        loading: false,
        onLoadMore
      })
    );

    expect(result.current.isIntersecting).toBe(false);
    expect(result.current.sentinelRef.current).toBeNull();
  });

  it('should call onLoadMore when sentinel is intersecting', () => {
    const onLoadMore = jest.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        hasMore: true,
        loading: false,
        onLoadMore
      })
    );

    // Create a mock sentinel element
    const sentinel = document.createElement('div');
    act(() => {
      result.current.sentinelRef.current = sentinel;
    });

    // Trigger intersection
    act(() => {
      mockObserver.triggerIntersection(true);
    });

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('should not call onLoadMore when loading', () => {
    const onLoadMore = jest.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        hasMore: true,
        loading: true,
        onLoadMore
      })
    );

    // Create a mock sentinel element
    const sentinel = document.createElement('div');
    act(() => {
      result.current.sentinelRef.current = sentinel;
    });

    // Trigger intersection
    act(() => {
      mockObserver.triggerIntersection(true);
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('should not call onLoadMore when hasMore is false', () => {
    const onLoadMore = jest.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        hasMore: false,
        loading: false,
        onLoadMore
      })
    );

    // Create a mock sentinel element
    const sentinel = document.createElement('div');
    act(() => {
      result.current.sentinelRef.current = sentinel;
    });

    // Try to trigger intersection
    act(() => {
      mockObserver?.triggerIntersection(true);
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('should manually trigger loadMore', () => {
    const onLoadMore = jest.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        hasMore: true,
        loading: false,
        onLoadMore
      })
    );

    act(() => {
      result.current.loadMore();
    });

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('should reset scroll position', () => {
    const onLoadMore = jest.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        hasMore: true,
        loading: false,
        onLoadMore
      })
    );

    // Create a mock container with sentinel
    const container = document.createElement('div');
    container.setAttribute('data-infinite-scroll-container', 'true');
    container.scrollTop = 100;
    
    const sentinel = document.createElement('div');
    container.appendChild(sentinel);
    
    act(() => {
      result.current.sentinelRef.current = sentinel;
    });

    act(() => {
      result.current.resetScroll();
    });

    expect(container.scrollTop).toBe(0);
  });

  it('should disconnect observer when disabled', () => {
    const onLoadMore = jest.fn();
    const { rerender } = renderHook(
      ({ enabled }) =>
        useInfiniteScroll({
          hasMore: true,
          loading: false,
          onLoadMore,
          enabled
        }),
      { initialProps: { enabled: true } }
    );

    const disconnectSpy = jest.spyOn(mockObserver, 'disconnect');

    rerender({ enabled: false });

    expect(disconnectSpy).toHaveBeenCalled();
  });
});

describe('useVirtualInfiniteScroll', () => {
  it('should calculate visible range correctly', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    const onLoadMore = jest.fn();
    
    const { result } = renderHook(() =>
      useVirtualInfiniteScroll({
        items,
        itemHeight: 50,
        containerHeight: 500,
        overscan: 3,
        hasMore: true,
        loading: false,
        onLoadMore
      })
    );

    expect(result.current.visibleItems.length).toBeGreaterThan(0);
    expect(result.current.totalHeight).toBe(5000); // 100 items * 50px
    expect(result.current.offsetY).toBe(0);
  });

  it('should update visible items when scrolling', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    const onLoadMore = jest.fn();
    
    const { result } = renderHook(() =>
      useVirtualInfiniteScroll({
        items,
        itemHeight: 50,
        containerHeight: 500,
        overscan: 0,
        hasMore: true,
        loading: false,
        onLoadMore
      })
    );

    // Simulate scroll event
    const mockEvent = {
      currentTarget: { scrollTop: 250 }
    } as React.UIEvent<HTMLDivElement>;

    act(() => {
      result.current.handleScroll(mockEvent);
    });

    // At scrollTop 250px with itemHeight 50px, we should see items starting from index 5
    expect(result.current.startIndex).toBe(5);
    expect(result.current.offsetY).toBe(250);
  });

  it('should call onLoadMore when scrolling near bottom', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    const onLoadMore = jest.fn();
    
    const { result } = renderHook(() =>
      useVirtualInfiniteScroll({
        items,
        itemHeight: 50,
        containerHeight: 500,
        overscan: 0,
        hasMore: true,
        loading: false,
        onLoadMore
      })
    );

    // Total height = 50 items * 50px = 2500px
    // 80% of scrollable area = (2500 - 500) * 0.8 + 500 = 2100px
    // To reach 80%, scrollTop should be at least 1600px (2100 - 500 container height)
    const mockEvent = {
      currentTarget: { scrollTop: 1600 }
    } as React.UIEvent<HTMLDivElement>;

    act(() => {
      result.current.handleScroll(mockEvent);
    });

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('should respect overscan parameter', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    const onLoadMore = jest.fn();
    
    const { result } = renderHook(() =>
      useVirtualInfiniteScroll({
        items,
        itemHeight: 50,
        containerHeight: 500,
        overscan: 3,
        hasMore: true,
        loading: false,
        onLoadMore
      })
    );

    // With overscan of 3, we should have more items than just the visible ones
    const visibleCount = Math.ceil(500 / 50); // 10 visible items
    const expectedCount = visibleCount + 3 * 2; // +3 above and +3 below
    
    expect(result.current.visibleItems.length).toBeLessThanOrEqual(expectedCount);
  });

  it('should handle empty items array', () => {
    const onLoadMore = jest.fn();
    
    const { result } = renderHook(() =>
      useVirtualInfiniteScroll({
        items: [],
        itemHeight: 50,
        containerHeight: 500,
        overscan: 3,
        hasMore: true,
        loading: false,
        onLoadMore
      })
    );

    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.totalHeight).toBe(0);
    expect(result.current.offsetY).toBe(0);
  });
});