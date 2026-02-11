import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { guestRegex, isDevelopmentEnvironment } from './lib/constants';

/**
 * Validates that the request originates from the same origin (CSRF protection)
 * Returns true if valid, false if the request should be rejected
 */
function validateOrigin(request: NextRequest): boolean {
  const method = request.method.toUpperCase();

  // Only validate state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return true;
  }

  // Skip CSRF validation for auth endpoints (they have their own protection)
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    return true;
  }

  // Skip for webhook endpoints that need to receive external requests
  if (
    request.nextUrl.pathname.startsWith('/api/webhooks') ||
    request.nextUrl.pathname.startsWith('/api/billing/webhook')
  ) {
    return true;
  }

  // Skip CSRF validation for Vercel cron endpoints.
  // These are machine-to-machine invocations protected by CRON_SECRET.
  if (request.nextUrl.pathname.startsWith('/api/cron/')) {
    return true;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Get the host from the request
  const host = request.headers.get('host');
  const expectedOrigins = [`https://${host}`, `http://${host}`];

  // In development, also allow localhost variations
  if (isDevelopmentEnvironment) {
    expectedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  // Check origin header first (most reliable)
  if (origin) {
    return expectedOrigins.some((expected) => origin === expected);
  }

  // Fall back to referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = refererUrl.origin;
      return expectedOrigins.some((expected) => refererOrigin === expected);
    } catch {
      return false;
    }
  }

  // If neither header is present, reject the request for API routes
  // (Some older browsers may not send origin, but they should send referer)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return false;
  }

  // For non-API routes, allow (could be server-side navigation)
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  // Check if this is a Meticulous recording session
  // Configure this header in Meticulous project settings > Custom Request Headers
  const meticulousHeader = request.headers.get('x-meticulous-recording');
  const meticulousSecret = process.env.METICULOUS_AUTH_BYPASS_SECRET;

  const isMeticulousSession =
    (process.env.NODE_ENV === 'development' ||
      process.env.VERCEL_ENV === 'preview') &&
    meticulousHeader === (meticulousSecret || 'true');

  // If it's a Meticulous session, bypass all auth checks
  if (isMeticulousSession) {
    // Skip auth checks and allow access to all routes
    // Meticulous will automatically stub network responses
    return NextResponse.next();
  }

  // CSRF protection: validate origin for state-changing requests
  if (!validateOrigin(request)) {
    return new NextResponse(
      JSON.stringify({ error: 'CSRF validation failed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Public routes that are always accessible without authentication
  if (
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname === '/register' ||
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

  // If no token (logged out) and trying to access a protected route, redirect to login
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
      pathname.startsWith('/account') ||
      pathname.startsWith('/academy')
    ) {
      // Redirect to login page instead of homepage for protected routes
      const url = new URL('/login', request.url);
      // Store the original path to redirect back after login
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
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
