-- Add meetingType and tags columns to VoiceRecording table
ALTER TABLE "VoiceRecording" 
  ADD COLUMN IF NOT EXISTS "meetingType" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT '[]'::jsonb;

-- Create index for meetingType for faster filtering
CREATE INDEX IF NOT EXISTS "idx_recording_meeting_type" ON "VoiceRecording"("meetingType");

-- Create GIN index for tags for efficient searching  
CREATE INDEX IF NOT EXISTS "idx_recording_tags" ON "VoiceRecording" USING GIN("tags");

