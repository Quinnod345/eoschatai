/**
 * Unified Document Service
 *
 * Provides atomic operations for document CRUD with version history.
 * Combines the Document table (current state) with DocumentVersion table (history).
 */

import { eq, desc, sql } from 'drizzle-orm';
import { db } from '.';
import {
  document,
  documentVersion,
  documentHistory,
  documentUndoStack,
} from './schema';
import type { ComposerKind } from '@/components/composer';
import { processDocument } from '../ai/embeddings';

export interface SaveDocumentWithVersionOptions {
  id: string;
  title: string;
  kind: ComposerKind;
  content: string;
  userId: string;
  /** If true, also creates a version entry (default: true for updates, false for creates) */
  createVersion?: boolean;
  /** Source of the change for history tracking */
  source?: 'user' | 'ai' | 'system';
}

export interface DocumentWithVersions {
  id: string;
  title: string;
  kind: ComposerKind;
  content: string | null;
  createdAt: Date;
  userId: string;
  isContext: boolean | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    title: string;
    content: string | null;
    createdAt: Date;
  }>;
}

/**
 * Save a document with atomic version creation.
 * - Creates document if it doesn't exist
 * - Updates document if it exists and creates a version entry
 */
export async function saveDocumentWithVersion({
  id,
  title,
  kind,
  content,
  userId,
  createVersion = true,
  source = 'user',
}: SaveDocumentWithVersionOptions): Promise<{
  document: typeof document.$inferSelect;
  version?: typeof documentVersion.$inferSelect;
}> {
  console.log(`[DocumentService] Saving document ${id}:`, {
    title,
    kind,
    contentLength: content?.length || 0,
    createVersion,
    source,
  });

  return await db.transaction(async (tx) => {
    // Check if document exists
    const [existingDoc] = await tx
      .select()
      .from(document)
      .where(eq(document.id, id));

    const now = new Date();

    if (existingDoc) {
      // Update existing document
      const [updatedDoc] = await tx
        .update(document)
        .set({
          title,
          kind,
          content,
        })
        .where(eq(document.id, id))
        .returning();

      let versionEntry: typeof documentVersion.$inferSelect | undefined;

      // Create version entry if requested
      if (createVersion) {
        // Create history entry
        const [historyEntry] = await tx
          .insert(documentHistory)
          .values({
            documentId: id,
            userId,
            operation: 'update',
            metadata: { source },
          })
          .returning();

        // Get next version number
        const [maxVersion] = await tx
          .select({
            max: sql<number>`COALESCE(MAX(${documentVersion.versionNumber}), 0)`,
          })
          .from(documentVersion)
          .where(eq(documentVersion.documentId, id));

        const nextVersionNumber = (maxVersion?.max || 0) + 1;

        // Create version entry
        [versionEntry] = await tx
          .insert(documentVersion)
          .values({
            documentId: id,
            historyId: historyEntry.id,
            versionNumber: nextVersionNumber,
            title,
            content,
            kind,
            createdAt: now,
            metadata: { source },
          })
          .returning();

        // Update undo stack
        const [existingStack] = await tx
          .select()
          .from(documentUndoStack)
          .where(
            eq(documentUndoStack.documentId, id),
          );

        if (existingStack) {
          const undoStack = (existingStack.undoStack as string[]) || [];
          if (existingStack.currentVersionId) {
            undoStack.push(existingStack.currentVersionId);
          }
          // Limit stack size
          while (undoStack.length > existingStack.maxStackSize) {
            undoStack.shift();
          }

          await tx
            .update(documentUndoStack)
            .set({
              currentVersionId: versionEntry.id,
              undoStack,
              redoStack: [],
              updatedAt: now,
            })
            .where(eq(documentUndoStack.id, existingStack.id));
        } else {
          await tx.insert(documentUndoStack).values({
            documentId: id,
            userId,
            currentVersionId: versionEntry.id,
            undoStack: [],
            redoStack: [],
          });
        }
      }

      console.log(`[DocumentService] Updated document ${id}, version: ${versionEntry?.versionNumber || 'none'}`);
      return { document: updatedDoc, version: versionEntry };
    } else {
      // Create new document
      const [newDoc] = await tx
        .insert(document)
        .values({
          id,
          title,
          kind,
          content,
          userId,
          createdAt: now,
        })
        .returning();

      // Create initial version
      const [historyEntry] = await tx
        .insert(documentHistory)
        .values({
          documentId: id,
          userId,
          operation: 'create',
          metadata: { source },
        })
        .returning();

      const [versionEntry] = await tx
        .insert(documentVersion)
        .values({
          documentId: id,
          historyId: historyEntry.id,
          versionNumber: 1,
          title,
          content,
          kind,
          createdAt: now,
          metadata: { source },
        })
        .returning();

      // Create initial undo stack
      await tx.insert(documentUndoStack).values({
        documentId: id,
        userId,
        currentVersionId: versionEntry.id,
        undoStack: [],
        redoStack: [],
      });

      console.log(`[DocumentService] Created document ${id} with initial version`);
      return { document: newDoc, version: versionEntry };
    }
  }).then(async (result) => {
    // Process for embeddings outside transaction (only for text kind with content)
    if (kind === 'text' && content) {
      try {
        await processDocument(id, content, {
          useSummary: true,
          documentKind: kind,
          documentTitle: title,
        });
      } catch (err) {
        console.error(`[DocumentService] Error processing embeddings for ${id}:`, err);
        // Don't throw - embeddings are non-critical
      }
    }
    return result;
  });
}

