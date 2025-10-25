/**
 * Main error handler - orchestrates error classification, messaging, and recovery
 */

import { classifyError } from './classifier';
import { generateUserMessage, generateErrorTitle } from './messages';
import { generateRecoveryActions } from './recovery';
import type { ClassifiedError, ErrorHandlerOptions } from './types';

// Import toast on client side only
let toast: any = null;
if (typeof window !== 'undefined') {
  import('../toast-system').then((module) => {
    toast = module.toast;
  });
}

/**
 * Main error handler - handles errors intelligently with toast notifications
 */
export async function handleError(
  error: unknown,
  options: ErrorHandlerOptions = {},
): Promise<ClassifiedError> {
  const {
    context,
    showToast = true,
    allowRetry = true,
    onRetry,
    logToConsole = true,
    customMessage,
    metadata,
  } = options;

  // Classify the error
  const classified = classifyError(error, context);

  // Add metadata if provided
  if (metadata) {
    (classified as any).metadata = metadata;
  }

  // Log to console in development
  if (logToConsole && process.env.NODE_ENV === 'development') {
    console.group(`[Error Handler] ${classified.category.toUpperCase()}`);
    console.error('Classification:', {
      category: classified.category,
      severity: classified.severity,
      isRetryable: classified.isRetryable,
      shouldAutoRetry: classified.shouldAutoRetry,
      context: classified.context,
    });
    console.error('User Message:', classified.userMessage);
    console.error('Original Error:', classified.originalError);
    if (classified.technicalDetails) {
      console.error('Stack:', classified.technicalDetails);
    }
    console.groupEnd();
  }

  // Show toast notification if requested
  if (showToast && typeof window !== 'undefined' && toast) {
    await showErrorToast(
      classified,
      customMessage,
      allowRetry ? onRetry : undefined,
    );
  }

  // Auto-retry for transient errors if retry function provided
  if (classified.shouldAutoRetry && onRetry && allowRetry) {
    const delay = classified.retryDelay || 1000;
    console.log(`[Error Handler] Auto-retrying in ${delay}ms...`);

    setTimeout(async () => {
      try {
        await onRetry();
      } catch (retryError) {
        // Don't auto-retry again, but handle the error
        handleError(retryError, {
          ...options,
          allowRetry: false,
        });
      }
    }, delay);
  }

  return classified;
}

/**
 * Show an error toast with appropriate styling and actions
 */
async function showErrorToast(
  classified: ClassifiedError,
  customMessage?: string,
  onRetry?: () => Promise<void> | void,
): Promise<void> {
  if (!toast) return;

  const message =
    customMessage || generateUserMessage(classified, classified.context);
  const title = generateErrorTitle(classified.category);
  const recoveryActions = generateRecoveryActions(classified, onRetry);

  // Determine toast type based on severity
  const toastType =
    classified.severity === 'critical' || classified.severity === 'error'
      ? 'error'
      : classified.severity === 'warning'
        ? 'warning'
        : 'info';

  // Build toast options
  const toastOptions: any = {
    description: title !== 'Error' ? message : undefined,
    duration:
      classified.severity === 'critical'
        ? Number.POSITIVE_INFINITY
        : classified.severity === 'error'
          ? 6000
          : 4000,
  };

  // Add primary action if available
  const primaryAction = recoveryActions.find((a) => a.isPrimary);
  if (primaryAction) {
    toastOptions.action = {
      label: primaryAction.label,
      onClick: primaryAction.action,
    };
  }

  // Add cancel/dismiss action for critical errors or if there's a secondary action
  const secondaryActions = recoveryActions.filter((a) => !a.isPrimary);
  if (secondaryActions.length > 0 && !primaryAction) {
    toastOptions.action = {
      label: secondaryActions[0].label,
      onClick: secondaryActions[0].action,
    };
  }

  // Show the toast
  if (toastType === 'error') {
    toast.error(
      title !== 'Error' ? `${title}: ${message}` : message,
      toastOptions,
    );
  } else if (toastType === 'warning') {
    toast.warning(
      title !== 'Invalid Input' ? `${title}: ${message}` : message,
      toastOptions,
    );
  } else {
    toast.info(message, toastOptions);
  }
}

/**
 * Handle errors in API routes - returns appropriate Response object
 */
export function createErrorResponse(
  error: unknown,
  context?: string,
): Response {
  const classified = classifyError(error, context);

  // Log server-side errors
  console.error('[API Error]', {
    category: classified.category,
    severity: classified.severity,
    context: classified.context,
    message: classified.message,
  });

  const status = classified.httpStatus || 500;
  const body = {
    error: classified.category,
    message: classified.userMessage,
    details:
      process.env.NODE_ENV === 'development' ? classified.message : undefined,
    isRetryable: classified.isRetryable,
    timestamp: classified.timestamp.toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Client-side smart error handler for fetch requests
 */
export async function handleFetchError(
  response: Response,
  context?: string,
  onRetry?: () => Promise<void> | void,
): Promise<ClassifiedError> {
  let errorData: any = {};

  try {
    errorData = await response.json();
  } catch {
    // If response is not JSON, use status text
    errorData = { message: response.statusText };
  }

  const error = {
    status: response.status,
    message: errorData.message || errorData.error || response.statusText,
    ...errorData,
  };

  return handleError(error, {
    context,
    showToast: true,
    allowRetry: true,
    onRetry,
  });
}

/**
 * Simplified error handler for quick use
 */
export function showError(
  message: string,
  options?: Partial<ErrorHandlerOptions>,
): void {
  handleError(new Error(message), {
    showToast: true,
    logToConsole: true,
    ...options,
  });
}

/**
 * Success handler for consistency
 */
export function showSuccess(message: string, options?: any): void {
  if (typeof window !== 'undefined' && toast) {
    toast.success(message, options);
  }
}

/**
 * Check if an error has already been shown to prevent duplicates
 */
const recentErrors = new Map<string, number>();
const ERROR_DEDUPE_WINDOW = 3000; // 3 seconds

export function shouldShowError(error: unknown, context?: string): boolean {
  const errorKey = `${context || 'global'}-${String(error)}`;
  const lastShown = recentErrors.get(errorKey);
  const now = Date.now();

  if (lastShown && now - lastShown < ERROR_DEDUPE_WINDOW) {
    return false; // Don't show duplicate error
  }

  recentErrors.set(errorKey, now);

  // Clean up old entries
  if (recentErrors.size > 100) {
    const cutoff = now - ERROR_DEDUPE_WINDOW;
    for (const [key, time] of recentErrors.entries()) {
      if (time < cutoff) {
        recentErrors.delete(key);
      }
    }
  }

  return true;
}

/**
 * Handle error with deduplication
 */
export async function handleErrorOnce(
  error: unknown,
  options: ErrorHandlerOptions = {},
): Promise<ClassifiedError> {
  if (!shouldShowError(error, options.context)) {
    // Still classify but don't show toast
    return classifyError(error, options.context);
  }

  return handleError(error, options);
}
