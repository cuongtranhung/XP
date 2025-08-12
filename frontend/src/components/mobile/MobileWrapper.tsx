/**
 * Mobile Wrapper Component
 * Provides responsive layout and touch gesture support for mobile devices
 */

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { useSwipeable } from 'react-swipeable';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface MobileWrapperProps {
  children: ReactNode;
  className?: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onPullToRefresh?: () => Promise<void>;
  enableSwipe?: boolean;
  enablePullToRefresh?: boolean;
}

export const MobileWrapper: React.FC<MobileWrapperProps> = ({
  children,
  className = '',
  onSwipeLeft,
  onSwipeRight,
  onPullToRefresh,
  enableSwipe = true,
  enablePullToRefresh = true
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');

  // Touch start position for pull-to-refresh
  const [touchStart, setTouchStart] = useState(0);

  // Swipe handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (enableSwipe && onSwipeLeft && isMobile) {
        onSwipeLeft();
      }
    },
    onSwipedRight: () => {
      if (enableSwipe && onSwipeRight && isMobile) {
        onSwipeRight();
      }
    },
    preventScrollOnSwipe: false,
    trackMouse: false,
    trackTouch: true,
    delta: 50, // Min distance for swipe
  });

  // Pull to refresh handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enablePullToRefresh || !onPullToRefresh || !isMobile) return;
    
    const touch = e.touches[0];
    if (window.scrollY === 0) {
      setTouchStart(touch.clientY);
      setIsPulling(true);
    }
  }, [enablePullToRefresh, onPullToRefresh, isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || !enablePullToRefresh || isRefreshing) return;

    const touch = e.touches[0];
    const distance = touch.clientY - touchStart;
    
    if (distance > 0 && distance < 150) {
      setPullDistance(distance);
      
      // Prevent default scrolling when pulling
      if (distance > 10) {
        e.preventDefault();
      }
    }
  }, [isPulling, touchStart, enablePullToRefresh, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || !enablePullToRefresh || !onPullToRefresh) return;

    setIsPulling(false);
    
    // Trigger refresh if pulled enough
    if (pullDistance > 80) {
      setIsRefreshing(true);
      
      try {
        await onPullToRefresh();
      } catch (error) {
        console.error('Pull to refresh error:', error);
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setPullDistance(0);
  }, [isPulling, pullDistance, enablePullToRefresh, onPullToRefresh]);

  // Get responsive classes
  const getResponsiveClasses = () => {
    const classes = [];
    
    if (isMobile) {
      classes.push('mobile-view');
      classes.push('px-2 py-2'); // Reduced padding on mobile
    } else if (isTablet) {
      classes.push('tablet-view');
      classes.push('px-4 py-3');
    } else {
      classes.push('desktop-view');
      classes.push('px-6 py-4');
    }
    
    return classes.join(' ');
  };

  return (
    <div
      {...(enableSwipe ? swipeHandlers : {})}
      className={`mobile-wrapper ${getResponsiveClasses()} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: pullDistance > 0 ? `translateY(${pullDistance * 0.5}px)` : undefined,
        transition: isPulling ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {/* Pull to refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center items-center bg-blue-500 text-white z-50 transition-all"
          style={{
            height: isRefreshing ? '60px' : `${Math.min(pullDistance, 60)}px`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 80, 1)
          }}
        >
          <div className="flex items-center space-x-2">
            {isRefreshing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <span className="text-sm font-medium">Đang làm mới...</span>
              </>
            ) : (
              <>
                <svg 
                  className={`w-5 h-5 transition-transform ${pullDistance > 80 ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span className="text-sm font-medium">
                  {pullDistance > 80 ? 'Thả để làm mới' : 'Kéo xuống để làm mới'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={isRefreshing ? 'opacity-50 pointer-events-none' : ''}>
        {children}
      </div>

      {/* Mobile-specific styles */}
      <style>{`
        .mobile-wrapper {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
        }
        
        .mobile-view {
          font-size: 14px;
        }
        
        .tablet-view {
          font-size: 15px;
        }
        
        .desktop-view {
          font-size: 16px;
        }
        
        @media (max-width: 768px) {
          .mobile-wrapper {
            min-height: 100vh;
          }
        }
      `}</style>
    </div>
  );
};