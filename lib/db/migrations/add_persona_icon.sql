-- Add iconUrl column to Persona table
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT; 