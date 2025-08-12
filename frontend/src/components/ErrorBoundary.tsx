import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  lastErrorTime: number;
}

/**
 * Advanced Error Boundary with recovery strategies
 */
export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;
  private readonly ERROR_TIMEOUT = 10000; // 10 seconds

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props;
    
    // Log error with context
    logger.error(`[ErrorBoundary-${level}]`, {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      level,
      retryCount: this.retryCount,
      timestamp: new Date().toISOString()
    });

    // Call custom error handler
    onError?.(error, errorInfo);

    // Update state with error details
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportToMonitoring(error, errorInfo);
    }

    // Auto-recover after timeout for transient errors
    if (this.retryCount < this.MAX_RETRIES) {
      this.scheduleReset();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;
    
    // Reset on prop changes if configured
    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys?.some((key, idx) => key !== prevProps.resetKeys?.[idx])) {
        this.resetErrorBoundary();
      }
    }
    
    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  scheduleReset = () => {
    this.resetTimeoutId = setTimeout(() => {
      this.retryCount++;
      this.resetErrorBoundary();
    }, this.ERROR_TIMEOUT);
  };

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  reportToMonitoring = (error: Error, errorInfo: ErrorInfo) => {
    // Implement your monitoring service integration here
    // Example: Sentry, LogRocket, etc.
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        level: this.props.level
      };
      
      // Send to monitoring endpoint
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport)
      }).catch(() => {
        // Silently fail if monitoring is down
      });
    } catch {
      // Don't let monitoring errors break the app
    }
  };

  render() {
    const { hasError, error, errorCount } = this.state;
    const { children, fallback, level = 'component', isolate = false } = this.props;

    if (hasError && error) {
      // Custom fallback UI
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default fallback UI based on level
      return (
        <div className={`error-boundary-fallback ${level}`}>
          {level === 'page' && (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-gray-900 text-center">
                  Something went wrong
                </h2>
                <p className="mt-2 text-sm text-gray-600 text-center">
                  We're having trouble loading this page. Please try refreshing or come back later.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Refresh Page
                  </button>
                  <button
                    onClick={this.resetErrorBoundary}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                  >
                    Try Again ({this.MAX_RETRIES - this.retryCount} retries left)
                  </button>
                </div>
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-4 text-xs text-gray-500">
                    <summary className="cursor-pointer">Error Details</summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                      {error.toString()}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {level === 'section' && (
            <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-lg font-medium text-yellow-900">
                This section couldn't load
              </h3>
              <p className="mt-2 text-sm text-yellow-700">
                Error loading this part of the page. Other sections should work normally.
              </p>
              <button
                onClick={this.resetErrorBoundary}
                className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Retry Section
              </button>
            </div>
          )}

          {level === 'component' && (
            <div className="p-4 bg-gray-100 border border-gray-300 rounded">
              <p className="text-sm text-gray-600">Component failed to load</p>
              <button
                onClick={this.resetErrorBoundary}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      );
    }

    // Isolate errors to prevent cascading failures
    if (isolate) {
      return (
        <div style={{ isolation: 'isolate' }}>
          {children}
        </div>
      );
    }

    return children;
  }
}

// Hook for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    logger.error('Error caught by useErrorHandler:', error, errorInfo);
    
    // You can add custom error handling logic here
    if (process.env.NODE_ENV === 'production') {
      // Report to monitoring service
    }
  };
}

export default ErrorBoundary;