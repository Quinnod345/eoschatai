import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { googleCalendarToken, user } from '@/lib/db/schema';

/**
 * Handler for GET requests - Checks if Google Calendar is connected
 */
export async function GET(_request: NextRequest) {
  // Get authenticated session
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { connected: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const tokens = await db
      .select()
      .from(googleCalendarToken)
      .where(eq(googleCalendarToken.userId, session.user.id));

    const users = await db
      .select({ googleCalendarConnected: user.googleCalendarConnected })
      .from(user)
      .where(eq(user.id, session.user.id));

    const hasToken = tokens.length > 0 && !!tokens[0].token;
    const userConnected = users.length > 0 && !!users[0].googleCalendarConnected;
    const isConnected = hasToken && userConnected;

    return NextResponse.json({ connected: isConnected });
  } catch (error) {
    console.error('Error checking Google Calendar status:', error);
    return NextResponse.json(
      { connected: false, error: 'Failed to check calendar status' },
      { status: 500 },
    );
  }
}
