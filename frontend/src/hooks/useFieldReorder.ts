/**
 * Field Reorder Hook
 * Provides keyboard shortcuts and utilities for field reordering
 */

import { useEffect, useCallback } from 'react';
import { useHapticFeedback } from './useMobileGestures';

interface UseFieldReorderProps {
  fields: any[];
  selectedFieldId?: string;
  onMoveUp: (fieldId: string) => void;
  onMoveDown: (fieldId: string) => void;
  onSelectNext: () => void;
  onSelectPrevious: () => void;
  isEnabled?: boolean;
}

export const useFieldReorder = ({
  fields,
  selectedFieldId,
  onMoveUp,
  onMoveDown,
  onSelectNext,
  onSelectPrevious,
  isEnabled = true
}: UseFieldReorderProps) => {
  const haptic = useHapticFeedback();

  // Get selected field info
  const selectedFieldIndex = selectedFieldId 
    ? fields.findIndex(f => f.id === selectedFieldId) 
    : -1;
  
  const canMoveUp = selectedFieldIndex > 0;
  const canMoveDown = selectedFieldIndex < fields.length - 1 && selectedFieldIndex !== -1;

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isEnabled || !selectedFieldId) return;

    // Check if user is typing in input/textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    const { key, ctrlKey, metaKey, shiftKey, altKey } = event;
    const isModifierKey = ctrlKey || metaKey;

    switch (key) {
      case 'ArrowUp':
        event.preventDefault();
        if (isModifierKey) {
          // Ctrl/Cmd + Arrow Up = Move field up
          if (canMoveUp) {
            onMoveUp(selectedFieldId);
            haptic.success();
          } else {
            haptic.warning();
          }
        } else if (shiftKey) {
          // Shift + Arrow Up = Select previous field
          onSelectPrevious();
          haptic.light();
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (isModifierKey) {
          // Ctrl/Cmd + Arrow Down = Move field down
          if (canMoveDown) {
            onMoveDown(selectedFieldId);
            haptic.success();
          } else {
            haptic.warning();
          }
        } else if (shiftKey) {
          // Shift + Arrow Down = Select next field
          onSelectNext();
          haptic.light();
        }
        break;

      case 'j':
      case 'J':
        // j = Move down (vim-like)
        if (!shiftKey && !isModifierKey && !altKey) {
          event.preventDefault();
          if (canMoveDown) {
            onMoveDown(selectedFieldId);
            haptic.success();
          } else {
            haptic.warning();
          }
        }
        break;

      case 'k':
      case 'K':
        // k = Move up (vim-like)
        if (!shiftKey && !isModifierKey && !altKey) {
          event.preventDefault();
          if (canMoveUp) {
            onMoveUp(selectedFieldId);
            haptic.success();
          } else {
            haptic.warning();
          }
        }
        break;

      case 'Home':
        // Home = Move to top
        if (isModifierKey && canMoveUp) {
          event.preventDefault();
          // Move to top by repeatedly moving up
          for (let i = selectedFieldIndex; i > 0; i--) {
            onMoveUp(selectedFieldId);
          }
          haptic.success();
        }
        break;

      case 'End':
        // End = Move to bottom
        if (isModifierKey && canMoveDown) {
          event.preventDefault();
          // Move to bottom by repeatedly moving down
          for (let i = selectedFieldIndex; i < fields.length - 1; i++) {
            onMoveDown(selectedFieldId);
          }
          haptic.success();
        }
        break;
    }
  }, [
    isEnabled,
    selectedFieldId,
    canMoveUp,
    canMoveDown,
    selectedFieldIndex,
    fields.length,
    onMoveUp,
    onMoveDown,
    onSelectNext,
    onSelectPrevious,
    haptic
  ]);

  // Register keyboard event listeners
  useEffect(() => {
    if (isEnabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isEnabled, handleKeyDown]);

  // Utility functions for programmatic reordering
  const moveToTop = useCallback(() => {
    if (selectedFieldId && canMoveUp) {
      for (let i = selectedFieldIndex; i > 0; i--) {
        onMoveUp(selectedFieldId);
      }
      haptic.success();
    }
  }, [selectedFieldId, canMoveUp, selectedFieldIndex, onMoveUp, haptic]);

  const moveToBottom = useCallback(() => {
    if (selectedFieldId && canMoveDown) {
      for (let i = selectedFieldIndex; i < fields.length - 1; i++) {
        onMoveDown(selectedFieldId);
      }
      haptic.success();
    }
  }, [selectedFieldId, canMoveDown, selectedFieldIndex, fields.length, onMoveDown, haptic]);

  const moveToPosition = useCallback((targetIndex: number) => {
    if (!selectedFieldId || selectedFieldIndex === -1 || targetIndex === selectedFieldIndex) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(fields.length - 1, targetIndex));
    const moves = Math.abs(clampedIndex - selectedFieldIndex);

    if (clampedIndex < selectedFieldIndex) {
      // Move up
      for (let i = 0; i < moves; i++) {
        onMoveUp(selectedFieldId);
      }
    } else {
      // Move down
      for (let i = 0; i < moves; i++) {
        onMoveDown(selectedFieldId);
      }
    }
    
    haptic.success();
  }, [selectedFieldId, selectedFieldIndex, fields.length, onMoveUp, onMoveDown, haptic]);

  // Get keyboard shortcuts help text
  const getShortcutsHelp = () => [
    { keys: ['Ctrl/⌘', '↑'], action: 'Move field up' },
    { keys: ['Ctrl/⌘', '↓'], action: 'Move field down' },
    { keys: ['Shift', '↑'], action: 'Select previous field' },
    { keys: ['Shift', '↓'], action: 'Select next field' },
    { keys: ['K'], action: 'Move up (vim-style)' },
    { keys: ['J'], action: 'Move down (vim-style)' },
    { keys: ['Ctrl/⌘', 'Home'], action: 'Move to top' },
    { keys: ['Ctrl/⌘', 'End'], action: 'Move to bottom' }
  ];

  return {
    // State
    canMoveUp,
    canMoveDown,
    selectedFieldIndex,
    
    // Actions
    moveToTop,
    moveToBottom,
    moveToPosition,
    
    // Utilities
    getShortcutsHelp,
    
    // Info
    isEnabled
  };
};

export default useFieldReorder;