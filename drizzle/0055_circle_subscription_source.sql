DO $$
BEGIN
  CREATE TYPE "subscription_source" AS ENUM ('stripe', 'circle');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "circleId" text;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "circleMemberEmail" text;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "subscriptionSource" subscription_source DEFAULT 'stripe' NOT NULL;

ALTER TABLE "Org"
ADD COLUMN IF NOT EXISTS "subscriptionSource" subscription_source DEFAULT 'stripe' NOT NULL;

UPDATE "User"
SET "circleId" = "circleMemberId"
WHERE "circleId" IS NULL
  AND "circleMemberId" IS NOT NULL;

UPDATE "User"
SET "circleMemberEmail" = lower("email")
WHERE "circleMemberEmail" IS NULL
  AND "circleMemberId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "user_circle_id_idx"
ON "User" ("circleId");

CREATE INDEX IF NOT EXISTS "user_circle_member_email_idx"
ON "User" ("circleMemberEmail");

CREATE INDEX IF NOT EXISTS "user_subscription_source_idx"
ON "User" ("subscriptionSource");

CREATE INDEX IF NOT EXISTS "org_subscription_source_idx"
ON "Org" ("subscriptionSource");
