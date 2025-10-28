import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { updateContextFeedback } from '@/lib/db/context-tracking';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messageId, wasHelpful } = await request.json();

    if (!messageId || typeof wasHelpful !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, wasHelpful' },
        { status: 400 },
      );
    }

    const feedback = wasHelpful ? 'helpful' : 'not_helpful';
    const success = await updateContextFeedback(messageId, feedback);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Feedback recorded',
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to record feedback' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Context Feedback API: Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

