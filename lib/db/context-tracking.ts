import { db } from '@/lib/db';
import { contextUsageLog } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export interface ContextUsageData {
  chatId: string;
  messageId: string;
  userId: string;
  queryComplexity?: string;
  systemChunks?: number;
  personaChunks?: number;
  userChunks?: number;
  memoryChunks?: number;
  conversationSummaryUsed?: boolean;
  totalTokens?: number;
  contextTokens?: number;
  responseTokens?: number;
  model?: string;
  metadata?: any;
}

// In-memory queue for failed log attempts (for retry)
const pendingLogs: ContextUsageData[] = [];
let retryTimeout: ReturnType<typeof setTimeout> | null = null;
const MAX_PENDING_LOGS = 100;
const RETRY_DELAY_MS = 5000;

/**
 * Log context usage for a message with automatic retry on failure
 * @param data - Context usage data
 * @returns Created log entry or null if failed/queued
 */
export async function logContextUsage(data: ContextUsageData) {
  try {
    const entry = await insertContextLog(data);

    // On success, try to flush any pending logs
    if (entry && pendingLogs.length > 0) {
      schedulePendingLogFlush();
    }

    return entry;
  } catch (error) {
    // Queue for retry instead of just logging
    queueForRetry(data);
    console.warn(
      `Context Tracking: Queued log for retry (${pendingLogs.length} pending)`,
      {
        messageId: data.messageId,
        error: error instanceof Error ? error.message : 'Unknown',
      },
    );
    return null;
  }
}

/**
 * Internal function to insert a context log entry
 */
async function insertContextLog(data: ContextUsageData) {
  const [entry] = await db
    .insert(contextUsageLog)
    .values({
      chatId: data.chatId,
      messageId: data.messageId,
      userId: data.userId,
      queryComplexity: data.queryComplexity || null,
      systemChunks: data.systemChunks || 0,
      personaChunks: data.personaChunks || 0,
      userChunks: data.userChunks || 0,
      memoryChunks: data.memoryChunks || 0,
      conversationSummaryUsed: data.conversationSummaryUsed || false,
      totalTokens: data.totalTokens || null,
      contextTokens: data.contextTokens || null,
      responseTokens: data.responseTokens || null,
      model: data.model || null,
      userFeedback: 'pending' as any,
      metadata: data.metadata || null,
      createdAt: new Date(),
    })
    .onConflictDoNothing() // Prevent duplicate entries on retry
    .returning();

  if (entry) {
    console.log(`Context Tracking: Logged usage for message ${data.messageId}`);
  }

  return entry;
}

/**
 * Queue a failed log for retry
 */
function queueForRetry(data: ContextUsageData) {
  // Prevent queue from growing unbounded
  if (pendingLogs.length >= MAX_PENDING_LOGS) {
    // Remove oldest entry to make room
    pendingLogs.shift();
    console.warn(
      'Context Tracking: Pending log queue full, dropping oldest entry',
    );
  }

  pendingLogs.push(data);
  schedulePendingLogFlush();
}

/**
 * Schedule a retry of pending logs
 */
function schedulePendingLogFlush() {
  if (retryTimeout) return; // Already scheduled

  retryTimeout = setTimeout(async () => {
    retryTimeout = null;
    await flushPendingLogs();
  }, RETRY_DELAY_MS);
}

/**
 * Attempt to flush all pending logs
 */
async function flushPendingLogs() {
  if (pendingLogs.length === 0) return;

  const logsToRetry = [...pendingLogs];
  pendingLogs.length = 0; // Clear the queue

  let successCount = 0;
  let failCount = 0;

  for (const data of logsToRetry) {
    try {
      await insertContextLog(data);
      successCount++;
    } catch (error) {
      // Re-queue if still failing
      if (pendingLogs.length < MAX_PENDING_LOGS) {
        pendingLogs.push(data);
      }
      failCount++;
    }
  }

  if (successCount > 0 || failCount > 0) {
    console.log(
      `Context Tracking: Flushed pending logs - ${successCount} succeeded, ${failCount} failed`,
    );
  }

  // If there are still pending logs, schedule another retry
  if (pendingLogs.length > 0) {
    schedulePendingLogFlush();
  }
}

/**
 * Update user feedback for a context usage log entry
 * @param messageId - Message ID
 * @param feedback - User feedback ('helpful' or 'not_helpful')
 */
export async function updateContextFeedback(
  messageId: string,
  userId: string,
  feedback: 'helpful' | 'not_helpful',
) {
  try {
    const updated = await db
      .update(contextUsageLog)
      .set({ userFeedback: feedback })
      .where(
        and(
          eq(contextUsageLog.messageId, messageId),
          eq(contextUsageLog.userId, userId),
        ),
      )
      .returning({ id: contextUsageLog.id });

    if (updated.length === 0) {
      return false;
    }

    console.log(
      `Context Tracking: Updated feedback for message ${messageId}: ${feedback}`,
    );

    return true;
  } catch (error) {
    console.error('Context Tracking: Error updating feedback:', error);
    return false;
  }
}

/**
 * Get context usage statistics
 * @param userId - User ID to filter by (optional)
 * @returns Usage statistics
 */
export async function getContextUsageStats(userId?: string) {
  try {
    // This would be implemented with aggregate queries
    // For now, return a placeholder
    console.log('Context Tracking: Getting usage stats...');

    return {
      totalQueries: 0,
      avgSystemChunks: 0,
      avgPersonaChunks: 0,
      avgUserChunks: 0,
      avgMemoryChunks: 0,
      avgTokens: 0,
      helpfulPercentage: 0,
    };
  } catch (error) {
    console.error('Context Tracking: Error getting stats:', error);
    return null;
  }
}
