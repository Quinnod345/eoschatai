import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { googleCalendarToken } from '@/lib/db/schema';
import { getAccessContext } from '@/lib/entitlements';
import { trackBlockedAction } from '@/lib/analytics';
import { ApiErrors, logApiError, apiErrorResponse, ErrorCodes } from '@/lib/api/error-response';

/**
 * Handler for GET requests - Retrieves calendar events
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth();
    if (!session || !session.user) {
      return ApiErrors.unauthorized();
    }

    // Check entitlements
    const accessContext = await getAccessContext(session.user.id);
    if (!accessContext.entitlements.features.calendar_connect) {
      await trackBlockedAction({
        feature: 'calendar_connect',
        reason: 'not_enabled',
        user_id: session.user.id,
        org_id: accessContext.user.orgId,
        status: 403,
      });

      return apiErrorResponse(
        'Calendar connect feature is not enabled for your plan',
        403,
        ErrorCodes.ENTITLEMENT_BLOCKED
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const defaultTimeMax = new Date();
    defaultTimeMax.setDate(defaultTimeMax.getDate() + 7); // Default to 7 days from now
    const timeMax = searchParams.get('timeMax') || defaultTimeMax.toISOString();
    const maxResults = Number.parseInt(
      searchParams.get('maxResults') || '10',
      10,
    );

    // Get the token directly from the database
    const tokens = await db
      .select()
      .from(googleCalendarToken)
      .where(eq(googleCalendarToken.userId, session.user.id));

    if (tokens.length === 0 || !tokens[0].token) {
      return apiErrorResponse(
        'Google Calendar is not connected',
        401,
        'calendar_not_connected'
      );
    }

    const token = tokens[0].token;

    // Create OAuth2 client with the token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      // Use the request URL to determine the redirect URL (this avoids hardcoding)
      `${request.nextUrl.origin}/api/calendar/auth/callback`,
    );

    oauth2Client.setCredentials(token);

    // Create calendar client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Fetch events
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    // Format the events
    const formattedEvents = (data.items || []).map((event) => ({
      id: event.id,
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      attendees: event.attendees,
      htmlLink: event.htmlLink,
      created: event.created,
      updated: event.updated,
    }));

    return NextResponse.json(formattedEvents);
  } catch (error) {
    logApiError('api/calendar/events GET', error);
    return ApiErrors.externalServiceError('Google Calendar');
  }
}

/**
 * Handler for POST requests - Creates a new calendar event
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth();
    if (!session || !session.user) {
      return ApiErrors.unauthorized();
    }

    // Check entitlements
    const accessContext = await getAccessContext(session.user.id);
    if (!accessContext.entitlements.features.calendar_connect) {
      await trackBlockedAction({
        feature: 'calendar_connect',
        reason: 'not_enabled',
        user_id: session.user.id,
        org_id: accessContext.user.orgId,
        status: 403,
      });

      return apiErrorResponse(
        'Calendar connect feature is not enabled for your plan',
        403,
        ErrorCodes.ENTITLEMENT_BLOCKED
      );
    }

    // Get event data from request body
    let body: {
      summary?: string;
      description?: string;
      location?: string;
      startDateTime?: string;
      endDateTime?: string;
      attendees?: string[];
    };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.invalidJson();
    }

    const {
      summary,
      description,
      location,
      startDateTime,
      endDateTime,
      attendees,
    } = body;

    // Validate required fields
    if (!summary) {
      return ApiErrors.missingField('summary');
    }
    if (!startDateTime) {
      return ApiErrors.missingField('startDateTime');
    }
    if (!endDateTime) {
      return ApiErrors.missingField('endDateTime');
    }

    // Get the token directly from the database
    const tokens = await db
      .select()
      .from(googleCalendarToken)
      .where(eq(googleCalendarToken.userId, session.user.id));

    if (tokens.length === 0 || !tokens[0].token) {
      return apiErrorResponse(
        'Google Calendar is not connected',
        401,
        'calendar_not_connected'
      );
    }

    const token = tokens[0].token;

    // Create OAuth2 client with the token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      // Use the request URL to determine the redirect URL (this avoids hardcoding)
      `${request.nextUrl.origin}/api/calendar/auth/callback`,
    );

    oauth2Client.setCredentials(token);

    // Create calendar client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Format attendees if provided
    const formattedAttendees = attendees
      ? attendees.map((email: string) => ({ email }))
      : undefined;

    // Create the event
    const event = {
      summary,
      description,
      location,
      start: {
        dateTime: startDateTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'UTC',
      },
      attendees: formattedAttendees,
    };

    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all', // Send emails to attendees
    });

    return NextResponse.json({
      id: data.id,
      summary: data.summary,
      description: data.description,
      location: data.location,
      start: data.start,
      end: data.end,
      attendees: data.attendees,
      htmlLink: data.htmlLink,
      created: data.created,
      updated: data.updated,
    });
  } catch (error) {
    logApiError('api/calendar/events POST', error);
    return ApiErrors.externalServiceError('Google Calendar');
  }
}
