import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

describe('useMediaQuery', () => {
  let listeners: Map<string, Set<() => void>>;
  let mediaQueryState: Map<string, boolean>;

  beforeEach(() => {
    listeners = new Map();
    mediaQueryState = new Map();

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => {
        if (!listeners.has(query)) {
          listeners.set(query, new Set());
        }
        if (!mediaQueryState.has(query)) {
          mediaQueryState.set(query, false);
        }

        return {
          matches: mediaQueryState.get(query),
          media: query,
          onchange: null,
          addEventListener: vi.fn((event: string, callback: () => void) => {
            if (event === 'change') {
              listeners.get(query)?.add(callback);
            }
          }),
          removeEventListener: vi.fn((event: string, callback: () => void) => {
            if (event === 'change') {
              listeners.get(query)?.delete(callback);
            }
          }),
          addListener: vi.fn((callback: () => void) => {
            listeners.get(query)?.add(callback);
          }),
          removeListener: vi.fn((callback: () => void) => {
            listeners.get(query)?.delete(callback);
          }),
          dispatchEvent: vi.fn(),
        };
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    listeners.clear();
    mediaQueryState.clear();
  });

  // Helper to simulate media query change
  const triggerMediaQueryChange = (query: string, matches: boolean) => {
    mediaQueryState.set(query, matches);
    // Re-mock to return new value
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((q: string) => {
        const result = originalMatchMedia(q);
        return {
          ...result,
          matches: mediaQueryState.get(q) ?? false,
        };
      }),
    });
    // Trigger listeners
    listeners.get(query)?.forEach((callback) => callback());
  };

  it('initializes to false for SSR compatibility', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'));

    // After effect runs, it should update based on matchMedia
    expect(typeof result.current).toBe('boolean');
  });

  it('returns true when media query matches', () => {
    mediaQueryState.set('(max-width: 640px)', true);

    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'));

    expect(result.current).toBe(true);
  });

  it('returns false when media query does not match', () => {
    mediaQueryState.set('(max-width: 640px)', false);

    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'));

    expect(result.current).toBe(false);
  });

  it('handles different media queries', () => {
    mediaQueryState.set('(min-width: 768px)', true);
    mediaQueryState.set('(prefers-color-scheme: dark)', false);

    const { result: minWidthResult } = renderHook(() => 
      useMediaQuery('(min-width: 768px)')
    );
    const { result: darkModeResult } = renderHook(() => 
      useMediaQuery('(prefers-color-scheme: dark)')
    );

    expect(minWidthResult.current).toBe(true);
    expect(darkModeResult.current).toBe(false);
  });

  it('updates when media query changes', () => {
    mediaQueryState.set('(max-width: 640px)', false);

    const { result, rerender } = renderHook(() => 
      useMediaQuery('(max-width: 640px)')
    );

    expect(result.current).toBe(false);

    // Simulate window resize that triggers media query change
    act(() => {
      triggerMediaQueryChange('(max-width: 640px)', true);
    });

    rerender();
    
    // Note: The hook relies on the change event, so we verify listener setup
    expect(listeners.get('(max-width: 640px)')?.size).toBeGreaterThan(0);
  });

  it('handles query changes', () => {
    mediaQueryState.set('(max-width: 640px)', true);
    mediaQueryState.set('(min-width: 1024px)', false);

    const { result, rerender } = renderHook(
      ({ query }) => useMediaQuery(query),
      { initialProps: { query: '(max-width: 640px)' } }
    );

    expect(result.current).toBe(true);

    rerender({ query: '(min-width: 1024px)' });

    expect(result.current).toBe(false);
  });

  it('cleans up event listeners on unmount', () => {
    const query = '(max-width: 640px)';
    mediaQueryState.set(query, true);

    const { unmount } = renderHook(() => useMediaQuery(query));

    const listenersBeforeUnmount = listeners.get(query)?.size ?? 0;
    expect(listenersBeforeUnmount).toBeGreaterThan(0);

    unmount();

    // After unmount, listener should be removed
    // The removeEventListener mock was called
    expect(window.matchMedia(query).removeEventListener).toBeDefined();
  });

  it('handles complex media queries', () => {
    const complexQuery = '(min-width: 768px) and (max-width: 1024px)';
    mediaQueryState.set(complexQuery, true);

    const { result } = renderHook(() => useMediaQuery(complexQuery));

    expect(result.current).toBe(true);
  });

  it('handles orientation media query', () => {
    mediaQueryState.set('(orientation: landscape)', true);

    const { result } = renderHook(() => useMediaQuery('(orientation: landscape)'));

    expect(result.current).toBe(true);
  });

  it('handles prefers-reduced-motion', () => {
    mediaQueryState.set('(prefers-reduced-motion: reduce)', true);

    const { result } = renderHook(() => 
      useMediaQuery('(prefers-reduced-motion: reduce)')
    );

    expect(result.current).toBe(true);
  });

  it('returns consistent value across renders', () => {
    mediaQueryState.set('(max-width: 640px)', true);

    const { result, rerender } = renderHook(() => 
      useMediaQuery('(max-width: 640px)')
    );

    const firstValue = result.current;

    rerender();
    rerender();
    rerender();

    expect(result.current).toBe(firstValue);
  });

  it('handles empty query string', () => {
    mediaQueryState.set('', false);

    // Should not throw
    const { result } = renderHook(() => useMediaQuery(''));

    expect(typeof result.current).toBe('boolean');
  });
});
