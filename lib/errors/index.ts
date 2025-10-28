/**
 * Centralized export for error handling system
 * Import error handling utilities from this file for consistency
 */

// Core error handler
export {
  handleError,
  handleErrorOnce,
  handleFetchError,
  showError,
  showSuccess,
  createErrorResponse,
} from './handler';

// Error classification
export {
  classifyError,
  isNetworkError,
  isAuthError,
  isValidationError,
  isRetryableError,
} from './classifier';

// Error types and classes
export type {
  ErrorCategory,
  ErrorSeverity,
  ClassifiedError,
  ErrorHandlerOptions,
  RecoveryAction,
  ErrorResponse,
} from './types';

export {
  AppError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  DatabaseError,
  RateLimitError,
  PermissionError,
  FileOperationError,
} from './types';

// User-friendly messages
export {
  generateUserMessage,
  generateErrorTitle,
  generateErrorTip,
} from './messages';

// Recovery actions
export {
  generateRecoveryActions,
  shouldShowReportIssue,
  generateReportIssueAction,
  getContextualActionLabel,
} from './recovery';

// API wrapper for route handlers
export {
  withErrorHandler,
  withStreamErrorHandler,
  withErrorLogging,
  handleApiError,
  createApiErrorResponse,
  validateRequestBody,
  requireAuth,
} from './api-wrapper';









