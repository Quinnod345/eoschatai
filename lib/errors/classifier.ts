/**
 * Error classification system - automatically detects and categorizes errors
 */

import type { ErrorCategory, ErrorSeverity, ClassifiedError } from './types';
import { AppError } from './types';

/**
 * Classify an error into a category and severity
 */
export function classifyError(
  error: unknown,
  context?: string,
): ClassifiedError {
  const timestamp = new Date();

  // Handle our custom AppError types
  if (error instanceof AppError) {
    return {
      category: error.category,
      severity: error.severity,
      message: error.message,
      userMessage: error.message,
      technicalDetails: error.stack,
      isRetryable: error.isRetryable,
      shouldAutoRetry: error.isRetryable && error.category === 'network',
      httpStatus: error.httpStatus,
      originalError: error,
      timestamp,
      context,
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Network errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('connection') ||
      errorName.includes('networkerror')
    ) {
      return createClassifiedError(
        'network',
        'error',
        error.message,
        'Network connection issue. Please check your internet connection.',
        error,
        true,
        true,
        503,
        context,
        timestamp,
      );
    }

    // Authentication errors
    if (
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('session expired') ||
      errorMessage.includes('invalid token') ||
      errorMessage.includes('not authenticated') ||
      errorName.includes('autherror')
    ) {
      return createClassifiedError(
        'authentication',
        'error',
        error.message,
        'Authentication required. Please log in again.',
        error,
        false,
        false,
        401,
        context,
        timestamp,
      );
    }

    // Rate limit errors
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('quota exceeded') ||
      errorName.includes('ratelimit')
    ) {
      return createClassifiedError(
        'rate_limit',
        'warning',
        error.message,
        'Rate limit reached. Please wait a moment and try again.',
        error,
        true,
        false,
        429,
        context,
        timestamp,
        5000, // 5 second retry delay
      );
    }

    // Validation errors
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('must be') ||
      errorMessage.includes('missing') ||
      errorName.includes('validationerror')
    ) {
      return createClassifiedError(
        'validation',
        'warning',
        error.message,
        'Please check your input and try again.',
        error,
        false,
        false,
        400,
        context,
        timestamp,
      );
    }

    // Database errors
    if (
      errorMessage.includes('database') ||
      errorMessage.includes('postgres') ||
      errorMessage.includes('sql') ||
      errorMessage.includes('unique constraint') ||
      errorMessage.includes('foreign key') ||
      errorMessage.includes('duplicate key') ||
      errorMessage.includes('deadlock') ||
      errorMessage.includes('connection pool') ||
      errorName.includes('databaseerror')
    ) {
      // Specific handling for constraint violations
      if (
        errorMessage.includes('unique constraint') ||
        errorMessage.includes('duplicate key')
      ) {
        return createClassifiedError(
          'database',
          'warning',
          error.message,
          'This item already exists.',
          error,
          false,
          false,
          409,
          context,
          timestamp,
        );
      }

      // Deadlock - retryable
      if (errorMessage.includes('deadlock')) {
        return createClassifiedError(
          'database',
          'error',
          error.message,
          'A temporary database conflict occurred. Retrying...',
          error,
          true,
          true,
          500,
          context,
          timestamp,
          1000,
        );
      }

      return createClassifiedError(
        'database',
        'error',
        error.message,
        'A database error occurred. Please try again.',
        error,
        true,
        false,
        500,
        context,
        timestamp,
      );
    }

    // AI/Streaming errors
    if (
      errorMessage.includes('openai') ||
      errorMessage.includes('model') ||
      errorMessage.includes('streaming') ||
      errorMessage.includes('ai') ||
      errorMessage.includes('completion')
    ) {
      return createClassifiedError(
        'ai_streaming',
        'error',
        error.message,
        'AI service temporarily unavailable. Please try again.',
        error,
        true,
        false,
        503,
        context,
        timestamp,
      );
    }

    // File operation errors
    if (
      errorMessage.includes('file') ||
      errorMessage.includes('upload') ||
      errorMessage.includes('too large') ||
      errorMessage.includes('unsupported format') ||
      errorMessage.includes('storage')
    ) {
      if (errorMessage.includes('too large')) {
        return createClassifiedError(
          'file_operation',
          'warning',
          error.message,
          'File is too large. Please upload a smaller file.',
          error,
          false,
          false,
          413,
          context,
          timestamp,
        );
      }

      return createClassifiedError(
        'file_operation',
        'error',
        error.message,
        'File operation failed. Please try again.',
        error,
        true,
        false,
        500,
        context,
        timestamp,
      );
    }

    // Permission errors
    if (
      errorMessage.includes('forbidden') ||
      errorMessage.includes('permission') ||
      errorMessage.includes('not allowed') ||
      errorMessage.includes('access denied')
    ) {
      return createClassifiedError(
        'permission',
        'error',
        error.message,
        'You do not have permission to perform this action.',
        error,
        false,
        false,
        403,
        context,
        timestamp,
      );
    }
  }

  // Handle HTTP Response errors
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as any;

    if (errorObj.status || errorObj.statusCode) {
      const status = errorObj.status || errorObj.statusCode;
      return classifyHttpError(status, errorObj, context, timestamp);
    }

    // Handle response objects from fetch
    if (errorObj.ok === false && errorObj.status) {
      return classifyHttpError(errorObj.status, errorObj, context, timestamp);
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return classifyError(new Error(error), context);
  }

  // Unknown error - be safe and assume it might be retryable
  return createClassifiedError(
    'unknown',
    'error',
    String(error),
    'An unexpected error occurred. Please try again.',
    error,
    true,
    false,
    500,
    context,
    timestamp,
  );
}

