CREATE TABLE IF NOT EXISTS "VoiceRecording" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"audioUrl" text NOT NULL,
	"duration" integer,
	"fileSize" integer,
	"mimeType" varchar(64) DEFAULT 'audio/webm',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "VoiceTranscript" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recordingId" uuid NOT NULL,
	"fullTranscript" text NOT NULL,
	"segments" json NOT NULL,
	"speakerCount" integer DEFAULT 1 NOT NULL,
	"summary" text,
	"keywords" json,
	"analyzedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VoiceRecording" ADD CONSTRAINT "VoiceRecording_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VoiceTranscript" ADD CONSTRAINT "VoiceTranscript_recordingId_VoiceRecording_id_fk" FOREIGN KEY ("recordingId") REFERENCES "public"."VoiceRecording"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
