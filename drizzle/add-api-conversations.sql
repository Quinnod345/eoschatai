-- Add API Conversations tables for persistent multi-turn conversations via public API
-- Migration: add-api-conversations

-- Create ApiConversation table
CREATE TABLE IF NOT EXISTS "ApiConversation" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "apiKeyId" uuid NOT NULL REFERENCES "ApiKey"("id") ON DELETE CASCADE,
    "title" text,
    "model" varchar(64) DEFAULT 'eosai-v1',
    "systemPrompt" text,
    "metadata" jsonb,
    "messageCount" integer DEFAULT 0 NOT NULL,
    "totalTokens" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for ApiConversation table
CREATE INDEX IF NOT EXISTS "api_conversation_key_idx" ON "ApiConversation" ("apiKeyId");
CREATE INDEX IF NOT EXISTS "api_conversation_created_idx" ON "ApiConversation" ("createdAt");
CREATE INDEX IF NOT EXISTS "api_conversation_updated_idx" ON "ApiConversation" ("updatedAt");

-- Create ApiConversationMessage table
CREATE TABLE IF NOT EXISTS "ApiConversationMessage" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "conversationId" uuid NOT NULL REFERENCES "ApiConversation"("id") ON DELETE CASCADE,
    "role" varchar(16) NOT NULL,
    "content" text NOT NULL,
    "tokenCount" integer DEFAULT 0,
    "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for ApiConversationMessage table
CREATE INDEX IF NOT EXISTS "api_conv_message_conv_idx" ON "ApiConversationMessage" ("conversationId");
CREATE INDEX IF NOT EXISTS "api_conv_message_created_idx" ON "ApiConversationMessage" ("createdAt");
