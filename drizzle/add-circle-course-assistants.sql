-- Add Circle.so course persona tracking
-- This table maps Circle.so courses to EOSAI personas for course assistant functionality

CREATE TABLE IF NOT EXISTS "CircleCoursePersona" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "circleSpaceId" VARCHAR(128) NOT NULL,
  "circleCourseId" VARCHAR(128) NOT NULL,
  "personaId" UUID NOT NULL REFERENCES "Persona"(id) ON DELETE CASCADE,
  "courseName" VARCHAR(256) NOT NULL,
  "courseDescription" TEXT,
  "targetAudience" VARCHAR(32) NOT NULL, -- 'implementer' or 'client'
  "lastSyncedAt" TIMESTAMP,
  "syncStatus" VARCHAR(32) DEFAULT 'pending',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("circleCourseId")
);

CREATE INDEX "circle_course_persona_course_idx" ON "CircleCoursePersona"("circleCourseId");
CREATE INDEX "circle_course_persona_persona_idx" ON "CircleCoursePersona"("personaId");


