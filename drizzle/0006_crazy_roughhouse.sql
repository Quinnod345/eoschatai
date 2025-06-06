CREATE TABLE IF NOT EXISTS "BookmarkedChat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"chatId" uuid NOT NULL,
	"bookmarkedAt" timestamp DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
DROP TABLE "BookmarkedMessage";--> statement-breakpoint
ALTER TABLE "UserSettings" DROP CONSTRAINT "UserSettings_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "PinnedMessage" ALTER COLUMN "userId" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "kind" varchar DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "lastFeaturesVersion" timestamp;--> statement-breakpoint
ALTER TABLE "UserSettings" ADD COLUMN "selectedChatModel" text DEFAULT 'gpt-4o-mini';--> statement-breakpoint
ALTER TABLE "UserSettings" ADD COLUMN "selectedProvider" text DEFAULT 'openai';--> statement-breakpoint
ALTER TABLE "UserSettings" ADD COLUMN "selectedVisibilityType" text DEFAULT 'private';--> statement-breakpoint
ALTER TABLE "UserSettings" ADD COLUMN "selectedPersonaId" uuid;--> statement-breakpoint
ALTER TABLE "UserSettings" ADD COLUMN "selectedProfileId" uuid;--> statement-breakpoint
ALTER TABLE "UserSettings" ADD COLUMN "selectedResearchMode" text DEFAULT 'off';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BookmarkedChat" ADD CONSTRAINT "BookmarkedChat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BookmarkedChat" ADD CONSTRAINT "BookmarkedChat_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bookmarked_user_chat_idx" ON "BookmarkedChat" USING btree ("userId","chatId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookmarked_user_idx" ON "BookmarkedChat" USING btree ("userId");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "Document" DROP COLUMN IF EXISTS "text";--> statement-breakpoint
ALTER TABLE "UserSettings" DROP COLUMN IF EXISTS "isPremium";