CREATE TABLE IF NOT EXISTS "UserDocument" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"fileType" varchar(64) NOT NULL,
	"fileSize" varchar(32) NOT NULL,
	"status" varchar DEFAULT 'processing' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserDocumentEmbedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userDocumentId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"chunk" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Suggestion" DROP CONSTRAINT IF EXISTS "Suggestion_documentId_documentCreatedAt_Document_id_createdAt_fk";
--> statement-breakpoint
ALTER TABLE "Stream" DROP CONSTRAINT IF EXISTS "Stream_id_pk";--> statement-breakpoint
ALTER TABLE "Suggestion" DROP CONSTRAINT IF EXISTS "Suggestion_id_pk";--> statement-breakpoint
ALTER TABLE "Stream" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "Suggestion" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "Embeddings" ADD COLUMN IF NOT EXISTS "embedding" vector(1536) NOT NULL;--> statement-breakpoint
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "profilePicture" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserDocumentEmbedding" ADD CONSTRAINT "UserDocumentEmbedding_userDocumentId_UserDocument_id_fk" FOREIGN KEY ("userDocumentId") REFERENCES "public"."UserDocument"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserDocumentEmbedding" ADD CONSTRAINT "UserDocumentEmbedding_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_embedding_idx" ON "UserDocumentEmbedding" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_doc_user_id_idx" ON "UserDocumentEmbedding" USING btree ("userId");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embedding_idx" ON "Embeddings" USING hnsw ("embedding" vector_cosine_ops);