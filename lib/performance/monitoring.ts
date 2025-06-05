interface PerformanceMetrics {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private marks = new Map<string, number>();
  private observers: Array<(metrics: PerformanceMetrics) => void> = [];

  // Start timing an operation
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  // End timing and record metric
  measure(name: string, metadata?: Record<string, any>): void {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`No mark found for: ${name}`);
      return;
    }

    const duration = performance.now() - startTime;
    const metric: PerformanceMetrics = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);
    this.marks.delete(name);

    // Notify observers
    this.observers.forEach((observer) => observer(metric));

    // Log slow operations
    if (duration > 1000) {
      console.warn(
        `Slow operation detected: ${name} took ${duration.toFixed(2)}ms`,
        metadata,
      );
    }
  }

  // Time an async function
  async timeAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    this.mark(name);
    try {
      const result = await fn();
      this.measure(name, metadata);
      return result;
    } catch (error) {
      this.measure(name, { ...metadata, error: true });
      throw error;
    }
  }

  // Time a sync function
  timeSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    this.mark(name);
    try {
      const result = fn();
      this.measure(name, metadata);
      return result;
    } catch (error) {
      this.measure(name, { ...metadata, error: true });
      throw error;
    }
  }

  // Get metrics summary
  getSummary(): Record<
    string,
    {
      count: number;
      avgDuration: number;
      minDuration: number;
      maxDuration: number;
      totalDuration: number;
    }
  > {
    const summary: Record<string, any> = {};

    this.metrics.forEach((metric) => {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          totalDuration: 0,
          minDuration: Number.POSITIVE_INFINITY,
          maxDuration: Number.NEGATIVE_INFINITY,
        };
      }

      const stat = summary[metric.name];
      stat.count++;
      stat.totalDuration += metric.duration;
      stat.minDuration = Math.min(stat.minDuration, metric.duration);
      stat.maxDuration = Math.max(stat.maxDuration, metric.duration);
    });

    // Calculate averages
    Object.keys(summary).forEach((key) => {
      const stat = summary[key];
      stat.avgDuration = stat.totalDuration / stat.count;
    });

    return summary;
  }

  // Subscribe to metrics
  subscribe(observer: (metrics: PerformanceMetrics) => void): () => void {
    this.observers.push(observer);
    return () => {
      this.observers = this.observers.filter((obs) => obs !== observer);
    };
  }

  // Clear metrics
  clear(): void {
    this.metrics = [];
    this.marks.clear();
  }

  // Export metrics
  exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  return performanceMonitor;
}

// Web Vitals monitoring
export function initWebVitals() {
  if (typeof window === 'undefined') return;

  // First Contentful Paint (FCP)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        performanceMonitor.metrics.push({
          name: 'web-vitals-fcp',
          duration: entry.startTime,
          timestamp: Date.now(),
          metadata: { type: 'web-vital' },
        });
      }
    }
  }).observe({ entryTypes: ['paint'] });

  // Largest Contentful Paint (LCP)
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    performanceMonitor.metrics.push({
      name: 'web-vitals-lcp',
      duration: lastEntry.startTime,
      timestamp: Date.now(),
      metadata: { type: 'web-vital' },
    });
  }).observe({ entryTypes: ['largest-contentful-paint'] });

  // First Input Delay (FID)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      performanceMonitor.metrics.push({
        name: 'web-vitals-fid',
        duration: entry.processingStart - entry.startTime,
        timestamp: Date.now(),
        metadata: { type: 'web-vital' },
      });
    }
  }).observe({ entryTypes: ['first-input'] });

  // Cumulative Layout Shift (CLS)
  let clsValue = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
        performanceMonitor.metrics.push({
          name: 'web-vitals-cls',
          duration: clsValue,
          timestamp: Date.now(),
          metadata: { type: 'web-vital' },
        });
      }
    }
  }).observe({ entryTypes: ['layout-shift'] });
}

// Memory monitoring
export function monitorMemory() {
  if (typeof window === 'undefined' || !('memory' in performance)) return;

  setInterval(() => {
    const memory = (performance as any).memory;
    performanceMonitor.metrics.push({
      name: 'memory-usage',
      duration: memory.usedJSHeapSize / 1048576, // Convert to MB
      timestamp: Date.now(),
      metadata: {
        totalJSHeapSize: memory.totalJSHeapSize / 1048576,
        jsHeapSizeLimit: memory.jsHeapSizeLimit / 1048576,
      },
    });
  }, 30000); // Every 30 seconds
}
