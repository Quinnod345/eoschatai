import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  persona,
  personaDocument,
  personaComposerDocument,
  document,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
        knowledgeNamespace: EOS_IMPLEMENTER_PERSONA.knowledgeNamespace,
        createdAt: new Date(),
        updatedAt: new Date(),
        documentIds: [],
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

    // If not a system persona, check if it's a user persona
    const [userPersona] = await db
      .select()
      .from(persona)
      .where(and(eq(persona.id, id), eq(persona.userId, session.user.id)));

    if (!userPersona) {
      console.log('PERSONA_API: Persona not found', {
        personaId: id,
        userId: session.user.id,
      });
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Get associated documents for user personas
    const documents = await db
      .select()
      .from(personaDocument)
      .where(eq(personaDocument.personaId, id));

    // Get associated composer documents for user personas
    const composerDocs = await db
      .select({ documentId: personaComposerDocument.documentId })
      .from(personaComposerDocument)
      .where(eq(personaComposerDocument.personaId, id));

    console.log('PERSONA_API: Successfully fetched user persona', {
      personaId: id,
      personaName: userPersona.name,
      documentCount: documents.length,
    });

    return NextResponse.json({
      ...userPersona,
      documentIds: documents.map((d) => d.documentId),
      composerDocumentIds: composerDocs.map((d) => d.documentId),
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
    const body = await request.json();
    const {
      name,
      description,
      instructions,
      documentIds = [],
      composerDocumentIds,
    } = body;

    if (!name || !instructions) {
      return NextResponse.json(
        { error: 'Name and instructions are required' },
        { status: 400 },
      );
    }

    // Verify persona belongs to user
    const [existingPersona] = await db
      .select()
      .from(persona)
      .where(and(eq(persona.id, id), eq(persona.userId, session.user.id)));

    if (!existingPersona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Update persona
    const [updatedPersona] = await db
      .update(persona)
      .set({
        name,
        description,
        instructions,
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
      // Get current associations
      const currentComposerDocs = await db
        .select()
        .from(personaComposerDocument)
        .where(eq(personaComposerDocument.personaId, id));

      const currentIds = currentComposerDocs.map((d) => d.documentId);
      const newIdsSet = new Set((composerDocumentIds as string[]) || []);
      const currentIdsSet = new Set(currentIds);

      const toAdd = (composerDocumentIds as string[]).filter(
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
        const newRows = toAdd.map((documentId: string) => ({
          personaId: id,
          documentId,
        }));
        await db.insert(personaComposerDocument).values(newRows);
      }

      // Process newly added composer docs into persona namespace
      try {
        if (toAdd.length > 0) {
          const { processUserDocument } = await import('@/lib/ai/user-rag');
          // Fetch documents to get content and metadata
          const docs = await db
            .select()
            .from(document)
            .where(inArray(document.id, toAdd));

          for (const d of docs) {
            if (d.content) {
              await processUserDocument(id, d.id, d.content, {
                fileName: d.title || 'Composer Document',
                category: (d.kind || 'text') as any,
                fileType: d.kind,
              });
            }
          }
        }
      } catch (e) {
        console.error('PERSONA_API: Error processing composer docs:', e);
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

    // Verify persona belongs to user
    const [existingPersona] = await db
      .select()
      .from(persona)
      .where(and(eq(persona.id, id), eq(persona.userId, session.user.id)));

    if (!existingPersona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Clean up persona's vector namespace before deleting
    try {
      console.log('PERSONA_API: Cleaning up persona vector namespace', {
        personaId: id,
      });

      const { deletePersonaDocuments } = await import('@/lib/ai/persona-rag');
      const result = await deletePersonaDocuments(id);

      console.log('PERSONA_API: Cleaned up persona namespace', {
        personaId: id,
        deletedVectors: result.deleted,
      });
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
