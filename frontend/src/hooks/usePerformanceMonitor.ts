/**
 * Performance Monitoring Hook
 * Tracks rendering performance, memory usage, and component lifecycle metrics
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: number;
  componentMounts: number;
  reRenders: number;
  lastUpdate: number;
}

interface UsePerformanceMonitorOptions {
  trackMemory?: boolean;
  logToConsole?: boolean;
  threshold?: number; // Log if render time exceeds threshold (ms)
}

export const usePerformanceMonitor = (
  componentName: string,
  options: UsePerformanceMonitorOptions = {}
) => {
  const {
    trackMemory = false,
    logToConsole = false,
    threshold = 16 // 60fps = 16.67ms per frame
  } = options;

  const renderStartTime = useRef<number>(performance.now());
  const mountCount = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const previousMetrics = useRef<PerformanceMetrics>({
    renderTime: 0,
    componentMounts: 0,
    reRenders: 0,
    lastUpdate: Date.now()
  });
  
  const [metrics, setMetrics] = useState<PerformanceMetrics>(() => ({
    renderTime: 0,
    componentMounts: 0,
    reRenders: 0,
    lastUpdate: Date.now()
  }));

  // Track component mount - only runs once
  useEffect(() => {
    mountCount.current += 1;
    
    // Update metrics with mount count
    const newMetrics: PerformanceMetrics = {
      ...previousMetrics.current,
      componentMounts: mountCount.current,
      lastUpdate: Date.now()
    };
    
    previousMetrics.current = newMetrics;
    setMetrics(newMetrics);
  }, []); // Empty dependency array - only runs on mount

  // Track render performance - runs on specific dependency changes only
  useEffect(() => {
    // Only update if this is not the initial render
    if (renderCount.current > 0) {
      const renderTime = performance.now() - renderStartTime.current;
      
      let memoryUsage: number | undefined;
      if (trackMemory && 'memory' in performance) {
        const memory = (performance as any).memory;
        memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
      }

      const newMetrics: PerformanceMetrics = {
        renderTime,
        memoryUsage,
        componentMounts: mountCount.current,
        reRenders: renderCount.current,
        lastUpdate: Date.now()
      };

      previousMetrics.current = newMetrics;
      setMetrics(newMetrics);

      // Log performance issues
      if (logToConsole && renderTime > threshold) {
        console.warn(`${componentName} slow render detected:`, {
          renderTime: `${renderTime.toFixed(2)}ms`,
          threshold: `${threshold}ms`,
          reRenders: renderCount.current,
          memoryUsage: memoryUsage ? `${memoryUsage.toFixed(2)}MB` : 'N/A'
        });
      }
    }
    
    renderCount.current += 1;
    renderStartTime.current = performance.now();
  }, [componentName, trackMemory, logToConsole, threshold]); // Only re-run when options change

  const logMetrics = useCallback(() => {
    console.log(`Performance Metrics for ${componentName}:`, {
      averageRenderTime: `${metrics.renderTime.toFixed(2)}ms`,
      totalRenders: metrics.reRenders,
      totalMounts: metrics.componentMounts,
      currentMemory: metrics.memoryUsage ? `${metrics.memoryUsage.toFixed(2)}MB` : 'N/A',
      lastUpdate: new Date(metrics.lastUpdate).toLocaleTimeString()
    });
  }, [componentName, metrics]);

  const isSlowRender = useCallback(() => {
    return metrics.renderTime > threshold;
  }, [metrics.renderTime, threshold]);

  return {
    metrics,
    logMetrics,
    isSlowRender
  };
};