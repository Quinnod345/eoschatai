ALTER TABLE "UserSettings" ADD COLUMN "dailyMessageCount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "UserSettings" ADD COLUMN "lastMessageCountReset" timestamp DEFAULT now();