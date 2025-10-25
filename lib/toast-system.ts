import { toast as sonnerToast, type ExternalToast } from 'sonner';
import type { MouseEvent } from 'react';

export interface ToastOptions extends Omit<ExternalToast, 'cancel'> {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  };
}

// Export unified toast API - direct wrapper around sonner
export const toast = {
  success: (message: string, options?: ToastOptions) =>
    sonnerToast.success(message, options),
  error: (message: string, options?: ToastOptions) =>
    sonnerToast.error(message, options),
  info: (message: string, options?: ToastOptions) =>
    sonnerToast.info(message, options),
  warning: (message: string, options?: ToastOptions) =>
    sonnerToast.warning(message, options),
  loading: (message: string, options?: ToastOptions) =>
    sonnerToast.loading(message, options),
  promise: <T>(
    promise: Promise<T>,
    {
      loading: loadingMessage,
      success: successMessage,
      error: errorMessage,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options?: ToastOptions,
  ) =>
    sonnerToast.promise(promise, {
      loading: loadingMessage,
      success: successMessage,
      error: errorMessage,
      ...options,
    }),
  dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  clear: () => sonnerToast.dismiss(),
};

// Utility functions for common use cases
export const toastUtils = {
  // Operation feedback
  operationSuccess: (operation: string) =>
    toast.success(`${operation} completed successfully`),

  operationError: (operation: string, error?: string) =>
    toast.error(
      `Failed to ${operation.toLowerCase()}${error ? `: ${error}` : ''}`,
    ),

  // Network related
  networkError: () =>
    toast.error('Network error. Please check your connection and try again.'),

  // Authentication
  authError: () => toast.error('Authentication required. Please log in.'),

  // Validation
  validationError: (field: string) =>
    toast.error(`Please enter a valid ${field}.`),

  // File operations
  fileSaved: (filename?: string) =>
    toast.success(`File ${filename ? `"${filename}" ` : ''}saved successfully`),

  fileError: (operation: string) =>
    toast.error(`Failed to ${operation} file. Please try again.`),

  // Copy operations
  copySuccess: (item = 'content') =>
    toast.success(`${item} copied to clipboard`),

  copyError: () => toast.error('Failed to copy to clipboard'),
};

/**
 * Smart error toast that adapts based on error type
 * This integrates with the intelligent error handling system
 */
export async function smartError(
  error: unknown,
  options?: {
    context?: string;
    onRetry?: () => Promise<void> | void;
    customMessage?: string;
  },
): Promise<void> {
  // Dynamically import the error handler to avoid circular dependencies
  const { handleError } = await import('./errors/handler');

  await handleError(error, {
    context: options?.context,
    showToast: true,
    allowRetry: !!options?.onRetry,
    onRetry: options?.onRetry,
    customMessage: options?.customMessage,
  });
}

/**
 * Show a retryable error with a retry button
 */
export function retryableError(
  message: string,
  onRetry: () => Promise<void> | void,
  options?: ToastOptions,
): void {
  toast.error(message, {
    ...options,
    action: {
      label: 'Retry',
      onClick: async () => {
        try {
          await onRetry();
        } catch (error) {
          smartError(error, { context: 'Retry operation' });
        }
      },
    },
  });
}

/**
 * Show an error with a custom action
 */
export function errorWithAction(
  message: string,
  actionLabel: string,
  onAction: () => void,
  options?: ToastOptions,
): void {
  toast.error(message, {
    ...options,
    action: {
      label: actionLabel,
      onClick: onAction,
    },
  });
}

/**
 * Extended toast with smart error support
 */
export const toastWithSmart = {
  ...toast,
  smartError,
  retryableError,
  errorWithAction,
};

export default toast;
