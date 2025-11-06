import { db } from '@/lib/db';
import { circleCoursePersona, userDocuments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Configure as serverless function with extended timeout
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

/**
 * Serverless function to process course embeddings
 * Runs in isolated environment with own memory limit
 * POST /api/circle/process-embeddings
 */
export async function POST(request: NextRequest) {
  try {
    const { courseId, personaId, documentIds } = await request.json();

    if (!courseId || !personaId || !documentIds) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 },
      );
    }

    console.log(
      `[Embedding Worker] Starting for course ${courseId}, ${documentIds.length} documents`,
    );

    // Update status to processing
    await db
      .update(circleCoursePersona)
      .set({
        courseDescription: JSON.stringify({
          progress: 25,
          status: 'Generating embeddings...',
          totalDocuments: documentIds.length,
          processedDocuments: 0,
        }),
      })
      .where(eq(circleCoursePersona.circleCourseId, courseId));

    // Import PostgreSQL system RAG (more stable than Upstash)
    const { processSystemDocument } = await import('@/lib/ai/system-rag');

    let processedCount = 0;

    // Process each document one at a time
    for (let i = 0; i < documentIds.length; i++) {
      const docId = documentIds[i];

      try {
        // Get document content
        const [doc] = await db
          .select()
          .from(userDocuments)
          .where(eq(userDocuments.id, docId))
          .limit(1);

        if (!doc) {
          console.error(`[Embedding Worker] Document not found: ${docId}`);
          continue;
        }

        console.log(
          `[Embedding Worker] Processing ${i + 1}/${documentIds.length}: ${doc.fileName}`,
        );

        // Process this document using PostgreSQL (stable, no Upstash crashes)
        await processSystemDocument(doc.content, personaId, {
          title: doc.fileName,
          fileName: doc.fileName,
          category: doc.category || 'Course Content',
          fileType: doc.fileType || 'lesson',
          lessonId: docId,
          order: i,
        });

        processedCount++;

        // Update progress after each document
        const progress = Math.floor(25 + (processedCount / documentIds.length) * 65); // 25-90%

        await db
          .update(circleCoursePersona)
          .set({
            courseDescription: JSON.stringify({
              progress,
              status: `Embedding: ${doc.fileName.substring(0, 40)}...`,
              totalDocuments: documentIds.length,
              processedDocuments: processedCount,
            }),
          })
          .where(eq(circleCoursePersona.circleCourseId, courseId));

        console.log(
          `[Embedding Worker] Progress: ${processedCount}/${documentIds.length} (${progress}%)`,
        );
      } catch (docError) {
        console.error(
          `[Embedding Worker] Error processing document ${docId}:`,
          docError,
        );
        // Continue with next document
      }
    }

    // Mark as complete
    await db
      .update(circleCoursePersona)
      .set({
        syncStatus: 'complete',
        lastSyncedAt: new Date(),
        courseDescription: JSON.stringify({
          progress: 100,
          status: 'Complete',
          totalDocuments: documentIds.length,
          processedDocuments: processedCount,
        }),
      })
      .where(eq(circleCoursePersona.circleCourseId, courseId));

    console.log(
      `[Embedding Worker] ✅ Complete! Processed ${processedCount}/${documentIds.length} documents`,
    );

    return NextResponse.json({
      success: true,
      processedCount,
      totalCount: documentIds.length,
    });
  } catch (error) {
    console.error('[Embedding Worker] Fatal error:', error);
    
    // Try to mark as failed
    try {
      const { courseId } = await request.json();
      await db
        .update(circleCoursePersona)
        .set({
          syncStatus: 'failed',
          courseDescription: JSON.stringify({
            progress: 0,
            status: 'Embedding failed',
            totalDocuments: 0,
            processedDocuments: 0,
          }),
        })
        .where(eq(circleCoursePersona.circleCourseId, courseId));
    } catch (updateError) {
      // Ignore
    }

    return NextResponse.json(
      { error: 'Failed to process embeddings', details: String(error) },
      { status: 500 },
    );
  }
}

