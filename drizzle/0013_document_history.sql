-- Create Document History table for tracking all document operations
CREATE TABLE IF NOT EXISTS "DocumentHistory" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "documentId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "operation" varchar NOT NULL,
  "timestamp" timestamp DEFAULT now() NOT NULL,
  "metadata" jsonb,
  CONSTRAINT "DocumentHistory_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "DocumentHistory_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- Create indexes for DocumentHistory
CREATE INDEX IF NOT EXISTS "doc_history_document_idx" ON "DocumentHistory" ("documentId");
CREATE INDEX IF NOT EXISTS "doc_history_user_idx" ON "DocumentHistory" ("userId");
CREATE INDEX IF NOT EXISTS "doc_history_timestamp_idx" ON "DocumentHistory" ("timestamp");

-- Add check constraint for operation enum values
ALTER TABLE "DocumentHistory" ADD CONSTRAINT "document_history_operation_check" 
  CHECK ("operation" IN ('create', 'update', 'delete', 'restore'));

-- Create Document Version table for storing content versions
CREATE TABLE IF NOT EXISTS "DocumentVersion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "documentId" uuid NOT NULL,
  "historyId" uuid NOT NULL,
  "versionNumber" integer NOT NULL,
  "title" text NOT NULL,
  "content" text,
  "kind" varchar NOT NULL,
  "createdAt" timestamp NOT NULL,
  "metadata" jsonb,
  CONSTRAINT "DocumentVersion_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "DocumentVersion_historyId_DocumentHistory_id_fk" FOREIGN KEY ("historyId") REFERENCES "DocumentHistory"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create indexes for DocumentVersion
CREATE UNIQUE INDEX IF NOT EXISTS "doc_version_idx" ON "DocumentVersion" ("documentId", "versionNumber");
CREATE INDEX IF NOT EXISTS "doc_version_history_idx" ON "DocumentVersion" ("historyId");

-- Add check constraint for kind enum values
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "document_version_kind_check" 
  CHECK ("kind" IN ('text', 'code', 'image', 'sheet', 'chart', 'vto', 'accountability'));

-- Create Document Edit Session table for grouping related edits
CREATE TABLE IF NOT EXISTS "DocumentEditSession" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "documentId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "endedAt" timestamp,
  "isActive" boolean DEFAULT true NOT NULL,
  "editCount" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "DocumentEditSession_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "DocumentEditSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- Create indexes for DocumentEditSession
CREATE INDEX IF NOT EXISTS "edit_session_doc_user_idx" ON "DocumentEditSession" ("documentId", "userId");
CREATE INDEX IF NOT EXISTS "edit_session_active_idx" ON "DocumentEditSession" ("isActive");

-- Create Document Undo Stack table for managing undo/redo per user per document
CREATE TABLE IF NOT EXISTS "DocumentUndoStack" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "documentId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "currentVersionId" uuid NOT NULL,
  "undoStack" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "redoStack" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "maxStackSize" integer DEFAULT 50 NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "DocumentUndoStack_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "DocumentUndoStack_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "DocumentUndoStack_currentVersionId_DocumentVersion_id_fk" FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- Create unique index for undo stack per user per document
CREATE UNIQUE INDEX IF NOT EXISTS "undo_stack_doc_user_idx" ON "DocumentUndoStack" ("documentId", "userId");


