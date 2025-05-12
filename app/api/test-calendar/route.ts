import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { googleCalendarToken, user } from '@/lib/db/schema';

/**
 * Test handler to diagnose calendar API issues
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Calendar Test API: Starting diagnostic test');
    console.log('Calendar Test API: ENV variables check:');
    console.log(
      'NEXT_PUBLIC_BASE_URL:',
      process.env.NEXT_PUBLIC_BASE_URL || 'not set',
    );
    console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');

    // Test URL construction
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const statusUrl = new URL('/api/calendar/status', baseUrl).toString();
      console.log('Calendar Test API: Status URL test:', statusUrl);
    } catch (urlError) {
      console.error('Calendar Test API: Error creating status URL:', urlError);
      return NextResponse.json(
        {
          error: 'URL creation failed',
          details:
            urlError instanceof Error ? urlError.message : String(urlError),
        },
        { status: 500 },
      );
    }

    // Get authenticated session
    const session = await auth();
    if (!session?.user) {
      console.log('Calendar Test API: No authenticated user');
      return NextResponse.json(
        { connected: false, error: 'Unauthorized', stage: 'auth-check' },
        { status: 401 },
      );
    }

    console.log('Calendar Test API: Authenticated user', session.user.id);

    // Direct database check for tokens
    try {
      console.log(
        'Calendar Test API: Checking database for user',
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

      console.log('Calendar Test API: Database check:', {
        userId: session.user.id,
        hasToken,
        userConnected,
        isConnected,
        tokensFound: tokens.length,
      });

      if (!isConnected) {
        return NextResponse.json({
          connected: false,
          error: 'Calendar not connected in database',
          stage: 'db-check',
          hasToken,
          userConnected,
        });
      }

      // If connected, try to actually use the token
      if (tokens.length > 0 && tokens[0].token) {
        try {
          const token = tokens[0].token;

          // Create OAuth2 client with the token
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            // Use the request URL to determine the redirect URL
            `${request.nextUrl.origin}/api/calendar/auth/callback`,
          );

          oauth2Client.setCredentials(token);

          // Test token with a lightweight API call
          const calendar = google.calendar({
            version: 'v3',
            auth: oauth2Client,
          });

          // Just get the calendar list to test the connection
          const { data } = await calendar.calendarList.list({
            maxResults: 1,
          });

          console.log('Calendar Test API: API test successful', {
            calendarsFound: data.items?.length || 0,
          });

          return NextResponse.json({
            connected: true,
            stage: 'api-test',
            calendarsFound: data.items?.length || 0,
            calendars: data.items,
          });
        } catch (apiError) {
          console.error(
            'Calendar Test API: Error testing calendar API:',
            apiError,
          );
          return NextResponse.json(
            {
              connected: false,
              error:
                apiError instanceof Error ? apiError.message : String(apiError),
              stage: 'api-test',
            },
            { status: 500 },
          );
        }
      }

      return NextResponse.json({ connected: isConnected, stage: 'complete' });
    } catch (dbError) {
      console.error('Calendar Test API: Database check failed:', dbError);
      return NextResponse.json(
        {
          connected: false,
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stage: 'db-error',
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Calendar Test API: Unhandled error:', error);
    return NextResponse.json(
      {
        connected: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        stage: 'unhandled-error',
      },
      { status: 500 },
    );
  }
}
