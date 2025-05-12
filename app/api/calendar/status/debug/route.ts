import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { googleCalendarToken, user } from '@/lib/db/schema';

/**
 * Extended debugging handler for GET requests - Checks if Google Calendar is connected with detailed logging
 */
export async function GET(request: NextRequest) {
  try {
    console.log('DEBUG Calendar status API called');
    console.log(
      'DEBUG Request headers:',
      Object.fromEntries(request.headers.entries()),
    );
    console.log('DEBUG Request URL:', request.url);
    console.log(
      'DEBUG NEXT_PUBLIC_BASE_URL:',
      process.env.NEXT_PUBLIC_BASE_URL || 'not set',
    );

    // Get authenticated session
    const session = await auth();

    console.log('DEBUG Session result:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id || 'unknown',
    });

    if (!session?.user) {
      console.log('DEBUG Calendar status: No authenticated user');
      return NextResponse.json(
        {
          connected: false,
          error: 'Unauthorized',
          debug: {
            method: request.method,
            url: request.url,
            headers: Object.fromEntries(request.headers.entries()),
            nextUrl: request.nextUrl.toString(),
          },
        },
        { status: 401 },
      );
    }

    console.log('DEBUG Calendar status: Authenticated user', session.user.id);

    // Direct database check
    try {
      console.log(
        'DEBUG Calendar status: Checking database for user',
        session.user.id,
      );

      // Get Google Calendar token for the user
      const tokens = await db
        .select()
        .from(googleCalendarToken)
        .where(eq(googleCalendarToken.userId, session.user.id));

      // Get user settings
      const users = await db
        .select({ googleCalendarConnected: user.googleCalendarConnected })
        .from(user)
        .where(eq(user.id, session.user.id));

      console.log('DEBUG Database lookup results:', {
        tokensFound: tokens.length,
        hasTokenData: tokens.length > 0 && !!tokens[0].token,
        usersFound: users.length,
        userConnectedFlag:
          users.length > 0 ? users[0].googleCalendarConnected : null,
      });

      // Use either the token existence or the user settings flag to determine connection status
      const hasToken = tokens.length > 0 && !!tokens[0].token;
      const userConnected =
        users.length > 0 && !!users[0].googleCalendarConnected;
      const isConnected = hasToken && userConnected;

      console.log('DEBUG Calendar status detailed check:', {
        userId: session.user.id,
        hasToken,
        userConnected,
        isConnected,
        tokensFound: tokens.length,
      });

      // Return diagnostic information in the response
      return NextResponse.json({
        connected: isConnected,
        debug: {
          method: request.method,
          url: request.url,
          headers: Object.fromEntries(request.headers.entries()),
          nextUrl: request.nextUrl.toString(),
          hasToken,
          userConnected,
          tokensFound: tokens.length,
          usersFound: users.length,
        },
      });
    } catch (dbError) {
      console.error('DEBUG Database check failed:', dbError);

      // Return detailed error information
      return NextResponse.json(
        {
          connected: false,
          error: 'Database query failed',
          errorDetails:
            dbError instanceof Error
              ? dbError.message
              : 'Unknown database error',
          debug: {
            method: request.method,
            url: request.url,
            headers: Object.fromEntries(request.headers.entries()),
            nextUrl: request.nextUrl.toString(),
            dbErrorStack: dbError instanceof Error ? dbError.stack : null,
          },
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('DEBUG Error checking Google Calendar status:', error);

    // Return detailed error information
    return NextResponse.json(
      {
        connected: false,
        error: 'Unknown error occurred',
        errorDetails:
          error instanceof Error ? error.message : 'Unspecified error',
        debug: {
          errorStack: error instanceof Error ? error.stack : null,
        },
      },
      { status: 500 },
    );
  }
}
