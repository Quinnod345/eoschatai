// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoading } from '@/hooks/use-loading';

describe('useLoading', () => {
  // Reset store state before each test
  beforeEach(() => {
    const { result } = renderHook(() => useLoading());
    act(() => {
      result.current.setLoading(false);
    });
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useLoading());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadingText).toBe('Loading...');
    expect(result.current.loadingType).toBe('default');
  });

  it('sets loading to true with defaults', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadingText).toBe('Loading...');
    expect(result.current.loadingType).toBe('default');
  });

  it('sets loading with custom text', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.setLoading(true, 'Fetching data...');
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadingText).toBe('Fetching data...');
    expect(result.current.loadingType).toBe('default');
  });

  it('sets loading with custom type', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.setLoading(true, 'Chatting...', 'chat');
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadingText).toBe('Chatting...');
    expect(result.current.loadingType).toBe('chat');
  });

  it('handles all loading types', () => {
    const { result } = renderHook(() => useLoading());
    const types: Array<'default' | 'chat' | 'search' | 'upload' | 'processing'> = [
      'default',
      'chat',
      'search',
      'upload',
      'processing',
    ];

    types.forEach((type) => {
      act(() => {
        result.current.setLoading(true, `${type} text`, type);
      });

      expect(result.current.loadingType).toBe(type);
      expect(result.current.loadingText).toBe(`${type} text`);
    });
  });

  it('sets loading to false and resets text and type', () => {
    const { result } = renderHook(() => useLoading());

    // First set to loading with custom values
    act(() => {
      result.current.setLoading(true, 'Processing...', 'processing');
    });

    expect(result.current.isLoading).toBe(true);

    // Then set to not loading
    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.isLoading).toBe(false);
    // Note: setLoading(false) still sets text and type to defaults
    expect(result.current.loadingText).toBe('Loading...');
    expect(result.current.loadingType).toBe('default');
  });

  it('persists state across multiple hooks (zustand store behavior)', () => {
    const { result: result1 } = renderHook(() => useLoading());
    const { result: result2 } = renderHook(() => useLoading());

    // Update from first hook
    act(() => {
      result1.current.setLoading(true, 'Synced state', 'upload');
    });

    // Both hooks should see the change
    expect(result1.current.isLoading).toBe(true);
    expect(result2.current.isLoading).toBe(true);
    expect(result1.current.loadingText).toBe('Synced state');
    expect(result2.current.loadingText).toBe('Synced state');
    expect(result1.current.loadingType).toBe('upload');
    expect(result2.current.loadingType).toBe('upload');
  });

  it('handles rapid state changes', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.setLoading(true, 'First', 'chat');
      result.current.setLoading(true, 'Second', 'search');
      result.current.setLoading(true, 'Third', 'upload');
    });

    // Should have the last value
    expect(result.current.loadingText).toBe('Third');
    expect(result.current.loadingType).toBe('upload');
  });

  it('handles empty string text', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.setLoading(true, '');
    });

    expect(result.current.loadingText).toBe('');
  });

  it('handles very long loading text', () => {
    const { result } = renderHook(() => useLoading());
    const longText = 'Loading '.repeat(100);

    act(() => {
      result.current.setLoading(true, longText);
    });

    expect(result.current.loadingText).toBe(longText);
  });

  it('returns consistent setLoading function reference', () => {
    const { result, rerender } = renderHook(() => useLoading());
    
    const initialSetLoading = result.current.setLoading;
    
    rerender();
    
    // Zustand should return same function reference
    expect(result.current.setLoading).toBe(initialSetLoading);
  });
});
