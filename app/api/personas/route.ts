import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  persona,
  personaDocument,
  personaComposerDocument,
  document,
  user,
  userCoursePersonaSubscription,
  circleCoursePersona,
} from '@/lib/db/schema';
import { eq, or, isNull, and, ne, inArray, desc } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { API_CACHE } from '@/lib/api/cache-headers';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Dynamically import EOS implementer functions to avoid server-only import issues
    const { hasEOSImplementerAccess, EOS_IMPLEMENTER_PERSONA } = await import(
      '@/lib/ai/eos-implementer'
    );

    // Check if user has EOS Implementer access
    const userHasEOSImplementerAccess = hasEOSImplementerAccess(
      session.user.email || '',
    );

    // Get system personas from database (excluding EOS Implementer since it's now hardcoded)
    // For course personas, only show ones the user has subscribed to
    const allSystemPersonas = await db
      .select()
      .from(persona)
      .where(
        and(
          eq(persona.isSystemPersona, true),
          ne(persona.name, 'EOS Implementer'), // Exclude EOS Implementer from DB
        ),
      )
      .orderBy(persona.createdAt);

    // Get user's course persona subscriptions
    const courseSubscriptions = await db
      .select({
        personaId: userCoursePersonaSubscription.personaId,
      })
      .from(userCoursePersonaSubscription)
      .where(
        and(
          eq(userCoursePersonaSubscription.userId, session.user.id),
          eq(userCoursePersonaSubscription.isActive, true),
        ),
      );

    const subscribedCoursePersonaIds = new Set(
      courseSubscriptions.map((s) => s.personaId),
    );

    // Get all course persona IDs to identify which personas are course-based
    const coursePersonas = await db
      .select({ personaId: circleCoursePersona.personaId })
      .from(circleCoursePersona);

    const coursePersonaIds = new Set(coursePersonas.map((cp) => cp.personaId));

    // Filter system personas: include non-course personas OR course personas user is subscribed to
    const systemPersonas = allSystemPersonas.filter((p) => {
      const isCoursePersona = coursePersonaIds.has(p.id);
      if (!isCoursePersona) {
        // Not a course persona, include it
        return true;
      }
      // Is a course persona, only include if user is subscribed
      return subscribedCoursePersonaIds.has(p.id);
    });

    // Add hardcoded EOS Implementer if user has access
    const finalSystemPersonas = [...systemPersonas];
    if (userHasEOSImplementerAccess) {
      finalSystemPersonas.unshift({
        id: EOS_IMPLEMENTER_PERSONA.id,
        userId: null,
        orgId: null,
        name: EOS_IMPLEMENTER_PERSONA.name,
        description: EOS_IMPLEMENTER_PERSONA.description,
        instructions: EOS_IMPLEMENTER_PERSONA.instructions,
        iconUrl: null,
        isDefault: true,
        isSystemPersona: true,
        isShared: null,
        knowledgeNamespace: EOS_IMPLEMENTER_PERSONA.knowledgeNamespace,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Get user's org if they have one
    const [userRecord] = await db
      .select({ orgId: user.orgId })
      .from(user)
      .where(eq(user.id, session.user.id));

    // Get user-created personas (exclude system personas and shared personas)
    const userPersonas = await db
      .select()
      .from(persona)
      .where(
        and(
          eq(persona.userId, session.user.id),
          or(
            eq(persona.isSystemPersona, false),
            isNull(persona.isSystemPersona),
          ),
          or(eq(persona.isShared, false), isNull(persona.isShared)),
        ),
      )
      .orderBy(persona.createdAt);

    // Get shared org personas if user is in an org
    let sharedPersonas: typeof userPersonas = [];
    if (userRecord?.orgId) {
      sharedPersonas = await db
        .select()
        .from(persona)
        .where(
          and(eq(persona.orgId, userRecord.orgId), eq(persona.isShared, true)),
        )
        .orderBy(desc(persona.createdAt));
    }

    // Use private-medium cache: 60s max-age with 120s stale-while-revalidate
    // Personas change infrequently, and the list can be briefly cached
    return NextResponse.json(
      {
        systemPersonas: finalSystemPersonas,
        userPersonas,
        sharedPersonas,
      },
      { headers: API_CACHE.privateMedium() }
    );
  } catch (error) {
    console.error('Error fetching personas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personas' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check entitlements for custom persona creation
    const { getAccessContext } = await import('@/lib/entitlements');
    const accessContext = await getAccessContext(session.user.id);

    if (!accessContext.entitlements.features.personas.custom) {
      return NextResponse.json(
        {
          error: 'Custom personas are a Pro feature',
          code: 'FEATURE_LOCKED',
          requiredPlan: 'pro',
          feature: 'personas.custom',
        },
        { status: 403 },
      );
    }

    // Check persona count limit
    const currentPersonaCount = await db
      .select()
      .from(persona)
      .where(
        and(
          eq(persona.userId, session.user.id),
          or(
            eq(persona.isSystemPersona, false),
            isNull(persona.isSystemPersona),
          ),
        ),
      );

    const maxPersonas = accessContext.entitlements.features.personas.max_count;
    if (maxPersonas !== -1 && currentPersonaCount.length >= maxPersonas) {
      return NextResponse.json(
        {
          error: `You've reached your persona limit (${maxPersonas} personas)`,
          code: 'LIMIT_REACHED',
          limit: maxPersonas,
          current: currentPersonaCount.length,
          requiredPlan: 'business',
          feature: 'personas.unlimited',
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      instructions,
      documentIds = [],
      composerDocumentIds = [],
      isShared = false,
    } = body;

    if (!name || !instructions) {
      return NextResponse.json(
        { error: 'Name and instructions are required' },
        { status: 400 },
      );
    }

    // If creating a shared persona, check permissions and entitlements
    let orgId = null;
    if (isShared) {
      // Check if shared personas are enabled
      if (!accessContext.entitlements.features.personas.shared) {
        return NextResponse.json(
          {
            error: 'Shared personas are a Business feature',
            code: 'FEATURE_LOCKED',
            requiredPlan: 'business',
            feature: 'personas.shared',
          },
          { status: 403 },
        );
      }

      // Get user's org
      const [userRecord] = await db
        .select({ orgId: user.orgId })
        .from(user)
        .where(eq(user.id, session.user.id));

      if (!userRecord?.orgId) {
        return NextResponse.json(
          {
            error:
              'You must be part of an organization to create shared personas',
          },
          { status: 403 },
        );
      }

      orgId = userRecord.orgId;

      // Check permissions
      const { checkOrgPermission } = await import(
        '@/lib/organizations/permissions'
      );
      const hasPermission = await checkOrgPermission(
        session.user.id,
        orgId,
        'personas.create',
      );

      if (!hasPermission) {
        return NextResponse.json(
          { error: 'You do not have permission to create shared personas' },
          { status: 403 },
        );
      }
    }

    // Create the persona
    const [newPersona] = await db
      .insert(persona)
      .values({
        userId: session.user.id,
        orgId,
        name,
        description,
        instructions,
        isDefault: false,
        isShared,
      })
      .returning();

    // Create persona document associations
    if (documentIds && documentIds.length > 0) {
      console.log('PERSONA_API: Creating document associations', {
        personaId: newPersona.id,
        documentCount: documentIds.length,
      });

      const personaDocuments = documentIds.map((documentId: string) => ({
        personaId: newPersona.id,
        documentId,
      }));

      await db.insert(personaDocument).values(personaDocuments);

      // Process documents into persona's vector namespace
      console.log('PERSONA_API: Processing documents into persona namespace', {
        personaId: newPersona.id,
        documentIds,
      });

      try {
        const { processPersonaDocuments } = await import(
          '@/lib/ai/persona-rag'
        );
        await processPersonaDocuments(
          newPersona.id,
          documentIds,
          session.user.id,
        );
        console.log(
          'PERSONA_API: Successfully processed documents for persona',
        );
      } catch (error) {
        console.error(
          'PERSONA_API: Error processing persona documents:',
          error,
        );
        // Don't fail the entire operation if document processing fails
        // The documents are still associated in the database
      }
    }

    // Create composer document associations
    if (composerDocumentIds && composerDocumentIds.length > 0) {
      const rows = composerDocumentIds.map((documentId: string) => ({
        personaId: newPersona.id,
        documentId,
      }));
      await db.insert(personaComposerDocument).values(rows);

      // Process composer documents into persona namespace
      // Use Promise.allSettled for resilience - individual failures won't stop other documents
      const { processUserDocument } = await import('@/lib/ai/user-rag');
      const docs = await db
        .select()
        .from(document)
        .where(inArray(document.id, composerDocumentIds));
      
      const results = await Promise.allSettled(
        docs
          .filter((d) => d.content)
          .map((d) =>
            processUserDocument(newPersona.id, d.id, d.content!, {
              fileName: d.title || 'Composer Document',
              category: (d.kind || 'text') as any,
              fileType: d.kind,
            })
          )
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

    return NextResponse.json(newPersona, { status: 201 });
  } catch (error) {
    console.error('Error creating persona:', error);
    return NextResponse.json(
      { error: 'Failed to create persona' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('id');

    if (!personaId) {
      return NextResponse.json(
        { error: 'Persona ID is required' },
        { status: 400 },
      );
    }

    // Check if this is a course persona
    console.log(
      `[Persona Delete] Checking if ${personaId} is a course persona...`,
    );

    const [coursePersona] = await db
      .select()
      .from(circleCoursePersona)
      .where(eq(circleCoursePersona.personaId, personaId))
      .limit(1);

    console.log(
      `[Persona Delete] Course persona check result:`,
      coursePersona ? 'Found' : 'Not found',
    );

    if (coursePersona) {
      // For course personas, fully delete the persona and all its data
      console.log(
        `[Persona Delete] Deleting course persona ${personaId} and all associated data`,
      );

      // Delete from Upstash Vector namespace
      try {
        const { Index } = await import('@upstash/vector');
        const url = process.env.UPSTASH_USER_RAG_REST_URL;
        const token = process.env.UPSTASH_USER_RAG_REST_TOKEN;

        if (url && token) {
          const client = new Index({ url, token });
          const namespaceClient = client.namespace(personaId);

          // Delete all vectors in the namespace
          await namespaceClient.reset();
          console.log(
            `[Persona Delete] Deleted Upstash vectors for namespace ${personaId}`,
          );
        }
      } catch (vectorError) {
        console.error('[Persona Delete] Error deleting vectors:', vectorError);
        // Continue with database deletion
      }

      // First, null out any chats using this persona
      const { chat } = await import('@/lib/db/schema');
      await db
        .update(chat)
        .set({ personaId: null })
        .where(eq(chat.personaId, personaId));

      console.log(`[Persona Delete] Nulled persona references in Chat table`);

      // Delete the course persona mapping
      await db
        .delete(circleCoursePersona)
        .where(eq(circleCoursePersona.personaId, personaId));

      // Delete all user subscriptions
      await db
        .delete(userCoursePersonaSubscription)
        .where(eq(userCoursePersonaSubscription.personaId, personaId));

      // Delete the persona itself
      await db.delete(persona).where(eq(persona.id, personaId));

      console.log(
        `[Persona Delete] ✅ Deleted course persona and all data for ${personaId}`,
      );

      return NextResponse.json({
        success: true,
        message: 'Course assistant deleted completely',
      });
    }

    // For regular user personas, proceed with normal deletion
    const [personaToDelete] = await db
      .select()
      .from(persona)
      .where(eq(persona.id, personaId))
      .limit(1);

    if (!personaToDelete) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Verify ownership (allow null userId which means it's a system persona user can manage)
    if (
      personaToDelete.userId !== null &&
      personaToDelete.userId !== session.user.id
    ) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this persona' },
        { status: 403 },
      );
    }

    // First, null out any chats using this persona
    const { chat } = await import('@/lib/db/schema');
    await db
      .update(chat)
      .set({ personaId: null })
      .where(eq(chat.personaId, personaId));

    console.log(`[Persona Delete] Nulled persona references in Chat table`);

    // Delete persona documents from vector store
    try {
      const { deletePersonaDocuments } = await import('@/lib/ai/persona-rag');
      await deletePersonaDocuments(personaId);
    } catch (error) {
      console.error(
        'Error deleting persona documents from vector store:',
        error,
      );
      // Continue with database deletion even if vector deletion fails
    }

    // Delete the persona (cascades to related records)
    await db.delete(persona).where(eq(persona.id, personaId));

    return NextResponse.json({
      success: true,
      message: 'Persona deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting persona:', error);
    return NextResponse.json(
      { error: 'Failed to delete persona' },
      { status: 500 },
    );
  }
}
