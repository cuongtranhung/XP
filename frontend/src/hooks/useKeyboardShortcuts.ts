/**
 * Keyboard Shortcuts Hook
 * Provides keyboard shortcuts functionality for power users
 */

import { useEffect, useRef, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean; // Cmd key on Mac
  description: string;
  action: () => void;
  preventDefault?: boolean;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  target?: Element | null; // Specific element to listen on, defaults to document
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  target = null
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts);
  const enabledRef = useRef(enabled);

  // Update refs when props change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
    enabledRef.current = enabled;
  }, [shortcuts, enabled]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabledRef.current) return;

    // Don't trigger shortcuts when user is typing in input fields
    const activeElement = document.activeElement;
    const isInputActive = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.hasAttribute('contenteditable')
    );

    // Allow certain shortcuts even in input fields (like Ctrl+S)
    const allowInInputs = ['s', 'z', 'y', 'a', 'c', 'v', 'x'];
    const isAllowedInInput = allowInInputs.includes(event.key.toLowerCase()) && 
                           (event.ctrlKey || event.metaKey);

    if (isInputActive && !isAllowedInInput) return;

    shortcutsRef.current.forEach(shortcut => {
      if (shortcut.enabled === false) return;

      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
      const altMatches = !!shortcut.alt === event.altKey;
      const shiftMatches = !!shortcut.shift === event.shiftKey;
      const metaMatches = !!shortcut.meta === event.metaKey;

      if (keyMatches && ctrlMatches && altMatches && shiftMatches && metaMatches) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action();
      }
    });
  }, []);

  useEffect(() => {
    const element = target || document;
    element.addEventListener('keydown', handleKeyDown as EventListener);
    
    return () => {
      element.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [handleKeyDown, target]);

  return {
    shortcuts: shortcutsRef.current,
    enabled: enabledRef.current
  };
}

// Global keyboard shortcuts for the application
export function useGlobalKeyboardShortcuts() {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: '/',
      description: 'Focus search',
      action: () => {
        const searchInput = document.querySelector('[data-shortcut="search"]') as HTMLElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    },
    {
      key: 'g',
      shift: true,
      description: 'Go to User Management',
      action: () => {
        window.location.href = '/users';
      }
    },
    {
      key: 'r',
      shift: true,
      description: 'Go to Role Management',
      action: () => {
        window.location.href = '/roles';
      }
    },
    {
      key: 'g',
      ctrl: true,
      description: 'Go to Group Management',
      action: () => {
        window.location.href = '/groups';
      }
    },
    {
      key: '?',
      description: 'Show keyboard shortcuts help',
      action: () => {
        // This will be handled by the ShortcutsModal component
        const event = new CustomEvent('show-shortcuts-modal');
        document.dispatchEvent(event);
      }
    },
    {
      key: 'n',
      ctrl: true,
      description: 'Create new user',
      action: () => {
        const newUserButton = document.querySelector('[data-shortcut="new-user"]') as HTMLElement;
        if (newUserButton) {
          newUserButton.click();
        }
      }
    },
    {
      key: 'r',
      ctrl: true,
      description: 'Refresh current page',
      action: () => {
        window.location.reload();
      },
      preventDefault: false // Let browser handle the refresh
    },
    {
      key: 'k',
      ctrl: true,
      description: 'Open command palette',
      action: () => {
        const event = new CustomEvent('show-command-palette');
        document.dispatchEvent(event);
      }
    },
    {
      key: 'Escape',
      description: 'Close modals and dropdowns',
      action: () => {
        // Close any open modals
        const closeButtons = document.querySelectorAll('[data-shortcut="close-modal"]');
        closeButtons.forEach(button => (button as HTMLElement).click());
        
        // Close dropdowns
        const dropdowns = document.querySelectorAll('[data-shortcut="close-dropdown"]');
        dropdowns.forEach(dropdown => (dropdown as HTMLElement).click());
      }
    }
  ];

  return useKeyboardShortcuts({ shortcuts });
}

