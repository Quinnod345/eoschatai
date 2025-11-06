import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { circleCoursePersona, userCoursePersonaSubscription, persona } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Check if user has already activated a course
 * GET /api/circle/check-activation?courseId=xxx&audience=implementer|client
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ alreadyActivated: false });
    }

    const searchParams = request.nextUrl.searchParams;
    const courseId = searchParams.get('courseId');
    const audience = searchParams.get('audience') || 'implementer';

    if (!courseId) {
      return NextResponse.json(
        { error: 'Missing courseId parameter' },
        { status: 400 },
      );
    }

    console.log(`[Check Activation] Checking if user ${session.user.id} has course ${courseId}`);

    // Find system persona for this course + audience
    const [coursePersonaRecord] = await db
      .select()
      .from(circleCoursePersona)
      .where(
        and(
          eq(circleCoursePersona.circleCourseId, courseId),
          eq(circleCoursePersona.targetAudience, audience),
        ),
      )
      .limit(1);

    if (!coursePersonaRecord) {
      console.log('[Check Activation] No system persona found for this course');
      return NextResponse.json({ alreadyActivated: false });
    }

    // Check if user has an active subscription to this persona
    const [subscription] = await db
      .select()
      .from(userCoursePersonaSubscription)
      .where(
        and(
          eq(userCoursePersonaSubscription.userId, session.user.id),
          eq(userCoursePersonaSubscription.personaId, coursePersonaRecord.personaId),
          eq(userCoursePersonaSubscription.isActive, true),
        ),
      )
      .limit(1);

    if (!subscription) {
      console.log('[Check Activation] User does not have active subscription');
      return NextResponse.json({ alreadyActivated: false });
    }

    // Get persona details
    const [personaDetails] = await db
      .select()
      .from(persona)
      .where(eq(persona.id, coursePersonaRecord.personaId))
      .limit(1);

    console.log('[Check Activation] User already has this course activated');

    return NextResponse.json({
      alreadyActivated: true,
      personaId: coursePersonaRecord.personaId,
      courseName: personaDetails?.name || coursePersonaRecord.courseName,
      courseDescription: coursePersonaRecord.courseDescription,
      activatedAt: subscription.activatedAt,
    });
  } catch (error) {
    console.error('[Check Activation] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check activation status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

