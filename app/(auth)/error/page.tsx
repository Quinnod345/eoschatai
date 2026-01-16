'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Suspense } from 'react';

const errorMessages: Record<string, string> = {
  Configuration:
    'There was a problem with the server configuration. Please try again.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification link may have expired or already been used.',
  OAuthSignin: 'There was a problem starting the sign in process.',
  OAuthCallback:
    'There was a problem completing the sign in. Please try again.',
  OAuthCreateAccount: 'Could not create an account with this provider.',
  EmailCreateAccount: 'Could not create an account with this email.',
  Callback: 'There was a problem with the authentication callback.',
  OAuthAccountNotLinked:
    'This email is already associated with another account.',
  EmailSignin: 'The email could not be sent.',
  CredentialsSignin: 'The credentials you provided are incorrect.',
  SessionRequired: 'Please sign in to access this page.',
  Default: 'An unexpected error occurred. Please try again.',
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Default';
  const errorMessage = errorMessages[error] || errorMessages.Default;

  const handleRetry = () => {
    // Clear any stale auth cookies and retry
    document.cookie.split(';').forEach((c) => {
      const cookie = c.trim();
      if (
        cookie.startsWith('authjs.') ||
        cookie.startsWith('__Secure-authjs.')
      ) {
        document.cookie = `${cookie.split('=')[0]}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    });
    window.location.href = '/login';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Authentication Error
          </h1>
          <p className="text-muted-foreground">{errorMessage}</p>
          {error === 'Configuration' && (
            <p className="text-sm text-muted-foreground mt-2">
              This often happens due to stale browser cookies. Try clearing your
              cookies or using an incognito window.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={handleRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <Link href="/login">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 rounded-lg bg-muted p-4 text-left">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Debug Info (dev only):
            </p>
            <code className="text-xs text-muted-foreground">
              Error code: {error}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
