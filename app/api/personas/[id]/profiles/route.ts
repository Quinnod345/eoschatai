import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { persona, personaProfile, profileDocument } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  canAccessPersona,
  checkOrgPermission,
} from '@/lib/organizations/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { getAccessContext } = await import('@/lib/entitlements');
    const accessContext = await getAccessContext(session.user.id);
    if (!accessContext.entitlements.features.personas.custom) {
      return NextResponse.json(
        {
          error: 'AI personas are a Pro feature',
          code: 'FEATURE_LOCKED',
          requiredPlan: 'pro',
          feature: 'personas.custom',
        },
        { status: 403 },
      );
    }

    const { id: personaId } = await params;

    // Handle hardcoded EOS implementer profiles
    // Dynamically import EOS implementer constants to avoid server-only import issues
    const {
      hasEOSImplementerAccess,
      EOS_IMPLEMENTER_PROFILES,
      EOS_IMPLEMENTER_UUID,
    } = await import('@/lib/ai/eos-implementer');

    if (personaId === EOS_IMPLEMENTER_UUID || personaId === 'eos-implementer') {
      // Check if user has access to EOS implementer
      if (!hasEOSImplementerAccess(session.user.email || '')) {
        return NextResponse.json(
          { error: 'Persona not found' },
          { status: 404 },
        );
      }

      // Return hardcoded profiles formatted as database profiles
      // Use string IDs for frontend compatibility
      const hardcodedProfiles = EOS_IMPLEMENTER_PROFILES.map((profile) => ({
        id: profile.stringId,
        personaId: EOS_IMPLEMENTER_UUID,
        name: profile.name,
        description: profile.description,
        instructions: profile.instructions,
        knowledgeNamespace: profile.knowledgeNamespace,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      return NextResponse.json(hardcodedProfiles);
    }

    // Check if this is a system persona (accessible to all users) or user persona
    const [personaData] = await db
      .select()
      .from(persona)
      .where(eq(persona.id, personaId))
      .limit(1);

    if (!personaData) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const access = await canAccessPersona(session.user.id, personaData);
    if (!access.canChat) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Fetch profiles for this persona
    const profiles = await db
      .select()
      .from(personaProfile)
      .where(eq(personaProfile.personaId, personaId))
      .orderBy(personaProfile.createdAt);

    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Error fetching persona profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: personaId } = await params;
    const body = await request.json();

    // Verify the persona exists and caller can edit
    const [personaData] = await db
      .select()
      .from(persona)
      .where(eq(persona.id, personaId))
      .limit(1);

    if (!personaData) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    let canEdit = personaData.userId === session.user.id;
    if (
      !canEdit &&
      personaData.orgId &&
      (personaData.visibility === 'org' || personaData.isShared === true)
    ) {
      canEdit = await checkOrgPermission(
        session.user.id,
        personaData.orgId,
        'personas.edit',
      );
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this persona' },
        { status: 403 },
      );
    }

    // Don't allow creating profiles for system personas
    if (personaData.isSystemPersona) {
      return NextResponse.json(
        { error: 'Cannot create profiles for system personas' },
        { status: 403 },
      );
    }

    const {
      name,
      description,
      instructions,
      documentIds = [],
      isDefault = false,
    } = body;

    if (!name || !instructions) {
      return NextResponse.json(
        { error: 'Name and instructions are required' },
        { status: 400 },
      );
    }

    // Create the profile
    const [newProfile] = await db
      .insert(personaProfile)
      .values({
        personaId,
        name: name.trim(),
        description: description?.trim() || null,
        instructions: instructions.trim(),
        isDefault,
      })
      .returning();

    // Associate documents with the profile if provided
    if (documentIds.length > 0) {
      const profileDocuments = documentIds.map((documentId: string) => ({
        profileId: newProfile.id,
        documentId,
      }));

      await db.insert(profileDocument).values(profileDocuments);
    }

    return NextResponse.json(newProfile, { status: 201 });
  } catch (error) {
    console.error('Error creating persona profile:', error);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 },
    );
  }
}
