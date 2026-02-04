import { NextResponse } from 'next/server';

/**
 * Standard error codes for API responses
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  FEATURE_LOCKED: 'FEATURE_LOCKED',

  // Validation
  INVALID_REQUEST: 'INVALID_REQUEST',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FIELD: 'INVALID_FIELD',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Rate limiting & quotas
  RATE_LIMITED: 'RATE_LIMITED',
  LIMIT_REACHED: 'LIMIT_REACHED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Organization-specific
  ORG_SEAT_LIMIT: 'ORG_SEAT_LIMIT',
  ORG_ALREADY_MEMBER: 'ORG_ALREADY_MEMBER',
  ORG_OWNER_REQUIRED: 'ORG_OWNER_REQUIRED',

  // Billing-specific
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Standard error response structure
 */
export interface ApiErrorResponse {
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
  requiredPlan?: 'pro' | 'business';
  feature?: string;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  message: string,
  code: ErrorCode,
  status: number,
  details?: Record<string, unknown>,
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    error: message,
    code,
    ...(details && { details }),
  };

  return NextResponse.json(body, { status });
}

/**
 * Common error response helpers
 */
export const ApiErrors = {
  unauthorized: (message = 'Authentication required') =>
    createErrorResponse(message, ErrorCodes.UNAUTHORIZED, 401),

  forbidden: (message = 'Access denied') =>
    createErrorResponse(message, ErrorCodes.FORBIDDEN, 403),

  featureLocked: (
    feature: string,
    requiredPlan: 'pro' | 'business' = 'pro',
    message?: string,
  ) =>
    NextResponse.json(
      {
        error: message || `${feature} is a ${requiredPlan} feature`,
        code: ErrorCodes.FEATURE_LOCKED,
        requiredPlan,
        feature,
      },
      { status: 403 },
    ),

  notFound: (resource: string) =>
    createErrorResponse(`${resource} not found`, ErrorCodes.NOT_FOUND, 404),

  invalidRequest: (message: string, details?: Record<string, unknown>) =>
    createErrorResponse(message, ErrorCodes.INVALID_REQUEST, 400, details),

  missingField: (fieldName: string) =>
    createErrorResponse(
      `${fieldName} is required`,
      ErrorCodes.MISSING_FIELD,
      400,
      { field: fieldName },
    ),

  invalidField: (fieldName: string, reason: string) =>
    createErrorResponse(
      `Invalid ${fieldName}: ${reason}`,
      ErrorCodes.INVALID_FIELD,
      400,
      { field: fieldName, reason },
    ),

  alreadyExists: (resource: string) =>
    createErrorResponse(
      `${resource} already exists`,
      ErrorCodes.ALREADY_EXISTS,
      409,
    ),

  conflict: (message: string) =>
    createErrorResponse(message, ErrorCodes.CONFLICT, 409),

  limitReached: (
    limitName: string,
    limit: number,
    used: number,
    requiredPlan?: 'pro' | 'business',
  ) =>
    NextResponse.json(
      {
        error: `You've reached your ${limitName} limit (${limit})`,
        code: ErrorCodes.LIMIT_REACHED,
        details: { limit, used },
        ...(requiredPlan && { requiredPlan }),
      },
      { status: 403 },
    ),

  rateLimited: (retryAfterSeconds?: number) =>
    NextResponse.json(
      {
        error: 'Too many requests, please try again later',
        code: ErrorCodes.RATE_LIMITED,
        ...(retryAfterSeconds && { details: { retryAfter: retryAfterSeconds } }),
      },
      {
        status: 429,
        headers: retryAfterSeconds
          ? { 'Retry-After': String(retryAfterSeconds) }
          : undefined,
      },
    ),

  internalError: (message = 'An unexpected error occurred') =>
    createErrorResponse(message, ErrorCodes.INTERNAL_ERROR, 500),

  serviceUnavailable: (service: string) =>
    createErrorResponse(
      `${service} is temporarily unavailable`,
      ErrorCodes.SERVICE_UNAVAILABLE,
      503,
    ),

  // Organization-specific errors
  orgSeatLimit: () =>
    createErrorResponse(
      'Organization has reached its seat limit',
      ErrorCodes.ORG_SEAT_LIMIT,
      403,
    ),

  orgAlreadyMember: () =>
    createErrorResponse(
      'You already belong to an organization',
      ErrorCodes.ORG_ALREADY_MEMBER,
      400,
    ),

  orgOwnerRequired: () =>
    createErrorResponse(
      'Only organization owners can perform this action',
      ErrorCodes.ORG_OWNER_REQUIRED,
      403,
    ),
};

/**
 * Wrap an async route handler with error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>,
  context?: string,
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch((error: unknown) => {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${context || 'api'}] Error:`, errorMessage, error);

    // Check for known error patterns
    if (errorMessage.includes('already belong to an organization')) {
      return ApiErrors.orgAlreadyMember();
    }
    if (errorMessage.includes('seat limit')) {
      return ApiErrors.orgSeatLimit();
    }

    return ApiErrors.internalError();
  });
}
