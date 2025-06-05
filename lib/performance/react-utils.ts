import { useCallback, useEffect, useRef } from 'react';

/**
 * Custom hook for debounced callbacks with cleanup
 */
export function useOptimizedDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  dependencies: any[] = [],
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay, ...dependencies],
  ) as T;

  return debouncedCallback;
}

/**
 * Hook for optimized scroll performance
 */
export function useOptimizedScroll(
  callback: (event: Event) => void,
  element?: HTMLElement | null,
) {
  const rafId = useRef<number | null>(null);
  const lastScrollTime = useRef(0);

  useEffect(() => {
    const targetElement = element || window;

    const handleScroll = (event: Event) => {
      const now = Date.now();
      const timeSinceLastScroll = now - lastScrollTime.current;

      // Throttle to 60fps max
      if (timeSinceLastScroll < 16) {
        return;
      }

      lastScrollTime.current = now;

      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        callback(event);
      });
    };

    targetElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      targetElement.removeEventListener('scroll', handleScroll);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [callback, element]);
}

/**
 * Hook for lazy loading components with intersection observer
 */
export function useLazyComponent(threshold = 0.1, rootMargin = '50px') {
  const ref = useRef<HTMLElement | null>(null);
  const isIntersecting = useRef(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!ref.current || hasLoaded.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoaded.current) {
            isIntersecting.current = true;
            hasLoaded.current = true;
            observer.disconnect();
          }
        });
      },
      { threshold, rootMargin },
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { ref, isVisible: isIntersecting.current };
}

/**
 * Batch DOM updates for better performance
 */
export function batchDOMUpdates(updates: (() => void)[]) {
  requestAnimationFrame(() => {
    updates.forEach((update) => update());
  });
}

/**
 * Memoization helper with size limit
 */
export function createMemoizedFunction<T extends (...args: any[]) => any>(
  fn: T,
  maxCacheSize = 100,
): T {
  const cache = new Map<string, any>();

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);

    // Implement LRU cache
    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    cache.set(key, result);
    return result;
  }) as T;
}
