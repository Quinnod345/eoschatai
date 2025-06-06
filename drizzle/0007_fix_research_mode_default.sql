-- Update existing records that have 'standard' to 'off'
UPDATE "UserSettings" SET "selectedResearchMode" = 'off' WHERE "selectedResearchMode" = 'standard';

-- Update the default value for the column
ALTER TABLE "UserSettings" ALTER COLUMN "selectedResearchMode" SET DEFAULT 'off'; 