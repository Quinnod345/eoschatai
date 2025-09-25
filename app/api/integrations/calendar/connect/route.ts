import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { initiateCalendarConnection } from '@/lib/integrations/calendar/connect';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return initiateCalendarConnection(request.nextUrl.origin, session.user.id);
  } catch (error) {
    console.error('Error initiating calendar connection:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google Calendar authentication' },
      { status: 500 },
    );
  }
}
