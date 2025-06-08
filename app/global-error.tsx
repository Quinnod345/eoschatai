'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to your error reporting service
    console.error('Global error caught:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-4 max-w-md mx-auto p-6">
            <h2 className="text-2xl font-semibold">Something went wrong!</h2>
            <p className="text-muted-foreground">
              {error.message?.includes('Rendered more hooks')
                ? 'The application encountered a navigation error. This usually resolves itself on refresh.'
                : 'An unexpected error occurred while loading the application.'}
            </p>
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
          </div>
        </div>
      </body>
    </html>
  );
}
