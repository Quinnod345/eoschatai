-- Add lastFeaturesVersion column to User table
ALTER TABLE "User" 
ADD COLUMN "lastFeaturesVersion" timestamp;