-- Phase 7: Create context usage tracking table
-- This enables analysis of RAG effectiveness and optimization

CREATE TABLE IF NOT EXISTS "ContextUsageLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "chatId" UUID REFERENCES "Chat"("id") ON DELETE CASCADE,
  "messageId" UUID REFERENCES "Message_v2"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "queryComplexity" VARCHAR(20),
  "systemChunks" INTEGER DEFAULT 0,
  "personaChunks" INTEGER DEFAULT 0,
  "userChunks" INTEGER DEFAULT 0,
  "memoryChunks" INTEGER DEFAULT 0,
  "conversationSummaryUsed" BOOLEAN DEFAULT false,
  "totalTokens" INTEGER,
  "contextTokens" INTEGER,
  "responseTokens" INTEGER,
  "model" VARCHAR(50),
  "userFeedback" VARCHAR(20) DEFAULT 'pending',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "metadata" JSONB
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "context_log_chat_idx" ON "ContextUsageLog"("chatId");
CREATE INDEX IF NOT EXISTS "context_log_message_idx" ON "ContextUsageLog"("messageId");
CREATE INDEX IF NOT EXISTS "context_log_user_idx" ON "ContextUsageLog"("userId");
CREATE INDEX IF NOT EXISTS "context_log_feedback_idx" ON "ContextUsageLog"("userFeedback");
CREATE INDEX IF NOT EXISTS "context_log_complexity_idx" ON "ContextUsageLog"("queryComplexity");
CREATE INDEX IF NOT EXISTS "context_log_created_idx" ON "ContextUsageLog"("createdAt");

