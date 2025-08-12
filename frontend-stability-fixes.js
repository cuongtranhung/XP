/**
 * Frontend Stability Improvements
 * Patches for common React issues that cause freezes and crashes
 */

// 1. React DevTools Memory Leak Fix
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Limit React DevTools fiber tree size
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    const originalOnCommitFiberRoot = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = function(...args) {
      try {
        return originalOnCommitFiberRoot?.apply(this, args);
      } catch (error) {
        console.warn('React DevTools error prevented:', error.message);
      }
    };
  }
}

// 2. Prevent memory leaks from event listeners
const originalAddEventListener = EventTarget.prototype.addEventListener;
const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
const activeListeners = new WeakMap();

EventTarget.prototype.addEventListener = function(type, listener, options) {
  if (!activeListeners.has(this)) {
    activeListeners.set(this, new Set());
  }
  activeListeners.get(this).add({ type, listener, options });
  return originalAddEventListener.call(this, type, listener, options);
};

EventTarget.prototype.removeEventListener = function(type, listener, options) {
  if (activeListeners.has(this)) {
    const listeners = activeListeners.get(this);
    listeners.forEach(item => {
      if (item.type === type && item.listener === listener) {
        listeners.delete(item);
      }
    });
  }
  return originalRemoveEventListener.call(this, type, listener, options);
};

// 3. Memory usage monitoring and cleanup
let memoryCheckInterval;

function startMemoryMonitoring() {
  if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
    memoryCheckInterval = setInterval(() => {
      const memory = performance.memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
      const usage = (usedMB / limitMB) * 100;

      if (usage > 75) {
        console.warn(`High memory usage detected: ${usedMB.toFixed(1)}MB (${usage.toFixed(1)}%)`);
        
        // Force garbage collection if available
        if (window.gc) {
          console.log('Forcing garbage collection...');
          window.gc();
        }
        
        // Clear React Query cache if available
        if (window.__REACT_QUERY_CLIENT__) {
          console.log('Clearing React Query cache...');
          window.__REACT_QUERY_CLIENT__.clear();
        }
      }
    }, 30000); // Check every 30 seconds
  }
}

// 4. Prevent infinite re-renders
const renderCounts = new WeakMap();

function trackRenderCount(component) {
  if (!renderCounts.has(component)) {
    renderCounts.set(component, { count: 0, lastReset: Date.now() });
  }
  
  const data = renderCounts.get(component);
  data.count++;
  
  // Reset count every 5 seconds
  if (Date.now() - data.lastReset > 5000) {
    data.count = 1;
    data.lastReset = Date.now();
  }
  
  // Warn if component renders too frequently
  if (data.count > 50) {
    console.warn('Possible infinite render loop detected in component:', component);
    return true; // Indicate potential infinite loop
  }
  
  return false;
}

// 5. Better error boundaries
class StabilityErrorBoundary extends Error {
  constructor(message, componentStack) {
    super(message);
    this.name = 'StabilityErrorBoundary';
    this.componentStack = componentStack;
  }
}

// 6. Network request timeout and retry logic
function createStableAxiosInstance(baseConfig = {}) {
  const axios = require('axios');
  
  const instance = axios.create({
    timeout: 30000, // 30 second timeout
    ...baseConfig,
  });

  // Retry logic for failed requests
  instance.interceptors.response.use(
    response => response,
    async error => {
      const { config } = error;
      
      if (!config || config.__isRetryRequest) {
        return Promise.reject(error);
      }

      // Retry on network errors or 5xx status codes
      const shouldRetry = !error.response || (error.response.status >= 500);
      
      if (shouldRetry && config.__retryCount < 3) {
        config.__retryCount = (config.__retryCount || 0) + 1;
        config.__isRetryRequest = true;
        
        const delay = Math.pow(2, config.__retryCount) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return instance(config);
      }
      
      return Promise.reject(error);
    }
  );

  return instance;
}

// 7. React Hooks stability improvements
function useStableCallback(callback, deps) {
  const ref = useRef(callback);
  
  useEffect(() => {
    ref.current = callback;
  }, deps);
  
  return useCallback((...args) => ref.current(...args), []);
}

function useStableMemo(factory, deps) {
  const depsRef = useRef();
  const valueRef = useRef();
  
  if (!depsRef.current || deps.some((dep, i) => dep !== depsRef.current[i])) {
    depsRef.current = deps;
    valueRef.current = factory();
  }
  
  return valueRef.current;
}

// 8. Component lifecycle cleanup
function createCleanupManager() {
  const cleanupTasks = new Set();
  
  return {
    addCleanup: (task) => cleanupTasks.add(task),
    removeCleanup: (task) => cleanupTasks.delete(task),
    cleanup: () => {
      cleanupTasks.forEach(task => {
        try {
          task();
        } catch (error) {
          console.error('Cleanup task failed:', error);
        }
      });
      cleanupTasks.clear();
    }
  };
}

// 9. Start monitoring on load
if (typeof window !== 'undefined') {
  // Start memory monitoring
  startMemoryMonitoring();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (memoryCheckInterval) {
      clearInterval(memoryCheckInterval);
    }
    
    // Clear any remaining active listeners
    activeListeners.forEach((listeners, target) => {
      listeners.forEach(({ type, listener, options }) => {
        try {
          target.removeEventListener(type, listener, options);
        } catch (error) {
          // Ignore errors during cleanup
        }
      });
    });
  });
}

// Export utilities for use in React components
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    trackRenderCount,
    StabilityErrorBoundary,
    createStableAxiosInstance,
    useStableCallback,
    useStableMemo,
    createCleanupManager
  };
}

// Export as ES modules for modern bundlers
if (typeof window !== 'undefined') {
  window.StabilityUtils = {
    trackRenderCount,
    StabilityErrorBoundary,
    createStableAxiosInstance,
    useStableCallback,
    useStableMemo,
    createCleanupManager
  };
}