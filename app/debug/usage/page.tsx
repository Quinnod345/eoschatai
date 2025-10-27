'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAccountStore } from '@/lib/stores/account-store';
import { Button } from '@/components/ui/button';

export default function DebugUsagePage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const entitlements = useAccountStore((state) => state.entitlements);
  const usageCounters = useAccountStore((state) => state.usageCounters);

  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="container mx-auto p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Debug page not available in production</h1>
        </div>
      </div>
    );
  }

  const handleResetSelf = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/debug/reset-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'self' }),
      });
      const data = await res.json();
      setResult(data);
      if (res.ok) {
        // Reload to refresh usage counters
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleResetAll = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/debug/reset-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'all' }),
      });
      const data = await res.json();
      setResult(data);
      if (res.ok) {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Usage Counter Debug</h1>
          <p className="text-muted-foreground">
            Development-only page to test usage counter resets
          </p>
        </div>

        {/* Current State */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Current Usage State</h2>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">User ID:</span>
              <span className="text-sm font-mono">{session?.user?.id || 'Not logged in'}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">User Type:</span>
              <span className="text-sm font-mono">{session?.user?.type || 'unknown'}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Daily Chat Limit:</span>
              <span className="text-sm font-mono">
                {entitlements?.features.chats_per_day || 'unlimited'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Chats Today:</span>
              <span className="text-sm font-mono">
                {usageCounters?.chats_today ?? 0}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Remaining:</span>
              <span className="text-sm font-mono">
                {entitlements?.features.chats_per_day 
                  ? Math.max(0, entitlements.features.chats_per_day - (usageCounters?.chats_today ?? 0))
                  : 'unlimited'}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-sm font-medium mb-2">All Counters:</h3>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
              {JSON.stringify(usageCounters, null, 2)}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Reset Actions</h2>
          
          <div className="space-y-3">
            <div>
              <Button
                onClick={handleResetSelf}
                disabled={loading}
                className="w-full"
                variant="outline"
              >
                {loading ? 'Resetting...' : 'Reset My Usage Counters'}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Resets chats_today and deep_runs_day to 0 for your account only
              </p>
            </div>

            <div>
              <Button
                onClick={handleResetAll}
                disabled={loading}
                className="w-full"
                variant="destructive"
              >
                {loading ? 'Resetting...' : 'Reset ALL Users (Admin)'}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Resets daily counters for all users in the database
              </p>
            </div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-3">Result</h2>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
            {result.ok && (
              <p className="text-sm text-green-600 mt-2">
                ✓ Success! Page will reload in 1 second...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

