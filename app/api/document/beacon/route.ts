import { auth } from '@/app/(auth)/auth';
import type { ComposerKind } from '@/components/composer';
import { saveDocumentWithVersion } from '@/lib/db/document-service';
import { getDocumentsById } from '@/lib/db/queries';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BEACON_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_COMPOSER_KINDS: readonly ComposerKind[] = [
  'text',
  'code',
  'image',
  'sheet',
  'chart',
  'vto',
  'accountability',
];

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

    const contentLengthHeader = request.headers.get('content-length');
    const parsedContentLength = contentLengthHeader
      ? Number.parseInt(contentLengthHeader, 10)
      : Number.NaN;
    if (
      Number.isFinite(parsedContentLength) &&
      parsedContentLength > MAX_BEACON_PAYLOAD_BYTES
    ) {
      return new Response(null, { status: 204 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.warn('[Beacon API] Invalid JSON payload');
        return new Response(null, { status: 204 });
      }
      throw error;
    }

    const { id, content, title, kind } = body as {
      id: string;
      content: string;
      title?: string;
      kind?: ComposerKind;
    };

    if (typeof id !== 'string' || typeof content !== 'string') {
      return new Response(null, { status: 204 });
    }

    if (!id || !content) {
      return new Response(null, { status: 204 });
    }

    if (content.length > MAX_BEACON_PAYLOAD_BYTES) {
      return new Response(null, { status: 204 });
    }

    // Reject malformed IDs for new-document beacon writes.
    if (!UUID_PATTERN.test(id)) {
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

    const existingKind = existingDocs[0]?.kind as ComposerKind | undefined;
    const resolvedKind =
      kind && ALLOWED_COMPOSER_KINDS.includes(kind)
        ? kind
        : existingKind && ALLOWED_COMPOSER_KINDS.includes(existingKind)
          ? existingKind
          : 'text';
    const resolvedTitle =
      typeof title === 'string' && title.trim().length > 0
        ? title
        : existingDocs[0]?.title || 'Untitled';

    // Save without creating version (fast path)
    await saveDocumentWithVersion({
      id,
      content,
      title: resolvedTitle,
      kind: resolvedKind,
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
