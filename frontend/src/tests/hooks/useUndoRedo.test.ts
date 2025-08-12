/**
 * Unit Tests for useUndoRedo Hook
 */

import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../../hooks/useUndoRedo';

describe('useUndoRedo Hook', () => {
  it('should initialize with initial state', () => {
    const initialState = { value: 'initial' };
    const { result } = renderHook(() => useUndoRedo(initialState));

    expect(result.current.state).toEqual(initialState);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.historySize).toBe(0);
  });

  it('should update state and add to history', () => {
    const { result } = renderHook(() => useUndoRedo({ value: 1 }));

    act(() => {
      result.current.setState({ value: 2 });
    });

    expect(result.current.state).toEqual({ value: 2 });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.historySize).toBe(1);
  });

  it('should undo state changes', () => {
    const { result } = renderHook(() => useUndoRedo({ value: 1 }));

    act(() => {
      result.current.setState({ value: 2 });
      result.current.setState({ value: 3 });
    });

    expect(result.current.state).toEqual({ value: 3 });

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual({ value: 2 });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual({ value: 1 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('should redo state changes', () => {
    const { result } = renderHook(() => useUndoRedo({ value: 1 }));

    act(() => {
      result.current.setState({ value: 2 });
      result.current.setState({ value: 3 });
      result.current.undo();
      result.current.undo();
    });

    expect(result.current.state).toEqual({ value: 1 });

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toEqual({ value: 2 });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toEqual({ value: 3 });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should clear redo history on new state', () => {
    const { result } = renderHook(() => useUndoRedo({ value: 1 }));

    act(() => {
      result.current.setState({ value: 2 });
      result.current.setState({ value: 3 });
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.setState({ value: 4 });
    });

    expect(result.current.state).toEqual({ value: 4 });
    expect(result.current.canRedo).toBe(false);
    expect(result.current.historySize).toBe(2);
  });

  it('should respect max history size', () => {
    const { result } = renderHook(() => useUndoRedo({ value: 0 }, 3));

    // Add more than max history
    act(() => {
      result.current.setState({ value: 1 });
      result.current.setState({ value: 2 });
      result.current.setState({ value: 3 });
      result.current.setState({ value: 4 });
    });

    expect(result.current.historySize).toBe(3);
    expect(result.current.state).toEqual({ value: 4 });

    // Undo to check oldest is removed
    act(() => {
      result.current.undo();
      result.current.undo();
      result.current.undo();
    });

    expect(result.current.state).toEqual({ value: 1 });
    expect(result.current.canUndo).toBe(false);
  });

  it('should handle function updates', () => {
    const { result } = renderHook(() => useUndoRedo({ counter: 0 }));

    act(() => {
      result.current.setState((prev) => ({ counter: prev.counter + 1 }));
    });

    expect(result.current.state).toEqual({ counter: 1 });

    act(() => {
      result.current.setState((prev) => ({ counter: prev.counter * 2 }));
    });

    expect(result.current.state).toEqual({ counter: 2 });
    expect(result.current.historySize).toBe(2);
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useUndoRedo({ value: 0 }));

    act(() => {
      result.current.setState({ value: 1 });
      result.current.setState({ value: 2 });
      result.current.setState({ value: 3 });
    });

    expect(result.current.historySize).toBe(3);
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.historySize).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.state).toEqual({ value: 3 }); // Current state preserved
  });

  it('should handle complex state objects', () => {
    const initialState = {
      user: { name: 'John', age: 30 },
      settings: { theme: 'light' }
    };

    const { result } = renderHook(() => useUndoRedo(initialState));

    act(() => {
      result.current.setState({
        ...result.current.state,
        user: { ...result.current.state.user, age: 31 }
      });
    });

    expect(result.current.state.user.age).toBe(31);
    expect(result.current.state.settings.theme).toBe('light');

    act(() => {
      result.current.undo();
    });

    expect(result.current.state.user.age).toBe(30);
  });

  it('should handle arrays as state', () => {
    const { result } = renderHook(() => useUndoRedo([1, 2, 3]));

    act(() => {
      result.current.setState([...result.current.state, 4]);
    });

    expect(result.current.state).toEqual([1, 2, 3, 4]);

    act(() => {
      result.current.setState(result.current.state.filter(n => n !== 2));
    });

    expect(result.current.state).toEqual([1, 3, 4]);

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual([1, 2, 3, 4]);
  });

  it('should not exceed history when undoing/redoing at limits', () => {
    const { result } = renderHook(() => useUndoRedo({ value: 1 }));

    // Try undo when no history
    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual({ value: 1 });

    // Add some history
    act(() => {
      result.current.setState({ value: 2 });
    });

    // Try redo when no future
    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toEqual({ value: 2 });
  });
});