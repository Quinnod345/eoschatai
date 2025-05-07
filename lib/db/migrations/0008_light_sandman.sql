DROP INDEX IF EXISTS "embedding_idx";--> statement-breakpoint
ALTER TABLE "Embeddings" DROP COLUMN IF EXISTS "embedding";