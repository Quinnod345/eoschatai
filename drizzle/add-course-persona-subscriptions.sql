-- Add user subscriptions to course personas
-- Allows users to activate/deactivate course personas without affecting other users

CREATE TABLE IF NOT EXISTS "UserCoursePersonaSubscription" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "personaId" UUID NOT NULL REFERENCES "Persona"(id) ON DELETE CASCADE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "activatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "deactivatedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("userId", "personaId")
);

CREATE INDEX "user_course_persona_sub_user_idx" ON "UserCoursePersonaSubscription"("userId");
CREATE INDEX "user_course_persona_sub_persona_idx" ON "UserCoursePersonaSubscription"("personaId");
CREATE INDEX "user_course_persona_sub_active_idx" ON "UserCoursePersonaSubscription"("userId", "isActive");


