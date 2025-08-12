/**
 * Keyboard Navigation Hook
 * Provides keyboard navigation support for lists and grids
 * WCAG 2.1 Criterion 2.1.1 - Keyboard (Level A)
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseKeyboardNavigationOptions {
  items: any[];
  onSelect?: (item: any, index: number) => void;
  onEnter?: (item: any, index: number) => void;
  onSpace?: (item: any, index: number) => void;
  onEscape?: () => void;
  orientation?: 'vertical' | 'horizontal' | 'grid';
  loop?: boolean;
  cols?: number; // For grid navigation
  initialIndex?: number;
  disabled?: boolean;
}

export const useKeyboardNavigation = ({
  items,
  onSelect,
  onEnter,
  onSpace,
  onEscape,
  orientation = 'vertical',
  loop = true,
  cols = 1,
  initialIndex = -1,
  disabled = false
}: UseKeyboardNavigationOptions) => {
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Calculate grid navigation
  const getNextIndex = useCallback((current: number, direction: 'up' | 'down' | 'left' | 'right'): number => {
    const totalItems = items.length;
    
    if (totalItems === 0) return -1;

    if (orientation === 'grid') {
      const rows = Math.ceil(totalItems / cols);
      const currentRow = Math.floor(current / cols);
      const currentCol = current % cols;

      switch (direction) {
        case 'up':
          if (currentRow === 0) {
            return loop ? (rows - 1) * cols + currentCol : current;
          }
          return Math.max(0, current - cols);

        case 'down':
          if (currentRow === rows - 1) {
            return loop ? currentCol : current;
          }
          return Math.min(totalItems - 1, current + cols);

        case 'left':
          if (current === 0) {
            return loop ? totalItems - 1 : 0;
          }
          return current - 1;

        case 'right':
          if (current === totalItems - 1) {
            return loop ? 0 : current;
          }
          return current + 1;

        default:
          return current;
      }
    } else if (orientation === 'horizontal') {
      switch (direction) {
        case 'left':
        case 'up':
          if (current <= 0) {
            return loop ? totalItems - 1 : 0;
          }
          return current - 1;

        case 'right':
        case 'down':
          if (current >= totalItems - 1) {
            return loop ? 0 : totalItems - 1;
          }
          return current + 1;

        default:
          return current;
      }
    } else {
      // Vertical orientation
      switch (direction) {
        case 'up':
        case 'left':
          if (current <= 0) {
            return loop ? totalItems - 1 : 0;
          }
          return current - 1;

        case 'down':
        case 'right':
          if (current >= totalItems - 1) {
            return loop ? 0 : totalItems - 1;
          }
          return current + 1;

        default:
          return current;
      }
    }
  }, [items.length, orientation, loop, cols]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled || items.length === 0) return;

    let newIndex = focusedIndex;
    let handled = false;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        newIndex = getNextIndex(focusedIndex, 'up');
        handled = true;
        break;

      case 'ArrowDown':
        e.preventDefault();
        newIndex = getNextIndex(focusedIndex, 'down');
        handled = true;
        break;

      case 'ArrowLeft':
        e.preventDefault();
        newIndex = getNextIndex(focusedIndex, 'left');
        handled = true;
        break;

      case 'ArrowRight':
        e.preventDefault();
        newIndex = getNextIndex(focusedIndex, 'right');
        handled = true;
        break;

      case 'Home':
        e.preventDefault();
        newIndex = 0;
        handled = true;
        break;

      case 'End':
        e.preventDefault();
        newIndex = items.length - 1;
        handled = true;
        break;

      case 'PageUp':
        e.preventDefault();
        if (orientation === 'grid') {
          newIndex = Math.max(0, focusedIndex - cols * 3);
        } else {
          newIndex = Math.max(0, focusedIndex - 5);
        }
        handled = true;
        break;

      case 'PageDown':
        e.preventDefault();
        if (orientation === 'grid') {
          newIndex = Math.min(items.length - 1, focusedIndex + cols * 3);
        } else {
          newIndex = Math.min(items.length - 1, focusedIndex + 5);
        }
        handled = true;
        break;

      case 'Enter':
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          e.preventDefault();
          onEnter?.(items[focusedIndex], focusedIndex);
          onSelect?.(items[focusedIndex], focusedIndex);
        }
        handled = true;
        break;

      case ' ':
      case 'Space':
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          e.preventDefault();
          onSpace?.(items[focusedIndex], focusedIndex);
          onSelect?.(items[focusedIndex], focusedIndex);
        }
        handled = true;
        break;

      case 'Escape':
        e.preventDefault();
        onEscape?.();
        setFocusedIndex(-1);
        handled = true;
        break;

      default:
        // Type-ahead search
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          const char = e.key.toLowerCase();
          const currentIndex = focusedIndex >= 0 ? focusedIndex : -1;
          
          // Find next item starting with this character
          for (let i = currentIndex + 1; i < items.length; i++) {
            const itemText = getItemText(items[i]);
            if (itemText && itemText.toLowerCase().startsWith(char)) {
              newIndex = i;
              handled = true;
              break;
            }
          }
          
          // If not found, search from beginning
          if (!handled && loop) {
            for (let i = 0; i <= currentIndex; i++) {
              const itemText = getItemText(items[i]);
              if (itemText && itemText.toLowerCase().startsWith(char)) {
                newIndex = i;
                handled = true;
                break;
              }
            }
          }
        }
        break;
    }

    if (handled && newIndex !== focusedIndex && newIndex >= 0 && newIndex < items.length) {
      setFocusedIndex(newIndex);
      
      // Focus the element
      if (itemRefs.current[newIndex]) {
        itemRefs.current[newIndex]?.focus();
      }
    }
  }, [disabled, items, focusedIndex, getNextIndex, onEnter, onSpace, onSelect, onEscape, loop]);

  // Set up event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Helper function to get text content for type-ahead
  const getItemText = (item: any): string => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      return item.label || item.name || item.title || item.text || '';
    }
    return '';
  };

  // Set ref for an item
  const setItemRef = useCallback((index: number, ref: HTMLElement | null) => {
    itemRefs.current[index] = ref;
  }, []);

  // Focus an item programmatically
  const focusItem = useCallback((index: number) => {
    if (index >= 0 && index < items.length) {
      setFocusedIndex(index);
      itemRefs.current[index]?.focus();
    }
  }, [items.length]);

  // Reset focus
  const resetFocus = useCallback(() => {
    setFocusedIndex(initialIndex);
  }, [initialIndex]);

  return {
    focusedIndex,
    setItemRef,
    focusItem,
    resetFocus,
    isFocused: (index: number) => focusedIndex === index
  };
};