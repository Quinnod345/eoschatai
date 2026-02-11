import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { persona, user } from '@/lib/db/schema';
import { checkOrgPermission } from '@/lib/organizations/permissions';
import { validateUuidField } from '@/lib/api/validation';
import { and, eq, or } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{
    orgId: string;
  }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const validatedOrgId = validateUuidField(orgId, 'orgId');
    if (!validatedOrgId.ok) {
      return NextResponse.json({ error: validatedOrgId.error }, { status: 400 });
    }

    const canManagePersonas = await checkOrgPermission(
      session.user.id,
      validatedOrgId.value,
      'personas.edit',
    );
    if (!canManagePersonas) {
      return NextResponse.json(
        { error: 'Forbidden - Admin role required' },
        { status: 403 },
      );
    }

    const rows = await db
      .select({
        id: persona.id,
        name: persona.name,
        description: persona.description,
        visibility: persona.visibility,
        isShared: persona.isShared,
        lockInstructions: persona.lockInstructions,
        lockKnowledge: persona.lockKnowledge,
        allowUserOverlay: persona.allowUserOverlay,
        allowUserKnowledge: persona.allowUserKnowledge,
        publishedAt: persona.publishedAt,
        updatedAt: persona.updatedAt,
        ownerId: persona.userId,
        ownerEmail: user.email,
      })
      .from(persona)
      .leftJoin(user, eq(user.id, persona.userId))
      .where(
        and(
          eq(persona.orgId, validatedOrgId.value),
          eq(persona.isSystemPersona, false),
          or(eq(persona.visibility, 'org'), eq(persona.isShared, true)),
        ),
      );

    return NextResponse.json({ personas: rows });
  } catch (error) {
    console.error('Error fetching organization personas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization personas' },
      { status: 500 },
    );
  }
}
