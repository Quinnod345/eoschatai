import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { endEditSession } from '@/lib/db/document-history';

// DELETE /api/composer-documents/history/session/[sessionId] - End edit session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    await endEditSession(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error ending edit session:', error);
    return NextResponse.json(
      { error: 'Failed to end edit session' },
      { status: 500 },
    );
  }
}
