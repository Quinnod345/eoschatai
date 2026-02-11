import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getDocumentVersion } from '@/lib/db/document-history';
import { db } from '@/lib/db';
import { document } from '@/lib/db/schema';
import { validateUuidField } from '@/lib/api/validation';
import { eq } from 'drizzle-orm';

// GET /api/composer-documents/history/version/[versionId] - Get specific version
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { versionId } = await params;
    const validatedVersionId = validateUuidField(versionId, 'versionId');
    if (!validatedVersionId.ok) {
      return NextResponse.json({ error: validatedVersionId.error }, { status: 400 });
    }

    const version = await getDocumentVersion(validatedVersionId.value);

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    const [doc] = await db
      .select({ id: document.id, userId: document.userId })
      .from(document)
      .where(eq(document.id, version.documentId));

    if (!doc || doc.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
