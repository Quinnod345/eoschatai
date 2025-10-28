import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { circleCoursePersona, persona } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getCourseInstructions,
  getCoursePersonaDescription,
  isValidTargetAudience,
} from '@/lib/ai/course-persona-templates';
import { fetchCourseDetails } from '@/lib/integrations/circle';

/**
 * Activate Course API Endpoint
 * Handles redirects from Circle.so course pages
 * URL: /api/circle/activate-course?courseId=xxx&spaceId=xxx&audience=implementer|client
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      // Redirect to login with callback URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const courseId = searchParams.get('courseId');
    const spaceId =
      searchParams.get('spaceId') || process.env.CIRCLE_SPACE_ID || '';
    const audienceParam = searchParams.get('audience') || 'implementer';

    // Validate required parameters
    if (!courseId) {
      return NextResponse.json(
        { error: 'Missing required parameter: courseId' },
        { status: 400 },
      );
    }

    if (!spaceId) {
      return NextResponse.json(
        {
          error:
            'Missing spaceId parameter and CIRCLE_SPACE_ID environment variable not set',
        },
        { status: 400 },
      );
    }

    // Validate target audience
    if (!isValidTargetAudience(audienceParam)) {
      return NextResponse.json(
        {
          error:
            'Invalid audience parameter. Must be "implementer" or "client"',
        },
        { status: 400 },
      );
    }

    const targetAudience = audienceParam;

    console.log(
      `[Circle Activate] User ${session.user.id} activating course ${courseId} for ${targetAudience}`,
    );

    // Check if course persona already exists
    const [existingCoursePersona] = await db
      .select()
      .from(circleCoursePersona)
      .where(eq(circleCoursePersona.circleCourseId, courseId))
      .limit(1);

    if (existingCoursePersona) {
      console.log(
        `[Circle Activate] Found existing course persona: ${existingCoursePersona.personaId}`,
      );

      // Return existing persona data
      return NextResponse.json({
        personaId: existingCoursePersona.personaId,
        courseName: existingCoursePersona.courseName,
        courseDescription: existingCoursePersona.courseDescription,
        targetAudience: existingCoursePersona.targetAudience,
        syncStatus: existingCoursePersona.syncStatus,
        isNewActivation: false,
        lastSyncedAt: existingCoursePersona.lastSyncedAt,
      });
    }

    // Fetch course details from Circle.so
    console.log('[Circle Activate] Fetching course details from Circle.so...');
    let courseDetails;
    try {
      courseDetails = await fetchCourseDetails(spaceId, courseId);
    } catch (error) {
      console.error('[Circle Activate] Error fetching course details:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch course details from Circle.so',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }

    // Create new persona for this course
    console.log('[Circle Activate] Creating new course persona...');
    const instructions = getCourseInstructions(
      courseDetails.name,
      targetAudience,
    );
    const description = getCoursePersonaDescription(
      courseDetails.name,
      targetAudience,
    );

    const [newPersona] = await db
      .insert(persona)
      .values({
        userId: null, // System persona, not owned by a specific user
        orgId: null,
        name: `${courseDetails.name} Assistant`,
        description,
        instructions,
        isDefault: false,
        isSystemPersona: true, // Make it a system persona so all users can see it
        isShared: false,
        knowledgeNamespace: `circle-course-${courseId}`, // Unique namespace for this course
      })
      .returning();

    console.log(`[Circle Activate] Created persona: ${newPersona.id}`);

    // Create course persona mapping
    const [coursePersonaMapping] = await db
      .insert(circleCoursePersona)
      .values({
        circleSpaceId: spaceId,
        circleCourseId: courseId,
        personaId: newPersona.id,
        courseName: courseDetails.name,
        courseDescription: courseDetails.description,
        targetAudience,
        syncStatus: 'pending',
      })
      .returning();

    console.log(
      `[Circle Activate] Created course persona mapping: ${coursePersonaMapping.id}`,
    );

    // Trigger background sync
    // We'll call the sync endpoint asynchronously (fire and forget)
    const syncUrl = new URL('/api/circle/sync-course', request.url);
    fetch(syncUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        courseId,
        spaceId,
        personaId: newPersona.id,
        userId: session.user.id,
      }),
    }).catch((error) => {
      console.error('[Circle Activate] Error triggering sync:', error);
    });

    console.log('[Circle Activate] Triggered background sync');

    // Return new persona data
    return NextResponse.json({
      personaId: newPersona.id,
      courseName: courseDetails.name,
      courseDescription: courseDetails.description,
      targetAudience,
      syncStatus: 'pending',
      isNewActivation: true,
      lastSyncedAt: null,
    });
  } catch (error) {
    console.error('[Circle Activate] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to activate course',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}


