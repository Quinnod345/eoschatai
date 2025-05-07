CREATE TABLE IF NOT EXISTS "UserSettings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"notificationsEnabled" boolean DEFAULT true,
	"language" varchar(32) DEFAULT 'english',
	"fontSize" varchar(16) DEFAULT 'medium',
	"displayName" varchar(64),
	"companyName" varchar(128),
	"companyType" varchar(64),
	"companyDescription" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "providerId" varchar(64);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
