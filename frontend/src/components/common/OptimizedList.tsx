import React, { memo, useRef, useCallback } from 'react';
import { useVirtualScroll } from '../../hooks/usePerformance';

interface OptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight?: number;
  className?: string;
  emptyMessage?: string;
}

/**
 * Optimized list component with virtual scrolling for large datasets
 */
function OptimizedListComponent<T>({
  items,
  renderItem,
  itemHeight = 60,
  containerHeight = 600,
  className = '',
  emptyMessage = 'No items to display'
}: OptimizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    visibleItems,
    offsetY,
    totalHeight,
    handleScroll
  } = useVirtualScroll(items, itemHeight, containerHeight);
  
  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 text-gray-500 ${className}`}>
        {emptyMessage}
      </div>
    );
  }
  
  // Use virtual scrolling for lists with more than 50 items
  if (items.length > 50) {
    return (
      <div
        ref={containerRef}
        className={`overflow-auto ${className}`}
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0
            }}
          >
            {visibleItems.map((item, index) => (
              <div
                key={index}
                style={{ height: itemHeight }}
                className="border-b border-gray-200"
              >
                {renderItem(item, index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // Regular rendering for small lists
  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={index} className="border-b border-gray-200">
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

// Export memoized component
export const OptimizedList = memo(OptimizedListComponent) as typeof OptimizedListComponent;

// List item wrapper for consistent memoization
export const ListItem = memo(function ListItem({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-4 hover:bg-gray-50 transition-colors ${className}`}>
      {children}
    </div>
  );
});

export default OptimizedList;