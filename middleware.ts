import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { guestRegex, isDevelopmentEnvironment } from './lib/constants';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  // Public routes that are always accessible without authentication
  if (
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/calendar-test.html' || // Allow access to calendar test page
    pathname === '/calendar-test' ||
    pathname === '/calendar-debug' || // Allow access to the new debug page
    pathname === '/' || // Allow access to the landing page without auth
    pathname === '/home.html' || // Allow access to static home page
    pathname === '/privacy-policy' || // Allow access to privacy policy
    pathname === '/terms' // Allow access to terms of service
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  // If no token (logged out) and trying to access a protected route, redirect to homepage
  if (!token) {
    if (
      pathname.startsWith('/chat') ||
      pathname.startsWith('/(chat)') ||
      pathname === '/api/user' ||
      pathname.startsWith('/api/chat') ||
      pathname.startsWith('/api/message') ||
      pathname.startsWith('/api/files') ||
      pathname.startsWith('/api/vote') ||
      pathname.startsWith('/api/document') ||
      pathname.startsWith('/api/history') ||
      pathname.startsWith('/api/suggestions') ||
      pathname.startsWith('/account')
    ) {
      // Redirect to homepage instead of login page
      return NextResponse.redirect(new URL('/', request.url));
    }

    // All other non-authenticated paths are handled by returning Next.js's response
    return NextResponse.next();
  }

  const isGuest = guestRegex.test(token?.email ?? '');

  // Redirect guest users to home page instead of login
  if (token && isGuest) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If authenticated user tries to access login/register pages, redirect to chat
  if (token && !isGuest && ['/login', '/register'].includes(pathname)) {
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - .well-known (well-known files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|.well-known).*)',
  ],
};
