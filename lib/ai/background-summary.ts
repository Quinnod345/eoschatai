import 'server-only';

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { db } from '@/lib/db';
import { chat, message } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

const SUMMARY_MODEL = 'gpt-4o-mini';
const MAX_MESSAGES_FOR_SUMMARY = 50;
const MIN_MESSAGES_FOR_SUMMARY = 10;

/**
 * Generate a summary of a conversation
 */
async function generateSummary(
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const prompt = `Summarize the following conversation concisely, capturing the main topics discussed, any decisions made, and key action items. Keep the summary to 2-3 paragraphs maximum.

Conversation:
${messages
  .map(
    (m) =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 500)}${m.content.length > 500 ? '...' : ''}`,
  )
  .join('\n\n')}

Summary:`;

  const result = await generateText({
    model: openai(SUMMARY_MODEL),
    prompt,
    maxOutputTokens: 500,
    temperature: 0.3,
  });

  return result.text;
}

/**
 * Generate and save a conversation summary in the background
 * This function does not throw - it logs errors and fails silently
 */
export async function generateConversationSummaryBackground(
  chatId: string,
): Promise<void> {
  try {
    console.log(`[Background Summary] Starting for chat ${chatId}`);

    // Fetch messages for this chat
    const messages = await db
      .select({
        role: message.role,
        parts: message.parts,
      })
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(asc(message.createdAt))
      .limit(MAX_MESSAGES_FOR_SUMMARY);

    // Only generate summary if we have enough messages
    if (messages.length < MIN_MESSAGES_FOR_SUMMARY) {
      console.log(
        `[Background Summary] Chat ${chatId} has only ${messages.length} messages, skipping`,
      );
      return;
    }

    // Process messages to extract text content from parts
    const processedMessages = messages.map((m) => ({
      role: m.role,
      content:
        typeof m.parts === 'string'
          ? m.parts
          : Array.isArray(m.parts)
            ? (m.parts as Array<any>)
                .map((part) =>
                  typeof part === 'string'
                    ? part
                    : part?.type === 'text'
                      ? part.text
                      : '',
                )
                .join(' ')
            : '',
    }));

    // Generate the summary
    const summary = await generateSummary(processedMessages);

    // Save the summary to the database
    await db
      .update(chat)
      .set({
        conversationSummary: summary,
        lastSummarizedAt: new Date(),
      })
      .where(eq(chat.id, chatId));

    console.log(
      `[Background Summary] Successfully generated summary for chat ${chatId} (${summary.length} chars)`,
    );
  } catch (error) {
    // Log error but don't throw - this is a background task
    console.error(
      `[Background Summary] Failed to generate summary for chat ${chatId}:`,
      error,
    );
  }
}

/**
 * Check if a chat needs a summary update
 */
export async function shouldGenerateSummary(chatId: string): Promise<boolean> {
  try {
    const [chatRecord] = await db
      .select({
        conversationSummary: chat.conversationSummary,
        lastSummarizedAt: chat.lastSummarizedAt,
      })
      .from(chat)
      .where(eq(chat.id, chatId))
      .limit(1);

    if (!chatRecord) {
      return false;
    }

    // Generate if no summary exists
    if (!chatRecord.conversationSummary) {
      return true;
    }

    // Generate if summary is more than 1 hour old
    if (chatRecord.lastSummarizedAt) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (chatRecord.lastSummarizedAt < oneHourAgo) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(
      '[Background Summary] Error checking if summary needed:',
      error,
    );
    return false;
  }
}

/**
 * Trigger background summary generation if needed
 * This is a fire-and-forget function
 */
export function triggerBackgroundSummary(chatId: string): void {
  // Fire and forget - don't await
  shouldGenerateSummary(chatId)
    .then((shouldGenerate) => {
      if (shouldGenerate) {
        return generateConversationSummaryBackground(chatId);
      }
    })
    .catch((error) => {
      console.error('[Background Summary] Error in trigger:', error);
    });
}
