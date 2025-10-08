-- Add pendingRemoval field to Org table
-- This tracks the number of members that need to be removed when seat count is reduced
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "pendingRemoval" integer DEFAULT 0;

-- Update existing organizations to have pendingRemoval = 0
UPDATE "Org" SET "pendingRemoval" = 0 WHERE "pendingRemoval" IS NULL;











