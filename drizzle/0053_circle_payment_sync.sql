ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "circleMemberId" text;

CREATE INDEX IF NOT EXISTS "user_circle_member_idx"
ON "User" ("circleMemberId");

CREATE TABLE IF NOT EXISTS "CircleSyncLog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "eventId" text NOT NULL,
  "circleMemberId" text,
  "email" text,
  "tierPurchased" text,
  "mappedPlan" plan_type,
  "action" varchar(64) NOT NULL,
  "userId" uuid,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "errorMessage" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE "CircleSyncLog"
  ADD CONSTRAINT "CircleSyncLog_userId_User_id_fk"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "circle_sync_log_event_id_idx"
ON "CircleSyncLog" ("eventId");

CREATE INDEX IF NOT EXISTS "circle_sync_log_member_idx"
ON "CircleSyncLog" ("circleMemberId");

CREATE INDEX IF NOT EXISTS "circle_sync_log_email_idx"
ON "CircleSyncLog" ("email");

CREATE INDEX IF NOT EXISTS "circle_sync_log_action_idx"
ON "CircleSyncLog" ("action");

CREATE INDEX IF NOT EXISTS "circle_sync_log_user_idx"
ON "CircleSyncLog" ("userId");

CREATE INDEX IF NOT EXISTS "circle_sync_log_created_at_idx"
ON "CircleSyncLog" ("createdAt");
