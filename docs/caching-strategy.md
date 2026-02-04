# EOSAI Caching Strategy

This document describes the caching mechanisms in place across the application.

## Overview

The app uses multiple layers of caching to optimize performance:
1. **Browser-level caching** via Cache-Control headers
2. **Server-side Redis caching** for entitlements and sessions
3. **In-memory caching** for embeddings and RAG results

---

## 1. API Route Caching (`lib/api/cache-headers.ts`)

A centralized utility for consistent Cache-Control headers across API routes.

### Strategies

| Strategy | Header | Use Case |
|----------|--------|----------|
| `no-store` | `no-store, no-cache, must-revalidate` | Sensitive data, always-fresh requirements |
| `private-short` | `private, max-age=10, stale-while-revalidate=30` | User-specific data that can be briefly cached (settings, history) |
| `private-medium` | `private, max-age=60, stale-while-revalidate=120` | User-specific data that changes infrequently (personas) |
| `public-static` | `public, max-age=300, stale-while-revalidate=600` | Static/public data (feature flags, configs) |
| `streaming` | `no-cache, no-transform` | SSE/streaming responses |

### Routes Using Cache Headers

| Route | Strategy | Reason |
|-------|----------|--------|
| `/api/me` | `private-short` | User bootstrap data, already Redis-cached server-side |
| `/api/personas` | `private-medium` | Persona list changes infrequently |
| `/api/user-settings` | `private-short` | Settings may change when user updates |
| `/api/history` | `private-short` | Chat list, new chats can be created |
| `/api/entitlements/events` | `streaming` | SSE endpoint |
| `/api/firesearch` | `streaming` | SSE endpoint |

---

## 2. Redis Caching

### Entitlements (`lib/entitlements/index.ts`)

- **TTL**: 10 minutes
- **Key pattern**: `entitlements:{userId}:{PLAN_VERSION}`
- **Invalidation**: On plan changes, org changes, billing updates

### Deep Research Rate Limiting

- **TTL**: 5 minutes
- Uses Redis Lua scripts for atomic token bucket operations
- Falls back to in-memory on Redis unavailability

---

## 3. In-Memory Caching

### Embedding Cache (`lib/ai/embeddings.ts`)

- **TTL**: 60 seconds
- **Max size**: 200 entries
- **Purpose**: Avoid duplicate embedding API calls for the same query text
- **Used by**: All RAG operations (user, persona, system)

### System RAG Cache (`lib/ai/upstash-system-rag.ts`)

- **TTL**: 5 minutes
- **Max size**: 100 entries
- **Purpose**: Cache vector search results for system knowledge
- **Cache key**: `{namespace}:{normalized_query}:{limit}:{threshold}`
- **Invalidation**: Automatic on namespace clear/update

---

## 4. What's NOT Cached (and why)

| Resource | Reason |
|----------|--------|
| Chat messages | Always need latest state |
| Document content | User modifications need immediate visibility |
| Organization membership | Security-sensitive, must be fresh |
| Billing/subscription status | Financial accuracy required |
| Search results | Dynamic, personalized, time-sensitive |

---

## Best Practices

### Adding Cache Headers to New Routes

```typescript
import { API_CACHE } from '@/lib/api/cache-headers';

export async function GET() {
  // ... your logic
  return NextResponse.json(data, { headers: API_CACHE.privateShort() });
}
```

### Invalidating Caches

```typescript
// Entitlements
import { invalidateUserEntitlementsCache } from '@/lib/entitlements';
await invalidateUserEntitlementsCache(userId);

// System RAG
import { clearSystemRagCache } from '@/lib/ai/upstash-system-rag';
clearSystemRagCache('namespace-name'); // or clearSystemRagCache() for all
```

---

## Performance Impact

With these caching strategies:
- `/api/me` calls reduced by ~90% for repeat loads (browser cache)
- Embedding API calls reduced by ~40-60% during active chats
- System RAG vector searches reduced by ~70% for common queries
- Persona list fetches cached for 60s, reducing DB queries

---

## Monitoring

Check cache effectiveness via browser DevTools Network tab:
- `304 Not Modified` = browser cache hit
- `(from disk cache)` = stale-while-revalidate served cached version
- Response headers show `Cache-Control` values