/**
 * Get a document with its version history.
 */
export async function getDocumentWithVersions(
  documentId: string,
  maxVersions = 50,
): Promise<DocumentWithVersions | null> {
  const [doc] = await db
    .select()
    .from(document)
    .where(eq(document.id, documentId));

  if (!doc) return null;

  const versions = await db
    .select({
      id: documentVersion.id,
      versionNumber: documentVersion.versionNumber,
      title: documentVersion.title,
      content: documentVersion.content,
      createdAt: documentVersion.createdAt,
    })
    .from(documentVersion)
    .where(eq(documentVersion.documentId, documentId))
    .orderBy(desc(documentVersion.versionNumber))
    .limit(maxVersions);

  return {
    id: doc.id,
    title: doc.title,
    kind: doc.kind as ComposerKind,
    content: doc.content,
    createdAt: doc.createdAt,
    userId: doc.userId,
    isContext: doc.isContext,
    versions: versions.reverse(), // Return in ascending order
  };
}

/**
 * Get version history as an array of documents (for backwards compatibility).
 * This returns versions formatted like the old getDocumentsById function.
 */
export async function getDocumentVersionsAsDocuments(
  documentId: string,
  maxVersions = 50,
): Promise<Array<typeof document.$inferSelect>> {
  // First get the current document
  const [currentDoc] = await db
    .select()
    .from(document)
    .where(eq(document.id, documentId));

  if (!currentDoc) return [];

  // Get version history
  const versions = await db
    .select()
    .from(documentVersion)
    .where(eq(documentVersion.documentId, documentId))
    .orderBy(documentVersion.versionNumber)
    .limit(maxVersions);

  if (versions.length === 0) {
    // No versions yet, return just the current document
    return [currentDoc];
  }

  // Convert versions to document-like objects for backwards compatibility
  return versions.map((v) => ({
    id: currentDoc.id,
    title: v.title,
    kind: v.kind as typeof currentDoc.kind,
    content: v.content,
    createdAt: v.createdAt,
    userId: currentDoc.userId,
    isContext: currentDoc.isContext,
    isShared: currentDoc.isShared,
    shareSettings: currentDoc.shareSettings,
    contentSummary: currentDoc.contentSummary,
  }));
}
