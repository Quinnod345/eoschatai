'use client';

import { useAccountStore } from '@/lib/stores/account-store';
import { Skeleton } from '@/components/ui/skeleton';

export function AccountReadyWrapper({
  children,
}: { children: React.ReactNode }) {
  const { ready, loading } = useAccountStore((state) => ({
    ready: state.ready,
    loading: state.loading,
  }));

  // Show loading state while account data is being fetched
  if (!ready || loading) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  // Once ready, render children
  return <>{children}</>;
}

