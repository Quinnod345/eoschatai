import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '.';
import {
  documentHistory,
  documentVersion,
  documentEditSession,
  documentUndoStack,
  document,
} from './schema';

// Create a new document version and update history
export async function createDocumentVersion(
  documentId: string,
  userId: string,
  title: string,
  content: string,
  kind:
    | 'text'
    | 'code'
    | 'image'
    | 'sheet'
    | 'chart'
    | 'vto'
    | 'accountability',
  operation: 'create' | 'update' | 'delete' | 'restore' = 'update',
  metadata?: any,
) {
  return await db.transaction(async (tx) => {
    // Create history entry
    const [historyEntry] = await tx
      .insert(documentHistory)
      .values({
        documentId,
        userId,
        operation,
        metadata,
      })
      .returning();

    // Get the next version number
    const [maxVersion] = await tx
      .select({
        max: sql<number>`COALESCE(MAX(${documentVersion.versionNumber}), 0)`,
      })
      .from(documentVersion)
      .where(eq(documentVersion.documentId, documentId));

    const nextVersionNumber = (maxVersion?.max || 0) + 1;

    // Create version entry
    const [versionEntry] = await tx
      .insert(documentVersion)
      .values({
        documentId,
        historyId: historyEntry.id,
        versionNumber: nextVersionNumber,
        title,
        content,
        kind,
        createdAt: new Date(),
        metadata,
      })
      .returning();

    // Update or create undo stack for this user
    const [existingStack] = await tx
      .select()
      .from(documentUndoStack)
      .where(
        and(
          eq(documentUndoStack.documentId, documentId),
          eq(documentUndoStack.userId, userId),
        ),
      );

    if (existingStack) {
      // Add to undo stack and clear redo stack
      const undoStack = existingStack.undoStack as string[];
      undoStack.push(existingStack.currentVersionId);

      // Limit stack size
      if (undoStack.length > existingStack.maxStackSize) {
        undoStack.shift();
      }

      await tx
        .update(documentUndoStack)
        .set({
          currentVersionId: versionEntry.id,
          undoStack,
          redoStack: [],
          updatedAt: new Date(),
        })
        .where(eq(documentUndoStack.id, existingStack.id));
    } else {
      // Create new undo stack
      await tx.insert(documentUndoStack).values({
        documentId,
        userId,
        currentVersionId: versionEntry.id,
        undoStack: [],
        redoStack: [],
      });
    }

    // Update the main document
    await tx
      .update(document)
      .set({
        title,
        content,
      })
      .where(eq(document.id, documentId));

    return { history: historyEntry, version: versionEntry };
  });
}

// Undo operation
export async function undoDocumentChange(documentId: string, userId: string) {
  return await db.transaction(async (tx) => {
    const [stack] = await tx
      .select()
      .from(documentUndoStack)
      .where(
        and(
          eq(documentUndoStack.documentId, documentId),
          eq(documentUndoStack.userId, userId),
        ),
      );

    if (!stack || (stack.undoStack as string[]).length === 0) {
      throw new Error('No operations to undo');
    }

    const undoStack = stack.undoStack as string[];
    const redoStack = stack.redoStack as string[];

    // Move current version to redo stack
    redoStack.unshift(stack.currentVersionId);

    // Pop from undo stack
    const previousVersionId = undoStack.pop();
    if (!previousVersionId) {
      throw new Error('No version ID in undo stack');
    }

    // Get the previous version
    const [previousVersion] = await tx
      .select()
      .from(documentVersion)
      .where(eq(documentVersion.id, previousVersionId));

    if (!previousVersion) {
      throw new Error('Previous version not found');
    }

    // Update undo stack
    await tx
      .update(documentUndoStack)
      .set({
        currentVersionId: previousVersionId,
        undoStack,
        redoStack,
        updatedAt: new Date(),
      })
      .where(eq(documentUndoStack.id, stack.id));

    // Update the main document
    await tx
      .update(document)
      .set({
        title: previousVersion.title,
        content: previousVersion.content,
      })
      .where(eq(document.id, documentId));

    // Create history entry for undo
    await tx.insert(documentHistory).values({
      documentId,
      userId,
      operation: 'restore',
      metadata: { undoFromVersionId: stack.currentVersionId },
    });

    return previousVersion;
  });
}

