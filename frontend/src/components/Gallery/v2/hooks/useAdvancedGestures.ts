import { useGesture } from '@use-gesture/react';
import { useCallback, useRef, useState } from 'react';

interface GestureConfig {
  onZoom?: (scale: number) => void;
  onRotate?: (angle: number) => void;
  onPan?: (x: number, y: number) => void;
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down') => void;
  onDoubleTap?: (point: { x: number; y: number }) => void;
  onLongPress?: () => void;
  enableMomentum?: boolean;
  enableHapticFeedback?: boolean;
}

export const useAdvancedGestures = (config: GestureConfig) => {
  const [gestureState, setGestureState] = useState({
    isZooming: false,
    isPanning: false,
    isRotating: false,
    scale: 1,
    rotation: 0,
    position: { x: 0, y: 0 },
  });

  const lastTapRef = useRef<number>(0);
  const velocityRef = useRef({ x: 0, y: 0 });
  const momentumAnimationRef = useRef<number>();

  // Haptic feedback helper
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!config.enableHapticFeedback) return;
    
    // Check if Vibration API is available
    if ('vibrate' in navigator) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 30,
      };
      navigator.vibrate(patterns[type]);
    }
  }, [config.enableHapticFeedback]);

  // Double tap detection
  const handleTap = useCallback((point: { x: number; y: number }) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    if (timeSinceLastTap < 300) {
      // Double tap detected
      config.onDoubleTap?.(point);
      triggerHaptic('medium');
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [config, triggerHaptic]);

  // Momentum scrolling
  const applyMomentum = useCallback(() => {
    if (!config.enableMomentum) return;

    const friction = 0.95;
    const minVelocity = 0.1;

    const animate = () => {
      velocityRef.current.x *= friction;
      velocityRef.current.y *= friction;

      if (Math.abs(velocityRef.current.x) > minVelocity || 
          Math.abs(velocityRef.current.y) > minVelocity) {
        const newX = gestureState.position.x + velocityRef.current.x;
        const newY = gestureState.position.y + velocityRef.current.y;
        
        config.onPan?.(newX, newY);
        setGestureState(prev => ({
          ...prev,
          position: { x: newX, y: newY }
        }));
        
        momentumAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    momentumAnimationRef.current = requestAnimationFrame(animate);
  }, [config, gestureState.position]);

  const bind = useGesture({
    // Pinch to zoom
    onPinch: ({ offset: [scale], active, origin }) => {
      setGestureState(prev => ({ ...prev, isZooming: active, scale }));
      config.onZoom?.(scale);
      
      if (!active) {
        triggerHaptic('light');
      }
    },

    // Drag/Pan with momentum
    onDrag: ({ offset: [x, y], velocity: [vx, vy], active, tap, event }) => {
      // Check for tap
      if (tap) {
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        const point = {
          x: (event as MouseEvent).clientX - rect.left,
          y: (event as MouseEvent).clientY - rect.top,
        };
        handleTap(point);
        return;
      }

      setGestureState(prev => ({ ...prev, isPanning: active, position: { x, y } }));
      config.onPan?.(x, y);
      
      // Store velocity for momentum
      velocityRef.current = { x: vx * 10, y: vy * 10 };
      
      // Apply momentum when drag ends
      if (!active && config.enableMomentum) {
        applyMomentum();
      }
    },

    // Wheel for zoom
    onWheel: ({ delta: [, dy], event, ctrlKey }) => {
      event.preventDefault();
      
      if (ctrlKey || event.metaKey) {
        // Zoom with Ctrl/Cmd + Wheel
        const scaleDelta = -dy * 0.01;
        const newScale = Math.max(0.5, Math.min(4, gestureState.scale + scaleDelta));
        
        setGestureState(prev => ({ ...prev, scale: newScale }));
        config.onZoom?.(newScale);
      } else {
        // Regular scroll for pan
        const panDelta = dy * 2;
        const newY = gestureState.position.y - panDelta;
        
        setGestureState(prev => ({ 
          ...prev, 
          position: { ...prev.position, y: newY } 
        }));
        config.onPan?.(gestureState.position.x, newY);
      }
    },

    // Swipe detection
    onDragEnd: ({ direction: [dx, dy], velocity: [vx, vy], distance }) => {
      const minSwipeDistance = 50;
      const minSwipeVelocity = 0.5;
      
      if (distance > minSwipeDistance && Math.max(Math.abs(vx), Math.abs(vy)) > minSwipeVelocity) {
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal swipe
          config.onSwipe?.(dx > 0 ? 'right' : 'left');
          triggerHaptic('medium');
        } else {
          // Vertical swipe
          config.onSwipe?.(dy > 0 ? 'down' : 'up');
          triggerHaptic('medium');
        }
      }
    },

    // Long press detection
    onDragStart: ({ event }) => {
      const target = event.target as HTMLElement;
      let longPressTimer: NodeJS.Timeout;
      
      const handleLongPress = () => {
        config.onLongPress?.();
        triggerHaptic('heavy');
      };
      
      longPressTimer = setTimeout(handleLongPress, 500);
      
      target.addEventListener('pointerup', () => clearTimeout(longPressTimer), { once: true });
      target.addEventListener('pointermove', () => clearTimeout(longPressTimer), { once: true });
    },
  }, {
    drag: {
      from: () => [gestureState.position.x, gestureState.position.y],
      filterTaps: true,
    },
    pinch: {
      from: () => [gestureState.scale, gestureState.rotation],
    },
  });

  // Cleanup momentum animation
  const cleanup = () => {
    if (momentumAnimationRef.current) {
      cancelAnimationFrame(momentumAnimationRef.current);
    }
  };

  return {
    bind,
    gestureState,
    cleanup,
    triggerHaptic,
    reset: () => {
      setGestureState({
        isZooming: false,
        isPanning: false,
        isRotating: false,
        scale: 1,
        rotation: 0,
        position: { x: 0, y: 0 },
      });
      velocityRef.current = { x: 0, y: 0 };
      cleanup();
    },
  };
};

export default useAdvancedGestures;