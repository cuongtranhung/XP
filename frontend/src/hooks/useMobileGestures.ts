/**
 * Mobile Gestures Hook - Phase 3 Implementation
 * Support for touch gestures and mobile interactions
 */

import { useRef, useEffect, useCallback, useState } from 'react';

interface GestureHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (scale: number) => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  onPullToRefresh?: () => Promise<void>;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

interface GestureState {
  isGesturing: boolean;
  gesture: 'swipe' | 'pinch' | 'longpress' | 'tap' | null;
  direction?: 'left' | 'right' | 'up' | 'down';
  scale?: number;
  distance?: number;
}

/**
 * Hook for mobile gesture detection
 */
export const useMobileGestures = (
  ref: React.RefObject<HTMLElement>,
  handlers: GestureHandlers,
  options: {
    swipeThreshold?: number;
    swipeVelocityThreshold?: number;
    longPressDelay?: number;
    doubleTapDelay?: number;
    preventScroll?: boolean;
  } = {}
) => {
  const {
    swipeThreshold = 50,
    swipeVelocityThreshold = 0.3,
    longPressDelay = 500,
    doubleTapDelay = 300,
    preventScroll = false
  } = options;

  const [gestureState, setGestureState] = useState<GestureState>({
    isGesturing: false,
    gesture: null
  });

  const touchStartRef = useRef<TouchPoint | null>(null);
  const touchEndRef = useRef<TouchPoint | null>(null);
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialDistanceRef = useRef<number | null>(null);

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (preventScroll) {
      e.preventDefault();
    }

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };

    // Handle pinch gesture start
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      initialDistanceRef.current = distance;
      
      setGestureState({
        isGesturing: true,
        gesture: 'pinch',
        scale: 1
      });
    }

    // Start long press timer
    if (handlers.onLongPress && e.touches.length === 1) {
      longPressTimerRef.current = setTimeout(() => {
        handlers.onLongPress?.();
        setGestureState({
          isGesturing: true,
          gesture: 'longpress'
        });
        
        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }, longPressDelay);
    }
  }, [handlers, longPressDelay, preventScroll]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    // Cancel long press on move
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Handle pinch gesture
    if (e.touches.length === 2 && handlers.onPinch && initialDistanceRef.current) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const scale = distance / initialDistanceRef.current;
      handlers.onPinch(scale);
      
      setGestureState({
        isGesturing: true,
        gesture: 'pinch',
        scale
      });
    }

    // Track movement for swipe
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchEndRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
    }
  }, [handlers]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Reset pinch
    initialDistanceRef.current = null;

    if (!touchStartRef.current) return;

    const endPoint = touchEndRef.current || {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now()
    };

    const deltaX = endPoint.x - touchStartRef.current.x;
    const deltaY = endPoint.y - touchStartRef.current.y;
    const deltaTime = endPoint.time - touchStartRef.current.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / deltaTime;

    // Check for tap or double tap
    if (distance < 10 && deltaTime < 200) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;
      
      if (timeSinceLastTap < doubleTapDelay && handlers.onDoubleTap) {
        handlers.onDoubleTap();
        setGestureState({
          isGesturing: true,
          gesture: 'tap'
        });
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
    // Check for swipe
    else if (distance > swipeThreshold && velocity > swipeVelocityThreshold) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      let direction: 'left' | 'right' | 'up' | 'down' | undefined;
      
      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0 && handlers.onSwipeRight) {
          handlers.onSwipeRight();
          direction = 'right';
        } else if (deltaX < 0 && handlers.onSwipeLeft) {
          handlers.onSwipeLeft();
          direction = 'left';
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && handlers.onSwipeDown) {
          handlers.onSwipeDown();
          direction = 'down';
        } else if (deltaY < 0 && handlers.onSwipeUp) {
          handlers.onSwipeUp();
          direction = 'up';
        }
      }

      if (direction) {
        setGestureState({
          isGesturing: true,
          gesture: 'swipe',
          direction,
          distance
        });
      }
    }

    // Reset state
    setTimeout(() => {
      setGestureState({
        isGesturing: false,
        gesture: null
      });
    }, 300);

    touchStartRef.current = null;
    touchEndRef.current = null;
  }, [
    handlers,
    swipeThreshold,
    swipeVelocityThreshold,
    doubleTapDelay
  ]);

  // Attach event listeners
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: !preventScroll });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventScroll]);

  return gestureState;
};

/**
 * Hook for pull-to-refresh functionality
 */
export const usePullToRefresh = (
  onRefresh: () => Promise<void>,
  options: {
    threshold?: number;
    resistance?: number;
    maxPull?: number;
  } = {}
) => {
  const {
    threshold = 80,
    resistance = 2.5,
    maxPull = 150
  } = options;

  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0 && e.touches.length === 1) {
      startYRef.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!startYRef.current || isRefreshing) return;

    currentYRef.current = e.touches[0].clientY;
    const distance = Math.max(0, currentYRef.current - startYRef.current);
    
    if (distance > 0) {
      e.preventDefault();
      setIsPulling(true);
      
      // Apply resistance
      const resistedDistance = Math.min(
        maxPull,
        distance / resistance
      );
      
      setPullDistance(resistedDistance);
    }
  }, [isRefreshing, resistance, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    setIsPulling(false);
    
    if (pullDistance > threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    
    startYRef.current = null;
    currentYRef.current = null;
  }, [isPulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    pullProgress: Math.min(1, pullDistance / threshold)
  };
};

/**
 * Hook for haptic feedback
 */
export const useHapticFeedback = () => {
  const isSupported = 'vibrate' in navigator;

  const vibrate = useCallback((pattern: number | number[] = 50) => {
    if (isSupported) {
      navigator.vibrate(pattern);
      return true;
    }
    return false;
  }, [isSupported]);

  const success = useCallback(() => vibrate(50), [vibrate]);
  const warning = useCallback(() => vibrate([50, 50, 50]), [vibrate]);
  const error = useCallback(() => vibrate([100, 50, 100]), [vibrate]);
  const impact = useCallback((style: 'light' | 'medium' | 'heavy' = 'medium') => {
    const patterns = {
      light: 30,
      medium: 50,
      heavy: 100
    };
    return vibrate(patterns[style]);
  }, [vibrate]);

  return {
    isSupported,
    vibrate,
    success,
    warning,
    error,
    impact
  };
};