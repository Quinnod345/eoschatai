-- API Keys table for public API access
CREATE TABLE IF NOT EXISTS "ApiKey" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"keyHash" varchar(128) NOT NULL,
	"keyPrefix" varchar(20) NOT NULL,
	"lastFour" varchar(4) NOT NULL,
	"requestCount" integer DEFAULT 0 NOT NULL,
	"lastUsedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp,
	"revokedAt" timestamp
);

-- API Key Usage Log for detailed tracking
CREATE TABLE IF NOT EXISTS "ApiKeyUsageLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apiKeyId" uuid NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(10) NOT NULL,
	"statusCode" integer,
	"responseTimeMs" integer,
	"tokensUsed" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);

-- Foreign keys
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "ApiKeyUsageLog" ADD CONSTRAINT "ApiKeyUsageLog_apiKeyId_ApiKey_id_fk" FOREIGN KEY ("apiKeyId") REFERENCES "public"."ApiKey"("id") ON DELETE cascade ON UPDATE no action;

-- Indexes
CREATE INDEX IF NOT EXISTS "api_key_user_idx" ON "ApiKey" USING btree ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "api_key_hash_idx" ON "ApiKey" USING btree ("keyHash");
CREATE INDEX IF NOT EXISTS "api_key_prefix_idx" ON "ApiKey" USING btree ("keyPrefix");
CREATE INDEX IF NOT EXISTS "api_key_usage_key_idx" ON "ApiKeyUsageLog" USING btree ("apiKeyId");
CREATE INDEX IF NOT EXISTS "api_key_usage_created_idx" ON "ApiKeyUsageLog" USING btree ("createdAt");
