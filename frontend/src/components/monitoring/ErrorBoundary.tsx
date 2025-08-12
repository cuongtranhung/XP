// Enhanced Error Boundary with Sentry Integration
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { monitoringService } from '../../services/monitoringService';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import Button from '../common/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  level?: 'page' | 'component' | 'feature';
  context?: Record<string, any>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

class EnhancedErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;
  
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, context, level = 'component' } = this.props;
    
    // Generate unique error ID
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced error context
    const enhancedContext = {
      component: 'ErrorBoundary',
      level,
      retryCount: this.state.retryCount,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
      ...context,
      metadata: {
        ...context,
        errorInfo: {
          componentStack: errorInfo.componentStack
        }
      },
      tags: {
        errorBoundary: 'true',
        level,
        retryCount: this.state.retryCount.toString()
      }
    };

    // Capture with monitoring service
    monitoringService.captureException(error, enhancedContext);
    
    // Add breadcrumb for error boundary trigger
    monitoringService.addBreadcrumb(
      'Error Boundary Triggered',
      'error',
      {
        level,
        retryCount: this.state.retryCount,
        errorMessage: error.message
      }
    );

    // Update state with error details
    this.setState({
      errorInfo,
      errorId,
      hasError: true
    });

    // Call optional error handler
    if (onError) {
      onError(error, errorInfo);
    }

    console.error('🚨 Error Boundary caught an error:', {
      error,
      errorInfo,
      context: enhancedContext
    });
  }

  handleRetry = () => {
    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000); // Exponential backoff, max 10s
    
    if (this.state.retryCount >= maxRetries) {
      monitoringService.addBreadcrumb(
        'Max retries reached',
        'error',
        { retryCount: this.state.retryCount }
      );
      return;
    }

    monitoringService.trackAction('error_boundary_retry', {
      retryCount: this.state.retryCount + 1,
      errorId: this.state.errorId,
      level: this.props.level
    });

    // Clear error state after delay
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: this.state.retryCount + 1
      });
    }, retryDelay);
  };

  handleReload = () => {
    monitoringService.trackAction('error_boundary_reload', {
      errorId: this.state.errorId,
      level: this.props.level
    });
    
    window.location.reload();
  };

  handleGoHome = () => {
    monitoringService.trackAction('error_boundary_go_home', {
      errorId: this.state.errorId,
      level: this.props.level
    });
    
    window.location.href = '/';
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI based on level
      return this.renderErrorUI();
    }

    return this.props.children;
  }

  private renderErrorUI() {
    const { error, errorId, retryCount } = this.state;
    const { level = 'component', showDetails = false } = this.props;
    const maxRetries = 3;
    const canRetry = retryCount < maxRetries;

    // Different UI based on error level
    if (level === 'page') {
      return this.renderPageLevelError(error, errorId, canRetry, maxRetries);
    } else if (level === 'feature') {
      return this.renderFeatureLevelError(error, errorId, canRetry);
    } else {
      return this.renderComponentLevelError(error, errorId, canRetry);
    }
  }

  private renderPageLevelError(error: Error | null, errorId: string | null, canRetry: boolean, maxRetries: number) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-16 w-16 text-red-500 mb-6" />
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Oops! Something went wrong
            </h1>
            
            <p className="text-gray-600 mb-6">
              We're sorry, but something unexpected happened. Our team has been notified.
            </p>
            
            {errorId && (
              <div className="bg-gray-100 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Error ID:</span> {errorId}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Please reference this ID when contacting support.
                </p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {canRetry && (
                <Button
                  onClick={this.handleRetry}
                  className="flex items-center justify-center"
                >
                  <RefreshCw size={16} className="mr-2" />
                  Try Again ({maxRetries - this.state.retryCount} left)
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="flex items-center justify-center"
              >
                <Home size={16} className="mr-2" />
                Go Home
              </Button>
              
              <Button
                variant="outline"
                onClick={this.handleReload}
                className="flex items-center justify-center"
              >
                <RefreshCw size={16} className="mr-2" />
                Reload Page
              </Button>
            </div>
            
            {this.props.showDetails && error && (
              <details className="mt-6 text-left bg-red-50 rounded-lg p-4">
                <summary className="cursor-pointer text-red-800 font-medium mb-2">
                  Error Details (for developers)
                </summary>
                <div className="text-sm text-red-700">
                  <div className="mb-2">
                    <strong>Error:</strong> {error.message}
                  </div>
                  <div className="mb-2">
                    <strong>Stack:</strong>
                    <pre className="mt-1 text-xs whitespace-pre-wrap">{error.stack}</pre>
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }

  private renderFeatureLevelError(error: Error | null, errorId: string | null, canRetry: boolean) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
          
          <div className="ml-4 flex-1">
            <h3 className="text-lg font-medium text-red-800 mb-2">
              Feature Unavailable
            </h3>
            
            <p className="text-red-700 mb-4">
              This feature is temporarily unavailable due to an error. Please try again.
            </p>
            
            {errorId && (
              <div className="bg-red-100 rounded-md p-3 mb-4">
                <p className="text-xs text-red-700">
                  Error ID: {errorId}
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              {canRetry && (
                <Button
                  size="sm"
                  onClick={this.handleRetry}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <RefreshCw size={14} className="mr-1" />
                  Retry
                </Button>
              )}
              
              <Button
                size="sm"
                variant="outline"
                onClick={this.handleReload}
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  private renderComponentLevelError(error: Error | null, errorId: string | null, canRetry: boolean) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <Bug className="h-5 w-5 text-yellow-500 flex-shrink-0" />
          
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-yellow-800">
              Component Error
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              This component failed to render properly.
            </p>
            
            {canRetry && (
              <div className="mt-2">
                <Button
                  size="sm"
                  onClick={this.handleRetry}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs"
                >
                  <RefreshCw size={12} className="mr-1" />
                  Retry
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

// HOC for easy error boundary wrapping
export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  level: 'page' | 'component' | 'feature' = 'component',
  context?: Record<string, any>
) => {
  return React.forwardRef<any, P>((props, ref) => (
    <EnhancedErrorBoundary 
      level={level} 
      context={{ ...context, componentName: WrappedComponent.name }}
    >
      <WrappedComponent {...props} ref={ref} />
    </EnhancedErrorBoundary>
  ));
};

export default EnhancedErrorBoundary;