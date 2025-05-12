'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect } from 'react';

export default function ChatErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Chat error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-background p-4">
      <div className="flex flex-col items-center gap-6 max-w-lg text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t load this chat. It may have been deleted or you may
            not have permission to view it.
          </p>
        </div>

        <div className="flex flex-row gap-4">
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
          <Button asChild>
            <Link href="/">New chat</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
