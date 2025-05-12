import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { safeParseJson } from '@/lib/fetch-utils';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { googleCalendarToken, user } from '@/lib/db/schema';

/**
 * Handler for GET requests - Checks if Google Calendar is connected
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Calendar status API called');
    console.log(
      'Request headers:',
      Object.fromEntries(request.headers.entries()),
    );
    console.log('Request URL:', request.url);
    console.log('Base URL:', process.env.NEXT_PUBLIC_BASE_URL);
    console.log('Node ENV:', process.env.NODE_ENV);

    // Get authenticated session
    const session = await auth();

    console.log('Session result:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id || 'unknown',
    });

    if (!session?.user) {
      console.log('Calendar status: No authenticated user');
      return NextResponse.json(
        { connected: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    console.log('Calendar status: Authenticated user', session.user.id);

    // Direct database check first (more reliable)
    try {
      console.log(
        'Calendar status: Checking database for user',
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

      // Use either the token existence or the user settings flag to determine connection status
      const hasToken = tokens.length > 0 && !!tokens[0].token;
      const userConnected =
        users.length > 0 && !!users[0].googleCalendarConnected;
      const isConnected = hasToken && userConnected;

      console.log('Calendar status database check:', {
        userId: session.user.id,
        hasToken,
        userConnected,
        isConnected,
        tokensFound: tokens.length,
      });

      // Return JSON with connection status
      const result = { connected: isConnected };
      console.log('Returning status response:', result);

      return NextResponse.json(result, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (dbError) {
      console.error('Database check failed:', dbError);
      // Return error JSON
      return NextResponse.json(
        {
          connected: false,
          error: 'Database query failed',
          details:
            dbError instanceof Error
              ? dbError.message
              : 'Unknown database error',
        },
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  } catch (error) {
    console.error('Error checking Google Calendar status:', error);
    // Return error JSON
    return NextResponse.json(
      {
        connected: false,
        error: 'Unknown error occurred',
        details: error instanceof Error ? error.message : 'Unspecified error',
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
