-- Add optional company metadata columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'UserSettings' AND column_name = 'companyIndustry'
  ) THEN
    ALTER TABLE "UserSettings" ADD COLUMN "companyIndustry" text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'UserSettings' AND column_name = 'companySize'
  ) THEN
    ALTER TABLE "UserSettings" ADD COLUMN "companySize" text;
  END IF;
END$$;


