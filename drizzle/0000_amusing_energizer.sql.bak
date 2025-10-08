-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE IF NOT EXISTS "Suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"documentCreatedAt" timestamp NOT NULL,
	"originalText" text NOT NULL,
	"suggestedText" text NOT NULL,
	"description" text,
	"isResolved" boolean DEFAULT false NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"content" json NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "BookmarkedChat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"chatId" uuid NOT NULL,
	"bookmarkedAt" timestamp DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(64) NOT NULL,
	"password" varchar(64),
	"providerId" varchar(64),
	"googleCalendarConnected" boolean DEFAULT false,
	"lastFeaturesVersion" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL,
	"personaId" uuid,
	"profileId" uuid,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Stream" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Message_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"parts" json NOT NULL,
	"attachments" json NOT NULL,
	"createdAt" timestamp NOT NULL,
	"provider" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "GoogleCalendarToken" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"token" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "GoogleCalendarToken_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentRevision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"content" text NOT NULL,
	"title" text,
	"kind" varchar(32) NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PersonaComposerDocument" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personaId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "L10RecordingContext" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recordingId" uuid NOT NULL,
	"meetingId" uuid NOT NULL,
	"agendaItemId" uuid,
	"issueId" uuid,
	"contextType" varchar NOT NULL
);
--> statement-breakpoint
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
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"profilePicture" text,
	"dailyMessageCount" integer DEFAULT 0,
	"lastMessageCountReset" timestamp DEFAULT now(),
	"selectedChatModel" text DEFAULT 'gpt-4o-mini',
	"selectedProvider" text DEFAULT 'openai',
	"selectedVisibilityType" text DEFAULT 'private',
	"selectedPersonaId" uuid,
	"selectedProfileId" uuid,
	"selectedResearchMode" text DEFAULT 'off',
	"primaryAccountabilityId" uuid,
	"primaryVtoId" uuid,
	"primaryScorecardId" uuid,
	"currentBundleId" uuid,
	"contextDocumentIds" jsonb,
	"usePrimaryDocsForContext" boolean DEFAULT true,
	"usePrimaryDocsForPersona" boolean DEFAULT true,
	"personaContextDocumentIds" jsonb,
	"contextComposerDocumentIds" jsonb,
	"contextRecordingIds" jsonb,
	"autocompleteEnabled" boolean DEFAULT true,
	"companyIndustry" text,
	"companySize" text,
	"companyWebsite" text,
	"companyCountry" text,
	"companyState" text
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
CREATE TABLE IF NOT EXISTS "Persona" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"name" varchar(128) NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"isDefault" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"iconUrl" text,
	"isSystemPersona" boolean DEFAULT false,
	"knowledgeNamespace" varchar(128)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PinnedMessage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"chatId" uuid NOT NULL,
	"pinnedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"kind" varchar DEFAULT 'text' NOT NULL,
	"userId" uuid NOT NULL,
	"currentVersion" integer DEFAULT 1 NOT NULL,
	"lastEditSequence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"chunk" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserDocuments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"fileUrl" text NOT NULL,
	"fileSize" integer NOT NULL,
	"fileType" varchar(255) NOT NULL,
	"category" varchar NOT NULL,
	"content" text NOT NULL,
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
CREATE TABLE IF NOT EXISTS "PersonaProfile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personaId" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"isDefault" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"knowledgeNamespace" varchar(128)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "BundleDocument" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"bundleId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SystemEmbeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace" varchar(128) NOT NULL,
	"title" text NOT NULL,
	"chunk" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
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
	"analyzedAt" timestamp DEFAULT now() NOT NULL,
	"content" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "MessageEditHistory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"messageId" uuid NOT NULL,
	"previousContent" json NOT NULL,
	"newContent" json NOT NULL,
	"editedBy" uuid NOT NULL,
	"editedAt" timestamp DEFAULT now() NOT NULL,
	"editReason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NexusResearchSession" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"chatId" uuid,
	"query" text NOT NULL,
	"status" varchar DEFAULT 'planning' NOT NULL,
	"researchPlan" jsonb,
	"searchQueries" jsonb NOT NULL,
	"totalSources" integer DEFAULT 0,
	"completedSearches" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NexusResearchEmbedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" uuid NOT NULL,
	"resultId" uuid,
	"chunk" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NexusResearchResult" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" uuid NOT NULL,
	"searchQuery" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"snippet" text,
	"content" text,
	"relevanceScore" integer,
	"sourceType" varchar DEFAULT 'web',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NexusResearchReport" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" uuid NOT NULL,
	"reportType" varchar DEFAULT 'detailed' NOT NULL,
	"content" text NOT NULL,
	"sections" jsonb,
	"citations" jsonb,
	"visualizations" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp
);
--> statement-breakpoint
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
CREATE TABLE IF NOT EXISTS "Feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"isPositive" boolean NOT NULL,
	"category" varchar,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "L10Meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"composerId" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"date" timestamp NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"attendees" json NOT NULL,
	"rating" integer,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "L10AgendaItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meetingId" uuid NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"duration" integer NOT NULL,
	"actualDuration" integer,
	"completed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"recordingId" uuid,
	"startTime" timestamp,
	"endTime" timestamp,
	"orderIndex" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserDocument" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"fileType" varchar(64) NOT NULL,
	"fileSize" varchar(32) NOT NULL,
	"status" varchar DEFAULT 'processing' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserDocumentEmbedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userDocumentId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"chunk" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "L10Issue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meetingId" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"status" varchar DEFAULT 'identified' NOT NULL,
	"owner" varchar(255),
	"recordingId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "L10Todo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meetingId" uuid NOT NULL,
	"task" text NOT NULL,
	"owner" varchar(255),
	"dueDate" timestamp,
	"completed" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentVersion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"kind" varchar(32) DEFAULT 'text' NOT NULL,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentEditOperation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"sequenceNumber" integer NOT NULL,
	"operationType" varchar(32) NOT NULL,
	"position" integer NOT NULL,
	"length" integer,
	"content" text,
	"previousContent" text,
	"metadata" json,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"isUndone" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentHistoryPointer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"currentVersion" integer DEFAULT 1 NOT NULL,
	"currentSequenceNumber" integer DEFAULT 0 NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserMemoryEmbedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memoryId" uuid NOT NULL,
	"chunk" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentHistory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"operation" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentEditSession" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"endedAt" timestamp,
	"isActive" boolean DEFAULT true NOT NULL,
	"editCount" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserMemory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"sourceMessageId" uuid,
	"summary" text NOT NULL,
	"content" text,
	"topic" varchar(128),
	"memoryType" varchar DEFAULT 'other' NOT NULL,
	"confidence" integer DEFAULT 60 NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"tags" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentUndoStack" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"currentVersionId" uuid NOT NULL,
	"undoStack" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"redoStack" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"maxStackSize" integer DEFAULT 50 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Vote" (
	"chatId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	CONSTRAINT "Vote_chatId_messageId_pk" PRIMARY KEY("chatId","messageId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Vote_v2" (
	"chatId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	CONSTRAINT "Vote_v2_chatId_messageId_pk" PRIMARY KEY("chatId","messageId")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
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
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_personaId_Persona_id_fk" FOREIGN KEY ("personaId") REFERENCES "public"."Persona"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_profileId_PersonaProfile_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."PersonaProfile"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "GoogleCalendarToken" ADD CONSTRAINT "GoogleCalendarToken_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentRevision" ADD CONSTRAINT "DocumentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentRevision" ADD CONSTRAINT "DocumentRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PersonaComposerDocument" ADD CONSTRAINT "PersonaComposerDocument_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "public"."Persona"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PersonaComposerDocument" ADD CONSTRAINT "PersonaComposerDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "L10RecordingContext" ADD CONSTRAINT "L10RecordingContext_recordingId_VoiceRecording_id_fk" FOREIGN KEY ("recordingId") REFERENCES "public"."VoiceRecording"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
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
 ALTER TABLE "Persona" ADD CONSTRAINT "Persona_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
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
DO $$ BEGIN
 ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Embeddings" ADD CONSTRAINT "Embeddings_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserDocuments" ADD CONSTRAINT "UserDocuments_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
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
 ALTER TABLE "PersonaProfile" ADD CONSTRAINT "PersonaProfile_personaId_Persona_id_fk" FOREIGN KEY ("personaId") REFERENCES "public"."Persona"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BundleDocument" ADD CONSTRAINT "BundleDocument_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BundleDocument" ADD CONSTRAINT "BundleDocument_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VoiceTranscript" ADD CONSTRAINT "VoiceTranscript_recordingId_VoiceRecording_id_fk" FOREIGN KEY ("recordingId") REFERENCES "public"."VoiceRecording"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "MessageEditHistory" ADD CONSTRAINT "MessageEditHistory_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "MessageEditHistory" ADD CONSTRAINT "MessageEditHistory_editedBy_User_id_fk" FOREIGN KEY ("editedBy") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchSession" ADD CONSTRAINT "NexusResearchSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchSession" ADD CONSTRAINT "NexusResearchSession_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchEmbedding" ADD CONSTRAINT "NexusResearchEmbedding_sessionId_NexusResearchSession_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."NexusResearchSession"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchEmbedding" ADD CONSTRAINT "NexusResearchEmbedding_resultId_NexusResearchResult_id_fk" FOREIGN KEY ("resultId") REFERENCES "public"."NexusResearchResult"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchResult" ADD CONSTRAINT "NexusResearchResult_sessionId_NexusResearchSession_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."NexusResearchSession"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NexusResearchReport" ADD CONSTRAINT "NexusResearchReport_sessionId_NexusResearchSession_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."NexusResearchSession"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VoiceRecording" ADD CONSTRAINT "VoiceRecording_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "L10Meeting" ADD CONSTRAINT "L10Meeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "L10AgendaItem" ADD CONSTRAINT "L10AgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."L10Meeting"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "L10AgendaItem" ADD CONSTRAINT "L10AgendaItem_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "public"."VoiceRecording"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserDocumentEmbedding" ADD CONSTRAINT "UserDocumentEmbedding_userDocumentId_UserDocument_id_fk" FOREIGN KEY ("userDocumentId") REFERENCES "public"."UserDocument"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserDocumentEmbedding" ADD CONSTRAINT "UserDocumentEmbedding_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "L10Issue" ADD CONSTRAINT "L10Issue_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."L10Meeting"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "L10Issue" ADD CONSTRAINT "L10Issue_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "public"."VoiceRecording"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "L10Todo" ADD CONSTRAINT "L10Todo_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."L10Meeting"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentEditOperation" ADD CONSTRAINT "DocumentEditOperation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentEditOperation" ADD CONSTRAINT "DocumentEditOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentHistoryPointer" ADD CONSTRAINT "DocumentHistoryPointer_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentHistoryPointer" ADD CONSTRAINT "DocumentHistoryPointer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserMemoryEmbedding" ADD CONSTRAINT "UserMemoryEmbedding_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "public"."UserMemory"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentHistory" ADD CONSTRAINT "DocumentHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentHistory" ADD CONSTRAINT "DocumentHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentEditSession" ADD CONSTRAINT "DocumentEditSession_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentEditSession" ADD CONSTRAINT "DocumentEditSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "public"."Message_v2"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentUndoStack" ADD CONSTRAINT "DocumentUndoStack_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentUndoStack" ADD CONSTRAINT "DocumentUndoStack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentUndoStack" ADD CONSTRAINT "DocumentUndoStack_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "public"."DocumentVersion"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Vote" ADD CONSTRAINT "Vote_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Vote" ADD CONSTRAINT "Vote_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bookmarked_user_chat_idx" ON "BookmarkedChat" USING btree ("userId","chatId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookmarked_user_idx" ON "BookmarkedChat" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_revision_doc_idx" ON "DocumentRevision" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_revision_doc_time_idx" ON "DocumentRevision" USING btree ("documentId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "persona_composer_doc_unique" ON "PersonaComposerDocument" USING btree ("personaId","documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pinned_chat_idx" ON "PinnedMessage" USING btree ("chatId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pinned_user_message_idx" ON "PinnedMessage" USING btree ("userId","messageId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embedding_idx" ON "Embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bundle_user_doc_unique" ON "BundleDocument" USING btree ("userId","bundleId","documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "namespace_idx" ON "SystemEmbeddings" USING btree ("namespace");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_embedding_idx" ON "SystemEmbeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_history_message_idx" ON "MessageEditHistory" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_history_time_idx" ON "MessageEditHistory" USING btree ("editedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_history_user_idx" ON "MessageEditHistory" USING btree ("editedBy");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_embedding_idx" ON "NexusResearchEmbedding" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_session_embedding_idx" ON "NexusResearchEmbedding" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_result_session_idx" ON "NexusResearchResult" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_result_url_idx" ON "NexusResearchResult" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "research_session_report_idx" ON "NexusResearchReport" USING btree ("sessionId","reportType");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_chat_idx" ON "Feedback" USING btree ("chatId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_user_message_idx" ON "Feedback" USING btree ("userId","messageId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "l10_meeting_composer_idx" ON "L10Meeting" USING btree ("composerId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "l10_meeting_status_idx" ON "L10Meeting" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "l10_meeting_user_idx" ON "L10Meeting" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "l10_agenda_meeting_idx" ON "L10AgendaItem" USING btree ("meetingId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_doc_user_id_idx" ON "UserDocumentEmbedding" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_embedding_idx" ON "UserDocumentEmbedding" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "l10_issue_meeting_idx" ON "L10Issue" USING btree ("meetingId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "l10_todo_meeting_idx" ON "L10Todo" USING btree ("meetingId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_version_created_idx" ON "DocumentVersion" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_version_document_idx" ON "DocumentVersion" USING btree ("documentId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_version_unique" ON "DocumentVersion" USING btree ("documentId","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_version_user_idx" ON "DocumentVersion" USING btree ("createdBy");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_edit_document_idx" ON "DocumentEditOperation" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_edit_sequence_idx" ON "DocumentEditOperation" USING btree ("documentId","sequenceNumber");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_edit_sequence_unique" ON "DocumentEditOperation" USING btree ("documentId","sequenceNumber");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_edit_timestamp_idx" ON "DocumentEditOperation" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_edit_user_idx" ON "DocumentEditOperation" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_history_pointer_unique" ON "DocumentHistoryPointer" USING btree ("documentId","userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memory_embedding_idx" ON "UserMemoryEmbedding" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memory_id_idx" ON "UserMemoryEmbedding" USING btree ("memoryId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_history_document_idx" ON "DocumentHistory" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_history_timestamp_idx" ON "DocumentHistory" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_history_user_idx" ON "DocumentHistory" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_session_active_idx" ON "DocumentEditSession" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_session_doc_user_idx" ON "DocumentEditSession" USING btree ("documentId","userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "undo_stack_doc_user_idx" ON "DocumentUndoStack" USING btree ("documentId","userId");
*/