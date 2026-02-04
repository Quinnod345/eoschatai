/**
 * Cache header utilities for API routes
 * 
 * Guidelines:
 * - Dynamic/user-specific data: private, short TTL with stale-while-revalidate
 * - Static/public data: public, longer TTL
 * - Always-fresh data: no-store
 * - SSE/streaming: no-cache, no-transform
 */

export type CacheStrategy =
  | 'no-store'           // Never cache (sensitive data, always fresh)
  | 'private-short'      // User-specific, short cache (entitlements, settings)
  | 'private-medium'     // User-specific, medium cache (personas, documents list)
  | 'public-static'      // Public data, long cache (feature flags, static config)
  | 'streaming';         // SSE/streaming responses

const CACHE_HEADERS: Record<CacheStrategy, string> = {
  'no-store': 'no-store, no-cache, must-revalidate',
  'private-short': 'private, max-age=10, stale-while-revalidate=30',
  'private-medium': 'private, max-age=60, stale-while-revalidate=120',
  'public-static': 'public, max-age=300, stale-while-revalidate=600',
  'streaming': 'no-cache, no-transform',
};

/**
 * Get Cache-Control header value for a given strategy
 */
export function getCacheControl(strategy: CacheStrategy): string {
  return CACHE_HEADERS[strategy];
}

/**
 * Create headers object with Cache-Control for NextResponse
 */
export function withCacheHeaders(
  strategy: CacheStrategy,
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  return {
    'Cache-Control': getCacheControl(strategy),
    ...additionalHeaders,
  };
}

/**
 * Standard cache headers for JSON API responses
 */
export const API_CACHE = {
  /** For sensitive or rapidly changing data */
  noStore: () => withCacheHeaders('no-store'),
  
  /** For user-specific data that can be briefly cached (10s + 30s stale) */
  privateShort: () => withCacheHeaders('private-short'),
  
  /** For user-specific data that changes less often (60s + 120s stale) */
  privateMedium: () => withCacheHeaders('private-medium'),
  
  /** For public/static data (5min + 10min stale) */
  publicStatic: () => withCacheHeaders('public-static'),
  
  /** For streaming/SSE responses */
  streaming: () => withCacheHeaders('streaming'),
} as const;
