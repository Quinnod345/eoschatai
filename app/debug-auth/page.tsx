'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { debugAuthState } from '@/lib/auth-debug';

export default function AuthDebugPage() {
  const { data: session, status } = useSession();
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const refreshDebugInfo = async () => {
    const info = await debugAuthState();
    setDebugInfo(info);
  };

  useEffect(() => {
    refreshDebugInfo();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Authentication Debug Page</h1>

      <div className="space-y-6">
        {/* Session Status */}
        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Session Status</h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Status:</span>{' '}
              <span
                className={
                  status === 'authenticated'
                    ? 'text-green-600'
                    : status === 'loading'
                      ? 'text-yellow-600'
                      : 'text-red-600'
                }
              >
                {status}
              </span>
            </p>
            {session && (
              <>
                <p>
                  <span className="font-medium">User ID:</span>{' '}
                  {session.user?.id || 'N/A'}
                </p>
                <p>
                  <span className="font-medium">Email:</span>{' '}
                  {session.user?.email || 'N/A'}
                </p>
                <p>
                  <span className="font-medium">Name:</span>{' '}
                  {session.user?.name || 'N/A'}
                </p>
                <p>
                  <span className="font-medium">Type:</span>{' '}
                  {session.user?.type || 'N/A'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Full Session Object */}
        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Full Session Object</h2>
          <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto max-h-60 text-sm">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        {/* Debug Info */}
        <div className="p-4 border rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold">Debug Information</h2>
            <Button onClick={refreshDebugInfo} size="sm">
              Refresh
            </Button>
          </div>
          <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto max-h-96 text-sm">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        {/* Actions */}
        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Actions</h2>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                window.location.href = '/api/auth/signin';
              }}
            >
              Sign In
            </Button>
            <Button
              onClick={() => {
                window.location.href = '/api/auth/signout';
              }}
              variant="destructive"
            >
              Sign Out
            </Button>
            <Button
              onClick={() => {
                window.location.href = '/chat';
              }}
              variant="outline"
            >
              Go to Chat
            </Button>
            <Button
              onClick={() => {
                window.location.href = '/';
              }}
              variant="outline"
            >
              Go to Home
            </Button>
          </div>
        </div>

        {/* Environment Info */}
        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Environment</h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Current URL:</span>{' '}
              {typeof window !== 'undefined' ? window.location.href : 'N/A'}
            </p>
            <p>
              <span className="font-medium">User Agent:</span>{' '}
              {typeof window !== 'undefined'
                ? navigator.userAgent
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

