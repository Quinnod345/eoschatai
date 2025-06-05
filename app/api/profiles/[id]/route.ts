import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { persona, personaProfile, profileDocument } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: profileId } = await params;

    // Fetch profile with persona verification
    const [profileData] = await db
      .select({
        profile: personaProfile,
        persona: persona,
      })
      .from(personaProfile)
      .innerJoin(persona, eq(personaProfile.personaId, persona.id))
      .where(
        and(
          eq(personaProfile.id, profileId),
          // Allow access to system personas or user-owned personas
          or(
            eq(persona.isSystemPersona, true),
            eq(persona.userId, session.user.id),
          ),
        ),
      )
      .limit(1);

    if (!profileData) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Fetch associated documents
    const documents = await db
      .select()
      .from(profileDocument)
      .where(eq(profileDocument.profileId, profileId));

    return NextResponse.json({
      ...profileData.profile,
      documentIds: documents.map((d) => d.documentId),
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
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
    const { id: profileId } = await params;
    const body = await request.json();

    // Verify profile belongs to user (only allow editing user personas, not system personas)
    const [profileData] = await db
      .select({
        profile: personaProfile,
        persona: persona,
      })
      .from(personaProfile)
      .innerJoin(persona, eq(personaProfile.personaId, persona.id))
      .where(
        and(
          eq(personaProfile.id, profileId),
          eq(persona.userId, session.user.id),
          eq(persona.isSystemPersona, false), // Only allow editing user personas
        ),
      )
      .limit(1);

    if (!profileData) {
      return NextResponse.json(
        { error: 'Profile not found or not editable' },
        { status: 404 },
      );
    }

    const { name, description, instructions, documentIds = [] } = body;

    if (!name || !instructions) {
      return NextResponse.json(
        { error: 'Name and instructions are required' },
        { status: 400 },
      );
    }

    // Update the profile
    const [updatedProfile] = await db
      .update(personaProfile)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        instructions: instructions.trim(),
        updatedAt: new Date(),
      })
      .where(eq(personaProfile.id, profileId))
      .returning();

    // Update document associations
    // First, remove existing associations
    await db
      .delete(profileDocument)
      .where(eq(profileDocument.profileId, profileId));

    // Then add new associations
    if (documentIds.length > 0) {
      const profileDocuments = documentIds.map((documentId: string) => ({
        profileId,
        documentId,
      }));

      await db.insert(profileDocument).values(profileDocuments);
    }

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
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
    const { id: profileId } = await params;

    // Verify profile belongs to user (only allow deleting user personas, not system personas)
    const [profileData] = await db
      .select({
        profile: personaProfile,
        persona: persona,
      })
      .from(personaProfile)
      .innerJoin(persona, eq(personaProfile.personaId, persona.id))
      .where(
        and(
          eq(personaProfile.id, profileId),
          eq(persona.userId, session.user.id),
          eq(persona.isSystemPersona, false), // Only allow deleting user personas
        ),
      )
      .limit(1);

    if (!profileData) {
      return NextResponse.json(
        { error: 'Profile not found or not deletable' },
        { status: 404 },
      );
    }

    // Delete the profile (cascade will handle document associations)
    await db.delete(personaProfile).where(eq(personaProfile.id, profileId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting profile:', error);
    return NextResponse.json(
      { error: 'Failed to delete profile' },
      { status: 500 },
    );
  }
}
