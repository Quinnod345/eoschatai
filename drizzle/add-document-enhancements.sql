-- Enhanced Document Management Schema Updates
-- Phase 1: Storage tracking and document metadata

-- Add storage tracking to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "storageUsed" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "storageQuota" BIGINT NOT NULL DEFAULT 104857600; -- 100MB default

-- Add document metadata fields to UserDocuments
ALTER TABLE "UserDocuments" ADD COLUMN IF NOT EXISTS "contentHash" VARCHAR(64);
ALTER TABLE "UserDocuments" ADD COLUMN IF NOT EXISTS "processingStatus" VARCHAR(20) NOT NULL DEFAULT 'ready';
ALTER TABLE "UserDocuments" ADD COLUMN IF NOT EXISTS "processingError" TEXT;
ALTER TABLE "UserDocuments" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "UserDocuments" ADD COLUMN IF NOT EXISTS "parentDocumentId" UUID REFERENCES "UserDocuments"("id") ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "user_documents_content_hash_idx" ON "UserDocuments"("contentHash");
CREATE INDEX IF NOT EXISTS "user_documents_processing_status_idx" ON "UserDocuments"("processingStatus");
CREATE INDEX IF NOT EXISTS "user_documents_parent_id_idx" ON "UserDocuments"("parentDocumentId");
CREATE INDEX IF NOT EXISTS "user_storage_idx" ON "User"("storageUsed");

-- Add check constraint for processing status
ALTER TABLE "UserDocuments" DROP CONSTRAINT IF EXISTS "user_documents_processing_status_check";
ALTER TABLE "UserDocuments" ADD CONSTRAINT "user_documents_processing_status_check" 
  CHECK ("processingStatus" IN ('pending', 'processing', 'ready', 'failed'));

-- Phase 2: Document Versions Table
CREATE TABLE IF NOT EXISTS "UserDocumentVersion" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" UUID NOT NULL REFERENCES "UserDocuments"("id") ON DELETE CASCADE,
  "versionNumber" INTEGER NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "content" TEXT,
  "contentHash" VARCHAR(64),
  "uploadedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "uploadedBy" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB
);

-- Indexes for document versions
CREATE INDEX IF NOT EXISTS "user_document_version_document_idx" ON "UserDocumentVersion"("documentId");
CREATE INDEX IF NOT EXISTS "user_document_version_number_idx" ON "UserDocumentVersion"("documentId", "versionNumber");
CREATE INDEX IF NOT EXISTS "user_document_version_active_idx" ON "UserDocumentVersion"("documentId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "user_document_version_unique_idx" ON "UserDocumentVersion"("documentId", "versionNumber");

-- Phase 3: Document Sharing Schema
-- Note: SharedDocument table already exists from add-shared-documents.sql
-- Adding user-specific sharing junction table

CREATE TABLE IF NOT EXISTS "DocumentShareUser" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" UUID NOT NULL REFERENCES "UserDocuments"("id") ON DELETE CASCADE,
  "sharedById" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "sharedWithId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "permission" VARCHAR(20) NOT NULL DEFAULT 'view',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMP,
  CONSTRAINT "document_share_user_unique" UNIQUE("documentId", "sharedWithId")
);

-- Add check constraint for permissions
ALTER TABLE "DocumentShareUser" ADD CONSTRAINT "document_share_user_permission_check" 
  CHECK ("permission" IN ('view', 'edit', 'comment'));

-- Indexes for sharing
CREATE INDEX IF NOT EXISTS "document_share_user_document_idx" ON "DocumentShareUser"("documentId");
CREATE INDEX IF NOT EXISTS "document_share_user_shared_with_idx" ON "DocumentShareUser"("sharedWithId");
CREATE INDEX IF NOT EXISTS "document_share_user_shared_by_idx" ON "DocumentShareUser"("sharedById");

-- Organization-level document sharing
CREATE TABLE IF NOT EXISTS "DocumentShareOrg" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" UUID NOT NULL REFERENCES "UserDocuments"("id") ON DELETE CASCADE,
  "orgId" UUID NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "sharedById" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "permission" VARCHAR(20) NOT NULL DEFAULT 'view',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "document_share_org_unique" UNIQUE("documentId", "orgId")
);

-- Add check constraint for org sharing permissions
ALTER TABLE "DocumentShareOrg" ADD CONSTRAINT "document_share_org_permission_check" 
  CHECK ("permission" IN ('view', 'edit', 'comment'));

-- Indexes for org sharing
CREATE INDEX IF NOT EXISTS "document_share_org_document_idx" ON "DocumentShareOrg"("documentId");
CREATE INDEX IF NOT EXISTS "document_share_org_org_idx" ON "DocumentShareOrg"("orgId");
CREATE INDEX IF NOT EXISTS "document_share_org_shared_by_idx" ON "DocumentShareOrg"("sharedById");

-- Phase 4: Update storage quotas based on plan type
-- Free: 100MB, Pro: 1GB, Business: 10GB
UPDATE "User" SET "storageQuota" = 104857600 WHERE "plan" = 'free'; -- 100MB
UPDATE "User" SET "storageQuota" = 1073741824 WHERE "plan" = 'pro'; -- 1GB
UPDATE "User" SET "storageQuota" = 10737418240 WHERE "plan" = 'business'; -- 10GB

-- Phase 5: Add document usage tracking view (for analytics)
CREATE OR REPLACE VIEW "DocumentUsageStats" AS
SELECT 
  ud."id" as "documentId",
  ud."fileName",
  ud."category",
  ud."userId",
  COUNT(DISTINCT cul."id") as "timesUsed",
  MAX(cul."createdAt") as "lastUsed",
  AVG(cul."userChunks") as "avgChunks",
  SUM(cul."totalTokens") as "totalTokens"
FROM "UserDocuments" ud
LEFT JOIN "ContextUsageLog" cul ON cul."userId" = ud."userId"
GROUP BY ud."id", ud."fileName", ud."category", ud."userId";


