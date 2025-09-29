-- Add orgId to personas table for shared personas
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "orgId" uuid REFERENCES "Org"(id) ON DELETE CASCADE;

-- Add isShared flag to personas
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "isShared" boolean DEFAULT false;

-- Create index for org personas
CREATE INDEX IF NOT EXISTS "idx_persona_orgId" ON "Persona"("orgId");

-- Create OrgMemberRole table for role management
CREATE TABLE IF NOT EXISTS "OrgMemberRole" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "orgId" uuid NOT NULL REFERENCES "Org"(id) ON DELETE CASCADE,
  "role" varchar(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "orgId")
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_org_member_role_userId" ON "OrgMemberRole"("userId");
CREATE INDEX IF NOT EXISTS "idx_org_member_role_orgId" ON "OrgMemberRole"("orgId");

-- Migrate existing org owners to the role table
INSERT INTO "OrgMemberRole" ("userId", "orgId", "role")
SELECT o."ownerId", o."id", 'owner'
FROM "Org" o
WHERE o."ownerId" IS NOT NULL
ON CONFLICT ("userId", "orgId") DO NOTHING;

-- Migrate existing org members to the role table
INSERT INTO "OrgMemberRole" ("userId", "orgId", "role")
SELECT u."id", u."orgId", 'member'
FROM "User" u
WHERE u."orgId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "OrgMemberRole" omr 
    WHERE omr."userId" = u."id" AND omr."orgId" = u."orgId"
  );