// User Management specific shortcuts
export function useUserManagementShortcuts() {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'a',
      ctrl: true,
      shift: true,
      description: 'Select all users',
      action: () => {
        const selectAllButton = document.querySelector('[data-shortcut="select-all"]') as HTMLElement;
        if (selectAllButton) {
          selectAllButton.click();
        }
      }
    },
    {
      key: 'Delete',
      description: 'Delete selected users',
      action: () => {
        const deleteButton = document.querySelector('[data-shortcut="delete-selected"]') as HTMLElement;
        if (deleteButton && !deleteButton.hasAttribute('disabled')) {
          deleteButton.click();
        }
      }
    },
    {
      key: 'f',
      ctrl: true,
      description: 'Open filters',
      action: () => {
        const filtersButton = document.querySelector('[data-shortcut="toggle-filters"]') as HTMLElement;
        if (filtersButton) {
          filtersButton.click();
        }
      }
    },
    {
      key: 'e',
      ctrl: true,
      description: 'Export users',
      action: () => {
        const exportButton = document.querySelector('[data-shortcut="export-users"]') as HTMLElement;
        if (exportButton) {
          exportButton.click();
        }
      }
    },
    {
      key: 'ArrowDown',
      description: 'Navigate to next user',
      action: () => {
        navigateUserList('down');
      }
    },
    {
      key: 'ArrowUp',
      description: 'Navigate to previous user',
      action: () => {
        navigateUserList('up');
      }
    },
    {
      key: 'Enter',
      description: 'Open selected user details',
      action: () => {
        const selectedUser = document.querySelector('[data-user-selected="true"]') as HTMLElement;
        if (selectedUser) {
          const viewButton = selectedUser.querySelector('[data-shortcut="view-user"]') as HTMLElement;
          if (viewButton) {
            viewButton.click();
          }
        }
      }
    }
  ];

  return useKeyboardShortcuts({ shortcuts });
}

// Helper function to navigate user list
function navigateUserList(direction: 'up' | 'down') {
  const users = document.querySelectorAll('[data-user-row]');
  const currentSelected = document.querySelector('[data-user-selected="true"]');
  
  if (users.length === 0) return;

  let newIndex = 0;
  
  if (currentSelected) {
    const currentIndex = Array.from(users).indexOf(currentSelected);
    if (direction === 'down') {
      newIndex = currentIndex < users.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : users.length - 1;
    }
    
    // Remove selection from current
    currentSelected.removeAttribute('data-user-selected');
    currentSelected.classList.remove('bg-blue-50', 'ring-2', 'ring-blue-500');
  }
  
  // Add selection to new item
  const newSelected = users[newIndex] as HTMLElement;
  newSelected.setAttribute('data-user-selected', 'true');
  newSelected.classList.add('bg-blue-50', 'ring-2', 'ring-blue-500');
  
  // Scroll into view
  newSelected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Hook for managing shortcuts state
export function useShortcutsState() {
  return {
    formatShortcut: (shortcut: KeyboardShortcut) => {
      const parts: string[] = [];
      
      if (shortcut.ctrl) parts.push('Ctrl');
      if (shortcut.alt) parts.push('Alt');
      if (shortcut.shift) parts.push('Shift');
      if (shortcut.meta) parts.push('Cmd');
      
      parts.push(shortcut.key === ' ' ? 'Space' : shortcut.key);
      
      return parts.join(' + ');
    },
    
    getShortcutsByCategory: (shortcuts: KeyboardShortcut[]) => {
      return {
        navigation: shortcuts.filter(s => 
          s.description.toLowerCase().includes('go to') || 
          s.description.toLowerCase().includes('navigate')
        ),
        actions: shortcuts.filter(s => 
          s.description.toLowerCase().includes('create') ||
          s.description.toLowerCase().includes('delete') ||
          s.description.toLowerCase().includes('export') ||
          s.description.toLowerCase().includes('select')
        ),
        interface: shortcuts.filter(s => 
          s.description.toLowerCase().includes('focus') ||
          s.description.toLowerCase().includes('show') ||
          s.description.toLowerCase().includes('close') ||
          s.description.toLowerCase().includes('open')
        )
      };
    }
  };
}