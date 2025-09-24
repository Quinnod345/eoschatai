import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { redoDocumentChange } from '@/lib/db/document-history';

// POST /api/documents/[documentId]/history/redo - Redo to next version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 },
      );
    }

    const { documentId } = await params;
    const version = await redoDocumentChange(documentId, userId);

    return NextResponse.json(version);
  } catch (error: any) {
    console.error('Error performing redo:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to redo' },
      { status: 400 },
    );
  }
}
