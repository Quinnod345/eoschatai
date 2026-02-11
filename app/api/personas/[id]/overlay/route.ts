import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  persona,
  personaUserOverlay,
  personaUserOverlayDocument,
  userDocuments,
} from '@/lib/db/schema';
import { canAccessPersona } from '@/lib/organizations/permissions';
import { validateUuidField } from '@/lib/api/validation';
import { and, eq, inArray } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type OverlayRequestContext = {
  personaId: string;
  personaRecord: typeof persona.$inferSelect;
};

async function resolveOverlayRequestContext(
  personaId: string,
  userId: string,
): Promise<
  | { ok: true; data: OverlayRequestContext }
  | { ok: false; response: NextResponse }
> {
  const personaIdValidation = validateUuidField(personaId, 'persona ID');
  if (!personaIdValidation.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: personaIdValidation.error },
        { status: 400 },
      ),
    };
  }

  const [personaRecord] = await db
    .select()
    .from(persona)
    .where(eq(persona.id, personaIdValidation.value))
    .limit(1);

  if (!personaRecord) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Persona not found' }, { status: 404 }),
    };
  }

  if (personaRecord.isSystemPersona) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'System personas do not support overlays' },
        { status: 400 },
      ),
    };
  }

  const access = await canAccessPersona(userId, personaRecord);
  if (!access.canChat) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Persona not found' }, { status: 404 }),
    };
  }

  const isSharedPersona =
    personaRecord.visibility === 'org' || personaRecord.isShared === true;
  if (!isSharedPersona) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Overlays are only available on shared personas' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    data: { personaId: personaIdValidation.value, personaRecord },
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const contextResult = await resolveOverlayRequestContext(id, session.user.id);
    if (!contextResult.ok) {
      return contextResult.response;
    }

    const { personaId, personaRecord } = contextResult.data;

    if (!personaRecord.allowUserOverlay && !personaRecord.allowUserKnowledge) {
      return NextResponse.json(
        { error: 'This persona does not allow user customization' },
        { status: 403 },
      );
    }

    const [overlay] = await db
      .select({
        id: personaUserOverlay.id,
        additionalInstructions: personaUserOverlay.additionalInstructions,
      })
      .from(personaUserOverlay)
      .where(
        and(
          eq(personaUserOverlay.personaId, personaId),
          eq(personaUserOverlay.userId, session.user.id),
          eq(personaUserOverlay.isActive, true),
        ),
      )
      .limit(1);

    if (!overlay) {
      return NextResponse.json({ error: 'Overlay not found' }, { status: 404 });
    }

    const overlayDocs = await db
      .select({ documentId: personaUserOverlayDocument.documentId })
      .from(personaUserOverlayDocument)
      .where(eq(personaUserOverlayDocument.overlayId, overlay.id));

    return NextResponse.json({
      id: overlay.id,
      personaId,
      additionalInstructions: overlay.additionalInstructions ?? '',
      documentIds: overlayDocs.map((row) => row.documentId),
      allowUserOverlay: personaRecord.allowUserOverlay,
      allowUserKnowledge: personaRecord.allowUserKnowledge,
    });
  } catch (error) {
    console.error('Error fetching persona overlay:', error);
    return NextResponse.json(
      { error: 'Failed to fetch persona overlay' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const contextResult = await resolveOverlayRequestContext(id, session.user.id);
    if (!contextResult.ok) {
      return contextResult.response;
    }

    const { personaId, personaRecord } = contextResult.data;

    if (!personaRecord.allowUserOverlay && !personaRecord.allowUserKnowledge) {
      return NextResponse.json(
        { error: 'This persona does not allow user customization' },
        { status: 403 },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const additionalInstructions =
      typeof body.additionalInstructions === 'string'
        ? body.additionalInstructions.trim()
        : '';

    if (additionalInstructions && !personaRecord.allowUserOverlay) {
      return NextResponse.json(
        { error: 'This persona does not allow instruction overlays' },
        { status: 403 },
      );
    }

    const rawDocumentIds =
      body.documentIds === undefined
        ? []
        : Array.isArray(body.documentIds)
          ? body.documentIds
          : null;

    if (rawDocumentIds === null) {
      return NextResponse.json(
        { error: 'documentIds must be an array of UUIDs' },
        { status: 400 },
      );
    }

    const uniqueDocumentIds = Array.from(
      new Set(rawDocumentIds.filter((value): value is string => typeof value === 'string')),
    );

    for (const documentId of uniqueDocumentIds) {
      const documentIdValidation = validateUuidField(documentId, 'document ID');
      if (!documentIdValidation.ok) {
        return NextResponse.json(
          { error: documentIdValidation.error },
          { status: 400 },
        );
      }
    }

    if (uniqueDocumentIds.length > 0 && !personaRecord.allowUserKnowledge) {
      return NextResponse.json(
        { error: 'This persona does not allow overlay knowledge documents' },
        { status: 403 },
      );
    }

    if (uniqueDocumentIds.length > 0) {
      const ownedDocuments = await db
        .select({ id: userDocuments.id })
        .from(userDocuments)
        .where(
          and(
            eq(userDocuments.userId, session.user.id),
            inArray(userDocuments.id, uniqueDocumentIds),
          ),
        );

      if (ownedDocuments.length !== uniqueDocumentIds.length) {
        return NextResponse.json(
          { error: 'One or more documents are not accessible' },
          { status: 403 },
        );
      }
    }

    const normalizedInstructions =
      additionalInstructions.length > 0 ? additionalInstructions : null;

    const [existingOverlay] = await db
      .select({ id: personaUserOverlay.id })
      .from(personaUserOverlay)
      .where(
        and(
          eq(personaUserOverlay.personaId, personaId),
          eq(personaUserOverlay.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!normalizedInstructions && uniqueDocumentIds.length === 0) {
      if (existingOverlay) {
        await db
          .delete(personaUserOverlay)
          .where(eq(personaUserOverlay.id, existingOverlay.id));

        try {
          const { deletePersonaOverlayDocuments } = await import(
            '@/lib/ai/persona-rag'
          );
          await deletePersonaOverlayDocuments(personaId, session.user.id);
        } catch (error) {
          console.error(
            'Error clearing overlay namespace after empty update:',
            error,
          );
        }
      }

      return NextResponse.json({
        id: null,
        personaId,
        additionalInstructions: '',
        documentIds: [],
        allowUserOverlay: personaRecord.allowUserOverlay,
        allowUserKnowledge: personaRecord.allowUserKnowledge,
      });
    }

    let overlayId: string;

    if (existingOverlay) {
      const [updatedOverlay] = await db
        .update(personaUserOverlay)
        .set({
          additionalInstructions: normalizedInstructions,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(personaUserOverlay.id, existingOverlay.id))
        .returning({ id: personaUserOverlay.id });

      overlayId = updatedOverlay.id;
    } else {
      const [createdOverlay] = await db
        .insert(personaUserOverlay)
        .values({
          userId: session.user.id,
          personaId,
          additionalInstructions: normalizedInstructions,
          isActive: true,
        })
        .returning({ id: personaUserOverlay.id });

      overlayId = createdOverlay.id;
    }

    const currentOverlayDocs = await db
      .select({ documentId: personaUserOverlayDocument.documentId })
      .from(personaUserOverlayDocument)
      .where(eq(personaUserOverlayDocument.overlayId, overlayId));

    const currentDocumentIds = currentOverlayDocs.map((row) => row.documentId);
    const newDocumentIdsSet = new Set(uniqueDocumentIds);
    const currentDocumentIdsSet = new Set(currentDocumentIds);

    const docsToAdd = uniqueDocumentIds.filter(
      (documentId) => !currentDocumentIdsSet.has(documentId),
    );
    const docsToRemove = currentDocumentIds.filter(
      (documentId) => !newDocumentIdsSet.has(documentId),
    );

    if (docsToRemove.length > 0) {
      await db
        .delete(personaUserOverlayDocument)
        .where(
          and(
            eq(personaUserOverlayDocument.overlayId, overlayId),
            inArray(personaUserOverlayDocument.documentId, docsToRemove),
          ),
        );
    }

    if (docsToAdd.length > 0) {
      await db.insert(personaUserOverlayDocument).values(
        docsToAdd.map((documentId) => ({
          overlayId,
          documentId,
        })),
      );
    }

    try {
      const { processPersonaOverlayDocuments, deletePersonaOverlayDocuments } =
        await import('@/lib/ai/persona-rag');

      if (uniqueDocumentIds.length === 0) {
        await deletePersonaOverlayDocuments(personaId, session.user.id);
      } else if (docsToRemove.length > 0) {
        // We clear and re-index because vector chunks are not tracked per document.
        await deletePersonaOverlayDocuments(personaId, session.user.id);
        await processPersonaOverlayDocuments(
          personaId,
          session.user.id,
          uniqueDocumentIds,
        );
      } else if (docsToAdd.length > 0) {
        await processPersonaOverlayDocuments(personaId, session.user.id, docsToAdd);
      }
    } catch (error) {
      console.error('Error processing overlay document vectors:', error);
    }

    return NextResponse.json({
      id: overlayId,
      personaId,
      additionalInstructions: normalizedInstructions ?? '',
      documentIds: uniqueDocumentIds,
      allowUserOverlay: personaRecord.allowUserOverlay,
      allowUserKnowledge: personaRecord.allowUserKnowledge,
    });
  } catch (error) {
    console.error('Error upserting persona overlay:', error);
    return NextResponse.json(
      { error: 'Failed to update persona overlay' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const contextResult = await resolveOverlayRequestContext(id, session.user.id);
    if (!contextResult.ok) {
      return contextResult.response;
    }

    const { personaId } = contextResult.data;

    const [existingOverlay] = await db
      .select({ id: personaUserOverlay.id })
      .from(personaUserOverlay)
      .where(
        and(
          eq(personaUserOverlay.personaId, personaId),
          eq(personaUserOverlay.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!existingOverlay) {
      return NextResponse.json({ error: 'Overlay not found' }, { status: 404 });
    }

    await db
      .delete(personaUserOverlay)
      .where(eq(personaUserOverlay.id, existingOverlay.id));

    try {
      const { deletePersonaOverlayDocuments } = await import('@/lib/ai/persona-rag');
      await deletePersonaOverlayDocuments(personaId, session.user.id);
    } catch (error) {
      console.error('Error cleaning overlay namespace during delete:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting persona overlay:', error);
    return NextResponse.json(
      { error: 'Failed to delete persona overlay' },
      { status: 500 },
    );
  }
}
