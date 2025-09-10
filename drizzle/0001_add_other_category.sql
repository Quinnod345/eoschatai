-- Add 'Other' to the category enum for UserDocuments table
-- This requires recreating the constraint in PostgreSQL

-- First, drop the existing constraint
ALTER TABLE "UserDocuments" 
DROP CONSTRAINT IF EXISTS "UserDocuments_category_check";

-- Add the new constraint with 'Other' included
ALTER TABLE "UserDocuments" 
ADD CONSTRAINT "UserDocuments_category_check" 
CHECK (category IN ('Scorecard', 'VTO', 'Rocks', 'A/C', 'Core Process', 'Other'));
