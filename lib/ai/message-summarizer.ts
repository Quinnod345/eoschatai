import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { DBMessage } from '@/lib/db/schema';
import { db } from '@/lib/db';
import { chat } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Summarize older messages from a conversation
 * @param messages - Array of messages to summarize
 * @param chatId - Chat ID for reference
 * @returns Structured summary of the conversation
 */
export async function summarizeOlderMessages(
  messages: DBMessage[],
  chatId: string,
): Promise<string> {
  if (!messages || messages.length === 0) {
    return '';
  }

  try {
    console.log(
      `Message Summarizer: Summarizing ${messages.length} messages for chat ${chatId}`,
    );

    // Convert messages to readable format
    const conversationText = messages
      .map((msg) => {
        // Extract text content from parts array
        const parts = Array.isArray(msg.parts) ? msg.parts : [];
        const textContent = parts
          .map((part: any) => {
            if (typeof part === 'string') return part;
            if (part.type === 'text') return part.text || '';
            return '';
          })
          .filter(Boolean)
          .join(' ');

        return `${msg.role.toUpperCase()}: ${textContent}`;
      })
      .join('\n\n');

    // Generate summary using GPT-4.1
    const summary = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `You are summarizing an older conversation to preserve key context. Create a concise but comprehensive summary that captures:

1. Main topics discussed
2. Key decisions or conclusions made
3. Important facts or preferences mentioned by the user
4. Business context (company info, EOS implementation details, etc.)
5. Any action items or commitments

Be specific and factual. Focus on information that would be useful for continuing the conversation later.

CONVERSATION TO SUMMARIZE:
${conversationText}

SUMMARY:`,
      maxTokens: 800,
    });

    console.log(
      `Message Summarizer: Generated summary with ${summary.text.length} characters`,
    );

    return summary.text;
  } catch (error) {
    console.error(
      `Message Summarizer: Error summarizing messages for chat ${chatId}:`,
      error,
    );
    return '';
  }
}

/**
 * Update conversation summary for a chat
 * @param chatId - Chat ID
 * @param messages - Messages to summarize
 * @returns Updated summary
 */
export async function updateConversationSummary(
  chatId: string,
  messages: DBMessage[],
): Promise<string> {
  const summary = await summarizeOlderMessages(messages, chatId);

  if (!summary) {
    return '';
  }

  try {
    // Update chat record with new summary
    await db
      .update(chat)
      .set({
        conversationSummary: summary,
        lastSummarizedAt: new Date(),
      })
      .where(eq(chat.id, chatId));

    console.log(
      `Message Summarizer: Updated conversation summary for chat ${chatId}`,
    );

    return summary;
  } catch (error) {
    console.error(
      `Message Summarizer: Error updating summary in database for chat ${chatId}:`,
      error,
    );
    return summary; // Return summary even if DB update fails
  }
}

/**
 * Check if chat needs summary update
 * @param totalMessages - Total number of messages in chat
 * @param lastSummarizedAt - When summary was last updated
 * @returns Whether summary needs updating
 */
export function shouldUpdateSummary(
  totalMessages: number,
  lastSummarizedAt: Date | null,
): boolean {
  // Don't summarize chats with fewer than 50 messages
  if (totalMessages < 50) {
    return false;
  }

  // If never summarized and has > 50 messages, summarize
  if (!lastSummarizedAt) {
    return true;
  }

  // Update summary every 25 new messages
  // This is a simplified heuristic - could be enhanced with message count tracking
  const daysSinceLastSummary =
    (Date.now() - lastSummarizedAt.getTime()) / (1000 * 60 * 60 * 24);

  // Update if it's been more than 7 days since last summary
  if (daysSinceLastSummary > 7) {
    return true;
  }

  return false;
}

/**
 * Format conversation summary for inclusion in system prompt
 * @param summary - Summary text
 * @param messageCount - Number of messages summarized
 * @returns Formatted prompt section
 */
export function formatSummaryForPrompt(
  summary: string,
  messageCount: number,
): string {
  if (!summary) {
    return '';
  }

  return `
## CONVERSATION HISTORY SUMMARY
The following is a summary of the earlier part of this conversation (${messageCount} messages):

${summary}

**CONTEXT USAGE:**
- Use this summary to understand the broader context of the conversation
- Reference facts and decisions from the summary when relevant
- Don't repeat information already covered in the summary
- Focus on building upon previous discussion

`;
}

