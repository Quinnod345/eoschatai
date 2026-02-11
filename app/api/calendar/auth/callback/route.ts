import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { googleCalendarToken, user } from '@/lib/db/schema';
import {
  sanitizeCalendarReturnTo,
  verifyCalendarOAuthState,
} from '@/lib/integrations/calendar/oauth-state';
import { generateUUID } from '@/lib/utils';

/**
 * Handler for GET requests - Processes OAuth callback from Google
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Get code from query parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.redirect(
        new URL(
          '/?error=No+authorization+code+received&open_settings=true',
          request.url,
        ),
      );
    }

    const stateValidation = verifyCalendarOAuthState(state, session.user.id);
    if (!stateValidation.valid) {
      console.error('State mismatch in OAuth callback');
      return NextResponse.redirect(
        new URL(
          '/?error=Invalid+state+parameter&open_settings=true',
          request.url,
        ),
      );
    }

    // Create OAuth2 client with callback URL derived from the request
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${request.nextUrl.origin}/api/calendar/auth/callback`,
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens directly to database
    try {
      // Check if token already exists for this user
      const existingTokens = await db
        .select()
        .from(googleCalendarToken)
        .where(eq(googleCalendarToken.userId, session.user.id));

      if (existingTokens.length > 0) {
        // Update existing token
        await db
          .update(googleCalendarToken)
          .set({ token: tokens, updatedAt: new Date() })
          .where(eq(googleCalendarToken.id, existingTokens[0].id));
      } else {
        // Create new token record
        await db.insert(googleCalendarToken).values({
          id: generateUUID(),
          userId: session.user.id,
          token: tokens,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Also update user settings to indicate Google Calendar is connected
      await db
        .update(user)
        .set({ googleCalendarConnected: true })
        .where(eq(user.id, session.user.id));

      console.log('Google Calendar token saved to database');
    } catch (dbError) {
      console.error(
        'Failed to save Google Calendar token to database:',
        dbError,
      );
      return NextResponse.redirect(
        new URL(
          '/?error=Failed+to+save+credentials&open_settings=true',
          request.url,
        ),
      );
    }

    // Redirect back to the main app with success message
    const savedReturnTo =
      stateValidation.returnTo ||
      sanitizeCalendarReturnTo(searchParams.get('state_return_to'));
    let redirectUrl =
      '/?success=Google+Calendar+connected+successfully&open_settings=true';

    // If there was a stored return URL, use it
    if (savedReturnTo) {
      // Add success parameter to the return URL
      redirectUrl = `${savedReturnTo}${savedReturnTo.includes('?') ? '&' : '?'}success=Google+Calendar+connected+successfully&open_settings=true`;
    }

    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error('Error processing Google OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/?error=Authentication+failed&open_settings=true', request.url),
    );
  }
}
