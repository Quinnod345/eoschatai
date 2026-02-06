/**
 * Standardized API Error Response Utilities
 * 
 * Provides consistent error response format across all API routes.
 * 
 * Standard format: { error: string, code?: string, details?: string }
 * - error: Human-readable error message
 * - code: Machine-readable error code for client handling
 * - details: Additional context (only in development)
 */

import { NextResponse } from 'next/server';

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: string;
}

/**
 * Standard error codes for internal API routes
 */
export const ErrorCodes = {
  // Auth errors (401)
  UNAUTHORIZED: 'unauthorized',
  SESSION_EXPIRED: 'session_expired',
  INVALID_TOKEN: 'invalid_token',
  
  // Permission errors (403)
  FORBIDDEN: 'forbidden',
  INSUFFICIENT_PERMISSIONS: 'insufficient_permissions',
  PLAN_REQUIRED: 'plan_required',
  ENTITLEMENT_BLOCKED: 'entitlement_blocked',
  
  // Validation errors (400)
  INVALID_REQUEST: 'invalid_request',
  INVALID_JSON: 'invalid_json',
  MISSING_FIELD: 'missing_field',
  INVALID_FIELD: 'invalid_field',
  VALIDATION_FAILED: 'validation_failed',
  
  // Not found errors (404)
  NOT_FOUND: 'not_found',
  RESOURCE_NOT_FOUND: 'resource_not_found',
  
  // Conflict errors (409)
  CONFLICT: 'conflict',
  ALREADY_EXISTS: 'already_exists',
  
  // Rate limit errors (429)
  RATE_LIMITED: 'rate_limited',
  DAILY_LIMIT_REACHED: 'daily_limit_reached',
  
  // Server errors (500)
  INTERNAL_ERROR: 'internal_error',
  DATABASE_ERROR: 'database_error',
  EXTERNAL_SERVICE_ERROR: 'external_service_error',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Create a standardized API error response
 * 
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param code - Machine-readable error code
 * @param details - Additional details (only included in development)
 */
export function apiErrorResponse(
  message: string,
  status: number,
  code?: ErrorCode | string,
  details?: string
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    error: message,
  };

  if (code) {
    response.code = code;
  }

  // Only include details in development to avoid leaking sensitive info
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Common error response helpers
 */
export const ApiErrors = {
  /** 401 - User not authenticated */
  unauthorized: (message = 'Unauthorized') => 
    apiErrorResponse(message, 401, ErrorCodes.UNAUTHORIZED),

  /** 403 - User lacks permission */
  forbidden: (message = 'Forbidden') => 
    apiErrorResponse(message, 403, ErrorCodes.FORBIDDEN),

  /** 403 - Feature requires specific plan */
  planRequired: (feature: string, requiredPlan: string) =>
    apiErrorResponse(
      `${feature} is only available on ${requiredPlan} plan`,
      403,
      ErrorCodes.PLAN_REQUIRED
    ),

  /** 400 - Invalid request body */
  invalidRequest: (message = 'Invalid request', details?: string) =>
    apiErrorResponse(message, 400, ErrorCodes.INVALID_REQUEST, details),

  /** 400 - Invalid JSON in request body */
  invalidJson: () =>
    apiErrorResponse('Invalid JSON in request body', 400, ErrorCodes.INVALID_JSON),

  /** 400 - Missing required field */
  missingField: (field: string) =>
    apiErrorResponse(`Missing required field: ${field}`, 400, ErrorCodes.MISSING_FIELD),

  /** 400 - Invalid field value */
  invalidField: (field: string, message?: string) =>
    apiErrorResponse(
      message || `Invalid value for field: ${field}`,
      400,
      ErrorCodes.INVALID_FIELD
    ),

  /** 400 - Validation failed */
  validationFailed: (message: string) =>
    apiErrorResponse(message, 400, ErrorCodes.VALIDATION_FAILED),

  /** 404 - Resource not found */
  notFound: (resource = 'Resource') =>
    apiErrorResponse(`${resource} not found`, 404, ErrorCodes.NOT_FOUND),

  /** 409 - Resource already exists */
  alreadyExists: (resource = 'Resource') =>
    apiErrorResponse(`${resource} already exists`, 409, ErrorCodes.ALREADY_EXISTS),

  /** 429 - Rate limit exceeded */
  rateLimited: (message = 'Rate limit exceeded', retryAfter?: number) => {
    const response = apiErrorResponse(message, 429, ErrorCodes.RATE_LIMITED);
    if (retryAfter) {
      response.headers.set('Retry-After', String(retryAfter));
    }
    return response;
  },

  /** 429 - Daily limit reached */
  dailyLimitReached: (limit: number, used: number) =>
    apiErrorResponse(
      `Daily limit reached. Used ${used} of ${limit} allowed.`,
      429,
      ErrorCodes.DAILY_LIMIT_REACHED
    ),

  /** 500 - Internal server error */
  internalError: (message = 'An internal error occurred', details?: string) =>
    apiErrorResponse(message, 500, ErrorCodes.INTERNAL_ERROR, details),

  /** 500 - Database error */
  databaseError: (details?: string) =>
    apiErrorResponse('A database error occurred', 500, ErrorCodes.DATABASE_ERROR, details),

  /** 500 - External service error */
  externalServiceError: (service: string, details?: string) =>
    apiErrorResponse(
      `Failed to communicate with ${service}`,
      500,
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      details
    ),
};

/**
 * Safe error logging - logs error without exposing sensitive data
 */
export function logApiError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[${context}] Error:`, {
    message: errorMessage,
    ...(process.env.NODE_ENV === 'development' && errorStack ? { stack: errorStack } : {}),
    ...additionalInfo,
  });
}

/**
 * Parse JSON body with error handling
 */
export async function parseJsonBody<T>(request: Request): Promise<{ data: T } | { error: NextResponse<ApiErrorResponse> }> {
  try {
    const data = await request.json() as T;
    return { data };
  } catch {
    return { error: ApiErrors.invalidJson() };
  }
}
