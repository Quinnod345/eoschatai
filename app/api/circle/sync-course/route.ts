import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { circleCoursePersona, userDocuments } from '@/lib/db/schema';
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
 */
export async function POST(request: NextRequest) {
  try {
    // For background jobs, we might want to use an API key instead of session auth
    // For now, we'll allow unauthenticated access since it's triggered by the activate endpoint
    // In production, consider adding API key authentication or job queue system

    const body = await request.json();
    const { courseId, spaceId, personaId, userId } = body;

    // Validate required parameters
    if (!courseId || !spaceId || !personaId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: courseId, spaceId, personaId, userId' },
        { status: 400 },
      );
    }

    console.log(
      `[Circle Sync] Starting sync for course ${courseId}, persona ${personaId}`,
    );

    // Update sync status to 'syncing'
    await db
      .update(circleCoursePersona)
      .set({
        syncStatus: 'syncing',
        updatedAt: new Date(),
      })
      .where(eq(circleCoursePersona.circleCourseId, courseId));

    // Fetch course content from Circle.so
    console.log('[Circle Sync] Fetching course content from Circle.so...');
    let courseContent;
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

    // Create document records in the database for tracking
    // These will be processed into the persona's vector namespace
    const documentIds: string[] = [];

    for (const doc of documents) {
      console.log(`[Circle Sync] Creating document record: ${doc.title}`);

      // Create a user document record
      // Use the userId of the person who activated the course
      const [docRecord] = await db
        .insert(userDocuments)
        .values({
          userId: userId,
          fileName: doc.title,
          fileUrl: `circle://course/${courseId}/doc/${doc.title}`, // Virtual URL for Circle content
          content: doc.content,
          category: 'Other', // Course content doesn't fit the predefined categories
          fileType: 'text',
          fileSize: doc.content.length,
        })
        .returning();

      documentIds.push(docRecord.id);
      console.log(`[Circle Sync] Created document: ${docRecord.id}`);
    }

    // Process documents into persona's vector namespace
    console.log(
      `[Circle Sync] Processing ${documentIds.length} documents into persona namespace ${personaId}`,
    );

    try {
      // Process documents into persona RAG namespace
      // The function uses personaId as the namespace
      await processPersonaDocuments(personaId, documentIds, userId);

      console.log(
        '[Circle Sync] Successfully processed documents into persona RAG',
      );
    } catch (error) {
      console.error('[Circle Sync] Error processing documents:', error);

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
          error: 'Failed to process documents into persona RAG',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }

    // Update sync status to 'complete'
    await db
      .update(circleCoursePersona)
      .set({
        syncStatus: 'complete',
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(circleCoursePersona.circleCourseId, courseId));

    console.log('[Circle Sync] Sync complete!');

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
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      syncStatus: coursePersona.syncStatus,
      lastSyncedAt: coursePersona.lastSyncedAt,
      courseName: coursePersona.courseName,
      personaId: coursePersona.personaId,
    });
  } catch (error) {
    console.error('[Circle Sync Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 },
    );
  }
}


