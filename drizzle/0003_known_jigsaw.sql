CREATE TABLE IF NOT EXISTS "PersonaProfile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personaId" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"isDefault" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ProfileDocument" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profileId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProfileDocument_profileId_documentId_unique" UNIQUE("profileId","documentId")
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "profileId" uuid;--> statement-breakpoint
ALTER TABLE "Persona" ADD COLUMN "iconUrl" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PersonaProfile" ADD CONSTRAINT "PersonaProfile_personaId_Persona_id_fk" FOREIGN KEY ("personaId") REFERENCES "public"."Persona"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ProfileDocument" ADD CONSTRAINT "ProfileDocument_profileId_PersonaProfile_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."PersonaProfile"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ProfileDocument" ADD CONSTRAINT "ProfileDocument_documentId_UserDocuments_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."UserDocuments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_profileId_PersonaProfile_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."PersonaProfile"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
