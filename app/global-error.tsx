'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorTitle, setErrorTitle] = useState<string>('Something went wrong!');

  useEffect(() => {
    // Classify and log the error using our intelligent error handler
    const classifyAndLogError = async () => {
      try {
        const { classifyError } = await import('@/lib/errors/classifier');
        const { generateUserMessage, generateErrorTitle } = await import(
          '@/lib/errors/messages'
        );

        const classified = classifyError(error, 'Application load');

        setErrorTitle(generateErrorTitle(classified.category));
        setErrorMessage(generateUserMessage(classified, 'Application load'));

        console.error('[Global Error]', {
          category: classified.category,
          severity: classified.severity,
          message: classified.message,
          userMessage: classified.userMessage,
          digest: error.digest,
        });

        // Log to Sentry error tracking service
        Sentry.captureException(error, {
          tags: {
            errorCategory: classified.category,
            severity: classified.severity,
          },
          extra: {
            digest: error.digest,
            userMessage: classified.userMessage,
            context: 'Application load',
          },
        });
      } catch (classifyError) {
        // Fallback if classification fails
        console.error('Global error caught:', error);

        if (error.message?.includes('Rendered more hooks')) {
          setErrorTitle('Navigation Error');
          setErrorMessage(
            'The application encountered a navigation error. This usually resolves itself on refresh.',
          );
        } else if (error.message?.toLowerCase().includes('network')) {
          setErrorTitle('Connection Error');
          setErrorMessage(
            'Network error. Please check your connection and try again.',
          );
        } else {
          setErrorTitle('Application Error');
          setErrorMessage(
            'An unexpected error occurred while loading the application.',
          );
        }
      }
    };

    classifyAndLogError();
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-4 max-w-md mx-auto p-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">
                {errorTitle}
              </h2>
              <p className="text-muted-foreground">
                {errorMessage || 'An unexpected error occurred.'}
              </p>
            </div>

            <div className="flex gap-2 justify-center">
              <Button onClick={() => reset()}>Try again</Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                Go home
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Error details (dev only)
                </summary>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                  {error.stack || error.message}
                </pre>
                {error.digest && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Error ID: {error.digest}
                  </p>
                )}
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
