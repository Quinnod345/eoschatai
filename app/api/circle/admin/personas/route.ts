import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { circleCoursePersona, persona, user } from '@/lib/db/schema';
import { checkOrgPermission } from '@/lib/organizations/permissions';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * Admin endpoint to fetch all course personas with their AI-generated instructions
 * GET /api/circle/admin/personas
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [currentUser] = await db
    .select({ orgId: user.orgId })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser?.orgId) {
    return NextResponse.json(
      { error: 'Forbidden - Organization membership required' },
      { status: 403 },
    );
  }

  const canManagePersonas = await checkOrgPermission(
    session.user.id,
    currentUser.orgId,
    'personas.edit',
  );
  if (!canManagePersonas) {
    return NextResponse.json(
      { error: 'Forbidden - Admin role required' },
      { status: 403 },
    );
  }

  try {
    console.log('[Admin] Fetching all course personas...');

    // Get all course persona mappings
    const coursePersonas = await db
      .select()
      .from(circleCoursePersona)
      .orderBy(circleCoursePersona.createdAt);

    // Fetch persona details including instructions
    const personasWithInstructions = await Promise.all(
      coursePersonas.map(async (cp) => {
        const [personaData] = await db
          .select()
          .from(persona)
          .where(eq(persona.id, cp.personaId))
          .limit(1);

        return {
          id: cp.id,
          personaId: cp.personaId,
          courseName: cp.courseName,
          courseDescription: cp.courseDescription,
          targetAudience: cp.targetAudience,
          syncStatus: cp.syncStatus,
          lastSyncedAt: cp.lastSyncedAt,
          createdAt: cp.createdAt,
          instructions: personaData?.instructions || null,
        };
      }),
    );

    console.log(`[Admin] Found ${personasWithInstructions.length} course personas`);

    return NextResponse.json({
      personas: personasWithInstructions,
    });
  } catch (error) {
    console.error('[Admin] Error fetching course personas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course personas' },
      { status: 500 },
    );
  }
}



