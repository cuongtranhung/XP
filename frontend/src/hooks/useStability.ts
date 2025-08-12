import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Collection of stability-focused hooks to prevent memory leaks and crashes
 */

/**
 * Safe async hook that cancels on unmount
 */
export function useSafeAsync<T>() {
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController>();

  useEffect(() => {
    mountedRef.current = true;
    abortControllerRef.current = new AbortController();

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const execute = useCallback(async (
    asyncFunction: (signal: AbortSignal) => Promise<T>
  ): Promise<T | undefined> => {
    if (!mountedRef.current) return undefined;

    try {
      const result = await asyncFunction(abortControllerRef.current!.signal);
      
      if (mountedRef.current) {
        return result;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
      } else if (mountedRef.current) {
        throw error;
      }
    }
    
    return undefined;
  }, []);

  return { execute, isMounted: () => mountedRef.current };
}

/**
 * Cleanup manager for subscriptions and timers
 */
export function useCleanup() {
  const cleanupFnsRef = useRef<Set<() => void>>(new Set());

  const addCleanup = useCallback((fn: () => void) => {
    cleanupFnsRef.current.add(fn);
    return () => {
      cleanupFnsRef.current.delete(fn);
      fn();
    };
  }, []);

  useEffect(() => {
    return () => {
      cleanupFnsRef.current.forEach(fn => {
        try {
          fn();
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      });
      cleanupFnsRef.current.clear();
    };
  }, []);

  return { addCleanup };
}

/**
 * Safe interval that cleans up properly
 */
export function useSafeInterval(
  callback: () => void,
  delay: number | null,
  immediate = false
) {
  const savedCallback = useRef(callback);
  const intervalIdRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const tick = () => {
      savedCallback.current();
    };

    if (immediate) {
      tick();
    }

    intervalIdRef.current = setInterval(tick, delay);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [delay, immediate]);

  const stop = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = undefined;
    }
  }, []);

  return { stop };
}

/**
 * Safe timeout that cleans up properly
 */
export function useSafeTimeout(
  callback: () => void,
  delay: number | null
) {
  const savedCallback = useRef(callback);
  const timeoutIdRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const set = useCallback((newDelay?: number) => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    if (newDelay !== null && newDelay !== undefined) {
      timeoutIdRef.current = setTimeout(() => {
        savedCallback.current();
      }, newDelay);
    }
  }, []);

  const clear = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (delay !== null) {
      set(delay);
    }

    return clear;
  }, [delay, set, clear]);

  return { set, clear };
}

/**
 * Event listener with automatic cleanup
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Window | Element | null = window,
  options?: boolean | AddEventListenerOptions
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!element || !element.addEventListener) return;

    const eventListener = (event: Event) => {
      savedHandler.current(event as WindowEventMap[K]);
    };

    element.addEventListener(eventName, eventListener, options);

    return () => {
      element.removeEventListener(eventName, eventListener, options);
    };
  }, [eventName, element, options]);
}

/**
 * Memory monitor to detect leaks
 */
export function useMemoryMonitor(threshold = 100) {
  const [memoryUsage, setMemoryUsage] = useState<number>(0);
  const [hasMemoryLeak, setHasMemoryLeak] = useState(false);
  const previousUsageRef = useRef<number>(0);

  useEffect(() => {
    if (!('memory' in performance)) return;

    const checkMemory = () => {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      
      setMemoryUsage(usedMB);

      // Check for potential memory leak (continuous growth)
      if (previousUsageRef.current > 0) {
        const growth = usedMB - previousUsageRef.current;
        if (growth > threshold) {
          console.warn(`Potential memory leak detected: ${growth}MB growth`);
          setHasMemoryLeak(true);
        }
      }

      previousUsageRef.current = usedMB;
    };

    const interval = setInterval(checkMemory, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [threshold]);

  return { memoryUsage, hasMemoryLeak };
}

/**
 * Abort controller manager
 */
export function useAbortController() {
  const abortControllerRef = useRef<AbortController>();

  useEffect(() => {
    abortControllerRef.current = new AbortController();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const getSignal = useCallback(() => {
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }
    return abortControllerRef.current.signal;
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
  }, []);

  return { getSignal, abort };
}

/**
 * Previous value tracker
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

/**
 * Mount state tracker
 */
export function useIsMounted(): () => boolean {
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return useCallback(() => mountedRef.current, []);
}

/**
 * Safe setState that only updates if mounted
 */
export function useSafeState<T>(
  initialState: T | (() => T)
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState(initialState);
  const isMounted = useIsMounted();

  const setSafeState = useCallback(
    (value: T | ((prev: T) => T)) => {
      if (isMounted()) {
        setState(value);
      }
    },
    [isMounted]
  );

  return [state, setSafeState];
}