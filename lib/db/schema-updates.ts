// This file documents schema changes needed for Phase 2
// These will be applied via migration SQL files

/**
 * Phase 2: Message History Management
 * 
 * Add the following columns to Chat table:
 * - conversationSummary: text - Stores AI-generated summary of older messages
 * - lastSummarizedAt: timestamp - Tracks when summary was last updated
 * - totalMessages: integer - Count of all messages in chat (default 0)
 * 
 * Migration file: drizzle/add-conversation-summary.sql
 */

export const phase2SchemaChanges = {
  table: 'Chat',
  columns: {
    conversationSummary: 'TEXT',
    lastSummarizedAt: 'TIMESTAMP',
    totalMessages: 'INTEGER DEFAULT 0',
  },
  indexes: ['chat_summary_updated_idx ON Chat(lastSummarizedAt)'],
};

