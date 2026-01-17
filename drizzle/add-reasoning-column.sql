-- Add reasoning column to Message_v2 table
-- This column stores Claude's extended thinking content for display when revisiting chats

ALTER TABLE "Message_v2" ADD COLUMN IF NOT EXISTS "reasoning" TEXT;
