'use client';

/**
 * Enhanced error boundary component with smart error handling
 */

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { onError, context } = this.props;

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

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
    });

    // Reset error count after successful reset
    setTimeout(() => {
      this.setState({ errorCount: 0 });
    }, 5000);
  };

  render() {
    const { hasError, error, errorCount } = this.state;
    const { children, fallback, context } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.reset);
      }

      // Check for error loop
      if (errorCount >= 3) {
        return <ErrorLoopFallback error={error} context={context} />;
      }

      // Default error UI
      return (
        <DefaultErrorFallback
          error={error}
          reset={this.reset}
          context={context}
        />
      );
    }

    return children;
  }
}

/**
 * Default error fallback UI
 */
function DefaultErrorFallback({
  error,
  reset,
  context,
}: {
  error: Error;
  reset: () => void;
  context?: string;
}) {
  return (
    <div className="flex min-h-[400px] w-full items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-foreground">
            {context ? `${context} Error` : 'Something went wrong'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {getUserFriendlyMessage(error)}
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
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
          <Button onClick={() => window.location.reload()} variant="default">
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
 * Get user-friendly message from error
 */
function getUserFriendlyMessage(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('chunk') || message.includes('load')) {
    return 'Failed to load this component. Please refresh the page.';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }

  if (message.includes('render') || message.includes('hook')) {
    return 'A rendering error occurred. The component will try to recover.';
  }

  if (message.includes('timeout')) {
    return 'The operation took too long. Please try again.';
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Convenience wrapper for sections that need error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context?: string,
): React.ComponentType<P> {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary context={context}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}









