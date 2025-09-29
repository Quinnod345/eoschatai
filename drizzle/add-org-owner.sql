-- Add ownerId to Org table
ALTER TABLE "Org" ADD COLUMN "ownerId" uuid;

-- Add foreign key constraint
ALTER TABLE "Org" ADD CONSTRAINT "Org_ownerId_fkey" 
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX "org_owner_idx" ON "Org"("ownerId");

-- For existing organizations, set the owner to the first member
-- This is a best-effort approach
UPDATE "Org" o
SET "ownerId" = (
  SELECT u.id 
  FROM "User" u 
  WHERE u."orgId" = o.id 
  ORDER BY u.id 
  LIMIT 1
)
WHERE o."ownerId" IS NULL;

