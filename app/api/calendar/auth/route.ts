import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { google } from 'googleapis';

/**
 * Handler for GET requests - Initiates the Google OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${request.nextUrl.origin}/api/calendar/auth/callback`,
    );

    // Generate a URL to request access
    const scopes = [
      'https://www.googleapis.com/auth/calendar', // Full access
      'https://www.googleapis.com/auth/calendar.events', // Full access to events
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // 'offline' gets refresh token
      scope: scopes,
      prompt: 'consent', // Force consent screen to ensure getting refresh token
      state: session.user.id, // Pass user ID as state for callback
    });

    // Redirect to auth URL
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Google Calendar auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google Calendar authentication' },
      { status: 500 },
    );
  }
}
