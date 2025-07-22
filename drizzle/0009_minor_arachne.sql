CREATE TABLE IF NOT EXISTS "MessageEditHistory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"messageId" uuid NOT NULL,
	"previousContent" json NOT NULL,
	"newContent" json NOT NULL,
	"editedBy" uuid NOT NULL,
	"editedAt" timestamp DEFAULT now() NOT NULL,
	"editReason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NexusResearchEmbedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" uuid NOT NULL,
	"resultId" uuid,
	"chunk" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NexusResearchReport" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" uuid NOT NULL,
	"reportType" varchar DEFAULT 'detailed' NOT NULL,
	"content" text NOT NULL,
	"sections" jsonb,
	"citations" jsonb,
	"visualizations" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NexusResearchResult" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" uuid NOT NULL,
	"searchQuery" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"snippet" text,
	"content" text,
	"relevanceScore" integer,
	"sourceType" varchar DEFAULT 'web',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NexusResearchSession" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"chatId" uuid,
	"query" text NOT NULL,
	"status" varchar DEFAULT 'planning' NOT NULL,
	"researchPlan" jsonb,
	"searchQueries" jsonb NOT NULL,
	"totalSources" integer DEFAULT 0,
	"completedSearches" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "MessageEditHistory" ADD CONSTRAINT "MessageEditHistory_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "MessageEditHistory" ADD CONSTRAINT "MessageEditHistory_editedBy_User_id_fk" FOREIGN KEY ("editedBy") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchEmbedding" ADD CONSTRAINT "NexusResearchEmbedding_sessionId_NexusResearchSession_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."NexusResearchSession"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchEmbedding" ADD CONSTRAINT "NexusResearchEmbedding_resultId_NexusResearchResult_id_fk" FOREIGN KEY ("resultId") REFERENCES "public"."NexusResearchResult"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchReport" ADD CONSTRAINT "NexusResearchReport_sessionId_NexusResearchSession_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."NexusResearchSession"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchResult" ADD CONSTRAINT "NexusResearchResult_sessionId_NexusResearchSession_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."NexusResearchSession"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchSession" ADD CONSTRAINT "NexusResearchSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchSession" ADD CONSTRAINT "NexusResearchSession_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_history_message_idx" ON "MessageEditHistory" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_history_user_idx" ON "MessageEditHistory" USING btree ("editedBy");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_history_time_idx" ON "MessageEditHistory" USING btree ("editedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_embedding_idx" ON "NexusResearchEmbedding" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_session_embedding_idx" ON "NexusResearchEmbedding" USING btree ("sessionId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "research_session_report_idx" ON "NexusResearchReport" USING btree ("sessionId","reportType");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_result_session_idx" ON "NexusResearchResult" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_result_url_idx" ON "NexusResearchResult" USING btree ("url");