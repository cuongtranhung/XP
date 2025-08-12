/**
 * Keyboard Navigation Hook for Table
 * Handles arrow keys, tab, enter, escape navigation
 */

import { useEffect, useCallback, useState } from 'react';

interface KeyboardNavigationOptions {
  enabled: boolean;
  totalRows: number;
  totalColumns: number;
  onCellSelect?: (row: number, col: number) => void;
  onCellEdit?: (row: number, col: number) => void;
  onEscape?: () => void;
  onCopy?: (row: number, col: number) => void;
  onPaste?: (row: number, col: number) => void;
}

export function useTableKeyboardNavigation({
  enabled,
  totalRows,
  totalColumns,
  onCellSelect,
  onCellEdit,
  onEscape,
  onCopy,
  onPaste
}: KeyboardNavigationOptions) {
  const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [isEditing, setIsEditing] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    const { row, col } = activeCell;

    // Don't handle navigation when editing
    if (isEditing && e.key !== 'Escape' && e.key !== 'Enter' && e.key !== 'Tab') {
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (row > 0) {
          const newRow = row - 1;
          setActiveCell({ row: newRow, col });
          onCellSelect?.(newRow, col);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (row < totalRows - 1) {
          const newRow = row + 1;
          setActiveCell({ row: newRow, col });
          onCellSelect?.(newRow, col);
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) {
          const newCol = col - 1;
          setActiveCell({ row, col: newCol });
          onCellSelect?.(row, newCol);
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (col < totalColumns - 1) {
          const newCol = col + 1;
          setActiveCell({ row, col: newCol });
          onCellSelect?.(row, newCol);
        }
        break;

      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          // Move backwards
          if (col > 0) {
            const newCol = col - 1;
            setActiveCell({ row, col: newCol });
            onCellSelect?.(row, newCol);
          } else if (row > 0) {
            const newRow = row - 1;
            const newCol = totalColumns - 1;
            setActiveCell({ row: newRow, col: newCol });
            onCellSelect?.(newRow, newCol);
          }
        } else {
          // Move forward
          if (col < totalColumns - 1) {
            const newCol = col + 1;
            setActiveCell({ row, col: newCol });
            onCellSelect?.(row, newCol);
          } else if (row < totalRows - 1) {
            const newRow = row + 1;
            const newCol = 0;
            setActiveCell({ row: newRow, col: newCol });
            onCellSelect?.(newRow, newCol);
          }
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (isEditing) {
          setIsEditing(false);
        } else {
          setIsEditing(true);
          onCellEdit?.(row, col);
        }
        break;

      case 'Escape':
        e.preventDefault();
        if (isEditing) {
          setIsEditing(false);
        }
        onEscape?.();
        break;

      case 'c':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onCopy?.(row, col);
        }
        break;

      case 'v':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onPaste?.(row, col);
        }
        break;

      case 'Home':
        e.preventDefault();
        if (e.ctrlKey) {
          // Go to first cell
          setActiveCell({ row: 0, col: 0 });
          onCellSelect?.(0, 0);
        } else {
          // Go to first column in current row
          setActiveCell({ row, col: 0 });
          onCellSelect?.(row, 0);
        }
        break;

      case 'End':
        e.preventDefault();
        if (e.ctrlKey) {
          // Go to last cell
          const lastRow = totalRows - 1;
          const lastCol = totalColumns - 1;
          setActiveCell({ row: lastRow, col: lastCol });
          onCellSelect?.(lastRow, lastCol);
        } else {
          // Go to last column in current row
          const lastCol = totalColumns - 1;
          setActiveCell({ row, col: lastCol });
          onCellSelect?.(row, lastCol);
        }
        break;

      case 'PageUp':
        e.preventDefault();
        const pageUpRow = Math.max(0, row - 10);
        setActiveCell({ row: pageUpRow, col });
        onCellSelect?.(pageUpRow, col);
        break;

      case 'PageDown':
        e.preventDefault();
        const pageDownRow = Math.min(totalRows - 1, row + 10);
        setActiveCell({ row: pageDownRow, col });
        onCellSelect?.(pageDownRow, col);
        break;
    }
  }, [activeCell, enabled, isEditing, totalRows, totalColumns, onCellSelect, onCellEdit, onEscape, onCopy, onPaste]);

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [enabled, handleKeyDown]);

  return {
    activeCell,
    setActiveCell,
    isEditing,
    setIsEditing
  };
}

export default useTableKeyboardNavigation;