// Redo operation
export async function redoDocumentChange(documentId: string, userId: string) {
  return await db.transaction(async (tx) => {
    const [stack] = await tx
      .select()
      .from(documentUndoStack)
      .where(
        and(
          eq(documentUndoStack.documentId, documentId),
          eq(documentUndoStack.userId, userId),
        ),
      );

    if (!stack || (stack.redoStack as string[]).length === 0) {
      throw new Error('No operations to redo');
    }

    const undoStack = stack.undoStack as string[];
    const redoStack = stack.redoStack as string[];

    // Move current version to undo stack
    undoStack.push(stack.currentVersionId);

    // Pop from redo stack
    const nextVersionId = redoStack.shift();
    if (!nextVersionId) {
      throw new Error('No version ID in redo stack');
    }

    // Get the next version
    const [nextVersion] = await tx
      .select()
      .from(documentVersion)
      .where(eq(documentVersion.id, nextVersionId));

    if (!nextVersion) {
      throw new Error('Next version not found');
    }

    // Update undo stack
    await tx
      .update(documentUndoStack)
      .set({
        currentVersionId: nextVersionId,
        undoStack,
        redoStack,
        updatedAt: new Date(),
      })
      .where(eq(documentUndoStack.id, stack.id));

    // Update the main document
    await tx
      .update(document)
      .set({
        title: nextVersion.title,
        content: nextVersion.content,
      })
      .where(eq(document.id, documentId));

    // Create history entry for redo
    await tx.insert(documentHistory).values({
      documentId,
      userId,
      operation: 'restore',
      metadata: { redoToVersionId: nextVersionId },
    });

    return nextVersion;
  });
}

// Get document history
export async function getDocumentHistory(
  documentId: string,
  limit = 50,
  offset = 0,
) {
  const history = await db
    .select({
      history: documentHistory,
      version: documentVersion,
    })
    .from(documentHistory)
    .leftJoin(
      documentVersion,
      eq(documentHistory.id, documentVersion.historyId),
    )
    .where(eq(documentHistory.documentId, documentId))
    .orderBy(desc(documentHistory.timestamp))
    .limit(limit)
    .offset(offset);

  return history;
}

// Get document versions
export async function getDocumentVersions(
  documentId: string,
  limit = 20,
  offset = 0,
) {
  const versions = await db
    .select()
    .from(documentVersion)
    .where(eq(documentVersion.documentId, documentId))
    .orderBy(desc(documentVersion.versionNumber))
    .limit(limit)
    .offset(offset);

  return versions;
}

// Get specific version
export async function getDocumentVersion(versionId: string) {
  const [version] = await db
    .select()
    .from(documentVersion)
    .where(eq(documentVersion.id, versionId));

  return version;
}

// Get undo/redo state for a user
export async function getUndoRedoState(documentId: string, userId: string) {
  const [stack] = await db
    .select()
    .from(documentUndoStack)
    .where(
      and(
        eq(documentUndoStack.documentId, documentId),
        eq(documentUndoStack.userId, userId),
      ),
    );

  if (!stack) {
    return {
      canUndo: false,
      canRedo: false,
      undoCount: 0,
      redoCount: 0,
      currentVersionId: null,
    };
  }

  const undoStack = stack.undoStack as string[];
  const redoStack = stack.redoStack as string[];

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    currentVersionId: stack.currentVersionId,
  };
}

// Create or get edit session
export async function getOrCreateEditSession(
  documentId: string,
  userId: string,
) {
  // Check for active session
  const [activeSession] = await db
    .select()
    .from(documentEditSession)
    .where(
      and(
        eq(documentEditSession.documentId, documentId),
        eq(documentEditSession.userId, userId),
        eq(documentEditSession.isActive, true),
      ),
    );

  if (activeSession) {
    // Check if session is still valid (e.g., less than 30 minutes old)
    const sessionAge = Date.now() - new Date(activeSession.startedAt).getTime();
    const thirtyMinutes = 30 * 60 * 1000;

    if (sessionAge < thirtyMinutes) {
      return activeSession;
    } else {
      // End the old session
      await db
        .update(documentEditSession)
        .set({
          isActive: false,
          endedAt: new Date(),
        })
        .where(eq(documentEditSession.id, activeSession.id));
    }
  }

  // Create new session
  const [newSession] = await db
    .insert(documentEditSession)
    .values({
      documentId,
      userId,
    })
    .returning();

  return newSession;
}

// Update edit session
export async function updateEditSession(sessionId: string) {
  await db
    .update(documentEditSession)
    .set({
      editCount: sql`${documentEditSession.editCount} + 1`,
    })
    .where(eq(documentEditSession.id, sessionId));
}

// End edit session
export async function endEditSession(sessionId: string) {
  await db
    .update(documentEditSession)
    .set({
      isActive: false,
      endedAt: new Date(),
    })
    .where(eq(documentEditSession.id, sessionId));
}

// Clean up old versions (keep only last N versions)
export async function cleanupOldVersions(
  documentId: string,
  keepVersions = 100,
) {
  const versionsToKeep = await db
    .select({ id: documentVersion.id })
    .from(documentVersion)
    .where(eq(documentVersion.documentId, documentId))
    .orderBy(desc(documentVersion.versionNumber))
    .limit(keepVersions);

  const idsToKeep = versionsToKeep.map((v) => v.id);

  if (idsToKeep.length > 0) {
    // Delete versions not in the keep list
    await db
      .delete(documentVersion)
      .where(
        and(
          eq(documentVersion.documentId, documentId),
          sql`${documentVersion.id} NOT IN (${sql.join(idsToKeep, sql`, `)})`,
        ),
      );
  }
}
