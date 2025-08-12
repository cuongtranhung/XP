/**
 * React Query Client Configuration
 * Optimized for stability and performance
 */

import { QueryClient } from '@tanstack/react-query';

// Create optimized query client with caching and retry logic
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Caching configuration
      staleTime: 5 * 60 * 1000,        // Data stays fresh for 5 minutes
      cacheTime: 10 * 60 * 1000,       // Keep cache for 10 minutes
      
      // Retry configuration for stability
      retry: 3,                         // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      
      // Performance optimizations
      refetchOnWindowFocus: false,     // Don't refetch on window focus
      refetchOnReconnect: 'always',    // Refetch when reconnecting
      refetchOnMount: true,            // Refetch when component mounts
      
      // Network mode for offline support
      networkMode: 'offlineFirst',     // Use cache first when offline
    },
    mutations: {
      // Mutation retry configuration
      retry: 2,                         // Retry mutations twice
      retryDelay: 1000,                // Wait 1 second between retries
      
      // Network mode
      networkMode: 'offlineFirst',
    },
  },
});

// Memory management - clear old cache periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    // Get all query cache entries
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    // Clear queries older than 30 minutes
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    queries.forEach(query => {
      if (query.state.dataUpdatedAt < thirtyMinutesAgo) {
        queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
      }
    });
  }, 5 * 60 * 1000); // Run every 5 minutes
}

// Export for global access if needed
if (typeof window !== 'undefined') {
  (window as any).__REACT_QUERY_CLIENT__ = queryClient;
}

export default queryClient;