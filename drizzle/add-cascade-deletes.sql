-- Add cascading deletes where appropriate
-- This migration adds ON DELETE CASCADE to foreign keys where it makes logical sense

-- Chat table - cascade from user deletion
ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_userId_User_id_fk";
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Chat table - set null for persona/profile deletion (preserve chat history)
ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_personaId_Persona_id_fk";
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_personaId_Persona_id_fk" 
  FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL;

ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_profileId_PersonaProfile_id_fk";
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_profileId_PersonaProfile_id_fk" 
  FOREIGN KEY ("profileId") REFERENCES "PersonaProfile"("id") ON DELETE SET NULL;

-- Message tables - cascade from chat deletion
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_chatId_Chat_id_fk";
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_Chat_id_fk" 
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;

ALTER TABLE "Message_v2" DROP CONSTRAINT IF EXISTS "Message_v2_chatId_Chat_id_fk";
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_Chat_id_fk" 
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;

-- Vote tables - cascade from chat and message deletion
ALTER TABLE "Vote" DROP CONSTRAINT IF EXISTS "Vote_chatId_Chat_id_fk";
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_chatId_Chat_id_fk" 
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;

ALTER TABLE "Vote" DROP CONSTRAINT IF EXISTS "Vote_messageId_Message_id_fk";
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_messageId_Message_id_fk" 
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE;

ALTER TABLE "Vote_v2" DROP CONSTRAINT IF EXISTS "Vote_v2_chatId_Chat_id_fk";
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_Chat_id_fk" 
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;

ALTER TABLE "Vote_v2" DROP CONSTRAINT IF EXISTS "Vote_v2_messageId_Message_v2_id_fk";
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk" 
  FOREIGN KEY ("messageId") REFERENCES "Message_v2"("id") ON DELETE CASCADE;

-- Feedback table - cascade from chat and message deletion
ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_chatId_Chat_id_fk";
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_chatId_Chat_id_fk" 
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;

ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_messageId_Message_v2_id_fk";
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_messageId_Message_v2_id_fk" 
  FOREIGN KEY ("messageId") REFERENCES "Message_v2"("id") ON DELETE CASCADE;

ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_userId_User_id_fk";
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_User_id_fk" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- PinnedMessage table - cascade from user, message, and chat deletion
ALTER TABLE "PinnedMessage" DROP CONSTRAINT IF EXISTS "PinnedMessage_userId_User_id_fk";
ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_userId_User_id_fk" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "PinnedMessage" DROP CONSTRAINT IF EXISTS "PinnedMessage_messageId_Message_v2_id_fk";
ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_messageId_Message_v2_id_fk" 
  FOREIGN KEY ("messageId") REFERENCES "Message_v2"("id") ON DELETE CASCADE;

ALTER TABLE "PinnedMessage" DROP CONSTRAINT IF EXISTS "PinnedMessage_chatId_Chat_id_fk";
ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_chatId_Chat_id_fk" 
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;

-- BookmarkedChat table - cascade from user and chat deletion
ALTER TABLE "BookmarkedChat" DROP CONSTRAINT IF EXISTS "BookmarkedChat_userId_User_id_fk";
ALTER TABLE "BookmarkedChat" ADD CONSTRAINT "BookmarkedChat_userId_User_id_fk" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "BookmarkedChat" DROP CONSTRAINT IF EXISTS "BookmarkedChat_chatId_Chat_id_fk";
ALTER TABLE "BookmarkedChat" ADD CONSTRAINT "BookmarkedChat_chatId_Chat_id_fk" 
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;

-- Document table - cascade from user deletion
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_userId_User_id_fk";
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fk" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Suggestion table - cascade from document deletion, set null for user
ALTER TABLE "Suggestion" DROP CONSTRAINT IF EXISTS "Suggestion_documentId_Document_id_fk";
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_documentId_Document_id_fk" 
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE;

ALTER TABLE "Suggestion" DROP CONSTRAINT IF EXISTS "Suggestion_userId_User_id_fk";
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_User_id_fk" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

-- Stream table - cascade from chat deletion
ALTER TABLE "Stream" DROP CONSTRAINT IF EXISTS "Stream_chatId_Chat_id_fk";
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fk" 
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;

-- MessageEditHistory - set null for editedBy (preserve edit history even if user deleted)
ALTER TABLE "MessageEditHistory" DROP CONSTRAINT IF EXISTS "MessageEditHistory_editedBy_User_id_fk";
ALTER TABLE "MessageEditHistory" ADD CONSTRAINT "MessageEditHistory_editedBy_User_id_fk" 
  FOREIGN KEY ("editedBy") REFERENCES "User"("id") ON DELETE SET NULL;

-- DocumentHistory - set null for userId (preserve history)
ALTER TABLE "DocumentHistory" DROP CONSTRAINT IF EXISTS "DocumentHistory_userId_User_id_fk";
ALTER TABLE "DocumentHistory" ADD CONSTRAINT "DocumentHistory_userId_User_id_fk" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

-- DocumentEditSession - set null for userId (preserve session data)
ALTER TABLE "DocumentEditSession" DROP CONSTRAINT IF EXISTS "DocumentEditSession_userId_User_id_fk";
ALTER TABLE "DocumentEditSession" ADD CONSTRAINT "DocumentEditSession_userId_User_id_fk" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

-- DocumentUndoStack - cascade from user deletion (undo stack is user-specific)
ALTER TABLE "DocumentUndoStack" DROP CONSTRAINT IF EXISTS "DocumentUndoStack_userId_User_id_fk";
ALTER TABLE "DocumentUndoStack" ADD CONSTRAINT "DocumentUndoStack_userId_User_id_fk" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- L10AgendaItem - set null for recordingId (preserve agenda even if recording deleted)
ALTER TABLE "L10AgendaItem" DROP CONSTRAINT IF EXISTS "L10AgendaItem_recordingId_VoiceRecording_id_fk";
ALTER TABLE "L10AgendaItem" ADD CONSTRAINT "L10AgendaItem_recordingId_VoiceRecording_id_fk" 
  FOREIGN KEY ("recordingId") REFERENCES "VoiceRecording"("id") ON DELETE SET NULL;

-- L10Issue - set null for recordingId
ALTER TABLE "L10Issue" DROP CONSTRAINT IF EXISTS "L10Issue_recordingId_VoiceRecording_id_fk";
ALTER TABLE "L10Issue" ADD CONSTRAINT "L10Issue_recordingId_VoiceRecording_id_fk" 
  FOREIGN KEY ("recordingId") REFERENCES "VoiceRecording"("id") ON DELETE SET NULL;


