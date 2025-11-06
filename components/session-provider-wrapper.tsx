'use client';

import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface SessionProviderWrapperProps {
  children: React.ReactNode;
}

export function SessionProviderWrapper({
  children,
}: SessionProviderWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Set up interval to check session every 5 minutes
    const interval = setInterval(
      async () => {
        try {
          // Fetch session to ensure it's still valid
          const response = await fetch('/api/auth/session');
          if (!response.ok) {
            console.warn('Session check failed, status:', response.status);
          }
        } catch (error) {
          console.error('Session check error:', error);
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  return (
    <SessionProvider
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={true} // Refetch when window regains focus
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  );
}

