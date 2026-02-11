import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  persona,
  personaDocument,
  personaComposerDocument,
  personaUserOverlay,
  document,
  user,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  canAccessPersona,
  checkOrgPermission,
} from '@/lib/organizations/permissions';

type PersonaVisibility = 'private' | 'org';

function resolvePersonaVisibility(input: {
  visibility?: unknown;
  isShared?: unknown;
}): PersonaVisibility {
  if (input.visibility === 'org' || input.isShared === true) {
    return 'org';
  }
  return 'private';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    console.log('PERSONA_API: Unauthorized GET request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    console.log('PERSONA_API: Fetching persona', {
      personaId: id,
      userId: session.user.id,
    });

    // Handle hardcoded EOS Implementer persona
    const {
      hasEOSImplementerAccess,
      EOS_IMPLEMENTER_PERSONA,
      EOS_IMPLEMENTER_UUID,
    } = await import('@/lib/ai/eos-implementer');

    if (
      (id === 'eos-implementer' || id === EOS_IMPLEMENTER_UUID) &&
      hasEOSImplementerAccess(session.user.email || '')
    ) {
      console.log('PERSONA_API: Returning hardcoded EOS Implementer persona', {
        personaId: id,
        userEmail: session.user.email,
      });

      return NextResponse.json({
        id: EOS_IMPLEMENTER_UUID,
        userId: null,
        name: EOS_IMPLEMENTER_PERSONA.name,
        description: EOS_IMPLEMENTER_PERSONA.description,
        instructions: EOS_IMPLEMENTER_PERSONA.instructions,
        iconUrl: null,
        isDefault: true,
        isSystemPersona: true,
        isShared: false,
        visibility: 'private',
        lockInstructions: false,
        lockKnowledge: false,
        allowUserOverlay: false,
        allowUserKnowledge: false,
        publishedAt: null,
        knowledgeNamespace: EOS_IMPLEMENTER_PERSONA.knowledgeNamespace,
        createdAt: new Date(),
        updatedAt: new Date(),
        documentIds: [],
        composerDocumentIds: [],
        canChat: true,
        canViewSettings: false,
        canEdit: false,
      });
    }

    // First try to find as a system persona (accessible to all users)
    const [systemPersona] = await db
      .select()
      .from(persona)
      .where(and(eq(persona.id, id), eq(persona.isSystemPersona, true)));

    if (systemPersona) {
      console.log('PERSONA_API: Found system persona', {
        personaId: id,
        personaName: systemPersona.name,
        isSystemPersona: true,
      });

      return NextResponse.json({
        ...systemPersona,
        documentIds: [], // System personas don't have user document associations
      });
    }

    const [personaRecord] = await db
      .select()
      .from(persona)
      .where(eq(persona.id, id))
      .limit(1);

    if (!personaRecord) {
      console.log('PERSONA_API: Persona not found', {
        personaId: id,
        userId: session.user.id,
      });
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const access = await canAccessPersona(session.user.id, personaRecord);
    if (!access.canChat) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const isOwner = personaRecord.userId === session.user.id;
    const shouldHideInstructions =
      personaRecord.lockInstructions && !isOwner && !access.canViewSettings;
    const shouldHideKnowledge =
      personaRecord.lockKnowledge && !isOwner && !access.canViewSettings;

    let documentIds: string[] = [];
    let composerDocumentIds: string[] = [];

    if (!shouldHideKnowledge) {
      const documents = await db
        .select()
        .from(personaDocument)
        .where(eq(personaDocument.personaId, id));

      const composerDocs = await db
        .select({ documentId: personaComposerDocument.documentId })
        .from(personaComposerDocument)
        .where(eq(personaComposerDocument.personaId, id));

      documentIds = documents.map((d) => d.documentId);
      composerDocumentIds = composerDocs.map((d) => d.documentId);
    }

    console.log('PERSONA_API: Successfully fetched persona', {
      personaId: id,
      personaName: personaRecord.name,
      documentCount: documentIds.length,
    });

    return NextResponse.json({
      ...personaRecord,
      instructions: shouldHideInstructions
        ? '[Instructions hidden by admin]'
        : personaRecord.instructions,
      documentIds,
      composerDocumentIds,
      knowledgeHidden: shouldHideKnowledge,
      canChat: access.canChat,
      canViewSettings: access.canViewSettings,
      canEdit: access.canEdit,
    });
  } catch (error) {
    console.error('PERSONA_API: Error fetching persona:', {
      error: error instanceof Error ? error.message : String(error),
      personaId: (await params).id,
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: 'Failed to fetch persona' },
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
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : null;
    const instructions =
      typeof body.instructions === 'string' ? body.instructions.trim() : '';
    const documentIds = Array.isArray(body.documentIds)
      ? (body.documentIds as string[])
      : [];
    const composerDocumentIds = Array.isArray(body.composerDocumentIds)
      ? (body.composerDocumentIds as string[])
      : undefined;
    const visibility = resolvePersonaVisibility({
      visibility: body.visibility,
      isShared: body.isShared,
    });
    const lockInstructions = body.lockInstructions === true;
    const lockKnowledge = body.lockKnowledge === true;
    const allowUserOverlay = body.allowUserOverlay === true;
    const allowUserKnowledge = body.allowUserKnowledge === true;

    if (!name || !instructions) {
      return NextResponse.json(
        { error: 'Name and instructions are required' },
        { status: 400 },
      );
    }

    // Verify persona exists and check permissions
    const [existingPersona] = await db
      .select()
      .from(persona)
      .where(eq(persona.id, id))
      .limit(1);

    if (!existingPersona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const isOwner = existingPersona.userId === session.user.id;
    let canEdit = isOwner;

    if (
      !canEdit &&
      existingPersona.orgId &&
      (existingPersona.visibility === 'org' || existingPersona.isShared === true)
    ) {
      canEdit = await checkOrgPermission(
        session.user.id,
        existingPersona.orgId,
        'personas.edit',
      );
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this persona' },
        { status: 403 },
      );
    }

    let nextOrgId: string | null = existingPersona.orgId;
    if (visibility === 'org') {
      if (!existingPersona.orgId) {
        const [userRecord] = await db
          .select({ orgId: user.orgId })
          .from(user)
          .where(eq(user.id, session.user.id))
          .limit(1);
        nextOrgId = userRecord?.orgId ?? null;
      }

      if (!nextOrgId) {
        return NextResponse.json(
          { error: 'You must be in an organization to publish this persona' },
          { status: 403 },
        );
      }
    } else {
      nextOrgId = null;
    }

    // Update persona
    const [updatedPersona] = await db
      .update(persona)
      .set({
        name,
        description,
        instructions,
        orgId: nextOrgId,
        isShared: visibility === 'org',
        visibility,
        lockInstructions,
        lockKnowledge,
        allowUserOverlay,
        allowUserKnowledge,
        publishedAt:
          visibility === 'org'
            ? existingPersona.publishedAt || new Date()
            : null,
        updatedAt: new Date(),
      })
      .where(eq(persona.id, id))
      .returning();

    // Update document associations if provided
    if (documentIds !== undefined) {
      console.log('PERSONA_API: Updating document associations', {
        personaId: id,
        newDocumentCount: documentIds.length,
      });

      // Get current document associations
      const currentDocs = await db
        .select()
        .from(personaDocument)
        .where(eq(personaDocument.personaId, id));

      const currentDocIds = currentDocs.map((d) => d.documentId);
      const newDocIds = new Set(documentIds);
      const currentDocIdsSet = new Set(currentDocIds);

      // Find documents to add and remove
      const docsToAdd = documentIds.filter(
        (docId: string) => !currentDocIdsSet.has(docId),
      );
      const docsToRemove = currentDocIds.filter(
        (docId: string) => !newDocIds.has(docId),
      );

      console.log('PERSONA_API: Document changes', {
        current: currentDocIds.length,
        new: documentIds.length,
        toAdd: docsToAdd.length,
        toRemove: docsToRemove.length,
      });

      // Delete removed associations
      if (docsToRemove.length > 0) {
        await db
          .delete(personaDocument)
          .where(
            and(
              eq(personaDocument.personaId, id),
              inArray(personaDocument.documentId, docsToRemove),
            ),
          );
      }

      // Add new associations
      if (docsToAdd.length > 0) {
        const newPersonaDocuments = docsToAdd.map((documentId: string) => ({
          personaId: id,
          documentId,
        }));
        await db.insert(personaDocument).values(newPersonaDocuments);
      }

      // Process document changes in persona's vector namespace
      try {
        const { processPersonaDocuments, deletePersonaDocuments } =
          await import('@/lib/ai/persona-rag');

        // If all documents are removed, clear the persona namespace
        if (documentIds.length === 0 && currentDocIds.length > 0) {
          console.log(
            'PERSONA_API: Clearing all documents from persona namespace',
          );
          await deletePersonaDocuments(id);
        } else {
          // Process new documents into persona namespace
          if (docsToAdd.length > 0) {
            console.log(
              'PERSONA_API: Processing new documents into persona namespace',
              {
                personaId: id,
                documentIds: docsToAdd,
              },
            );
            await processPersonaDocuments(id, docsToAdd, session.user.id);
          }

          // Note: We don't remove individual documents from the vector store
          // as it's complex to track which chunks belong to which document.
          // For now, we only clear all documents when the persona has no documents.
        }

        console.log('PERSONA_API: Successfully updated persona documents');
      } catch (error) {
        console.error('PERSONA_API: Error updating persona documents:', error);
        // Don't fail the entire operation if document processing fails
      }
    }

    // Update composer document associations if provided
    if (composerDocumentIds !== undefined) {
      const normalizedComposerDocumentIds = Array.from(
        new Set((composerDocumentIds as string[]) || []),
      );

      // Get current associations
      const currentComposerDocs = await db
        .select()
        .from(personaComposerDocument)
        .where(eq(personaComposerDocument.personaId, id));

      const currentIds = currentComposerDocs.map((d) => d.documentId);
      const newIdsSet = new Set(normalizedComposerDocumentIds);
      const currentIdsSet = new Set(currentIds);

      const toAdd = normalizedComposerDocumentIds.filter(
        (docId) => !currentIdsSet.has(docId),
      );
      const toRemove = currentIds.filter((docId) => !newIdsSet.has(docId));

      if (toRemove.length > 0) {
        await db
          .delete(personaComposerDocument)
          .where(
            and(
              eq(personaComposerDocument.personaId, id),
              inArray(personaComposerDocument.documentId, toRemove),
            ),
          );
      }

      if (toAdd.length > 0) {
        const ownedComposerDocs = await db
          .select({
            id: document.id,
            title: document.title,
            content: document.content,
            kind: document.kind,
          })
          .from(document)
          .where(
            and(
              eq(document.userId, session.user.id),
              inArray(document.id, toAdd),
            ),
          );

        if (ownedComposerDocs.length !== toAdd.length) {
          return NextResponse.json(
            { error: 'One or more composer documents are not accessible' },
            { status: 403 },
          );
        }

        const newRows = toAdd.map((documentId: string) => ({
          personaId: id,
          documentId,
        }));
        await db.insert(personaComposerDocument).values(newRows);

        const { processUserDocument } = await import('@/lib/ai/user-rag');
        const processableComposerDocs = ownedComposerDocs.filter(
          (d): d is typeof d & { content: string } =>
            typeof d.content === 'string' && d.content.length > 0,
        );

        // Process documents in parallel with Promise.allSettled for resilience
        // Individual failures won't stop other documents from being processed
        const results = await Promise.allSettled(
          processableComposerDocs.map((d) =>
            processUserDocument(id, d.id, d.content, {
              fileName: d.title || 'Composer Document',
              category: (d.kind || 'text') as any,
              fileType: d.kind,
            }),
          ),
        );

        // Log any failures
        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
          console.error(
            `PERSONA_API: ${failures.length}/${results.length} composer doc(s) failed to process:`,
            failures.map((f) => (f as PromiseRejectedResult).reason)
          );
        }
      }
    }

    return NextResponse.json(updatedPersona);
  } catch (error) {
    console.error('Error updating persona:', error);
    return NextResponse.json(
      { error: 'Failed to update persona' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    console.log('PERSONA_API: Deleting persona', {
      personaId: id,
      userId: session.user.id,
    });

    // Verify persona exists and caller can delete it
    const [existingPersona] = await db
      .select()
      .from(persona)
      .where(eq(persona.id, id))
      .limit(1);

    if (!existingPersona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    let canDelete = existingPersona.userId === session.user.id;
    if (
      !canDelete &&
      existingPersona.orgId &&
      (existingPersona.visibility === 'org' || existingPersona.isShared === true)
    ) {
      canDelete = await checkOrgPermission(
        session.user.id,
        existingPersona.orgId,
        'personas.delete',
      );
    }

    if (!canDelete) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this persona' },
        { status: 403 },
      );
    }

    // Clean up persona's vector namespace before deleting
    try {
      console.log('PERSONA_API: Cleaning up persona vector namespace', {
        personaId: id,
      });

      const { deletePersonaDocuments, deletePersonaOverlayDocuments } = await import(
        '@/lib/ai/persona-rag'
      );
      const result = await deletePersonaDocuments(id);

      console.log('PERSONA_API: Cleaned up persona namespace', {
        personaId: id,
        deletedVectors: result.deleted,
      });

      const overlayRows = await db
        .select({ userId: personaUserOverlay.userId })
        .from(personaUserOverlay)
        .where(eq(personaUserOverlay.personaId, id));

      if (overlayRows.length > 0) {
        const cleanupResults = await Promise.allSettled(
          overlayRows.map((row) => deletePersonaOverlayDocuments(id, row.userId)),
        );
        const cleanupFailures = cleanupResults.filter(
          (entry) => entry.status === 'rejected',
        );

        if (cleanupFailures.length > 0) {
          console.error(
            `PERSONA_API: Failed to cleanup ${cleanupFailures.length} overlay namespace(s)`,
          );
        }
      }
    } catch (error) {
      console.error('PERSONA_API: Error cleaning up persona namespace:', error);
      // Continue with deletion even if namespace cleanup fails
    }

    // Delete persona (cascade will handle personaDocument entries)
    await db.delete(persona).where(eq(persona.id, id));

    console.log('PERSONA_API: Successfully deleted persona', {
      personaId: id,
      personaName: existingPersona.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PERSONA_API: Error deleting persona:', {
      error: error instanceof Error ? error.message : String(error),
      personaId: (await params).id,
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: 'Failed to delete persona' },
      { status: 500 },
    );
  }
}
