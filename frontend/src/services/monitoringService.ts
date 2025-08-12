// Monitoring Service
// Centralized monitoring, error tracking, and performance monitoring

import React from 'react';

// Use mock Sentry for development to avoid installation issues
import { Sentry } from '../lib/sentry-mock';
import { monitoringConfig, monitoringFeatures, dataSanitization } from '../config/monitoring';

// Performance metrics interface
export interface PerformanceMetrics {
  timestamp: number;
  url: string;
  userAgent: string;
  metrics: {
    // Core Web Vitals
    lcp?: number; // Largest Contentful Paint
    fid?: number; // First Input Delay
    cls?: number; // Cumulative Layout Shift
    fcp?: number; // First Contentful Paint
    ttfb?: number; // Time to First Byte
    // Custom metrics
    pageLoadTime?: number;
    renderTime?: number;
    apiResponseTime?: number;
  };
  context?: Record<string, any>;
}

// Error context interface
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  route?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

// User context interface
export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  role?: string;
  organization?: string;
}

class MonitoringService {
  private static instance: MonitoringService;
  private isInitialized = false;
  private performanceObserver: PerformanceObserver | null = null;
  private sessionId: string;
  
  constructor() {
    this.sessionId = this.generateSessionId();
  }
  
  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }
  
  // Initialize monitoring services
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Monitoring service already initialized');
      return;
    }
    
    try {
      // Initialize Sentry
      if (monitoringFeatures.SENTRY_ENABLED) {
        await this.initializeSentry();
        console.log('✅ Sentry initialized successfully');
      }
      
      // Initialize LogRocket
      if (monitoringFeatures.LOGROCKET_ENABLED) {
        await this.initializeLogRocket();
        console.log('✅ LogRocket initialized successfully');
      }
      
      // Initialize Performance Monitoring
      if (monitoringFeatures.PERFORMANCE_MONITORING_ENABLED) {
        this.initializePerformanceMonitoring();
        console.log('✅ Performance monitoring initialized successfully');
      }
      
      // Setup error handlers
      this.setupGlobalErrorHandlers();
      
      this.isInitialized = true;
      console.log('🎯 Monitoring Service initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize monitoring service:', error);
      throw error;
    }
  }
  
  // Initialize Sentry
  private async initializeSentry(): Promise<void> {
    const { sentry } = monitoringConfig;
    
    Sentry.init({
      dsn: sentry.dsn,
      environment: sentry.environment,
      tracesSampleRate: sentry.tracesSampleRate,
      profilesSampleRate: sentry.profilesSampleRate,
      
      integrations: [
        new Sentry.BrowserTracing({
          routingInstrumentation: Sentry.reactRouterV6Instrumentation(
            React.useEffect,
            require('react-router-dom').useLocation,
            require('react-router-dom').useNavigationType,
            require('react-router-dom').createRoutesFromChildren,
            require('react-router-dom').matchRoutes
          ),
        }),
        new Sentry.React.Profiler(),
        new Sentry.HttpContext(),
        new Sentry.ReportingObserver(),
      ],
      
      // Data sanitization
      beforeSend: (event, hint) => {
        return this.sanitizeErrorEvent(event, hint);
      },
      
      beforeSendTransaction: (event) => {
        return this.sanitizeTransactionEvent(event);
      },
      
      // Error filtering
      ignoreErrors: dataSanitization.ignoreErrors,
      
      // Release tracking
      release: import.meta.env.VITE_APP_VERSION || '1.0.0',
      
      // Debug mode in development
      debug: import.meta.env.MODE === 'development',
    });
    
    // Set initial context
    Sentry.setContext('app', {
      name: 'XP Frontend',
      version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      environment: sentry.environment
    });
    
    Sentry.setTag('sessionId', this.sessionId);
  }
  
  // Initialize LogRocket (mock implementation)
  private async initializeLogRocket(): Promise<void> {
    // In a real implementation, you would:
    // import LogRocket from 'logrocket';
    // LogRocket.init(monitoringConfig.logrocket.appId);
    
    console.log('📹 LogRocket would be initialized here with ID:', monitoringConfig.logrocket.appId);
    
    // Mock LogRocket integration
    (window as any).LogRocket = {
      identify: (userId: string, userData: any) => {
        console.log('📹 LogRocket identify:', userId, userData);
      },
      track: (eventName: string, properties: any) => {
        console.log('📹 LogRocket track:', eventName, properties);
      },
      captureException: (error: Error) => {
        console.log('📹 LogRocket captureException:', error);
      }
    };
  }
  
  // Initialize Performance Monitoring
  private initializePerformanceMonitoring(): void {
    if (!monitoringFeatures.PERFORMANCE_MONITORING_ENABLED) return;
    
    // Web Vitals monitoring
    this.initializeWebVitals();
    
    // Navigation timing
    if (monitoringConfig.performance.enableNavigationTiming) {
      this.trackNavigationTiming();
    }
    
    // User timing
    if (monitoringConfig.performance.enableUserTiming) {
      this.setupUserTimingObserver();
    }
  }
  
  // Initialize Web Vitals
  private initializeWebVitals(): void {
    // Mock implementation of Web Vitals
    // In real implementation: import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
    
    const webVitalsCallback = (metric: any) => {
      const performanceMetric: PerformanceMetrics = {
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        metrics: {
          [metric.name.toLowerCase()]: metric.value
        },
        context: {
          sessionId: this.sessionId,
          id: metric.id,
          rating: metric.rating
        }
      };
      
      this.trackPerformance(performanceMetric);
    };
    
    // Mock Web Vitals collection
    console.log('📊 Web Vitals monitoring initialized');
  }
  
  // Track navigation timing
  private trackNavigationTiming(): void {
    if (performance && performance.timing) {
      setTimeout(() => {
        const timing = performance.timing;
        const metrics: PerformanceMetrics = {
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          metrics: {
            pageLoadTime: timing.loadEventEnd - timing.navigationStart,
            renderTime: timing.domContentLoadedEventEnd - timing.navigationStart,
            ttfb: timing.responseStart - timing.navigationStart
          },
          context: { sessionId: this.sessionId }
        };
        
        this.trackPerformance(metrics);
      }, 0);
    }
  }
  
  // Setup User Timing observer
  private setupUserTimingObserver(): void {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            this.trackCustomTiming(entry.name, entry.duration);
          }
        }
      });
      
      this.performanceObserver.observe({ entryTypes: ['measure'] });
    }
  }
  
  // Setup global error handlers
  private setupGlobalErrorHandlers(): void {
    // Unhandled promise rejections
    if (monitoringConfig.errorTracking.enableUnhandledRejection) {
      window.addEventListener('unhandledrejection', (event) => {
        try {
          this.captureException(new Error(`Unhandled Promise Rejection: ${event.reason}`), {
            tags: { type: 'unhandledrejection' },
            metadata: { reason: event.reason }
          });
        } catch (captureError) {
          // Prevent infinite loops in error handling
          console.error('Error in unhandledrejection handler:', captureError);
        }
      });
    }
    
    // Global error handler
    if (monitoringConfig.errorTracking.enableWindowError) {
      window.addEventListener('error', (event) => {
        this.captureException(event.error || new Error(event.message), {
          tags: { type: 'javascript' },
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        });
      });
    }
  }
  
  // Set user context
  setUser(user: UserContext): void {
    if (monitoringFeatures.SENTRY_ENABLED) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username
      });
    }
    
    if (monitoringFeatures.LOGROCKET_ENABLED && (window as any).LogRocket) {
      (window as any).LogRocket.identify(user.id, {
        name: user.username,
        email: user.email,
        role: user.role,
        organization: user.organization
      });
    }
  }
  
  // Capture exception
  captureException(error: Error, context?: ErrorContext): void {
    if (monitoringFeatures.SENTRY_ENABLED) {
      Sentry.withScope((scope) => {
        if (context) {
          if (context.tags) {
            Object.entries(context.tags).forEach(([key, value]) => {
              scope.setTag(key, value);
            });
          }
          
          if (context.metadata) {
            scope.setContext('metadata', context.metadata);
          }
          
          if (context.route) {
            scope.setTag('route', context.route);
          }
          
          if (context.component) {
            scope.setTag('component', context.component);
          }
        }
        
        scope.setTag('sessionId', this.sessionId);
        Sentry.captureException(error);
      });
    }
    
    if (monitoringFeatures.LOGROCKET_ENABLED && (window as any).LogRocket) {
      (window as any).LogRocket.captureException(error);
    }
    
    console.error('🚨 Exception captured:', error, context);
  }
  
  // Capture message
  captureMessage(message: string, level: 'debug' | 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    if (monitoringFeatures.SENTRY_ENABLED) {
      Sentry.withScope((scope) => {
        if (context) {
          if (context.tags) {
            Object.entries(context.tags).forEach(([key, value]) => {
              scope.setTag(key, value);
            });
          }
          
          if (context.metadata) {
            scope.setContext('metadata', context.metadata);
          }
        }
        
        scope.setTag('sessionId', this.sessionId);
        Sentry.captureMessage(message, level);
      });
    }
    
    console.log(`📝 Message captured [${level}]:`, message, context);
  }
  
  // Track performance metrics
  trackPerformance(metrics: PerformanceMetrics): void {
    // Send to monitoring services
    if (monitoringFeatures.SENTRY_ENABLED) {
      Sentry.addBreadcrumb({
        category: 'performance',
        message: 'Performance metrics captured',
        level: 'info',
        data: metrics.metrics
      });
    }
    
    console.log('📊 Performance metrics:', metrics);
  }
  
  // Track custom timing
  trackCustomTiming(name: string, duration: number): void {
    if (monitoringFeatures.SENTRY_ENABLED) {
      Sentry.addBreadcrumb({
        category: 'timing',
        message: `Custom timing: ${name}`,
        level: 'info',
        data: { duration }
      });
    }
    
    console.log(`⏱️ Custom timing [${name}]:`, duration, 'ms');
  }
  
  // Track user action
  trackAction(action: string, properties?: Record<string, any>): void {
    if (monitoringFeatures.LOGROCKET_ENABLED && (window as any).LogRocket) {
      (window as any).LogRocket.track(action, properties);
    }
    
    if (monitoringFeatures.SENTRY_ENABLED) {
      Sentry.addBreadcrumb({
        category: 'user',
        message: `User action: ${action}`,
        level: 'info',
        data: properties
      });
    }
    
    console.log('👆 User action:', action, properties);
  }
  
  // Start performance measurement
  startTiming(name: string): void {
    if (performance && performance.mark) {
      performance.mark(`${name}-start`);
    }
  }
  
  // End performance measurement
  endTiming(name: string): number | null {
    if (performance && performance.mark && performance.measure) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measures = performance.getEntriesByName(name, 'measure');
      if (measures.length > 0) {
        const duration = measures[measures.length - 1].duration;
        this.trackCustomTiming(name, duration);
        return duration;
      }
    }
    
    return null;
  }
  
  // Add breadcrumb
  addBreadcrumb(message: string, category: string = 'custom', data?: Record<string, any>): void {
    if (monitoringFeatures.SENTRY_ENABLED) {
      Sentry.addBreadcrumb({
        category,
        message,
        level: 'info',
        data
      });
    }
    
    console.log(`🍞 Breadcrumb [${category}]:`, message, data);
  }
  
  // Generate session ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Sanitize error event
  private sanitizeErrorEvent(event: any, hint: any): any {
    // Remove sensitive data from error events
    if (event.request && event.request.headers) {
      dataSanitization.sensitiveFields.forEach(field => {
        if (event.request.headers[field]) {
          event.request.headers[field] = '[Filtered]';
        }
      });
    }
    
    return event;
  }
  
  // Sanitize transaction event
  private sanitizeTransactionEvent(event: any): any {
    // Filter sensitive URLs or data from transaction events
    return event;
  }
  
  // Cleanup
  cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
  }
}

// Export singleton instance
export const monitoringService = MonitoringService.getInstance();
export default monitoringService;

// Export types for external use
export type { PerformanceMetrics, ErrorContext, UserContext };

// HOC for performance monitoring
export const withPerformanceMonitoring = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) => {
  return React.forwardRef<any, P>((props, ref) => {
    React.useEffect(() => {
      monitoringService.startTiming(`component-${componentName}`);
      
      return () => {
        monitoringService.endTiming(`component-${componentName}`);
      };
    }, []);
    
    return React.createElement(WrappedComponent, { ...props, ref });
  });
};