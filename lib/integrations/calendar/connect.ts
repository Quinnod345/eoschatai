import { NextResponse } from 'next/server';
import { google } from 'googleapis';

import { getAccessContext } from '@/lib/entitlements';
import { trackBlockedAction } from '@/lib/analytics';

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

export const initiateCalendarConnection = async (
  origin: string,
  userId: string,
) => {
  const accessContext = await getAccessContext(userId);

  if (!accessContext.entitlements.features.calendar_connect) {
    await trackBlockedAction({
      feature: 'calendar_connect',
      reason: 'not_enabled',
      user_id: userId,
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

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${origin}/api/calendar/auth/callback`,
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: CALENDAR_SCOPES,
    prompt: 'consent',
    state: userId,
  });

  return NextResponse.redirect(authUrl);
};
