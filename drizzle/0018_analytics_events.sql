CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventName" varchar(128) NOT NULL,
  "source" varchar(16) NOT NULL,
  "userId" uuid REFERENCES "User"("id"),
  "orgId" uuid REFERENCES "Org"("id"),
  "properties" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "analytics_event_user_idx"
  ON "AnalyticsEvent" ("userId");

CREATE INDEX IF NOT EXISTS "analytics_event_org_idx"
  ON "AnalyticsEvent" ("orgId");

CREATE INDEX IF NOT EXISTS "analytics_event_name_idx"
  ON "AnalyticsEvent" ("eventName");
