-- Create feedback table for detailed user feedback on messages
CREATE TABLE IF NOT EXISTS "Feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chatId" uuid NOT NULL,
  "messageId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "isPositive" boolean NOT NULL,
  "category" varchar,
  "description" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "Feedback_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "Feedback_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "Feedback_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "feedback_user_message_idx" ON "Feedback" ("userId", "messageId");
CREATE INDEX IF NOT EXISTS "feedback_chat_idx" ON "Feedback" ("chatId");

-- Add check constraint for category enum values
ALTER TABLE "Feedback" ADD CONSTRAINT "feedback_category_check" CHECK ("category" IN ('accuracy', 'helpfulness', 'tone', 'length', 'clarity', 'other') OR "category" IS NULL);
