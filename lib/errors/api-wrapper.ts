/**
 * API route error wrapper for consistent error handling across all API routes
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { classifyError } from './classifier';
import type { ErrorResponse } from './types';

type RouteHandler = (
  request: NextRequest,
  context?: any,
) => Promise<Response | NextResponse>;

/**
 * Wrap API route handlers with automatic error handling
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error, request);
    }
  };
}

/**
 * Handle API errors and return appropriate response
 */
export function handleApiError(
  error: unknown,
  request?: NextRequest,
): NextResponse<ErrorResponse> {
  const classified = classifyError(error);

  // Extract request context for logging
  const requestContext = request
    ? {
        method: request.method,
        url: request.url,
        path: new URL(request.url).pathname,
        timestamp: new Date().toISOString(),
      }
    : {};

  // Log error with context
  console.error('[API Error]', {
    ...requestContext,
    category: classified.category,
    severity: classified.severity,
    message: classified.message,
    userMessage: classified.userMessage,
    isRetryable: classified.isRetryable,
  });

  // Log stack trace in development
  if (process.env.NODE_ENV === 'development' && classified.technicalDetails) {
    console.error('Stack trace:', classified.technicalDetails);
  }

  // Build error response
  const status = classified.httpStatus || 500;
  const errorResponse: ErrorResponse = {
    error: classified.category,
    message: classified.userMessage,
    details:
      process.env.NODE_ENV === 'development' ? classified.message : undefined,
    category: classified.category,
    isRetryable: classified.isRetryable,
    timestamp: classified.timestamp.toISOString(),
  };

  // Add retry-after header for rate limit errors
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (classified.category === 'rate_limit' && classified.retryDelay) {
    headers['Retry-After'] = String(Math.ceil(classified.retryDelay / 1000));
  }

  return NextResponse.json(errorResponse, {
    status,
    headers,
  });
}

/**
 * Create a standardized error response
 */
export function createApiErrorResponse(
  message: string,
  status = 500,
  category?: string,
): NextResponse<ErrorResponse> {
  const errorResponse: ErrorResponse = {
    error: category || 'error',
    message,
    timestamp: new Date().toISOString(),
    isRetryable: status >= 500,
  };

  return NextResponse.json(errorResponse, {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Wrap streaming API route handlers with error handling
 */
export function withStreamErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    try {
      const response = await handler(request, context);

      // If the response is a streaming response, wrap the stream with error handling
      if (
        response.headers.get('Content-Type')?.includes('text/event-stream') ||
        response.headers.get('Content-Type')?.includes('text/plain')
      ) {
        return wrapStreamWithErrorHandler(response, request);
      }

      return response;
    } catch (error) {
      return handleApiError(error, request);
    }
  };
}

/**
 * Wrap a streaming response with error handling
 */
function wrapStreamWithErrorHandler(
  response: Response,
  request: NextRequest,
): Response {
  if (!response.body) return response;

  const reader = response.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            controller.close();
            break;
          }

          controller.enqueue(value);
        }
      } catch (error) {
        console.error('[Stream Error]', {
          path: new URL(request.url).pathname,
          error: error instanceof Error ? error.message : String(error),
        });

        // Send error message through stream
        const classified = classifyError(error);
        const errorMessage = encoder.encode(
          `event: error\ndata: ${JSON.stringify({
            error: classified.category,
            message: classified.userMessage,
          })}\n\n`,
        );
        controller.enqueue(errorMessage);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: response.headers,
  });
}

/**
 * Helper to validate request body and handle validation errors
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  validator: (body: any) => T,
): Promise<T> {
  try {
    const body = await request.json();
    return validator(body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON in request body');
    }
    throw error;
  }
}

/**
 * Helper to check authentication and return user
 */
export async function requireAuth(request: NextRequest): Promise<any> {
  // Import auth here to avoid circular dependencies
  const { auth } = await import('@/app/(auth)/auth');
  const session = await auth();

  if (!session?.user) {
    throw new Error('Authentication required');
  }

  return session.user;
}

/**
 * Middleware-style error catcher for route groups
 */
export function withErrorLogging(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    const startTime = Date.now();

    try {
      const response = await handler(request, context);
      const duration = Date.now() - startTime;

      // Log successful requests in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[API Success]', {
          method: request.method,
          path: new URL(request.url).pathname,
          status: response.status,
          duration: `${duration}ms`,
        });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error('[API Error]', {
        method: request.method,
        path: new URL(request.url).pathname,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  };
}
