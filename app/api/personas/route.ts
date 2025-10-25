import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  persona,
  personaDocument,
  personaComposerDocument,
  document,
  user,
} from '@/lib/db/schema';
import { eq, or, isNull, and, ne, inArray, desc } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
    const systemPersonas = await db
      .select()
      .from(persona)
      .where(
        and(
          eq(persona.isSystemPersona, true),
          ne(persona.name, 'EOS Implementer'), // Exclude EOS Implementer from DB
        ),
      )
      .orderBy(persona.createdAt);

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

    return NextResponse.json({
      systemPersonas: finalSystemPersonas,
      userPersonas,
      sharedPersonas,
    });
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
      try {
        const { processUserDocument } = await import('@/lib/ai/user-rag');
        const docs = await db
          .select()
          .from(document)
          .where(inArray(document.id, composerDocumentIds));
        for (const d of docs) {
          if (d.content) {
            await processUserDocument(newPersona.id, d.id, d.content, {
              fileName: d.title || 'Composer Document',
              category: (d.kind || 'text') as any,
              fileType: d.kind,
            });
          }
        }
      } catch (e) {
        console.error('PERSONA_API: Error processing composer documents:', e);
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
