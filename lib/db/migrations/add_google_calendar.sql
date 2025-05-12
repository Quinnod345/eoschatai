-- Add googleCalendarConnected to User table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'googleCalendarConnected'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "googleCalendarConnected" BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added googleCalendarConnected column to User table';
    ELSE
        RAISE NOTICE 'googleCalendarConnected column already exists in User table';
    END IF;
END $$;

-- Create GoogleCalendarToken table if it doesn't exist
CREATE TABLE IF NOT EXISTS "GoogleCalendarToken" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "token" JSONB NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "GoogleCalendarToken_userId_unique" UNIQUE ("userId")
);

-- Log creation
DO $$ 
BEGIN
    RAISE NOTICE 'GoogleCalendarToken table created or confirmed to exist';
END $$; 