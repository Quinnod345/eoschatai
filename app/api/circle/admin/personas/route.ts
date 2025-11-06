import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { circleCoursePersona, persona } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * Admin endpoint to fetch all course personas with their AI-generated instructions
 * GET /api/circle/admin/personas
 */
export async function GET() {
  const session = await auth();

  // Check if user is admin
  if (!session?.user?.email || session.user.email !== 'quinn@upaway.dev') {
    return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
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

