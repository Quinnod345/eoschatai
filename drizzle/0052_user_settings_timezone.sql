ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "timezone" varchar(64);

UPDATE "UserSettings"
SET "timezone" = 'UTC'
WHERE "timezone" IS NULL OR trim("timezone") = '';

ALTER TABLE "UserSettings"
  ALTER COLUMN "timezone" SET DEFAULT 'UTC';

ALTER TABLE "UserSettings"
  ALTER COLUMN "timezone" SET NOT NULL;
