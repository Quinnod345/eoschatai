-- Add missing pendingRemoval column to Org table
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "pendingRemoval" INTEGER DEFAULT 0;

-- Drop existing FK constraint on User.orgId if it exists
DO $$ BEGIN
  ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_orgId_Org_id_fk";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Re-add FK constraint with proper CASCADE behavior
DO $$ BEGIN
  ALTER TABLE "User" 
  ADD CONSTRAINT "User_orgId_Org_id_fk" 
  FOREIGN KEY ("orgId") 
  REFERENCES "Org"("id") 
  ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

