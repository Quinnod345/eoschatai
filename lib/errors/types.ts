/**
 * Error type definitions and interfaces for intelligent error handling
 */

export type ErrorCategory =
  | 'network'
  | 'authentication'
  | 'validation'
  | 'database'
  | 'ai_streaming'
  | 'file_operation'
  | 'permission'
  | 'business_logic'
  | 'rate_limit'
  | 'unknown';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ClassifiedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  technicalDetails?: string;
  isRetryable: boolean;
  shouldAutoRetry: boolean;
  retryDelay?: number;
  httpStatus?: number;
  originalError: unknown;
  timestamp: Date;
  context?: string;
}

export interface ErrorHandlerOptions {
  context?: string;
  showToast?: boolean;
  allowRetry?: boolean;
  onRetry?: () => Promise<void> | void;
  logToConsole?: boolean;
  logToServer?: boolean;
  customMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  isPrimary?: boolean;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: string;
  category?: ErrorCategory;
  isRetryable?: boolean;
  timestamp?: string;
  requestId?: string;
}

/**
 * Custom error classes for specific scenarios
 */
export class AppError extends Error {
  category: ErrorCategory;
  severity: ErrorSeverity;
  isRetryable: boolean;
  httpStatus?: number;
  metadata?: Record<string, unknown>;

  constructor(
    message: string,
    category: ErrorCategory = 'unknown',
    severity: ErrorSeverity = 'error',
    isRetryable = false,
    httpStatus?: number,
  ) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.severity = severity;
    this.isRetryable = isRetryable;
    this.httpStatus = httpStatus;
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network error occurred', isRetryable = true) {
    super(message, 'network', 'error', isRetryable, 503);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', isRetryable = false) {
    super(message, 'authentication', 'error', isRetryable, 401);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', isRetryable = false) {
    super(message, 'validation', 'warning', isRetryable, 400);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database error occurred', isRetryable = true) {
    super(message, 'database', 'error', isRetryable, 500);
    this.name = 'DatabaseError';
  }
}

export class RateLimitError extends AppError {
  constructor(
    message = 'Rate limit exceeded',
    retryAfter?: number,
    isRetryable = true,
  ) {
    super(message, 'rate_limit', 'warning', isRetryable, 429);
    this.name = 'RateLimitError';
    if (retryAfter) {
      this.metadata = { retryAfter };
    }
  }
}

export class PermissionError extends AppError {
  constructor(message = 'Permission denied', isRetryable = false) {
    super(message, 'permission', 'error', isRetryable, 403);
    this.name = 'PermissionError';
  }
}

export class FileOperationError extends AppError {
  constructor(message = 'File operation failed', isRetryable = false) {
    super(message, 'file_operation', 'error', isRetryable, 400);
    this.name = 'FileOperationError';
  }
}









