import { auth } from '@/app/(auth)/auth';
import type { ComposerKind } from '@/components/composer';
import { saveDocumentWithVersion } from '@/lib/db/document-service';
import { getDocumentsById } from '@/lib/db/queries';

/**
 * Beacon API endpoint for reliable document saves on page unload.
 * 
 * This endpoint is designed for use with navigator.sendBeacon() which
 * guarantees delivery even when the page is closing.
 * 
 * - Lightweight (no response body needed)
 * - Fire-and-forget
 * - Creates no versions (skipVersion equivalent)
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      // Return 204 even on auth failure - beacon doesn't care about response
      return new Response(null, { status: 204 });
    }

    const body = await request.json();
    const { id, content, title, kind } = body as {
      id: string;
      content: string;
      title?: string;
      kind?: ComposerKind;
    };

    if (!id || !content) {
      return new Response(null, { status: 204 });
    }

    // Check ownership
    const existingDocs = await getDocumentsById({ id });
    if (existingDocs.length > 0) {
      const [existingDoc] = existingDocs;
      if (existingDoc.userId !== session.user.id) {
        return new Response(null, { status: 204 });
      }
    }

    // Save without creating version (fast path)
    await saveDocumentWithVersion({
      id,
      content,
      title: title || existingDocs[0]?.title || 'Untitled',
      kind: kind || existingDocs[0]?.kind || 'text',
      userId: session.user.id,
      createVersion: false, // Never create version from beacon
      source: 'user',
    });

    // No Content - beacon doesn't need response body
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('[Beacon API] Error saving document:', error);
    // Return 204 even on error - beacon can't handle errors
    return new Response(null, { status: 204 });
  }
}
