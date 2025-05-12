import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';

/**
 * Simple API to test authentication state
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Test Auth API called');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    // Check for cookies
    const cookieHeader = request.headers.get('cookie');
    console.log('Cookie header:', cookieHeader);

    // Try to parse cookies
    const cookies =
      cookieHeader?.split(';').map((cookie) => {
        const [key, value] = cookie.trim().split('=');
        return { key, value };
      }) || [];

    console.log('Parsed cookies:', cookies);

    // Get authenticated session
    const session = await auth();

    console.log('Auth session result:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
    });

    if (!session || !session.user) {
      return NextResponse.json(
        {
          authenticated: false,
          error: 'Not authenticated',
          message: 'No valid session found. Please log in.',
          cookies: {
            hasCookieHeader: !!cookieHeader,
            cookieCount: cookies.length,
            cookieKeys: cookies.map((c) => c.key),
          },
        },
        { status: 401 },
      );
    }

    // Return sanitized user info
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      cookies: {
        hasCookieHeader: !!cookieHeader,
        cookieCount: cookies.length,
        cookieKeys: cookies.map((c) => c.key),
      },
    });
  } catch (error) {
    console.error('Auth test error:', error);
    return NextResponse.json(
      {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error instanceof Error ? error.stack : null,
      },
      { status: 500 },
    );
  }
}
