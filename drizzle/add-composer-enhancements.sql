-- Migration: Add Composer Enhancement Features
-- This migration adds new columns to the Document table and creates new tables
-- for tracking composer relationships and mentions

-- Add new columns to Document table for composer enhancements
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "category" varchar(100);
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "viewCount" integer DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "editCount" integer DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "mentionCount" integer DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "lastAccessedAt" timestamp;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sourceDocumentId" uuid;

-- Create indexes for Document table
CREATE INDEX IF NOT EXISTS "composer_title_idx" ON "Document" ("title");
CREATE INDEX IF NOT EXISTS "composer_tags_idx" ON "Document" USING gin ("tags");
CREATE INDEX IF NOT EXISTS "composer_category_idx" ON "Document" ("category");
CREATE INDEX IF NOT EXISTS "composer_last_access_idx" ON "Document" ("lastAccessedAt");
CREATE INDEX IF NOT EXISTS "composer_user_kind_idx" ON "Document" ("userId", "kind");

-- Create ComposerRelationship table
CREATE TABLE IF NOT EXISTS "ComposerRelationship" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sourceId" uuid NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
  "targetId" uuid NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
  "relationshipType" varchar NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "metadata" jsonb,
  CONSTRAINT "composer_rel_unique" UNIQUE ("sourceId", "targetId", "relationshipType")
);

-- Create indexes for ComposerRelationship table
CREATE INDEX IF NOT EXISTS "composer_rel_source_idx" ON "ComposerRelationship" ("sourceId");
CREATE INDEX IF NOT EXISTS "composer_rel_target_idx" ON "ComposerRelationship" ("targetId");
CREATE INDEX IF NOT EXISTS "composer_rel_type_idx" ON "ComposerRelationship" ("relationshipType");

-- Create ComposerMention table
CREATE TABLE IF NOT EXISTS "ComposerMention" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "composerId" uuid NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
  "mentionedInChatId" uuid REFERENCES "Chat"("id") ON DELETE CASCADE,
  "mentionedInComposerId" uuid REFERENCES "Document"("id") ON DELETE CASCADE,
  "messageId" uuid REFERENCES "Message_v2"("id") ON DELETE SET NULL,
  "mentionedAt" timestamp DEFAULT now() NOT NULL,
  "mentionContext" text,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create indexes for ComposerMention table
CREATE INDEX IF NOT EXISTS "composer_mention_composer_idx" ON "ComposerMention" ("composerId");
CREATE INDEX IF NOT EXISTS "composer_mention_chat_idx" ON "ComposerMention" ("mentionedInChatId");
CREATE INDEX IF NOT EXISTS "composer_mention_in_composer_idx" ON "ComposerMention" ("mentionedInComposerId");
CREATE INDEX IF NOT EXISTS "composer_mention_message_idx" ON "ComposerMention" ("messageId");
CREATE INDEX IF NOT EXISTS "composer_mention_user_idx" ON "ComposerMention" ("userId");
CREATE INDEX IF NOT EXISTS "composer_mention_time_idx" ON "ComposerMention" ("mentionedAt");
