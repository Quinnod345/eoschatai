CREATE TABLE IF NOT EXISTS "SystemEmbeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace" varchar(128) NOT NULL,
	"title" text NOT NULL,
	"chunk" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "GoogleCalendarToken" ALTER COLUMN "token" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "Persona" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Persona" ADD COLUMN "isSystemPersona" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "Persona" ADD COLUMN "knowledgeNamespace" varchar(128);--> statement-breakpoint
ALTER TABLE "PersonaProfile" ADD COLUMN "knowledgeNamespace" varchar(128);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_embedding_idx" ON "SystemEmbeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "namespace_idx" ON "SystemEmbeddings" USING btree ("namespace");