/**
 * Classify errors based on HTTP status code
 */
function classifyHttpError(
  status: number,
  error: any,
  context?: string,
  timestamp = new Date(),
): ClassifiedError {
  const message = error.message || error.statusText || `HTTP ${status}`;

  switch (status) {
    case 400:
      return createClassifiedError(
        'validation',
        'warning',
        message,
        'Invalid request. Please check your input.',
        error,
        false,
        false,
        400,
        context,
        timestamp,
      );

    case 401:
      return createClassifiedError(
        'authentication',
        'error',
        message,
        'Please log in to continue.',
        error,
        false,
        false,
        401,
        context,
        timestamp,
      );

    case 403:
      return createClassifiedError(
        'permission',
        'error',
        message,
        'You do not have permission to access this resource.',
        error,
        false,
        false,
        403,
        context,
        timestamp,
      );

    case 404:
      return createClassifiedError(
        'business_logic',
        'warning',
        message,
        'The requested resource was not found.',
        error,
        false,
        false,
        404,
        context,
        timestamp,
      );

    case 409:
      return createClassifiedError(
        'business_logic',
        'warning',
        message,
        'This item already exists or conflicts with another item.',
        error,
        false,
        false,
        409,
        context,
        timestamp,
      );

    case 413:
      return createClassifiedError(
        'file_operation',
        'warning',
        message,
        'File is too large.',
        error,
        false,
        false,
        413,
        context,
        timestamp,
      );

    case 429:
      return createClassifiedError(
        'rate_limit',
        'warning',
        message,
        'Too many requests. Please wait a moment.',
        error,
        true,
        false,
        429,
        context,
        timestamp,
        5000,
      );

    case 500:
    case 502:
    case 503:
    case 504:
      return createClassifiedError(
        'network',
        'error',
        message,
        'Server error. Please try again in a moment.',
        error,
        true,
        status === 503 || status === 504, // Auto-retry for service unavailable and gateway timeout
        status,
        context,
        timestamp,
        status === 503 || status === 504 ? 2000 : undefined,
      );

    default:
      return createClassifiedError(
        'unknown',
        'error',
        message,
        'An error occurred. Please try again.',
        error,
        true,
        false,
        status,
        context,
        timestamp,
      );
  }
}

/**
 * Helper to create a ClassifiedError object
 */
function createClassifiedError(
  category: ErrorCategory,
  severity: ErrorSeverity,
  message: string,
  userMessage: string,
  originalError: unknown,
  isRetryable: boolean,
  shouldAutoRetry: boolean,
  httpStatus?: number,
  context?: string,
  timestamp = new Date(),
  retryDelay?: number,
): ClassifiedError {
  return {
    category,
    severity,
    message,
    userMessage,
    technicalDetails:
      originalError instanceof Error ? originalError.stack : undefined,
    isRetryable,
    shouldAutoRetry,
    retryDelay,
    httpStatus,
    originalError,
    timestamp,
    context,
  };
}

/**
 * Check if an error is a specific category
 */
export function isNetworkError(error: unknown): boolean {
  const classified = classifyError(error);
  return classified.category === 'network';
}

export function isAuthError(error: unknown): boolean {
  const classified = classifyError(error);
  return classified.category === 'authentication';
}

export function isValidationError(error: unknown): boolean {
  const classified = classifyError(error);
  return classified.category === 'validation';
}

export function isRetryableError(error: unknown): boolean {
  const classified = classifyError(error);
  return classified.isRetryable;
}
