import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  circleCoursePersona,
  persona,
  userCoursePersonaSubscription,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getCourseInstructions,
  getCoursePersonaDescription,
  isValidTargetAudience,
} from '@/lib/ai/course-persona-templates';
import { fetchCourseDetails } from '@/lib/integrations/circle';

/**
 * Activate Course as System Persona API Endpoint
 * Creates a SYSTEM persona (not user-editable) and subscribes the user to it
 * POST /api/circle/activate-course-system?courseId=xxx&spaceId=xxx&audience=implementer|client
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const courseId = searchParams.get('courseId');
    const spaceId = searchParams.get('spaceId') || process.env.CIRCLE_SPACE_ID || '';
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
        { error: 'Missing spaceId parameter and CIRCLE_SPACE_ID environment variable not set' },
        { status: 400 },
      );
    }

    // Validate target audience
    if (!isValidTargetAudience(audienceParam)) {
      return NextResponse.json(
        { error: 'Invalid audience parameter. Must be "implementer" or "client"' },
        { status: 400 },
      );
    }

    const targetAudience = audienceParam;

    console.log(
      `[Circle Activate System] User ${session.user.id} activating course ${courseId} for ${targetAudience}`,
    );

    // Use the course ID as the namespace
    const courseNamespace = `circle-course-${courseId}`;

    // Check if a SYSTEM persona already exists for this course + audience combo
    const [existingSystemPersona] = await db
      .select()
      .from(circleCoursePersona)
      .where(
        and(
          eq(circleCoursePersona.circleCourseId, courseId),
          eq(circleCoursePersona.targetAudience, targetAudience),
        ),
      )
      .limit(1);

    let systemPersonaId: string;
    let courseName: string;

    if (existingSystemPersona) {
      console.log(
        `[Circle Activate System] Found existing system persona: ${existingSystemPersona.personaId}`,
      );
      
      systemPersonaId = existingSystemPersona.personaId;
      courseName = existingSystemPersona.courseName;

      // Check if user already has a subscription
      const [existingSubscription] = await db
        .select()
        .from(userCoursePersonaSubscription)
        .where(
          and(
            eq(userCoursePersonaSubscription.userId, session.user.id),
            eq(userCoursePersonaSubscription.personaId, systemPersonaId),
          ),
        )
        .limit(1);

      // If user already subscribed, just return success
      if (existingSubscription?.isActive) {
        console.log('[Circle Activate System] User already subscribed to this course');
        
        return NextResponse.json({
          personaId: systemPersonaId,
          courseName,
          isNewActivation: false,
          message: 'You already have access to this course assistant',
        });
      }

      // Reactivate or create subscription
      if (existingSubscription) {
        await db
          .update(userCoursePersonaSubscription)
          .set({
            isActive: true,
            deactivatedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(userCoursePersonaSubscription.id, existingSubscription.id));
        console.log('[Circle Activate System] Reactivated subscription');
      } else {
        await db.insert(userCoursePersonaSubscription).values({
          userId: session.user.id,
          personaId: systemPersonaId,
          isActive: true,
        });
        console.log('[Circle Activate System] Created new subscription');
      }

      return NextResponse.json({
        personaId: systemPersonaId,
        courseName,
        isNewActivation: true,
        message: 'Course assistant activated successfully',
      });
    }

    // No existing system persona - create one
    console.log('[Circle Activate System] Creating new system persona...');

    // Fetch course details from Circle.so
    let courseDetails;
    try {
      courseDetails = await fetchCourseDetails(spaceId, courseId);
    } catch (error) {
      console.error('[Circle Activate System] Error fetching course details:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch course details from Circle.so',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }

    courseName = courseDetails.name;

    // Generate AI-powered instructions from RAG
    console.log('[Circle Activate System] Generating AI instructions from RAG...');
    let aiInstructions = '';
    let ragContentFound = false;

    try {
      const { generateInstructionsFromRAG } = await import('@/lib/ai/generate-course-instructions');

      const result = await generateInstructionsFromRAG({
        namespace: courseNamespace,
        courseName: courseDetails.name,
        courseDescription: courseDetails.description,
        targetAudience,
      });

      aiInstructions = result.instructions;
      ragContentFound = result.contentFound;

      console.log(`[Circle Activate System] AI instructions generated: ${aiInstructions.length} chars`);
      console.log(`[Circle Activate System] RAG content found: ${ragContentFound}`);

      // If no RAG content found, return error
      if (!ragContentFound) {
        console.error('[Circle Activate System] No RAG content found for course');
        return NextResponse.json({
          error: 'course_not_found',
          errorMessage: `The course "${courseDetails.name}" has not been synced to the AI knowledge base yet. Please contact your administrator.`,
          courseId,
          courseName: courseDetails.name,
        }, { status: 404 });
      }
    } catch (aiError) {
      console.error('[Circle Activate System] Error generating AI instructions:', aiError);

      // Check if error is due to missing RAG content
      if (aiError instanceof Error && aiError.message.includes('No content found in RAG')) {
        return NextResponse.json({
          error: 'course_not_found',
          errorMessage: `The course "${courseDetails.name}" has not been synced. Contact your administrator to sync course ID ${courseId}.`,
          courseId,
          courseName: courseDetails.name,
        }, { status: 404 });
      }

      // Fallback to template instructions
      aiInstructions = getCourseInstructions(courseDetails.name, targetAudience);
      console.log('[Circle Activate System] Using template instructions as fallback');
    }

    const description = getCoursePersonaDescription(courseDetails.name, targetAudience);

    // Create SYSTEM persona (userId: null means system-wide, not user-owned)
    const [newPersona] = await db
      .insert(persona)
      .values({
        userId: null, // NULL = System persona (not editable by users)
        orgId: null,
        name: `${courseDetails.name} Assistant`,
        description,
        instructions: aiInstructions,
        isDefault: false,
        isSystemPersona: true, // System persona flag
        isShared: false,
        knowledgeNamespace: courseNamespace, // Shared Upstash namespace
      })
      .returning();

    console.log(
      `[Circle Activate System] ✅ Created system persona: ${newPersona.id}`,
    );

    // Create course persona mapping
    await db.insert(circleCoursePersona).values({
      circleSpaceId: spaceId,
      circleCourseId: courseId,
      personaId: newPersona.id,
      courseName: courseDetails.name,
      courseDescription: courseDetails.description,
      targetAudience,
      syncStatus: 'complete',
      lastSyncedAt: new Date(),
    });

    console.log('[Circle Activate System] Created course persona mapping');

    // Subscribe THIS USER to the system persona
    await db.insert(userCoursePersonaSubscription).values({
      userId: session.user.id,
      personaId: newPersona.id,
      isActive: true,
    });

    console.log('[Circle Activate System] User subscribed to system persona');

    return NextResponse.json({
      personaId: newPersona.id,
      courseName: courseDetails.name,
      isNewActivation: true,
      message: 'Course assistant activated successfully',
    });
  } catch (error) {
    console.error('[Circle Activate System] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'activation_failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

