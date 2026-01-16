-- Fix foreign key constraints for AnalyticsEvent table
-- These FKs were missing ON DELETE behavior, which could block user/org deletion

-- Drop existing constraints if they exist (they might have different names)
DO $$ 
BEGIN
    -- Drop userId constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'AnalyticsEvent_userId_User_id_fk' 
        AND table_name = 'AnalyticsEvent'
    ) THEN
        ALTER TABLE "AnalyticsEvent" DROP CONSTRAINT "AnalyticsEvent_userId_User_id_fk";
    END IF;
    
    -- Drop orgId constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'AnalyticsEvent_orgId_Org_id_fk' 
        AND table_name = 'AnalyticsEvent'
    ) THEN
        ALTER TABLE "AnalyticsEvent" DROP CONSTRAINT "AnalyticsEvent_orgId_Org_id_fk";
    END IF;
END $$;

-- Re-add with proper ON DELETE SET NULL behavior
ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_userId_User_id_fk"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_orgId_Org_id_fk"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL;

-- Log completion
DO $$ 
BEGIN
  RAISE NOTICE 'AnalyticsEvent FK constraints updated successfully';
END $$;





























































