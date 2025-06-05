import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { generateUUID } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import { googleCalendarToken, user } from '@/lib/db/schema';

/**
 * Handler for GET requests - Retrieves the user's Google Calendar token
 */
export async function GET() {
  try {
    // Get authenticated session
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Google Calendar token for the user
    const tokens = await db
      .select()
      .from(googleCalendarToken)
      .where(eq(googleCalendarToken.userId, session.user.id));

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Google Calendar is not connected' },
        { status: 404 },
      );
    }

    // Return the token
    return NextResponse.json({ token: tokens[0].token });
  } catch (error) {
    console.error('Error getting Google Calendar token:', error);
    return NextResponse.json(
      { error: 'Failed to get Google Calendar token' },
      { status: 500 },
    );
  }
}

/**
 * Handler for POST requests - Saves or updates the user's Google Calendar token
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get token from request body
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Check if token already exists for this user
    const existingTokens = await db
      .select()
      .from(googleCalendarToken)
      .where(eq(googleCalendarToken.userId, session.user.id));

    if (existingTokens.length > 0) {
      // Update existing token
      await db
        .update(googleCalendarToken)
        .set({ token, updatedAt: new Date() })
        .where(eq(googleCalendarToken.id, existingTokens[0].id));
    } else {
      // Create new token
      await db.insert(googleCalendarToken).values({
        id: generateUUID(),
        userId: session.user.id,
        token,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Also update user settings to indicate Google Calendar is connected
    await db
      .update(user)
      .set({ googleCalendarConnected: true })
      .where(eq(user.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Google Calendar token:', error);
    return NextResponse.json(
      { error: 'Failed to save Google Calendar token' },
      { status: 500 },
    );
  }
}

/**
 * Handler for DELETE requests - Removes the user's Google Calendar token
 */
export async function DELETE() {
  try {
    // Get authenticated session
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete token
    await db
      .delete(googleCalendarToken)
      .where(eq(googleCalendarToken.userId, session.user.id));

    // Update user settings to indicate Google Calendar is disconnected
    await db
      .update(user)
      .set({ googleCalendarConnected: false })
      .where(eq(user.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Google Calendar token:', error);
    return NextResponse.json(
      { error: 'Failed to delete Google Calendar token' },
      { status: 500 },
    );
  }
}
