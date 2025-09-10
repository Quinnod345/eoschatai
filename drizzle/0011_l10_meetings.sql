-- Create L10Meeting table
CREATE TABLE IF NOT EXISTS "L10Meeting" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "composerId" varchar(255) NOT NULL,
  "title" varchar(255) NOT NULL,
  "date" timestamp NOT NULL,
  "status" varchar DEFAULT 'active' NOT NULL CHECK ("status" IN ('active', 'completed', 'archived')),
  "attendees" json NOT NULL,
  "rating" integer,
  "notes" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- Create L10AgendaItem table
CREATE TABLE IF NOT EXISTS "L10AgendaItem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meetingId" uuid NOT NULL REFERENCES "L10Meeting"("id") ON DELETE CASCADE,
  "type" varchar NOT NULL CHECK ("type" IN ('segue', 'scorecard', 'rocks', 'headlines', 'todo', 'ids', 'conclusion')),
  "title" varchar(255) NOT NULL,
  "duration" integer NOT NULL,
  "actualDuration" integer,
  "completed" boolean DEFAULT false NOT NULL,
  "notes" text,
  "recordingId" uuid REFERENCES "VoiceRecording"("id"),
  "startTime" timestamp,
  "endTime" timestamp,
  "orderIndex" integer NOT NULL
);

-- Create L10Issue table
CREATE TABLE IF NOT EXISTS "L10Issue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meetingId" uuid NOT NULL REFERENCES "L10Meeting"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "description" text,
  "priority" varchar DEFAULT 'medium' NOT NULL CHECK ("priority" IN ('high', 'medium', 'low')),
  "status" varchar DEFAULT 'identified' NOT NULL CHECK ("status" IN ('identified', 'discussing', 'solving', 'solved')),
  "owner" varchar(255),
  "recordingId" uuid REFERENCES "VoiceRecording"("id"),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "resolvedAt" timestamp
);

-- Create L10Todo table
CREATE TABLE IF NOT EXISTS "L10Todo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meetingId" uuid NOT NULL REFERENCES "L10Meeting"("id") ON DELETE CASCADE,
  "task" text NOT NULL,
  "owner" varchar(255) NOT NULL,
  "dueDate" timestamp,
  "completed" boolean DEFAULT false NOT NULL,
  "completedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "l10_meeting_user_idx" ON "L10Meeting"("userId");
CREATE INDEX IF NOT EXISTS "l10_meeting_composer_idx" ON "L10Meeting"("composerId");
CREATE INDEX IF NOT EXISTS "l10_meeting_status_idx" ON "L10Meeting"("status");
CREATE INDEX IF NOT EXISTS "l10_agenda_meeting_idx" ON "L10AgendaItem"("meetingId");
CREATE INDEX IF NOT EXISTS "l10_issue_meeting_idx" ON "L10Issue"("meetingId");
CREATE INDEX IF NOT EXISTS "l10_todo_meeting_idx" ON "L10Todo"("meetingId");
CREATE INDEX IF NOT EXISTS "l10_todo_owner_idx" ON "L10Todo"("owner");
