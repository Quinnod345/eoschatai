-- Add autocompleteEnabled to UserSettings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'UserSettings' AND column_name = 'autocompleteEnabled'
  ) THEN
    ALTER TABLE "UserSettings" ADD COLUMN "autocompleteEnabled" boolean DEFAULT true;
  END IF;
END$$;


