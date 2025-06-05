-- Add missing columns to UserSettings table
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "dailyMessageCount" INTEGER DEFAULT 0;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "lastMessageCountReset" TIMESTAMP DEFAULT CURRENT_TIMESTAMP; 