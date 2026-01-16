'use client';

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useComposer } from '@/hooks/use-composer';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary for Composer Components
 *
 * Catches JavaScript errors in child components, logs them,
 * and displays a fallback UI instead of crashing the entire app.
 */
export class ComposerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ComposerErrorBoundary] Caught error:', error);
    console.error('[ComposerErrorBoundary] Error info:', errorInfo);

    this.setState({ errorInfo });

    // Log to error tracking service if available
    if (typeof window !== 'undefined' && 'Sentry' in window) {
      try {
        // @ts-expect-error - Sentry may be loaded globally
        window.Sentry?.captureException(error, {
          extra: { componentStack: errorInfo.componentStack },
        });
      } catch (e) {
        console.error('Failed to log to Sentry:', e);
      }
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ComposerErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          onClose={this.props.onClose}
          title={this.props.fallbackTitle}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Fallback UI Component when Composer errors
 */
interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onRetry: () => void;
  onClose?: () => void;
  title?: string;
}

function ComposerErrorFallback({
  error,
  errorInfo,
  onRetry,
  onClose,
  title = 'Composer',
}: ErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-medium">{title}</h2>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>

          <h3 className="text-lg font-semibold">Something went wrong</h3>

          <p className="text-sm text-muted-foreground">
            The composer encountered an error. Your work has been auto-saved,
            and you can try again.
          </p>

          {isDev && error && (
            <div className="mt-4 p-4 bg-muted rounded-md text-left overflow-auto max-h-48">
              <p className="text-xs font-mono text-destructive break-words">
                {error.name}: {error.message}
              </p>
              {errorInfo?.componentStack && (
                <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                  {errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-center pt-4">
            <Button onClick={onRetry} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Close Composer
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * HOC to wrap a component with ComposerErrorBoundary
 */
export function withComposerErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallbackTitle?: string,
) {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P) => {
    return (
      <ComposerErrorBoundary fallbackTitle={fallbackTitle}>
        <WrappedComponent {...props} />
      </ComposerErrorBoundary>
    );
  };

  ComponentWithErrorBoundary.displayName = `withComposerErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

/**
 * Hook-based error boundary wrapper for composer content
 */
export function ComposerContentErrorBoundary({
  children,
  documentId,
}: {
  children: ReactNode;
  documentId: string;
}) {
  const { setComposer } = useComposer();

  const handleClose = () => {
    setComposer((prev) => ({ ...prev, isVisible: false }));
  };

  return (
    <ComposerErrorBoundary
      fallbackTitle={`Document ${documentId.slice(0, 8)}...`}
      onClose={handleClose}
    >
      {children}
    </ComposerErrorBoundary>
  );
}

/**
 * Recovery mechanisms for composer state
 */
export const ComposerRecovery = {
  /**
   * Clear local storage cache for composer state
   */
  clearCache(documentId?: string): void {
    if (typeof window === 'undefined') return;

    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (
        key.startsWith('composer-') ||
        key.startsWith('document-draft-') ||
        (documentId && key.includes(documentId))
      ) {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.error('Failed to clear cache:', e);
        }
      }
    }
  },

  /**
   * Force refresh composer data from server
   */
  async forceRefresh(documentId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/document?id=${documentId}&_=${Date.now()}`);
      return response.ok;
    } catch (e) {
      console.error('Failed to force refresh:', e);
      return false;
    }
  },

  /**
   * Check if document is accessible and valid
   */
  async validateDocument(documentId: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`/api/document?id=${documentId}`);
      if (!response.ok) {
        return {
          valid: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      const data = await response.json();
      if (!data || data.length === 0) {
        return { valid: false, error: 'Document not found' };
      }
      return { valid: true };
    } catch (e) {
      return {
        valid: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  },
};
