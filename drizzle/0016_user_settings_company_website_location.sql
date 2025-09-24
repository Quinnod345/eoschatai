-- Add company website and location columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'UserSettings' AND column_name = 'companyWebsite'
  ) THEN
    ALTER TABLE "UserSettings" ADD COLUMN "companyWebsite" text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'UserSettings' AND column_name = 'companyCountry'
  ) THEN
    ALTER TABLE "UserSettings" ADD COLUMN "companyCountry" text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'UserSettings' AND column_name = 'companyState'
  ) THEN
    ALTER TABLE "UserSettings" ADD COLUMN "companyState" text;
  END IF;
END$$;
