CREATE TABLE IF NOT EXISTS "BookmarkedMessage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" varchar NOT NULL,
	"messageId" uuid NOT NULL,
	"chatId" uuid NOT NULL,
	"bookmarkedAt" timestamp DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PinnedMessage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" varchar NOT NULL,
	"messageId" uuid NOT NULL,
	"chatId" uuid NOT NULL,
	"pinnedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BookmarkedMessage" ADD CONSTRAINT "BookmarkedMessage_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BookmarkedMessage" ADD CONSTRAINT "BookmarkedMessage_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BookmarkedMessage" ADD CONSTRAINT "BookmarkedMessage_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookmarked_user_message_idx" ON "BookmarkedMessage" USING btree ("userId","messageId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookmarked_user_idx" ON "BookmarkedMessage" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pinned_user_message_idx" ON "PinnedMessage" USING btree ("userId","messageId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pinned_chat_idx" ON "PinnedMessage" USING btree ("chatId");