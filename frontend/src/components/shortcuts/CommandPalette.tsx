/**
 * Command Palette Component
 * Provides quick access to actions and navigation via search
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AccessibleModal } from '../accessibility/AccessibleModal';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { debounce } from '../../utils/debounce';

interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  category: string;
  action: () => void;
  keywords?: string[];
  shortcut?: string;
}

interface CommandPaletteProps {
  commands?: Command[];
}

const defaultCommands: Command[] = [
  // Navigation Commands
  {
    id: 'nav-users',
    title: 'Go to User Management',
    subtitle: 'Manage users, roles, and permissions',
    icon: '👥',
    category: 'Navigation',
    action: () => { window.location.href = '/users'; },
    keywords: ['users', 'people', 'accounts'],
    shortcut: 'Shift + G'
  },
  {
    id: 'nav-roles',
    title: 'Go to Role Management',
    subtitle: 'Manage user roles and permissions',
    icon: '🏷️',
    category: 'Navigation',
    action: () => { window.location.href = '/roles'; },
    keywords: ['roles', 'permissions', 'access'],
    shortcut: 'Shift + R'
  },
  {
    id: 'nav-groups',
    title: 'Go to Group Management',
    subtitle: 'Organize users into groups',
    icon: '👨‍👩‍👧‍👦',
    category: 'Navigation',
    action: () => { window.location.href = '/groups'; },
    keywords: ['groups', 'teams', 'organizations'],
    shortcut: 'Ctrl + G'
  },
  {
    id: 'nav-dashboard',
    title: 'Go to Dashboard',
    subtitle: 'View analytics and overview',
    icon: '📊',
    category: 'Navigation',
    action: () => { window.location.href = '/dashboard'; },
    keywords: ['dashboard', 'analytics', 'overview']
  },
  
  // Actions
  {
    id: 'action-new-user',
    title: 'Create New User',
    subtitle: 'Add a new user to the system',
    icon: '➕',
    category: 'Actions',
    action: () => {
      const button = document.querySelector('[data-shortcut="new-user"]') as HTMLElement;
      button?.click();
    },
    keywords: ['create', 'new', 'add', 'user'],
    shortcut: 'Ctrl + N'
  },
  {
    id: 'action-export-users',
    title: 'Export Users',
    subtitle: 'Export user data to file',
    icon: '📤',
    category: 'Actions',
    action: () => {
      const button = document.querySelector('[data-shortcut="export-users"]') as HTMLElement;
      button?.click();
    },
    keywords: ['export', 'download', 'backup'],
    shortcut: 'Ctrl + E'
  },
  {
    id: 'action-import-users',
    title: 'Import Users',
    subtitle: 'Import users from file',
    icon: '📥',
    category: 'Actions',
    action: () => {
      const button = document.querySelector('[data-shortcut="import-users"]') as HTMLElement;
      button?.click();
    },
    keywords: ['import', 'upload', 'bulk']
  },
  {
    id: 'action-refresh',
    title: 'Refresh Page',
    subtitle: 'Reload current page',
    icon: '🔄',
    category: 'Actions',
    action: () => { window.location.reload(); },
    keywords: ['refresh', 'reload', 'update'],
    shortcut: 'Ctrl + R'
  },
  
  // Interface
  {
    id: 'interface-shortcuts',
    title: 'Show Keyboard Shortcuts',
    subtitle: 'View all available shortcuts',
    icon: '⌨️',
    category: 'Interface',
    action: () => {
      document.dispatchEvent(new CustomEvent('show-shortcuts-modal'));
    },
    keywords: ['shortcuts', 'help', 'keys'],
    shortcut: '?'
  },
  {
    id: 'interface-search',
    title: 'Focus Search',
    subtitle: 'Jump to search input',
    icon: '🔍',
    category: 'Interface',
    action: () => {
      const searchInput = document.querySelector('[data-shortcut="search"]') as HTMLElement;
      searchInput?.focus();
    },
    keywords: ['search', 'find', 'filter'],
    shortcut: '/'
  },
  {
    id: 'interface-filters',
    title: 'Toggle Filters',
    subtitle: 'Show or hide filter options',
    icon: '🎛️',
    category: 'Interface',
    action: () => {
      const button = document.querySelector('[data-shortcut="toggle-filters"]') as HTMLElement;
      button?.click();
    },
    keywords: ['filters', 'toggle', 'options'],
    shortcut: 'Ctrl + F'
  }
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ 
  commands = defaultCommands 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter and search commands
  const filteredCommands = useMemo(() => {
    let filtered = commands;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(cmd => cmd.category === selectedCategory);
    }

    // Filter by query
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(cmd => 
        cmd.title.toLowerCase().includes(lowerQuery) ||
        cmd.subtitle?.toLowerCase().includes(lowerQuery) ||
        cmd.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery))
      );
    }

    return filtered;
  }, [commands, query, selectedCategory]);

  // Get unique categories
  const categories = useMemo(() => 
    Array.from(new Set(commands.map(cmd => cmd.category)))
  , [commands]);

  // Keyboard navigation
  const { focusedIndex, setItemRef, focusItem } = useKeyboardNavigation({
    items: filteredCommands,
    onEnter: (command) => {
      command.action();
      handleClose();
    },
    onEscape: () => setIsOpen(false)
  });

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setSelectedCategory(null);
  };

  const handleCommandSelect = (command: Command) => {
    command.action();
    handleClose();
  };

  // Listen for command palette trigger
  useEffect(() => {
    const handleShowCommandPalette = () => {
      setIsOpen(true);
    };

    document.addEventListener('show-command-palette', handleShowCommandPalette);
    
    return () => {
      document.removeEventListener('show-command-palette', handleShowCommandPalette);
    };
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Debounced search to improve performance
  const debouncedSetQuery = useMemo(
    () => debounce((value: string) => setQuery(value), 150),
    []
  );

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Command Palette"
      size="md"
      closeOnOverlayClick={true}
      data-shortcut="close-modal"
    >
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            onChange={(e) => debouncedSetQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                // Let the keyboard navigation hook handle this
              }
            }}
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(
                selectedCategory === category ? null : category
              )}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Commands List */}
        <div className="max-h-64 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl mb-2 block">🔍</span>
              No commands found
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((command, index) => (
                <button
                  key={command.id}
                  ref={(el) => setItemRef(index, el)}
                  onClick={() => handleCommandSelect(command)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    index === focusedIndex
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{command.icon}</span>
                      <div>
                        <div className="font-medium text-gray-900">{command.title}</div>
                        {command.subtitle && (
                          <div className="text-sm text-gray-600">{command.subtitle}</div>
                        )}
                      </div>
                    </div>
                    {command.shortcut && (
                      <kbd className="hidden sm:inline-block px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-600">
                        {command.shortcut}
                      </kbd>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs mr-1">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs mr-1">↵</kbd>
                Select
              </span>
              <span className="flex items-center">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs mr-1">Esc</kbd>
                Close
              </span>
            </div>
            <span>{filteredCommands.length} commands</span>
          </div>
        </div>
      </div>
    </AccessibleModal>
  );
};