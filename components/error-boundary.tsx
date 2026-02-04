'use client';

/**
 * Enhanced error boundary component with smart error handling
 * Includes Sentry integration, specialized fallbacks, and recovery mechanisms
 */

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, WifiOff, Database, Loader2 } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

export type ErrorBoundaryVariant = 'default' | 'inline' | 'card' | 'minimal';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  context?: string;
  /** Visual variant for the fallback UI */
  variant?: ErrorBoundaryVariant;
  /** Whether to show a retry button */
  showRetry?: boolean;
  /** Custom retry action */
  onRetry?: () => void;
  /** Whether to log to Sentry */
  logToSentry?: boolean;
  /** Component to show while retrying */
  retryingFallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
  isRetrying: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { onError, context, logToSentry = true } = this.props;

    // Increment error count to detect error loops
    this.setState((prev) => ({
      errorCount: prev.errorCount + 1,
    }));

    // Log error with context
    console.error(`[Error Boundary${context ? ` - ${context}` : ''}]`, {
      error: error.message,
      componentStack: errorInfo.componentStack,
      errorCount: this.state.errorCount + 1,
    });

    // Log to Sentry if enabled
    if (logToSentry) {
      try {
        Sentry.captureException(error, {
          tags: {
            errorBoundary: true,
            context: context || 'unknown',
          },
          extra: {
            componentStack: errorInfo.componentStack,
            errorCount: this.state.errorCount + 1,
          },
        });
      } catch (sentryError) {
        console.error('[Error Boundary] Failed to log to Sentry:', sentryError);
      }
    }

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Show toast notification (client-side only)
    if (typeof window !== 'undefined') {
      this.showErrorToast(error);
    }

    // If we're in an error loop (3+ errors in quick succession), reload the page
    if (this.state.errorCount >= 2) {
      console.error(
        '[Error Boundary] Error loop detected, reloading page in 2 seconds...',
      );
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }

  async showErrorToast(error: Error) {
    try {
      const { smartError } = await import('@/lib/toast-system');
      await smartError(error, {
        context: this.props.context || 'Application error',
      });
    } catch (toastError) {
      // Fallback if toast system fails
      console.error('[Error Boundary] Could not show toast:', toastError);
    }
  }

  reset = async () => {
    const { onRetry } = this.props;

    // Show retrying state if there's a custom retry action
    if (onRetry) {
      this.setState({ isRetrying: true });
      try {
        await onRetry();
      } catch (e) {
        console.error('[Error Boundary] Retry failed:', e);
      }
    }

    this.setState({
      hasError: false,
      error: null,
      isRetrying: false,
    });

    // Reset error count after successful reset
    setTimeout(() => {
      this.setState({ errorCount: 0 });
    }, 5000);
  };

  render() {
    const { hasError, error, errorCount, isRetrying } = this.state;
    const { children, fallback, context, variant = 'default', showRetry = true, retryingFallback } = this.props;

    // Show retrying fallback if provided
    if (isRetrying && retryingFallback) {
      return retryingFallback;
    }

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.reset);
      }

      // Check for error loop
      if (errorCount >= 3) {
        return <ErrorLoopFallback error={error} context={context} />;
      }

      // Render based on variant
      switch (variant) {
        case 'inline':
          return (
            <InlineErrorFallback
              error={error}
              reset={this.reset}
              context={context}
              showRetry={showRetry}
            />
          );
        case 'card':
          return (
            <CardErrorFallback
              error={error}
              reset={this.reset}
              context={context}
              showRetry={showRetry}
            />
          );
        case 'minimal':
          return (
            <MinimalErrorFallback
              error={error}
              reset={this.reset}
              showRetry={showRetry}
            />
          );
        default:
          return (
            <DefaultErrorFallback
              error={error}
              reset={this.reset}
              context={context}
              showRetry={showRetry}
            />
          );
      }
    }

    return children;
  }
}

/**
 * Default error fallback UI - Full page style
 */
