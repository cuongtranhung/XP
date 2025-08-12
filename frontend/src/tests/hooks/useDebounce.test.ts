/**
 * Unit Tests for useDebounce Hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebounce } from '../../hooks/useDebounce';

describe('useDebounce Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    );

    expect(result.current).toBe('initial');

    // Change value
    rerender({ value: 'updated', delay: 500 });
    
    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Now value should be updated
    expect(result.current).toBe('updated');
  });

  it('should cancel previous timeout on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    );

    // Make rapid changes
    rerender({ value: 'update1', delay: 500 });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    rerender({ value: 'update2', delay: 500 });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    rerender({ value: 'update3', delay: 500 });
    
    // Value should still be initial
    expect(result.current).toBe('initial');

    // Fast-forward to complete the last debounce
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Should have the last value
    expect(result.current).toBe('update3');
  });

  it('should handle different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 1000 }
      }
    );

    rerender({ value: 'updated', delay: 1000 });

    // Advance less than delay
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe('initial');

    // Advance to complete delay
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe('updated');
  });

  it('should handle zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 0 }
      }
    );

    rerender({ value: 'updated', delay: 0 });

    act(() => {
      jest.runAllTimers();
    });

    expect(result.current).toBe('updated');
  });

  it('should cleanup timeout on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    
    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    );

    rerender({ value: 'updated', delay: 500 });
    
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should handle different data types', () => {
    // Test with number
    const { result: numberResult, rerender: rerenderNumber } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 42, delay: 300 }
      }
    );

    rerenderNumber({ value: 100, delay: 300 });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(numberResult.current).toBe(100);

    // Test with object
    const { result: objectResult, rerender: rerenderObject } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: { name: 'John' }, delay: 300 }
      }
    );

    const newObject = { name: 'Jane' };
    rerenderObject({ value: newObject, delay: 300 });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(objectResult.current).toEqual(newObject);

    // Test with array
    const { result: arrayResult, rerender: rerenderArray } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: [1, 2, 3], delay: 300 }
      }
    );

    const newArray = [4, 5, 6];
    rerenderArray({ value: newArray, delay: 300 });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(arrayResult.current).toEqual(newArray);
  });

  it('should handle null and undefined values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: null as any, delay: 300 }
      }
    );

    expect(result.current).toBe(null);

    rerender({ value: undefined as any, delay: 300 });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe(undefined);

    rerender({ value: 'defined', delay: 300 });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('defined');
  });
});