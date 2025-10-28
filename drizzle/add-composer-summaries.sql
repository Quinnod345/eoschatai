-- Phase 6: Add composer summary columns for large document optimization
-- This enables summarization of large composers to reduce token usage

ALTER TABLE "Document" 
ADD COLUMN IF NOT EXISTS "contentSummary" TEXT;

ALTER TABLE "Embeddings" 
ADD COLUMN IF NOT EXISTS "isSummary" BOOLEAN DEFAULT false;

-- Create index for efficiently finding summary embeddings
CREATE INDEX IF NOT EXISTS "embedding_summary_idx" ON "Embeddings"("isSummary") WHERE "isSummary" = true;

-- Note: Existing documents will need to have summaries generated via background job
-- Run: pnpm run scripts/generate-composer-summaries.ts (to be created)

