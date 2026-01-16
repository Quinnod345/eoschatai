import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments, userDocumentVersion } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { processUserDocument } from '@/lib/ai/user-rag';

// GET - List all versions of a document
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 },
      );
    }

    // Verify user owns the document
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, documentId),
          eq(userDocuments.userId, session.user.id),
        ),
      );

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 },
      );
    }

    // Get all versions
    const versions = await db
      .select()
      .from(userDocumentVersion)
      .where(eq(userDocumentVersion.documentId, documentId))
      .orderBy(desc(userDocumentVersion.versionNumber));

    return NextResponse.json({
      documentId,
      currentVersion: document.version,
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        fileName: v.fileName,
        fileSize: v.fileSize,
        uploadedAt: v.uploadedAt,
        uploadedBy: v.uploadedBy,
        isActive: v.isActive,
        contentHash: v.contentHash,
      })),
    });
  } catch (error) {
    console.error('Error fetching document versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch versions' },
      { status: 500 },
    );
  }
}

// POST - Create new version or restore a version
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }
    const { action, documentId, versionId, file, contentHash } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 },
      );
    }

    // Verify user owns the document
    const [document] = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.id, documentId),
          eq(userDocuments.userId, session.user.id),
        ),
      );

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 },
      );
    }

    if (action === 'restore') {
      // Restore a previous version
      if (!versionId) {
        return NextResponse.json(
          { error: 'versionId is required for restore action' },
          { status: 400 },
        );
      }

      const [versionToRestore] = await db
        .select()
        .from(userDocumentVersion)
        .where(eq(userDocumentVersion.id, versionId));

      if (!versionToRestore) {
        return NextResponse.json(
          { error: 'Version not found' },
          { status: 404 },
        );
      }

      // Save current version before restoring
      const newVersionNumber = document.version + 1;
      await db.insert(userDocumentVersion).values({
        documentId: document.id,
        versionNumber: newVersionNumber,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        fileSize: document.fileSize,
        content: document.content,
        contentHash: document.contentHash,
        uploadedBy: session.user.id,
        isActive: false,
      });

      // Restore the selected version
      await db
        .update(userDocuments)
        .set({
          fileName: versionToRestore.fileName,
          fileUrl: versionToRestore.fileUrl,
          fileSize: versionToRestore.fileSize,
          content: versionToRestore.content ?? undefined,
          contentHash: versionToRestore.contentHash ?? undefined,
          version: newVersionNumber + 1,
          updatedAt: new Date(),
        })
        .where(eq(userDocuments.id, documentId));

      // Re-process for RAG if isContext is true
      if (document.isContext && versionToRestore.content) {
        try {
          await processUserDocument(
            session.user.id,
            documentId,
            versionToRestore.content,
            {
              fileName: versionToRestore.fileName,
              category: document.category,
              fileType: document.fileType,
            },
          );
        } catch (ragError) {
          console.error('Error re-processing document for RAG:', ragError);
        }
      }

      return NextResponse.json({
        message: 'Version restored successfully',
        newVersion: newVersionNumber + 1,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing document version:', error);
    return NextResponse.json(
      { error: 'Failed to manage version' },
      { status: 500 },
    );
  }
}
