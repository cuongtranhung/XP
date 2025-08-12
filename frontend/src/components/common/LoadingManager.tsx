import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface LoadingState {
  [key: string]: {
    isLoading: boolean;
    progress?: number;
    message?: string;
    startTime: number;
  };
}

interface LoadingContextType {
  startLoading: (key: string, message?: string) => void;
  stopLoading: (key: string) => void;
  updateProgress: (key: string, progress: number) => void;
  isLoading: (key?: string) => boolean;
  getLoadingMessage: (key: string) => string | undefined;
  getLoadingProgress: (key: string) => number | undefined;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

/**
 * Global loading state manager with timeout protection
 */
export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});
  const [timeouts, setTimeouts] = useState<{ [key: string]: NodeJS.Timeout }>({});
  
  const LOADING_TIMEOUT = 30000; // 30 seconds max loading time

  const startLoading = useCallback((key: string, message?: string) => {
    // Clear existing timeout if any
    if (timeouts[key]) {
      clearTimeout(timeouts[key]);
    }

    // Set loading state
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        isLoading: true,
        message,
        progress: 0,
        startTime: Date.now()
      }
    }));

    // Set timeout to auto-stop loading
    const timeoutId = setTimeout(() => {
      console.warn(`Loading timeout for ${key} after ${LOADING_TIMEOUT}ms`);
      stopLoading(key);
    }, LOADING_TIMEOUT);

    setTimeouts(prev => ({ ...prev, [key]: timeoutId }));
  }, [timeouts]);

  const stopLoading = useCallback((key: string) => {
    // Clear timeout
    if (timeouts[key]) {
      clearTimeout(timeouts[key]);
      setTimeouts(prev => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
    }

    // Remove loading state
    setLoadingStates(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, [timeouts]);

  const updateProgress = useCallback((key: string, progress: number) => {
    setLoadingStates(prev => {
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          progress: Math.min(100, Math.max(0, progress))
        }
      };
    });
  }, []);

  const isLoading = useCallback((key?: string) => {
    if (key) {
      return loadingStates[key]?.isLoading || false;
    }
    return Object.values(loadingStates).some(state => state.isLoading);
  }, [loadingStates]);

  const getLoadingMessage = useCallback((key: string) => {
    return loadingStates[key]?.message;
  }, [loadingStates]);

  const getLoadingProgress = useCallback((key: string) => {
    return loadingStates[key]?.progress;
  }, [loadingStates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        startLoading,
        stopLoading,
        updateProgress,
        isLoading,
        getLoadingMessage,
        getLoadingProgress
      }}
    >
      {children}
      <GlobalLoadingIndicator />
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
};

/**
 * Global loading indicator overlay
 */
const GlobalLoadingIndicator: React.FC = () => {
  const { isLoading } = useLoading();
  const [visible, setVisible] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    const loading = isLoading();
    
    if (loading) {
      setVisible(true);
      setTimeout(() => setFadeIn(true), 10);
    } else {
      setFadeIn(false);
      setTimeout(() => setVisible(false), 300);
    }
  }, [isLoading()]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="bg-blue-600 h-1">
        <div className="bg-blue-400 h-full animate-pulse" style={{ width: '100%' }}>
          <div className="bg-white/30 h-full animate-loading-bar" />
        </div>
      </div>
    </div>
  );
};

/**
 * Component-level loading wrapper
 */
export const LoadingBoundary: React.FC<{
  loading: boolean;
  error?: Error | null;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}> = ({ loading, error, skeleton, children }) => {
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error.message}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        {skeleton || (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
};

/**
 * Skeleton loaders for common UI patterns
 */
export const SkeletonCard: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
  </div>
);

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white p-4 rounded animate-pulse">
        <div className="flex items-center space-x-4">
          <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ 
  rows = 5, 
  cols = 4 
}) => (
  <div className="bg-white rounded-lg shadow overflow-hidden">
    <div className="animate-pulse">
      {/* Header */}
      <div className="bg-gray-100 px-6 py-3 border-b">
        <div className="flex space-x-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-300 rounded flex-1"></div>
          ))}
        </div>
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="px-6 py-4 border-b">
          <div className="flex space-x-4">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div key={colIndex} className="h-4 bg-gray-200 rounded flex-1"></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Add CSS for loading animation
const style = document.createElement('style');
style.textContent = `
  @keyframes loading-bar {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(200%); }
  }
  .animate-loading-bar {
    animation: loading-bar 1.5s ease-in-out infinite;
  }
`;
document.head.appendChild(style);

export default LoadingProvider;