ALTER TABLE "Document" DROP CONSTRAINT "Document_id_createdAt_pk";--> statement-breakpoint
ALTER TABLE "Document" ADD PRIMARY KEY ("id");