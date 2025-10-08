-- Create PasswordResetToken table for password recovery
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "token" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "usedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "PasswordResetToken_token_unique" UNIQUE ("token")
);

-- Create index for faster lookups by userId
CREATE INDEX IF NOT EXISTS "password_reset_token_user_idx" ON "PasswordResetToken" ("userId");

-- Log creation
DO $$ 
BEGIN
    RAISE NOTICE 'PasswordResetToken table created or confirmed to exist';
END $$;


