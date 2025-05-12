import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { googleCalendarToken, user } from '@/lib/db/schema';

/**
 * Handler for POST requests - Disconnects Google Calendar integration
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      // Delete token from the database
      await db
        .delete(googleCalendarToken)
        .where(eq(googleCalendarToken.userId, session.user.id));

      // Update user settings to indicate Google Calendar is disconnected
      await db
        .update(user)
        .set({ googleCalendarConnected: false })
        .where(eq(user.id, session.user.id));

      console.log('Google Calendar disconnected for user:', session.user.id);

      return NextResponse.json({ success: true });
    } catch (dbError) {
      console.error('Database error disconnecting Google Calendar:', dbError);
      return NextResponse.json(
        { error: 'Failed to disconnect Google Calendar' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google Calendar' },
      { status: 500 },
    );
  }
}
