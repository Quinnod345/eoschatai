-- Add persona profiles functionality
-- This migration adds support for profiles as sub-groups within personas

-- Create PersonaProfile table
CREATE TABLE IF NOT EXISTS "PersonaProfile" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "personaId" uuid NOT NULL REFERENCES "Persona"("id") ON DELETE CASCADE,
  "name" varchar(128) NOT NULL,
  "description" text,
  "instructions" text NOT NULL,
  "isDefault" boolean DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- Create ProfileDocument junction table
CREATE TABLE IF NOT EXISTS "ProfileDocument" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "profileId" uuid NOT NULL REFERENCES "PersonaProfile"("id") ON DELETE CASCADE,
  "documentId" uuid NOT NULL REFERENCES "UserDocuments"("id") ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  UNIQUE("profileId", "documentId")
);

-- Add profileId to Chat table
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "profileId" uuid REFERENCES "PersonaProfile"("id");

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "persona_profile_persona_id_idx" ON "PersonaProfile"("personaId");
CREATE INDEX IF NOT EXISTS "profile_document_profile_id_idx" ON "ProfileDocument"("profileId");
CREATE INDEX IF NOT EXISTS "profile_document_document_id_idx" ON "ProfileDocument"("documentId");
CREATE INDEX IF NOT EXISTS "chat_profile_id_idx" ON "Chat"("profileId"); 