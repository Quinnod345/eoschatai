import { toast as sonnerToast, type ExternalToast } from 'sonner';

export interface ToastOptions extends ExternalToast {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick?: () => void;
  };
}

// Enhanced toast queue management
class ToastManager {
  private toastQueue: Array<{
    type: string;
    message: string;
    options?: ToastOptions;
  }> = [];
  private isProcessing = false;
  private activeToasts = new Set<string | number>();
  private maxConcurrentToasts = 3;

  private async processQueue() {
    if (this.isProcessing || this.toastQueue.length === 0) return;
    if (this.activeToasts.size >= this.maxConcurrentToasts) return;

    this.isProcessing = true;
    const { type, message, options } = this.toastQueue.shift()!;

    try {
      let toastId: string | number;

      switch (type) {
        case 'success':
          toastId = sonnerToast.success(message, {
            duration: 4000,
            ...options,
            onDismiss: (t) => {
              this.activeToasts.delete(t);
              options?.onDismiss?.(t);
              this.processQueue();
            },
            onAutoClose: (t) => {
              this.activeToasts.delete(t);
              options?.onAutoClose?.(t);
              this.processQueue();
            },
          });
          break;
        case 'error':
          toastId = sonnerToast.error(message, {
            duration: 6000,
            ...options,
            onDismiss: (t) => {
              this.activeToasts.delete(t);
              options?.onDismiss?.(t);
              this.processQueue();
            },
            onAutoClose: (t) => {
              this.activeToasts.delete(t);
              options?.onAutoClose?.(t);
              this.processQueue();
            },
          });
          break;
        case 'info':
          toastId = sonnerToast.info(message, {
            duration: 4000,
            ...options,
            onDismiss: (t) => {
              this.activeToasts.delete(t);
              options?.onDismiss?.(t);
              this.processQueue();
            },
            onAutoClose: (t) => {
              this.activeToasts.delete(t);
              options?.onAutoClose?.(t);
              this.processQueue();
            },
          });
          break;
        case 'warning':
          toastId = sonnerToast.warning(message, {
            duration: 5000,
            ...options,
            onDismiss: (t) => {
              this.activeToasts.delete(t);
              options?.onDismiss?.(t);
              this.processQueue();
            },
            onAutoClose: (t) => {
              this.activeToasts.delete(t);
              options?.onAutoClose?.(t);
              this.processQueue();
            },
          });
          break;
        case 'loading':
          toastId = sonnerToast.loading(message, {
            duration: Infinity,
            ...options,
          });
          break;
        default:
          toastId = sonnerToast(message, {
            duration: 4000,
            ...options,
            onDismiss: (t) => {
              this.activeToasts.delete(t);
              options?.onDismiss?.(t);
              this.processQueue();
            },
            onAutoClose: (t) => {
              this.activeToasts.delete(t);
              options?.onAutoClose?.(t);
              this.processQueue();
            },
          });
      }

      if (type !== 'loading') {
        this.activeToasts.add(toastId);
      }
    } catch (error) {
      console.error('Toast error:', error);
    } finally {
      this.isProcessing = false;
      // Process next toast after a short delay
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private addToQueue(type: string, message: string, options?: ToastOptions) {
    // Prevent duplicate toasts
    const isDuplicate = this.toastQueue.some(
      (toast) => toast.type === type && toast.message === message,
    );

    if (!isDuplicate) {
      this.toastQueue.push({ type, message, options });
      this.processQueue();
    }
  }

  success(message: string, options?: ToastOptions) {
    this.addToQueue('success', message, options);
  }

  error(message: string, options?: ToastOptions) {
    this.addToQueue('error', message, options);
  }

  info(message: string, options?: ToastOptions) {
    this.addToQueue('info', message, options);
  }

  warning(message: string, options?: ToastOptions) {
    this.addToQueue('warning', message, options);
  }

  loading(message: string, options?: ToastOptions) {
    return sonnerToast.loading(message, options);
  }

  promise<T>(
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
  ) {
    return sonnerToast.promise(
      promise,
      {
        loading: loadingMessage,
        success: successMessage,
        error: errorMessage,
      },
      options,
    );
  }

  dismiss(toastId?: string | number) {
    if (toastId) {
      this.activeToasts.delete(toastId);
      sonnerToast.dismiss(toastId);
    } else {
      this.activeToasts.clear();
      sonnerToast.dismiss();
    }
  }

  // Clear all toasts and queue
  clear() {
    this.toastQueue = [];
    this.activeToasts.clear();
    sonnerToast.dismiss();
  }
}

// Create singleton instance
const toastManager = new ToastManager();

// Export unified toast API
export const toast = {
  success: (message: string, options?: ToastOptions) =>
    toastManager.success(message, options),
  error: (message: string, options?: ToastOptions) =>
    toastManager.error(message, options),
  info: (message: string, options?: ToastOptions) =>
    toastManager.info(message, options),
  warning: (message: string, options?: ToastOptions) =>
    toastManager.warning(message, options),
  loading: (message: string, options?: ToastOptions) =>
    toastManager.loading(message, options),
  promise: toastManager.promise.bind(toastManager),
  dismiss: (toastId?: string | number) => toastManager.dismiss(toastId),
  clear: () => toastManager.clear(),
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
  copySuccess: (item: string = 'content') =>
    toast.success(`${item} copied to clipboard`),

  copyError: () => toast.error('Failed to copy to clipboard'),
};

export default toast;
