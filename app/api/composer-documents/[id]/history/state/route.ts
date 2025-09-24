import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUndoRedoState } from '@/lib/db/document-history';

// GET /api/composer-documents/[id]/history/state - Get undo/redo state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 },
      );
    }

    const { id } = await params;
    const state = await getUndoRedoState(id, userId);

    return NextResponse.json(state);
  } catch (error) {
    console.error('Error fetching undo/redo state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch undo/redo state' },
      { status: 500 },
    );
  }
}
