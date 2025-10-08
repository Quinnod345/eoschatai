-- Add shared documents table for business plan collaboration
CREATE TABLE IF NOT EXISTS "SharedDocument" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" UUID NOT NULL REFERENCES "Document"(id) ON DELETE CASCADE,
  "ownerId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "orgId" UUID REFERENCES "Org"(id) ON DELETE CASCADE,
  "sharedWith" JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of user IDs or 'org' for org-wide
  "permissions" VARCHAR(50) NOT NULL DEFAULT 'view', -- 'view', 'edit', 'comment'
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "SharedDocument_documentId_key" UNIQUE("documentId")
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS "SharedDocument_ownerId_idx" ON "SharedDocument"("ownerId");
CREATE INDEX IF NOT EXISTS "SharedDocument_orgId_idx" ON "SharedDocument"("orgId");
CREATE INDEX IF NOT EXISTS "SharedDocument_documentId_idx" ON "SharedDocument"("documentId");

-- Add sharing metadata to Document table
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "isShared" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "shareSettings" JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS "Document_isShared_idx" ON "Document"("isShared");
CREATE INDEX IF NOT EXISTS "Document_userId_isShared_idx" ON "Document"("userId", "isShared");



