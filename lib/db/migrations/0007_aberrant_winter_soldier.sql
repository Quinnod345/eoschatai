CREATE TABLE IF NOT EXISTS "Embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"chunk" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "provider" varchar;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Embeddings" ADD CONSTRAINT "Embeddings_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embedding_idx" ON "Embeddings" USING hnsw ("embedding" vector_cosine_ops);