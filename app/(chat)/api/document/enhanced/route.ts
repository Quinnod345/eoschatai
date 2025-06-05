import { auth } from '@/app/(auth)/auth';
import type { ArtifactKind } from '@/components/artifact';
import { getDocumentsById, saveDocument } from '@/lib/db/queries';
import type { ArtifactChange } from '@/components/enhanced-artifact';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const {
    content,
    title,
    kind,
    change,
  }: {
    content: string;
    title: string;
    kind: ArtifactKind;
    change: ArtifactChange;
  } = await request.json();

  // Verify user owns the document
  const documents = await getDocumentsById({ id });
  if (documents.length > 0) {
    const [document] = documents;
    if (document.userId !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  try {
    // Save the document with enhanced metadata
    const document = await saveEnhancedDocument({
      id,
      content,
      title,
      kind,
      userId: session.user.id,
      change,
    });

    return Response.json(
      {
        document,
        change,
        success: true,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error saving enhanced document:', error);
    return new Response('Failed to save document', { status: 500 });
  }
}

// Enhanced save function that includes change tracking
async function saveEnhancedDocument({
  id,
  title,
  kind,
  content,
  userId,
  change,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  change: ArtifactChange;
}) {
  try {
    // For now, we'll use the existing saveDocument function
    // In a production system, you'd want to extend the database schema
    // to include change tracking metadata
    const document = await saveDocument({
      id,
      title,
      kind,
      content,
      userId,
    });

    // TODO: In a real implementation, you would:
    // 1. Save change metadata to a separate changes table
    // 2. Implement conflict resolution for concurrent edits
    // 3. Add support for operational transforms
    // 4. Store diff information for efficient storage

    console.log('Enhanced document saved with change:', {
      documentId: id,
      changeType: change.type,
      changeDescription: change.description,
      hasRange: !!change.range,
    });

    return document;
  } catch (error) {
    console.error('Failed to save enhanced document:', error);
    throw error;
  }
}
