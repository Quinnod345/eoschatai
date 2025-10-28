import { db } from '@/lib/db';
import { contextUsageLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

/**
 * Log context usage for a message
 * @param data - Context usage data
 * @returns Created log entry
 */
export async function logContextUsage(data: ContextUsageData) {
  try {
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
      .returning();

    console.log(`Context Tracking: Logged usage for message ${data.messageId}`);

    return entry;
  } catch (error) {
    console.error('Context Tracking: Error logging usage:', error);
    // Don't throw - tracking shouldn't break the chat flow
    return null;
  }
}

/**
 * Update user feedback for a context usage log entry
 * @param messageId - Message ID
 * @param feedback - User feedback ('helpful' or 'not_helpful')
 */
export async function updateContextFeedback(
  messageId: string,
  feedback: 'helpful' | 'not_helpful',
) {
  try {
    await db
      .update(contextUsageLog)
      .set({ userFeedback: feedback })
      .where(eq(contextUsageLog.messageId, messageId));

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