function DefaultErrorFallback({
  error,
  reset,
  context,
  showRetry = true,
}: {
  error: Error;
  reset: () => void;
  context?: string;
  showRetry?: boolean;
}) {
  const errorInfo = getErrorInfo(error);
  
  return (
    <div className="flex min-h-[400px] w-full items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          {errorInfo.icon}
        </div>
        
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-foreground">
            {context ? `${context} Error` : errorInfo.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {errorInfo.message}
          </p>
        </div>

        <div className="flex gap-2">
          {showRetry && (
            <Button onClick={reset} variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
          )}
          <Button
            onClick={() => {
              window.location.href = '/chat';
            }}
            variant="outline"
          >
            Go to dashboard
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left w-full">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Error details (dev only)
            </summary>
            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
              {error.stack || error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Inline error fallback - For use within content areas
 */
function InlineErrorFallback({
  error,
  reset,
  context,
  showRetry = true,
}: {
  error: Error;
  reset: () => void;
  context?: string;
  showRetry?: boolean;
}) {
  const errorInfo = getErrorInfo(error);
  
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
      <div className="flex-shrink-0 text-destructive">
        {errorInfo.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {context ? `${context}: ` : ''}{errorInfo.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {errorInfo.message}
        </p>
      </div>
      {showRetry && (
        <Button onClick={reset} variant="ghost" size="sm" className="flex-shrink-0">
          <RefreshCw className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * Card error fallback - For cards and panels
 */
function CardErrorFallback({
  error,
  reset,
  context,
  showRetry = true,
}: {
  error: Error;
  reset: () => void;
  context?: string;
  showRetry?: boolean;
}) {
  const errorInfo = getErrorInfo(error);
  
  return (
    <div className="flex flex-col items-center justify-center p-6 rounded-lg border bg-card text-card-foreground shadow-sm min-h-[200px]">
      <div className="mx-auto w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
        {errorInfo.icon}
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">
        {context || errorInfo.title}
      </h3>
      <p className="text-xs text-muted-foreground text-center mb-4 max-w-[200px]">
        {errorInfo.message}
      </p>
      {showRetry && (
        <Button onClick={reset} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-3 h-3" />
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Minimal error fallback - For tight spaces
 */
function MinimalErrorFallback({
  error,
  reset,
  showRetry = true,
}: {
  error: Error;
  reset: () => void;
  showRetry?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-destructive text-sm p-2">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">Failed to load</span>
      {showRetry && (
        <button 
          onClick={reset} 
          className="text-xs underline hover:no-underline flex-shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Error loop fallback UI
 */
function ErrorLoopFallback({
  error,
  context,
}: {
  error: Error;
  context?: string;
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 bg-background">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-destructive">
            Critical Error
          </h2>
          <p className="text-sm text-muted-foreground">
            {context
              ? `${context} encountered repeated errors.`
              : 'The application encountered repeated errors.'}{' '}
            The page will reload automatically.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()} variant="default" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Reload now
          </Button>
          <Button
            onClick={() => {
              window.location.href = '/';
            }}
            variant="outline"
          >
            Go home
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left w-full">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Error details (dev only)
            </summary>
            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
              {error.stack || error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Get structured error info based on error type
 */
interface ErrorInfo {
  title: string;
  message: string;
  icon: ReactNode;
  isRetryable: boolean;
}

function getErrorInfo(error: Error): ErrorInfo {
  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return {
      title: 'Connection Error',
      message: 'Please check your internet connection and try again.',
      icon: <WifiOff className="w-6 h-6 text-destructive" />,
      isRetryable: true,
    };
  }

  // Chunk loading errors (dynamic imports)
  if (message.includes('chunk') || message.includes('loading chunk') || message.includes('load')) {
    return {
      title: 'Loading Error',
      message: 'Failed to load this component. Please refresh the page.',
      icon: <Loader2 className="w-6 h-6 text-destructive" />,
      isRetryable: true,
    };
  }

  // Database/data errors
  if (message.includes('database') || message.includes('data') || message.includes('fetch')) {
    return {
      title: 'Data Error',
      message: 'Failed to load data. Please try again.',
      icon: <Database className="w-6 h-6 text-destructive" />,
      isRetryable: true,
    };
  }

  // Rendering errors
  if (message.includes('render') || message.includes('hook') || message.includes('hydration')) {
    return {
      title: 'Display Error',
      message: 'A rendering error occurred. The component will try to recover.',
      icon: <AlertTriangle className="w-6 h-6 text-destructive" />,
      isRetryable: true,
    };
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return {
      title: 'Timeout',
      message: 'The operation took too long. Please try again.',
      icon: <AlertTriangle className="w-6 h-6 text-destructive" />,
      isRetryable: true,
    };
  }

  // Default
  return {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
    icon: <AlertTriangle className="w-6 h-6 text-destructive" />,
    isRetryable: true,
  };
}

/**
 * HOC to wrap a component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    context?: string;
    variant?: ErrorBoundaryVariant;
    showRetry?: boolean;
    logToSentry?: boolean;
  },
): React.ComponentType<P> {
  const displayName = Component.displayName || Component.name || 'Component';
  
  const WrappedComponent = function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary
        context={options?.context}
        variant={options?.variant}
        showRetry={options?.showRetry}
        logToSentry={options?.logToSentry}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };
  
  WrappedComponent.displayName = `withErrorBoundary(${displayName})`;
  return WrappedComponent;
}

/**
 * Specialized error boundary for data-fetching components
 * Shows loading skeleton during retry
 */
export function DataErrorBoundary({
  children,
  context,
  onRetry,
  skeleton,
}: {
  children: ReactNode;
  context?: string;
  onRetry?: () => void;
  skeleton?: ReactNode;
}) {
  return (
    <ErrorBoundary
      context={context || 'Data'}
      variant="card"
      showRetry={true}
      onRetry={onRetry}
      retryingFallback={skeleton || <LoadingSkeleton />}
      logToSentry={true}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Specialized error boundary for third-party integrations (charts, editors, etc.)
 */
export function ThirdPartyErrorBoundary({
  children,
  context,
  fallbackMessage = 'This component failed to load',
}: {
  children: ReactNode;
  context?: string;
  fallbackMessage?: string;
}) {
  return (
    <ErrorBoundary
      context={context || 'Widget'}
      variant="card"
      showRetry={true}
      logToSentry={true}
      fallback={(error, reset) => (
        <div className="flex flex-col items-center justify-center p-6 rounded-lg border bg-muted/50 min-h-[200px]">
          <AlertTriangle className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground text-center mb-4">
            {fallbackMessage}
          </p>
          <Button onClick={reset} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-3 h-3" />
            Reload
          </Button>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              {error.message}
            </p>
          )}
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Specialized error boundary for media/streaming components (voice, video, etc.)
 */
export function MediaErrorBoundary({
  children,
  context,
  onClose,
}: {
  children: ReactNode;
  context?: string;
  onClose?: () => void;
}) {
  return (
    <ErrorBoundary
      context={context || 'Media'}
      logToSentry={true}
      fallback={(error, reset) => (
        <div className="flex flex-col items-center justify-center p-6 min-h-[300px]">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="text-lg font-medium mb-2">Media Error</h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
            {getMediaErrorMessage(error)}
          </p>
          <div className="flex gap-2">
            <Button onClick={reset} variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            {onClose && (
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            )}
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Get user-friendly message for media errors
 */
function getMediaErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('permission') || message.includes('denied')) {
    return 'Microphone or camera access was denied. Please grant permissions and try again.';
  }

  if (message.includes('not found') || message.includes('no device')) {
    return 'No microphone or camera was found. Please connect a device and try again.';
  }

  if (message.includes('websocket') || message.includes('connection')) {
    return 'Lost connection to the media server. Please check your internet and try again.';
  }

  if (message.includes('stream') || message.includes('media')) {
    return 'Failed to start media stream. Please try again.';
  }

  return 'An error occurred with media playback. Please try again.';
}

/**
 * Simple loading skeleton for retry states
 */
function LoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center p-6 min-h-[200px]">
      <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mb-3" />
      <p className="text-sm text-muted-foreground">Retrying...</p>
    </div>
  );
}

/**
 * Export utility to check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  return getErrorInfo(error).isRetryable;
}
