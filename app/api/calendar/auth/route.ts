import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { initiateCalendarConnection } from '@/lib/integrations/calendar/connect';

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

    return initiateCalendarConnection(request.nextUrl.origin, session.user.id);
  } catch (error) {
    console.error('Error initiating Google Calendar auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google Calendar authentication' },
      { status: 500 },
    );
  }
}
