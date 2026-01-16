import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { circleCoursePersona, userDocuments, persona } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  fetchCourseContent,
  courseToDocuments,
} from '@/lib/integrations/circle';
import { processPersonaDocuments } from '@/lib/ai/persona-rag';

/**
 * Sync Course API Endpoint
 * Background job to sync Circle.so course content into persona RAG
 * POST /api/circle/sync-course
 * 
 * Requires either:
 * - Valid user session
 * - Internal API key (X-Internal-Key header) for background jobs
 */
export async function POST(request: NextRequest) {
  try {
    // Validate authentication - either session or internal API key
    const internalKey = request.headers.get('X-Internal-Key');
    const expectedKey = process.env.INTERNAL_API_KEY;
    
    // Check for internal API key first (for background jobs)
    const isInternalRequest = expectedKey && internalKey === expectedKey;
    
    if (!isInternalRequest) {
      // Fall back to session authentication
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Unauthorized. Provide valid session or internal API key.' },
          { status: 401 },
        );
      }
    }

    const body = await request.json();
    let { courseId, spaceId, personaId } = body;

    // Validate required parameters
    if (!courseId || !spaceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: courseId, spaceId' },
        { status: 400 },
      );
    }

    // If personaId is 'auto' or missing, look it up from the database
    if (!personaId || personaId === 'auto') {
      console.log(`[Circle Sync] Looking up persona for course ${courseId}...`);

      const [coursePersona] = await db
        .select()
        .from(circleCoursePersona)
        .where(eq(circleCoursePersona.circleCourseId, courseId))
        .limit(1);

      if (!coursePersona) {
        return NextResponse.json(
          {
            error:
              'Course persona not found. Please activate the course first.',
          },
          { status: 404 },
        );
      }

      personaId = coursePersona.personaId;
      console.log(`[Circle Sync] Found persona: ${personaId}`);
    }

    console.log(
      `[Circle Sync] Starting sync for course ${courseId}, persona ${personaId}`,
    );

    // Update sync status to 'syncing' with metadata
    await db
      .update(circleCoursePersona)
      .set({
        syncStatus: 'syncing',
        updatedAt: new Date(),
        courseDescription: JSON.stringify({
          progress: 0,
          status: 'Initializing...',
          totalDocuments: 0,
          processedDocuments: 0,
        }),
      })
      .where(eq(circleCoursePersona.circleCourseId, courseId));

    // Fetch course content from Circle.so
    console.log('[Circle Sync] Fetching course content from Circle.so...');
    let courseContent: Awaited<ReturnType<typeof fetchCourseContent>>;
    try {
      courseContent = await fetchCourseContent(spaceId, courseId);
    } catch (error) {
      console.error('[Circle Sync] Error fetching course content:', error);

      // Update sync status to 'failed'
      await db
        .update(circleCoursePersona)
        .set({
          syncStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(circleCoursePersona.circleCourseId, courseId));

      return NextResponse.json(
        {
          error: 'Failed to fetch course content from Circle.so',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }

    console.log(
      `[Circle Sync] Fetched course: ${courseContent.name} with ${courseContent.lessons.length} lessons`,
    );

    // Convert course content to documents
    const documents = courseToDocuments(courseContent);
    console.log(
      `[Circle Sync] Converted to ${documents.length} documents for processing`,
    );

    // Update progress: fetched content
    await db
      .update(circleCoursePersona)
      .set({
        courseDescription: JSON.stringify({
          progress: 10,
          status: `Fetched ${courseContent.lessons.length} lessons`,
          totalDocuments: documents.length,
          processedDocuments: 0,
        }),
      })
      .where(eq(circleCoursePersona.circleCourseId, courseId));

    // Generate AI-powered persona instructions based on actual course content
    console.log('[Circle Sync] Generating AI-powered persona instructions...');
    try {
      const { generateCourseInstructions } = await import(
        '@/lib/ai/generate-course-instructions'
      );

      // Get target audience from the course persona record
      const [coursePersonaRecord] = await db
        .select()
        .from(circleCoursePersona)
        .where(eq(circleCoursePersona.personaId, personaId))
        .limit(1);

      const targetAudience =
        (coursePersonaRecord?.targetAudience as 'implementer' | 'client') ||
        'implementer';

      const aiInstructions = await generateCourseInstructions({
        courseName: courseContent.name,
        courseDescription: courseContent.description,
        lessons: courseContent.lessons.map((l) => ({
          title: l.title,
          content: l.content,
        })),
        targetAudience,
      });

      // Update persona with AI-generated instructions
      await db
        .update(persona)
        .set({
          instructions: aiInstructions,
          updatedAt: new Date(),
        })
        .where(eq(persona.id, personaId));

      console.log(
        `[Circle Sync] ✅ Updated persona with AI-generated instructions (${aiInstructions.length} chars)`,
      );

      // Update progress: instructions generated
      await db
        .update(circleCoursePersona)
        .set({
          courseDescription: JSON.stringify({
            progress: 20,
            status: 'Generated AI instructions',
            totalDocuments: documents.length,
            processedDocuments: 0,
          }),
        })
        .where(eq(circleCoursePersona.circleCourseId, courseId));
    } catch (instructionsError) {
      console.error(
        '[Circle Sync] Error generating AI instructions, using template:',
        instructionsError,
      );
      // Continue with sync even if instruction generation fails
    }

    // Create document records in the database for tracking
    // These will be processed into the persona's vector namespace
    const documentIds: string[] = [];

    // Get the first admin user to own these system documents
    // In Circle.so courses, we need a real user ID for document ownership
    const { user } = await import('@/lib/db/schema');
    const [adminUser] = await db.select({ id: user.id }).from(user).limit(1);

    if (!adminUser) {
      throw new Error('No users found in database. Cannot create documents.');
    }

    const SYSTEM_USER_ID = adminUser.id;
    console.log(`[Circle Sync] Using system user ID: ${SYSTEM_USER_ID}`);

    for (const doc of documents) {
      console.log(`[Circle Sync] Creating document record: ${doc.title}`);

      // Create a user document record
      // Use a placeholder fileUrl since this is synced content, not an uploaded file
      const [docRecord] = await db
        .insert(userDocuments)
        .values({
          userId: SYSTEM_USER_ID,
          fileName: doc.title,
          fileUrl: `circle://course/${courseId}/lesson/${doc.metadata.lessonId || 'overview'}`,
          content: doc.content,
          category: 'Other',
          fileType: 'text',
          fileSize: doc.content.length,
        })
        .returning();

      documentIds.push(docRecord.id);
      console.log(`[Circle Sync] Created document: ${docRecord.id}`);
    }

    // Trigger serverless function to process embeddings
    // This runs in isolated environment with own memory limit
    console.log(
      `[Circle Sync] Triggering serverless embedding worker for ${documentIds.length} documents`,
    );

    // Call the serverless embedding processor with internal API key
    const embeddingUrl = new URL(
      '/api/circle/process-embeddings',
      request.url,
    );
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Pass internal API key for background job authentication
    if (process.env.INTERNAL_API_KEY) {
      headers['X-Internal-Key'] = process.env.INTERNAL_API_KEY;
    }
    
    fetch(embeddingUrl.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        courseId,
        personaId,
        documentIds,
      }),
    }).catch((error) => {
      console.error('[Circle Sync] Error triggering embedding worker:', error);
    });

    console.log(
      `[Circle Sync] ✅ Embedding worker triggered for ${documentIds.length} documents`,
    );

    // Return success immediately - serverless function will complete in background
    console.log('[Circle Sync] Main sync complete - embeddings processing in background');

    return NextResponse.json({
      success: true,
      message: 'Course content synced successfully',
      personaId,
      documentsProcessed: documentIds.length,
    });
  } catch (error) {
    console.error('[Circle Sync] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync course',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET endpoint to check sync status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json(
        { error: 'Missing required parameter: courseId' },
        { status: 400 },
      );
    }

    // Get course persona sync status
    const [coursePersona] = await db
      .select()
      .from(circleCoursePersona)
      .where(eq(circleCoursePersona.circleCourseId, courseId))
      .limit(1);

    if (!coursePersona) {
      console.log(`[Circle Sync Status] Course not found: ${courseId}`);
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    console.log(
      `[Circle Sync Status] Course ${courseId}: ${coursePersona.syncStatus}`,
    );

    // Parse progress data from courseDescription if available
    let progressData = {
      progress: 0,
      status: 'Initializing...',
      totalDocuments: 0,
      processedDocuments: 0,
    };

    try {
      if (coursePersona.courseDescription) {
        const parsed = JSON.parse(coursePersona.courseDescription);
        if (parsed.progress !== undefined) {
          progressData = parsed;
        }
      }
    } catch (e) {
      // If parsing fails, courseDescription is plain text, not JSON
    }

    return NextResponse.json({
      syncStatus: coursePersona.syncStatus,
      lastSyncedAt: coursePersona.lastSyncedAt,
      courseName: coursePersona.courseName,
      personaId: coursePersona.personaId,
      progress: progressData.progress,
      statusMessage: progressData.status,
      totalDocuments: progressData.totalDocuments,
      processedDocuments: progressData.processedDocuments,
    });
  } catch (error) {
    console.error('[Circle Sync Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 },
    );
  }
}
