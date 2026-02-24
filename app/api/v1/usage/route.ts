/**
 * EOSAI Public API - Usage
 *
 * Check API key usage and rate limit status.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  validateApiRequest,
  addRateLimitHeaders,
  generateRequestId,
} from '@/lib/api/middleware';
import { logApiKeyUsage, getApiKeyUsageStats } from '@/lib/api/keys';

/**
 * GET /api/v1/usage
 * Get usage statistics for the current API key
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Validate API key
  const validation = await validateApiRequest(request, []);
  if ('error' in validation) {
    return validation.error;
  }
  const context = validation.context;

  // Get query parameters
  const url = new URL(request.url);
  const days = Number.parseInt(url.searchParams.get('days') || '30', 10);
  const clampedDays = Math.min(Math.max(days, 1), 90); // 1-90 days

  // Get usage stats
  const stats = await getApiKeyUsageStats(context.apiKey.id, clampedDays);

  // Log this request
  await logApiKeyUsage({
    apiKeyId: context.apiKey.id,
    endpoint: '/v1/usage',
    method: 'GET',
    statusCode: 200,
    responseTimeMs: Date.now() - startTime,
  });

  // Build response
  const responseBody = {
    object: 'usage',
    api_key: {
      id: context.apiKey.id,
      name: context.apiKey.name,
      prefix: context.apiKey.keyPrefix,
      created_at: context.apiKey.createdAt?.toISOString(),
      expires_at: context.apiKey.expiresAt?.toISOString() || null,
      is_active: context.apiKey.isActive,
      scopes: context.apiKey.scopes,
    },
    rate_limits: {
      requests_per_minute: context.apiKey.rateLimitRpm,
      requests_per_day: context.apiKey.rateLimitRpd,
      remaining_rpm: context.rateLimit.remainingRpm - 1,
      remaining_rpd: context.rateLimit.remainingRpd - 1,
      reset_rpm: context.rateLimit.resetAtRpm.toISOString(),
      reset_rpd: context.rateLimit.resetAtRpd.toISOString(),
    },
    usage: {
      period_days: clampedDays,
      total_requests: stats.totalRequests,
      total_tokens: stats.totalTokens,
      average_response_time_ms: stats.averageResponseTime,
      error_rate: stats.errorRate,
      lifetime_requests: context.apiKey.usageCount,
      lifetime_tokens: context.apiKey.usageTokens,
    },
    usage_by_day: stats.requestsByDay,
    usage_by_endpoint: stats.requestsByEndpoint,
  };

  const response = NextResponse.json(responseBody, {
    headers: {
      'X-Request-ID': requestId,
    },
  });

  return addRateLimitHeaders(response, context);
}

/**
 * OPTIONS /api/v1/usage
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
