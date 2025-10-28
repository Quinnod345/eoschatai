-- Phase 2: Add conversation summary columns to Chat table
-- This enables message history limiting with AI-generated summaries

ALTER TABLE "Chat" 
ADD COLUMN IF NOT EXISTS "conversationSummary" TEXT,
ADD COLUMN IF NOT EXISTS "lastSummarizedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "totalMessages" INTEGER DEFAULT 0;

-- Create index for efficient summary retrieval
CREATE INDEX IF NOT EXISTS "chat_summary_updated_idx" ON "Chat"("lastSummarizedAt");

-- Update totalMessages for existing chats
UPDATE "Chat" c
SET "totalMessages" = (
  SELECT COUNT(*) 
  FROM "Message_v2" m 
  WHERE m."chatId" = c.id
)
WHERE "totalMessages" = 0;

