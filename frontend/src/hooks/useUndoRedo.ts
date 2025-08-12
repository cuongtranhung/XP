/**
 * Undo/Redo Hook
 * Manages a history stack for reversible operations
 */

import { useState, useCallback, useRef } from 'react';

interface HistoryEntry<T> {
  action: string;
  data: T;
  timestamp: number;
}

interface UseUndoRedoOptions {
  maxHistorySize?: number;
}

export function useUndoRedo<T>(
  initialState: T,
  options: UseUndoRedoOptions = {}
) {
  const { maxHistorySize = 20 } = options;
  
  const [currentState, setCurrentState] = useState<T>(initialState);
  const [history, setHistory] = useState<HistoryEntry<T>[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const isInternalUpdate = useRef(false);

  // Add a new state to history
  const addToHistory = useCallback((action: string, newState: T) => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    setHistory(prev => {
      // Remove any history after current index (for branching)
      const newHistory = prev.slice(0, currentIndex + 1);
      
      // Add new entry
      newHistory.push({
        action,
        data: newState,
        timestamp: Date.now()
      });

      // Limit history size
      if (newHistory.length > maxHistorySize) {
        return newHistory.slice(-maxHistorySize);
      }

      return newHistory;
    });

    setCurrentIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
    setCurrentState(newState);
  }, [currentIndex, maxHistorySize]);

  // Undo last action
  const undo = useCallback(() => {
    if (currentIndex > 0) {
      isInternalUpdate.current = true;
      const newIndex = currentIndex - 1;
      const previousState = history[newIndex];
      
      setCurrentIndex(newIndex);
      setCurrentState(previousState.data);
      
      return {
        success: true,
        action: previousState.action,
        state: previousState.data
      };
    }
    
    return { success: false };
  }, [currentIndex, history]);

  // Redo last undone action
  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      isInternalUpdate.current = true;
      const newIndex = currentIndex + 1;
      const nextState = history[newIndex];
      
      setCurrentIndex(newIndex);
      setCurrentState(nextState.data);
      
      return {
        success: true,
        action: nextState.action,
        state: nextState.data
      };
    }
    
    return { success: false };
  }, [currentIndex, history]);

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  // Get history info
  const getHistoryInfo = useCallback(() => {
    return {
      canUndo: currentIndex > 0,
      canRedo: currentIndex < history.length - 1,
      historySize: history.length,
      currentIndex,
      actions: history.map(h => ({
        action: h.action,
        timestamp: h.timestamp
      }))
    };
  }, [currentIndex, history]);

  return {
    state: currentState,
    setState: (action: string, newState: T) => addToHistory(action, newState),
    undo,
    redo,
    clearHistory,
    historyInfo: getHistoryInfo()
  };
}

export default useUndoRedo;