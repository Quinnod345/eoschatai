'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Building2, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

function InviteAcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>(
    'processing',
  );
  const [message, setMessage] = useState('Processing your invitation...');

  useEffect(() => {
    // Get the query params
    const code = searchParams.get('code');
    const email = searchParams.get('email');

    // If no code is present, silently redirect without showing an error toast
    // This handles the case where someone visits /invite/accept directly without a token
    if (!code) {
      setStatus('error');
      setMessage('No invitation code provided');
      setTimeout(() => router.push('/chat'), 1500);
      return;
    }

    // Show immediate visual feedback only when we have a valid code to process
    const toastId = toast.loading('Accepting organization invitation...', {
      description: 'Please wait while we add you to the organization',
    });

    async function handleInvite() {
      try {

        // Build the accept URL
        const acceptUrl = new URL(
          '/api/organizations/accept',
          window.location.origin,
        );
        acceptUrl.searchParams.set('code', code);
        if (email) {
          acceptUrl.searchParams.set('email', email);
        }

        // Navigate to the accept URL which will handle auth and redirects
        // The server will redirect to /chat with the appropriate query params
        window.location.href = acceptUrl.toString();
      } catch (error) {
        console.error('Error accepting invitation:', error);
        toast.dismiss(toastId);
        toast.error('Failed to process invitation', {
          description: 'An unexpected error occurred',
        });
        setStatus('error');
        setMessage('An error occurred');
        setTimeout(() => router.push('/chat'), 2000);
      }
    }

    handleInvite();
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center gap-6 text-center">
          {status === 'processing' && (
            <>
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <Building2 className="h-6 w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary/50" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Accepting Invitation</h2>
                <p className="text-sm text-muted-foreground">
                  Please wait while we add you to the organization...
                </p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-600" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Success!</h2>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="h-12 w-12 text-red-600" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Error</h2>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <InviteAcceptContent />
    </Suspense>
  );
}
