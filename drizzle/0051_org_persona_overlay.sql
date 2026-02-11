ALTER TABLE "Persona"
  ADD COLUMN IF NOT EXISTS "visibility" varchar(16);

ALTER TABLE "Persona"
  ALTER COLUMN "visibility" SET DEFAULT 'private';

UPDATE "Persona"
SET "visibility" = CASE
  WHEN COALESCE("isShared", false) = true THEN 'org'
  ELSE COALESCE("visibility", 'private')
END;

ALTER TABLE "Persona"
  ALTER COLUMN "visibility" SET NOT NULL;

ALTER TABLE "Persona"
  ADD COLUMN IF NOT EXISTS "lockInstructions" boolean NOT NULL DEFAULT false;

ALTER TABLE "Persona"
  ADD COLUMN IF NOT EXISTS "lockKnowledge" boolean NOT NULL DEFAULT false;

ALTER TABLE "Persona"
  ADD COLUMN IF NOT EXISTS "allowUserOverlay" boolean NOT NULL DEFAULT false;

ALTER TABLE "Persona"
  ADD COLUMN IF NOT EXISTS "allowUserKnowledge" boolean NOT NULL DEFAULT false;

ALTER TABLE "Persona"
  ADD COLUMN IF NOT EXISTS "publishedAt" timestamp;

-- Backfill legacy shared personas into the new visibility model
UPDATE "Persona"
SET "visibility" = 'org'
WHERE COALESCE("isShared", false) = true;

CREATE INDEX IF NOT EXISTS "persona_org_visibility_idx"
  ON "Persona" ("orgId", "visibility");

CREATE TABLE IF NOT EXISTS "PersonaUserOverlay" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "personaId" uuid NOT NULL REFERENCES "Persona"("id") ON DELETE CASCADE,
  "additionalInstructions" text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "persona_user_overlay_user_persona_unique" UNIQUE("userId", "personaId")
);

CREATE INDEX IF NOT EXISTS "persona_user_overlay_user_idx"
  ON "PersonaUserOverlay" ("userId");

CREATE INDEX IF NOT EXISTS "persona_user_overlay_persona_idx"
  ON "PersonaUserOverlay" ("personaId");

CREATE TABLE IF NOT EXISTS "PersonaUserOverlayDocument" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "overlayId" uuid NOT NULL REFERENCES "PersonaUserOverlay"("id") ON DELETE CASCADE,
  "documentId" uuid NOT NULL REFERENCES "UserDocuments"("id") ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "persona_user_overlay_document_overlay_doc_unique" UNIQUE("overlayId", "documentId")
);

CREATE INDEX IF NOT EXISTS "persona_user_overlay_document_overlay_idx"
  ON "PersonaUserOverlayDocument" ("overlayId");

CREATE INDEX IF NOT EXISTS "persona_user_overlay_document_doc_idx"
  ON "PersonaUserOverlayDocument" ("documentId");

CREATE TABLE IF NOT EXISTS "OrgDocument" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "orgId" uuid NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "uploadedBy" uuid REFERENCES "User"("id") ON DELETE SET NULL,
  "fileName" varchar(255) NOT NULL,
  "fileUrl" text NOT NULL,
  "fileSize" integer NOT NULL,
  "fileType" varchar(255) NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "contentHash" varchar(64),
  "processingStatus" varchar(32) NOT NULL DEFAULT 'pending' CHECK ("processingStatus" IN ('pending', 'processing', 'ready', 'failed')),
  "processingError" text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "org_document_org_idx"
  ON "OrgDocument" ("orgId");

CREATE INDEX IF NOT EXISTS "org_document_processing_status_idx"
  ON "OrgDocument" ("processingStatus");

CREATE INDEX IF NOT EXISTS "org_document_content_hash_idx"
  ON "OrgDocument" ("contentHash");
