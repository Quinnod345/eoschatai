'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * SessionMonitor - Monitors session state and handles unexpected logouts
 * This component runs in the background to detect and handle session issues
 */
export function SessionMonitor() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const previousStatus = useRef(status);
  const hasWarned = useRef(false);

  useEffect(() => {
    // Log session changes in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[SessionMonitor] Session status:', status);
      if (session) {
        console.log('[SessionMonitor] User:', {
          id: session.user?.id,
          email: session.user?.email,
          type: session.user?.type,
        });
      }
    }

    // Detect unexpected logout
    if (
      previousStatus.current === 'authenticated' &&
      status === 'unauthenticated'
    ) {
      console.warn('[SessionMonitor] Unexpected logout detected!');

      // Check if we're on a protected route
      const protectedRoutes = ['/chat', '/account', '/academy'];
      const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route),
      );

      if (isProtectedRoute && !hasWarned.current) {
        hasWarned.current = true;
        console.error(
          '[SessionMonitor] Session lost while on protected route:',
          pathname,
        );

        // Optional: Show a toast or redirect to login
        // Uncomment if you want automatic redirect:
        // router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      }
    }

    // Reset warning flag when authenticated
    if (status === 'authenticated') {
      hasWarned.current = false;
    }

    previousStatus.current = status;
  }, [status, session, pathname, router]);

  // Periodically check session health
  useEffect(() => {
    if (status !== 'authenticated') return;

    const checkInterval = setInterval(
      async () => {
        try {
          const response = await fetch('/api/auth/session');
          if (!response.ok) {
            console.warn(
              '[SessionMonitor] Session check failed:',
              response.status,
            );
          } else {
            const data = await response.json();
            if (!data || !data.user) {
              console.warn('[SessionMonitor] Session is invalid or expired');
            }
          }
        } catch (error) {
          console.error('[SessionMonitor] Session check error:', error);
        }
      },
      2 * 60 * 1000,
    ); // Check every 2 minutes

    return () => clearInterval(checkInterval);
  }, [status]);

  // This component doesn't render anything
  return null;
}

