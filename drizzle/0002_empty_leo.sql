CREATE TABLE IF NOT EXISTS "Persona" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"isDefault" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PersonaDocument" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personaId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PersonaDocument_personaId_documentId_unique" UNIQUE("personaId","documentId")
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "personaId" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Persona" ADD CONSTRAINT "Persona_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PersonaDocument" ADD CONSTRAINT "PersonaDocument_personaId_Persona_id_fk" FOREIGN KEY ("personaId") REFERENCES "public"."Persona"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PersonaDocument" ADD CONSTRAINT "PersonaDocument_documentId_UserDocuments_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."UserDocuments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_personaId_Persona_id_fk" FOREIGN KEY ("personaId") REFERENCES "public"."Persona"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
