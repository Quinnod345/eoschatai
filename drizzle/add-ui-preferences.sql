-- Add UI preference settings to UserSettings table
ALTER TABLE "UserSettings"
ADD COLUMN IF NOT EXISTS "disableGlassEffects" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "disableEosGradient" boolean DEFAULT false;



