-- Add profilePicture column to User table
-- This allows users to have a profile picture stored in the database
-- Migration created to match schema.ts change

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profilePicture" text;

