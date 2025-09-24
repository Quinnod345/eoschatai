import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getDocumentVersion } from '@/lib/db/document-history';

// GET /api/composer-documents/history/version/[versionId] - Get specific version
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { versionId } = await params;
    const version = await getDocumentVersion(versionId);

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    return NextResponse.json(version);
  } catch (error) {
    console.error('Error fetching document version:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document version' },
      { status: 500 },
    );
  }
}
