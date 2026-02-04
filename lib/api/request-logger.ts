/**
 * Request Logging Utility
 *
 * Provides request logging instrumentation for API routes.
 * Logs request start, completion, and errors with correlation IDs.
 */

import { NextRequest } from 'next/server';
import { requestLogger } from '@/lib/logger';
import { generateRequestId } from './middleware';

interface RequestLogContext {
  method: string;
  path: string;
  userAgent?: string;
  ip?: string;
  contentLength?: number;
}

interface ResponseLogContext {
  statusCode: number;
  durationMs: number;
  contentLength?: number;
}

/**
 * Extract safe request metadata for logging
 * Automatically excludes sensitive headers
 */
function extractRequestContext(request: NextRequest): RequestLogContext {
  const url = new URL(request.url);

  return {
    method: request.method,
    path: url.pathname,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        undefined,
    contentLength: request.headers.get('content-length')
      ? parseInt(request.headers.get('content-length')!, 10)
      : undefined,
  };
}

/**
 * Create a request instrumentation wrapper
 *
 * Usage:
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const { log, requestId, finish } = instrumentRequest(request);
 *
 *   try {
 *     log.info('Processing request');
 *     // ... your logic ...
 *     const response = NextResponse.json(data);
 *     return finish(response, 200);
 *   } catch (error) {
 *     log.error('Request failed', { error: error.message });
 *     return finish(NextResponse.json({ error: 'Failed' }, { status: 500 }), 500);
 *   }
 * }
 * ```
 */
export function instrumentRequest(request: NextRequest, customRequestId?: string) {
  const requestId = customRequestId || generateRequestId();
  const startTime = Date.now();
  const requestContext = extractRequestContext(request);
  const log = requestLogger(requestId, { endpoint: requestContext.path });

  // Log request start
  log.info('Request started', {
    method: requestContext.method,
    path: requestContext.path,
    userAgent: requestContext.userAgent,
    ip: requestContext.ip,
  });

  /**
   * Finish the request and log completion
   */
  function finish<T>(response: T, statusCode: number, extraContext?: Record<string, unknown>): T {
    const durationMs = Date.now() - startTime;
    const responseContext: ResponseLogContext = {
      statusCode,
      durationMs,
    };

    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = statusCode >= 400 ? 'Request failed' : 'Request completed';

    log[level](message, { ...responseContext, ...extraContext });

    return response;
  }

  return {
    log,
    requestId,
    startTime,
    finish,
    context: requestContext,
  };
}

/**
 * Simple request logging for routes that don't need full instrumentation
 */
export function logRequest(
  request: NextRequest,
  requestId?: string,
  extra?: Record<string, unknown>
) {
  const id = requestId || generateRequestId();
  const ctx = extractRequestContext(request);
  const log = requestLogger(id);

  log.info('Request', { ...ctx, ...extra });

  return { log, requestId: id };
}

/**
 * Log an API error with context
 */
export function logApiError(
  requestId: string,
  error: Error | unknown,
  context?: Record<string, unknown>
) {
  const log = requestLogger(requestId);
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  log.error('API Error', {
    error: errorMessage,
    ...(errorStack && { stack: errorStack }),
    ...context,
  });
}
