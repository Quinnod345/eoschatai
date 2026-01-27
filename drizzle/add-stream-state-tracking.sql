-- Add stream state tracking for resumable streams
-- This enables proper stream lifecycle management and recovery on page reload

-- Create the stream status enum
DO $$ BEGIN
  CREATE TYPE stream_status AS ENUM ('active', 'completed', 'interrupted', 'errored');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to Stream table
ALTER TABLE "Stream" 
ADD COLUMN IF NOT EXISTS "status" stream_status NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS "lastActiveAt" timestamp NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS "messageId" uuid,
ADD COLUMN IF NOT EXISTS "composerDocumentId" uuid,
ADD COLUMN IF NOT EXISTS "metadata" jsonb;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "stream_status_idx" ON "Stream" ("status");
CREATE INDEX IF NOT EXISTS "stream_chat_status_idx" ON "Stream" ("chatId", "status");

-- Update existing streams to have proper lastActiveAt based on createdAt
UPDATE "Stream" SET "lastActiveAt" = "createdAt" WHERE "lastActiveAt" IS NULL;
