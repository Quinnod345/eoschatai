'use client';

import { useAccountStore } from '@/lib/stores/account-store';

export function AccountDebug() {
  const { ready, loading, user, entitlements, usageCounters } =
    useAccountStore();

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-background/95 p-4 text-xs shadow-lg backdrop-blur">
      <h3 className="font-semibold mb-2">Account Debug</h3>
      <div className="space-y-1">
        <div>Ready: {ready ? '✅' : '❌'}</div>
        <div>Loading: {loading ? '⏳' : '✅'}</div>
        <div>User: {user?.email || 'null'}</div>
        <div>Plan: {user?.plan || 'null'}</div>
        <div>Entitlements: {entitlements ? '✅' : '❌'}</div>
        <div>Usage: {usageCounters ? '✅' : '❌'}</div>
        {entitlements && (
          <>
            <div>Chat limit: {entitlements.features.chats_per_day}</div>
            <div>
              Upload limit: {entitlements.features.context_uploads_total}
            </div>
          </>
        )}
        {usageCounters && (
          <>
            <div>Chats today: {usageCounters.chats_today}</div>
            <div>Uploads total: {usageCounters.uploads_total}</div>
          </>
        )}
      </div>
    </div>
  );
}

