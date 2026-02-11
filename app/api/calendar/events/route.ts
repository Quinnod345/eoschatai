import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { googleCalendarToken } from '@/lib/db/schema';
import { getAccessContext } from '@/lib/entitlements';
import { trackBlockedAction } from '@/lib/analytics';

/**
 * Handler for GET requests - Retrieves calendar events
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

      return NextResponse.json(
        {
          code: 'ENTITLEMENT_BLOCK',
          feature: 'calendar_connect',
          reason: 'not_enabled',
        },
        { status: 403 },
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const defaultTimeMax = new Date();
    defaultTimeMax.setDate(defaultTimeMax.getDate() + 7); // Default to 7 days from now
    const timeMax = searchParams.get('timeMax') || defaultTimeMax.toISOString();
    const parsedMaxResults = Number.parseInt(
      searchParams.get('maxResults') || '10',
      10,
    );
    const maxResults = Number.isFinite(parsedMaxResults)
      ? Math.min(Math.max(parsedMaxResults, 1), 50)
      : 10;

    const parsedTimeMin = new Date(timeMin);
    const parsedTimeMax = new Date(timeMax);
    if (
      !Number.isFinite(parsedTimeMin.getTime()) ||
      !Number.isFinite(parsedTimeMax.getTime())
    ) {
      return NextResponse.json(
        { error: 'Invalid time range parameters' },
        { status: 400 },
      );
    }
    if (parsedTimeMin.getTime() > parsedTimeMax.getTime()) {
      return NextResponse.json(
        { error: 'timeMin must be before timeMax' },
        { status: 400 },
      );
    }

    const maxWindowMs = 366 * 24 * 60 * 60 * 1000;
    if (parsedTimeMax.getTime() - parsedTimeMin.getTime() > maxWindowMs) {
      return NextResponse.json(
        { error: 'Requested time range is too large' },
        { status: 400 },
      );
    }

    // Get the token directly from the database
    const tokens = await db
      .select()
      .from(googleCalendarToken)
      .where(eq(googleCalendarToken.userId, session.user.id));

    if (tokens.length === 0 || !tokens[0].token) {
      return NextResponse.json(
        { error: 'Google Calendar is not connected' },
        { status: 401 },
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
      timeMin: parsedTimeMin.toISOString(),
      timeMax: parsedTimeMax.toISOString(),
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
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 },
    );
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

      return NextResponse.json(
        {
          code: 'ENTITLEMENT_BLOCK',
          feature: 'calendar_connect',
          reason: 'not_enabled',
        },
        { status: 403 },
      );
    }

    // Get event data from request body
    const {
      summary,
      description,
      location,
      startDateTime,
      endDateTime,
      attendees,
    } = await request.json();

    // Validate required fields
    if (!summary || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const parsedStartDate = new Date(startDateTime);
    const parsedEndDate = new Date(endDateTime);
    if (
      !Number.isFinite(parsedStartDate.getTime()) ||
      !Number.isFinite(parsedEndDate.getTime())
    ) {
      return NextResponse.json(
        { error: 'Invalid event date values' },
        { status: 400 },
      );
    }
    if (parsedStartDate.getTime() >= parsedEndDate.getTime()) {
      return NextResponse.json(
        { error: 'Event end time must be after start time' },
        { status: 400 },
      );
    }

    // Get the token directly from the database
    const tokens = await db
      .select()
      .from(googleCalendarToken)
      .where(eq(googleCalendarToken.userId, session.user.id));

    if (tokens.length === 0 || !tokens[0].token) {
      return NextResponse.json(
        { error: 'Google Calendar is not connected' },
        { status: 401 },
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
        dateTime: parsedStartDate.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: parsedEndDate.toISOString(),
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
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 },
    );
  }
}
