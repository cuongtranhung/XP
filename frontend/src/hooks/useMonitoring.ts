import React, { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { monitoringService } from '../services/monitoringService';

// Hook options interface
interface UseMonitoringOptions {
  trackPageViews?: boolean;
  trackUserInteractions?: boolean;
  trackPerformance?: boolean;
  componentName?: string;
  context?: Record<string, any>;
}

// Page tracking hook
export const usePageTracking = (options: { trackPageViews: boolean }) => {
  const { trackPageViews } = options;

  useEffect(() => {
    if (trackPageViews) {
      const handleLocationChange = () => {
        monitoringService.trackPageView(
          window.location.pathname,
          window.location.search,
          document.title
        );
      };

      // Track initial page view
      handleLocationChange();

      // Listen for navigation changes
      window.addEventListener('popstate', handleLocationChange);

      return () => {
        window.removeEventListener('popstate', handleLocationChange);
      };
    }
  }, [trackPageViews]);
};

// Performance tracking hook
export const usePerformanceTracking = (componentName: string, trackPerformance: boolean) => {
  useEffect(() => {
    if (trackPerformance) {
      const performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          monitoringService.trackPerformance({
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            component: componentName,
            entryType: entry.entryType
          });
        });
      });

      performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });

      return () => {
        performanceObserver.disconnect();
      };
    }
  }, [componentName, trackPerformance]);
};

// Error tracking hook
export const useErrorTracking = (componentName: string, context: Record<string, any>) => {
  const captureError = useCallback((error: Error, errorInfo?: any) => {
    monitoringService.captureError(error, {
      component: componentName,
      context,
      errorInfo
    });
  }, [componentName, context]);

  const captureMessage = useCallback((message: string, level: 'info' | 'warning' | 'error' = 'info', extra?: any) => {
    monitoringService.captureMessage(message, level, {
      component: componentName,
      context,
      ...extra
    });
  }, [componentName, context]);

  return {
    captureError,
    captureMessage
  };
};

// User tracking hook
export const useUserTracking = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const userContext = {
        id: user.id.toString(),
        email: user.email,
        fullName: user.fullName || '',
        role: user.role || 'user',
        organization: user.organization_id || undefined
      };
      
      monitoringService.setUser(userContext);
      
      monitoringService.addBreadcrumb(
        'User context updated',
        'auth',
        { userId: user.id, email: user.email }
      );
    }
  }, [user]);
};

// Action tracking hook
export const useActionTracking = (componentName: string) => {
  const trackAction = useCallback((action: string, properties?: Record<string, any>) => {
    const actionProperties = {
      component: componentName,
      timestamp: Date.now(),
      url: window.location.href,
      ...properties
    };
    
    monitoringService.trackAction(action, actionProperties);
  }, [componentName]);
  
  const trackClick = useCallback((elementName: string, additionalData?: Record<string, any>) => {
    trackAction('click', {
      element: elementName,
      ...additionalData
    });
  }, [trackAction]);
  
  const trackFormSubmit = useCallback((formName: string, additionalData?: Record<string, any>) => {
    trackAction('form_submit', {
      form: formName,
      ...additionalData
    });
  }, [trackAction]);
  
  const trackFormError = useCallback((formName: string, errors: Record<string, any>) => {
    trackAction('form_error', {
      form: formName,
      errors,
      errorCount: Object.keys(errors).length
    });
  }, [trackAction]);
  
  return {
    trackAction,
    trackClick,
    trackFormSubmit,
    trackFormError
  };
};

// Timing hook for manual performance measurement
export const useTimingTracking = () => {
  const timers = useRef<Record<string, number>>({});
  
  const startTimer = useCallback((name: string) => {
    timers.current[name] = Date.now();
    monitoringService.startTiming(name);
  }, []);
  
  const endTimer = useCallback((name: string, properties?: Record<string, any>) => {
    const startTime = timers.current[name];
    if (startTime) {
      const duration = Date.now() - startTime;
      delete timers.current[name];
      
      monitoringService.endTiming(name);
      
      // Track as custom event
      monitoringService.trackAction('timing_measurement', {
        name,
        duration,
        ...properties
      });
      
      return duration;
    }
    
    return null;
  }, []);
  
  const measureAsync = useCallback(async <T>(
    name: string,
    asyncOperation: () => Promise<T>,
    properties?: Record<string, any>
  ): Promise<T> => {
    startTimer(name);
    
    try {
      const result = await asyncOperation();
      endTimer(name, { ...properties, success: true });
      return result;
    } catch (error) {
      endTimer(name, { ...properties, success: false, error: (error as Error).message });
      throw error;
    }
  }, [startTimer, endTimer]);
  
  return {
    startTimer,
    endTimer,
    measureAsync
  };
};

// Main monitoring hook
export const useMonitoring = (options: UseMonitoringOptions = {}) => {
  const {
    trackPageViews = true,
    trackUserInteractions = true,
    trackPerformance = true,
    componentName = 'UnknownComponent',
    context = {}
  } = options;
  
  // Initialize all tracking hooks
  usePageTracking({ trackPageViews });
  usePerformanceTracking(componentName, trackPerformance);
  useUserTracking();
  
  const { captureError, captureMessage } = useErrorTracking(componentName, context);
  const actionTracking = useActionTracking(componentName);
  const timingTracking = useTimingTracking();
  
  // Add breadcrumb for component usage
  useEffect(() => {
    monitoringService.addBreadcrumb(
      `Component mounted: ${componentName}`,
      'component',
      context
    );
  }, [componentName, context]);
  
  return {
    // Error tracking
    captureError,
    captureMessage,
    
    // Action tracking
    ...actionTracking,
    
    // Timing tracking
    ...timingTracking,
    
    // Manual tracking methods
    addBreadcrumb: monitoringService.addBreadcrumb.bind(monitoringService),
    trackCustomAction: monitoringService.trackAction.bind(monitoringService),
    trackCustomPerformance: monitoringService.trackPerformance.bind(monitoringService)
  };
};

// HOC for automatic monitoring
export const withMonitoring = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: UseMonitoringOptions = {}
) => {
  const componentName = options.componentName || WrappedComponent.displayName || WrappedComponent.name || 'Anonymous';
  
  return React.forwardRef((props: P, ref: any) => {
    const monitoring = useMonitoring({ ...options, componentName });
    
    // Pass monitoring utilities as props if component expects them
    const enhancedProps = {
      ...props,
      monitoring
    };
    
    return React.createElement(WrappedComponent, { ...enhancedProps, ref });
  });
};

export default useMonitoring;