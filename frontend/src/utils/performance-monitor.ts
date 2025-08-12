/**
 * Lightweight Performance Monitor
 * Safe replacement for problematic frontend-stability-fixes.js
 */

// Performance monitoring with minimal overhead
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private memoryCheckTimer: number | null = null;
  private lastMemoryWarning = 0;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startMonitoring() {
    if (process.env.NODE_ENV !== 'production' && 'performance' in window) {
      // Only monitor in development, check every 60 seconds
      this.memoryCheckTimer = window.setInterval(() => {
        this.checkMemory();
      }, 60000);
    }
  }

  private checkMemory() {
    if (!('memory' in performance)) return;
    
    const memory = (performance as any).memory;
    const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
    const usage = (usedMB / limitMB) * 100;

    // Only warn once per 5 minutes to avoid spam
    const now = Date.now();
    if (usage > 80 && now - this.lastMemoryWarning > 300000) {
      console.warn(`High memory usage: ${usedMB}MB / ${limitMB}MB (${usage.toFixed(1)}%)`);
      this.lastMemoryWarning = now;
    }
  }

  stopMonitoring() {
    if (this.memoryCheckTimer) {
      clearInterval(this.memoryCheckTimer);
      this.memoryCheckTimer = null;
    }
  }
}

// React render tracking helper
export function useRenderTracking(componentName: string, threshold = 10) {
  if (process.env.NODE_ENV === 'production') return;
  
  const renderCountRef = React.useRef(0);
  const lastResetRef = React.useRef(Date.now());
  
  React.useEffect(() => {
    renderCountRef.current++;
    
    // Reset counter every 5 seconds
    const now = Date.now();
    if (now - lastResetRef.current > 5000) {
      renderCountRef.current = 1;
      lastResetRef.current = now;
    }
    
    // Warn if rendering too frequently
    if (renderCountRef.current > threshold) {
      console.warn(`Component "${componentName}" rendered ${renderCountRef.current} times in 5 seconds`);
    }
  });
}

// Stable callback hook that actually works
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = React.useRef(callback);
  
  React.useLayoutEffect(() => {
    callbackRef.current = callback;
  });
  
  return React.useCallback(
    ((...args) => callbackRef.current(...args)) as T,
    []
  );
}

// Import React for hooks
import React from 'react';