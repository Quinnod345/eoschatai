-- Add API Key tables for public API access
-- Migration: add-api-keys

-- Create ApiKey table
CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "keyHash" varchar(64) NOT NULL,
    "keyPrefix" varchar(12) NOT NULL,
    "userId" uuid REFERENCES "User"("id") ON DELETE CASCADE,
    "orgId" uuid REFERENCES "Org"("id") ON DELETE CASCADE,
    "name" varchar(128) NOT NULL,
    "description" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "rateLimitRpm" integer DEFAULT 60 NOT NULL,
    "rateLimitRpd" integer DEFAULT 1000 NOT NULL,
    "usageCount" integer DEFAULT 0 NOT NULL,
    "usageTokens" integer DEFAULT 0 NOT NULL,
    "lastUsedAt" timestamp,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "expiresAt" timestamp,
    "allowedModels" jsonb,
    "scopes" jsonb DEFAULT '["chat"]'::jsonb NOT NULL,
    "metadata" jsonb
);

-- Create indexes for ApiKey table
CREATE UNIQUE INDEX IF NOT EXISTS "api_key_hash_idx" ON "ApiKey" ("keyHash");
CREATE INDEX IF NOT EXISTS "api_key_prefix_idx" ON "ApiKey" ("keyPrefix");
CREATE INDEX IF NOT EXISTS "api_key_user_idx" ON "ApiKey" ("userId");
CREATE INDEX IF NOT EXISTS "api_key_org_idx" ON "ApiKey" ("orgId");
CREATE INDEX IF NOT EXISTS "api_key_active_idx" ON "ApiKey" ("isActive");
CREATE INDEX IF NOT EXISTS "api_key_expires_idx" ON "ApiKey" ("expiresAt");

-- Create ApiKeyUsage table for tracking usage and analytics
CREATE TABLE IF NOT EXISTS "ApiKeyUsage" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "apiKeyId" uuid NOT NULL REFERENCES "ApiKey"("id") ON DELETE CASCADE,
    "endpoint" varchar(64) NOT NULL,
    "method" varchar(10) NOT NULL,
    "promptTokens" integer DEFAULT 0,
    "completionTokens" integer DEFAULT 0,
    "totalTokens" integer DEFAULT 0,
    "statusCode" integer,
    "responseTimeMs" integer,
    "model" varchar(64),
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "errorMessage" text
);

-- Create indexes for ApiKeyUsage table
CREATE INDEX IF NOT EXISTS "api_key_usage_key_idx" ON "ApiKeyUsage" ("apiKeyId");
CREATE INDEX IF NOT EXISTS "api_key_usage_created_idx" ON "ApiKeyUsage" ("createdAt");
CREATE INDEX IF NOT EXISTS "api_key_usage_endpoint_idx" ON "ApiKeyUsage" ("endpoint");
