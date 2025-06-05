import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { persona, personaDocument } from '@/lib/db/schema';
import { eq, or, isNull, and, ne } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { hasEOSAccess } from '@/lib/utils/eos-access';

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
        name: EOS_IMPLEMENTER_PERSONA.name,
        description: EOS_IMPLEMENTER_PERSONA.description,
        instructions: EOS_IMPLEMENTER_PERSONA.instructions,
        iconUrl: null,
        isDefault: true,
        isSystemPersona: true,
        knowledgeNamespace: EOS_IMPLEMENTER_PERSONA.knowledgeNamespace,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Get user-created personas (exclude system personas)
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
        ),
      )
      .orderBy(persona.createdAt);

    return NextResponse.json({
      systemPersonas: finalSystemPersonas,
      userPersonas,
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
    const body = await request.json();
    const { name, description, instructions, documentIds = [] } = body;

    if (!name || !instructions) {
      return NextResponse.json(
        { error: 'Name and instructions are required' },
        { status: 400 },
      );
    }

    // Create the persona
    const [newPersona] = await db
      .insert(persona)
      .values({
        userId: session.user.id,
        name,
        description,
        instructions,
        isDefault: false,
      })
      .returning();

    // Create persona document associations
    if (documentIds && documentIds.length > 0) {
      console.log('PERSONA_API: Creating document associations', {
        personaId: newPersona.id,
        documentCount: documentIds.length,
      });

      const personaDocuments = documentIds.map((documentId) => ({
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

    return NextResponse.json(newPersona, { status: 201 });
  } catch (error) {
    console.error('Error creating persona:', error);
    return NextResponse.json(
      { error: 'Failed to create persona' },
      { status: 500 },
    );
  }
}
