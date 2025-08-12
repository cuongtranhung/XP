/**
 * Search Input Component with Suggestions
 * Provides real-time search with auto-complete suggestions
 */

import React, { useRef, useEffect, useState } from 'react';
import { useSearchSuggestions } from '../../hooks/useSearchSuggestions';
import { AccessibleButton } from '../accessibility/AccessibleButton';

interface SearchInputProps<T> {
  searchFn: (query: string) => Promise<T[]>;
  onSelect?: (item: T) => void;
  onChange?: (query: string) => void;
  placeholder?: string;
  renderSuggestion: (item: T, isSelected: boolean) => React.ReactNode;
  getSuggestionKey: (item: T) => string;
  className?: string;
  debounceTime?: number;
  minChars?: number;
  maxSuggestions?: number;
  disabled?: boolean;
  'aria-label'?: string;
  'data-testid'?: string;
}

export function SearchInput<T>({
  searchFn,
  onSelect,
  onChange,
  placeholder = 'Search...',
  renderSuggestion,
  getSuggestionKey,
  className = '',
  debounceTime = 300,
  minChars = 2,
  maxSuggestions = 10,
  disabled = false,
  'aria-label': ariaLabel,
  'data-testid': testId
}: SearchInputProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const [inputValue, setInputValue] = useState('');
  
  const {
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
  } = useSearchSuggestions({
    searchFn,
    debounceTime,
    minChars,
    maxSuggestions
  });

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    updateQuery(value);
    onChange?.(value);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: T) => {
    const selected = selectSuggestion(suggestion);
    onSelect?.(selected);
    
    // Focus back to input
    inputRef.current?.focus();
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedItem = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      selectedItem?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const inputId = `search-input-${Math.random().toString(36).substr(2, 9)}`;
  const suggestionsId = `search-suggestions-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel || placeholder}
          aria-describedby={isOpen ? suggestionsId : undefined}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          role="combobox"
          data-testid={testId}
          className={`
            w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${isOpen ? 'rounded-b-none' : ''}
          `}
        />
        
        {/* Search icon */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Clear button */}
        {inputValue && !isLoading && (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              clearSuggestions();
              onChange?.('');
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && (suggestions.length > 0 || error) && (
        <div className="absolute z-50 w-full bg-white border border-gray-300 border-t-0 rounded-b-lg shadow-lg max-h-60 overflow-y-auto">
          {error ? (
            <div className="px-4 py-3 text-red-600 text-sm" role="alert">
              {error}
            </div>
          ) : (
            <ul
              ref={suggestionsRef}
              id={suggestionsId}
              role="listbox"
              aria-label="Search suggestions"
              className="divide-y divide-gray-100"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={getSuggestionKey(suggestion)}
                  role="option"
                  aria-selected={index === selectedIndex}
                  className={`
                    px-4 py-3 cursor-pointer transition-colors
                    ${index === selectedIndex 
                      ? 'bg-blue-50 text-blue-900' 
                      : 'hover:bg-gray-50 text-gray-900'
                    }
                  `}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  onMouseEnter={() => {
                    // Update selected index on hover for keyboard navigation consistency
                    if (index !== selectedIndex) {
                      // Don't interfere with keyboard navigation
                    }
                  }}
                >
                  {renderSuggestion(suggestion, index === selectedIndex)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isLoading && 'Loading suggestions'}
        {suggestions.length > 0 && !isLoading && (
          `${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''} available`
        )}
        {error && `Error: ${error}`}
      </div>
    </div>
  );
}

// Specialized User Search Input
interface UserSearchInputProps {
  onSelect?: (user: any) => void;
  onChange?: (query: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const UserSearchInput: React.FC<UserSearchInputProps> = ({
  onSelect,
  onChange,
  placeholder = 'Search users...',
  className = '',
  disabled = false
}) => {
  const searchUsers = async (query: string) => {
    // Mock API call - replace with actual API
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search users');
    const data = await response.json();
    return data.users || [];
  };

  const renderUserSuggestion = (user: any, isSelected: boolean) => (
    <div className="flex items-center space-x-3">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
          <span className="text-xs font-medium text-gray-600">
            {user.firstName?.[0]}{user.lastName?.[0]}
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {user.email}
        </p>
      </div>
    </div>
  );

  return (
    <SearchInput
      searchFn={searchUsers}
      onSelect={onSelect}
      onChange={onChange}
      placeholder={placeholder}
      renderSuggestion={renderUserSuggestion}
      getSuggestionKey={(user) => user.id}
      className={className}
      disabled={disabled}
      aria-label="Search for users"
      data-testid="user-search-input"
    />
  );
};

// Specialized Role Search Input
interface RoleSearchInputProps {
  onSelect?: (role: any) => void;
  onChange?: (query: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const RoleSearchInput: React.FC<RoleSearchInputProps> = ({
  onSelect,
  onChange,
  placeholder = 'Search roles...',
  className = '',
  disabled = false
}) => {
  const searchRoles = async (query: string) => {
    // Mock API call - replace with actual API
    const response = await fetch(`/api/roles/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search roles');
    const data = await response.json();
    return data.roles || [];
  };

  const renderRoleSuggestion = (role: any, isSelected: boolean) => (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{role.name}</p>
        {role.description && (
          <p className="text-xs text-gray-500 truncate">{role.description}</p>
        )}
      </div>
      <span className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        ${role.level === 'admin' ? 'bg-red-100 text-red-800' : 
          role.level === 'manager' ? 'bg-yellow-100 text-yellow-800' : 
          'bg-green-100 text-green-800'}
      `}>
        {role.level}
      </span>
    </div>
  );

  return (
    <SearchInput
      searchFn={searchRoles}
      onSelect={onSelect}
      onChange={onChange}
      placeholder={placeholder}
      renderSuggestion={renderRoleSuggestion}
      getSuggestionKey={(role) => role.id}
      className={className}
      disabled={disabled}
      aria-label="Search for roles"
      data-testid="role-search-input"
      debounceTime={200}
      minChars={1}
      maxSuggestions={5}
    />
  );
};