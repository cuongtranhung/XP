/**
 * Search Suggestions Hook
 * Provides real-time search suggestions with debouncing and caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from '../utils/debounce';

interface UseSearchSuggestionsOptions<T> {
  searchFn: (query: string) => Promise<T[]>;
  debounceTime?: number;
  minChars?: number;
  maxSuggestions?: number;
  cacheResults?: boolean;
  cacheTime?: number; // Cache expiry in milliseconds
}

interface SearchCache<T> {
  [key: string]: {
    data: T[];
    timestamp: number;
  };
}

export function useSearchSuggestions<T>({
  searchFn,
  debounceTime = 300,
  minChars = 2,
  maxSuggestions = 10,
  cacheResults = true,
  cacheTime = 5 * 60 * 1000 // 5 minutes default
}: UseSearchSuggestionsOptions<T>) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  
  const cacheRef = useRef<SearchCache<T>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear expired cache entries
  const clearExpiredCache = useCallback(() => {
    const now = Date.now();
    Object.keys(cacheRef.current).forEach(key => {
      if (now - cacheRef.current[key].timestamp > cacheTime) {
        delete cacheRef.current[key];
      }
    });
  }, [cacheTime]);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < minChars) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // Check cache first
    if (cacheResults && cacheRef.current[searchQuery]) {
      const cached = cacheRef.current[searchQuery];
      if (Date.now() - cached.timestamp < cacheTime) {
        setSuggestions(cached.data.slice(0, maxSuggestions));
        setIsOpen(true);
        return;
      }
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const results = await searchFn(searchQuery);
      
      // Cache results
      if (cacheResults) {
        clearExpiredCache();
        cacheRef.current[searchQuery] = {
          data: results,
          timestamp: Date.now()
        };
      }

      setSuggestions(results.slice(0, maxSuggestions));
      setIsOpen(true);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to fetch suggestions');
        setSuggestions([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchFn, minChars, maxSuggestions, cacheResults, cacheTime, clearExpiredCache]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce(fetchSuggestions, debounceTime),
    [fetchSuggestions, debounceTime]
  );

  // Update query and trigger search
  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setSelectedIndex(-1);
    
    if (newQuery.length === 0) {
      setSuggestions([]);
      setIsOpen(false);
    } else {
      debouncedSearch(newQuery);
    }
  }, [debouncedSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isOpen, suggestions, selectedIndex]);

  // Select a suggestion
  const selectSuggestion = useCallback((suggestion: T) => {
    setIsOpen(false);
    setSelectedIndex(-1);
    // The parent component should handle what to do with the selected suggestion
    return suggestion;
  }, []);

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    setQuery('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    suggestions,
    isLoading,
    error,
    isOpen,
    selectedIndex,
    updateQuery,
    handleKeyDown,
    selectSuggestion,
    clearSuggestions,
    setIsOpen
  };
}

// Hook for user search suggestions
export function useUserSearchSuggestions() {
  const searchUsers = async (query: string) => {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search users');
    const data = await response.json();
    return data.suggestions || [];
  };

  return useSearchSuggestions({
    searchFn: searchUsers,
    debounceTime: 300,
    minChars: 2,
    maxSuggestions: 8
  });
}

// Hook for role search suggestions
export function useRoleSearchSuggestions() {
  const searchRoles = async (query: string) => {
    const response = await fetch(`/api/roles/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search roles');
    const data = await response.json();
    return data.suggestions || [];
  };

  return useSearchSuggestions({
    searchFn: searchRoles,
    debounceTime: 200,
    minChars: 1,
    maxSuggestions: 5
  });
}