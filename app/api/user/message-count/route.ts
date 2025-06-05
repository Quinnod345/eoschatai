import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { getMessageCountByUserId } from '@/lib/db/queries';
import { entitlementsByUserType } from '@/lib/ai/entitlements';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Set the user type
    const userType = session.user.type || 'regular';

    // Get the message count for the past 24 hours
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    // Get the max messages per day from entitlements
    const maxMessages = entitlementsByUserType[userType].maxMessagesPerDay;

    return NextResponse.json({
      count: messageCount,
      maxMessages,
      remaining: Math.max(0, maxMessages - messageCount),
    });
  } catch (error) {
    console.error('Error getting message count:', error);
    return NextResponse.json(
      { error: 'Failed to get message count' },
      { status: 500 },
    );
  }
}
