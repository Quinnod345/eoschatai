/**
 * API Middleware
 *
 * Middleware functions for the public EOSAI API including
 * authentication, rate limiting, and request validation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, checkRateLimit } from './keys';
import type { ApiKey, User, Org } from '@/lib/db/schema';

export interface ApiContext {
  apiKey: ApiKey;
  user?: User;
  org?: Org;
  rateLimit: {
    remainingRpm: number;
    remainingRpd: number;
    resetAtRpm: Date;
    resetAtRpd: Date;
  };
}

/**
 * Extract API key from request headers
 * Supports both "Authorization: Bearer <key>" and "X-API-Key: <key>" formats
 */
export function extractApiKey(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = request.headers.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Create a JSON error response with proper headers
 */
export function apiError(
  message: string,
  code: string,
  status: number,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
        type: 'api_error',
        code,
      },
    },
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}

/**
 * Validate API request and return context
 * Returns either the context or an error response
 */
export async function validateApiRequest(
  request: NextRequest,
  requiredScopes: string[] = []
): Promise<{ context: ApiContext } | { error: NextResponse }> {
  // Extract API key
  const rawKey = extractApiKey(request);
  if (!rawKey) {
    return {
      error: apiError(
        'Missing API key. Include it in the Authorization header as "Bearer <key>" or in the X-API-Key header.',
        'missing_api_key',
        401
      ),
    };
  }

  // Validate the key
  const validation = await validateApiKey(rawKey);
  if (!validation.valid || !validation.apiKey) {
    return {
      error: apiError(
        validation.error || 'Invalid API key',
        'invalid_api_key',
        401
      ),
    };
  }

  const { apiKey, user, org } = validation;

  // Check scopes
  const keyScopes = (apiKey.scopes as string[]) || [];
  const missingScopes = requiredScopes.filter((s) => !keyScopes.includes(s));
  if (missingScopes.length > 0) {
    return {
      error: apiError(
        `API key is missing required scopes: ${missingScopes.join(', ')}`,
        'insufficient_scope',
        403
      ),
    };
  }

  // Check rate limits
  const rateLimit = await checkRateLimit(
    apiKey.id,
    apiKey.rateLimitRpm,
    apiKey.rateLimitRpd
  );

  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil(
      (rateLimit.resetAtRpm.getTime() - Date.now()) / 1000
    );

    return {
      error: apiError(
        'Rate limit exceeded. Please slow down your requests.',
        'rate_limit_exceeded',
        429,
        {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit-RPM': String(apiKey.rateLimitRpm),
          'X-RateLimit-Remaining-RPM': String(rateLimit.remainingRpm),
          'X-RateLimit-Reset-RPM': rateLimit.resetAtRpm.toISOString(),
          'X-RateLimit-Limit-RPD': String(apiKey.rateLimitRpd),
          'X-RateLimit-Remaining-RPD': String(rateLimit.remainingRpd),
          'X-RateLimit-Reset-RPD': rateLimit.resetAtRpd.toISOString(),
        }
      ),
    };
  }

  return {
    context: {
      apiKey,
      user,
      org,
      rateLimit,
    },
  };
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  context: ApiContext
): NextResponse {
  response.headers.set(
    'X-RateLimit-Limit-RPM',
    String(context.apiKey.rateLimitRpm)
  );
  response.headers.set(
    'X-RateLimit-Remaining-RPM',
    String(context.rateLimit.remainingRpm - 1)
  );
  response.headers.set(
    'X-RateLimit-Reset-RPM',
    context.rateLimit.resetAtRpm.toISOString()
  );
  response.headers.set(
    'X-RateLimit-Limit-RPD',
    String(context.apiKey.rateLimitRpd)
  );
  response.headers.set(
    'X-RateLimit-Remaining-RPD',
    String(context.rateLimit.remainingRpd - 1)
  );
  response.headers.set(
    'X-RateLimit-Reset-RPD',
    context.rateLimit.resetAtRpd.toISOString()
  );

  return response;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `eosai-${timestamp}-${randomPart}`;
}

/**
 * OpenAI-compatible error response format
 */
export function openaiError(
  message: string,
  type: string,
  code: string | null,
  param: string | null,
  status: number
): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
        type,
        param,
        code,
      },
    },
    { status }
  );
}
