-- Add stoppedAt column to Message_v2 table
-- This column tracks when a user stopped generation mid-stream
-- Messages with stoppedAt set don't count toward daily message limits

ALTER TABLE "Message_v2" ADD COLUMN IF NOT EXISTS "stoppedAt" TIMESTAMP;
