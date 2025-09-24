DO $$
BEGIN
  CREATE TYPE plan_type AS ENUM ('free', 'pro', 'business');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "plan" plan_type DEFAULT 'free' NOT NULL,
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" text,
  ADD COLUMN IF NOT EXISTS "entitlements" jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "usageCounters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "orgId" uuid;

CREATE TABLE IF NOT EXISTS "Org" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text,
  "plan" plan_type DEFAULT 'free' NOT NULL,
  "stripeSubscriptionId" text,
  "seatCount" integer DEFAULT 1 NOT NULL,
  "limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "User"
  ADD CONSTRAINT "User_orgId_Org_id_fk" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "user_org_idx" ON "User" ("orgId");
CREATE INDEX IF NOT EXISTS "org_stripe_subscription_idx" ON "Org" ("stripeSubscriptionId");

CREATE TABLE IF NOT EXISTS "WebhookEvents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "eventId" text NOT NULL,
  "processedAt" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_event_id_idx" ON "WebhookEvents" ("eventId");

UPDATE "User"
SET
  "plan" = COALESCE("plan", 'free'),
  "usageCounters" = COALESCE("usageCounters", '{}'::jsonb)
WHERE TRUE;
