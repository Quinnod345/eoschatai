-- Add profilePicture column to UserSettings table
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "profilePicture" TEXT; 