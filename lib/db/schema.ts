import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  json,
  jsonb,
  uuid,
  text,
  primaryKey,
  boolean,
  vector,
  index,
  unique,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  providerId: varchar('providerId', { length: 64 }),
  googleCalendarConnected: boolean('googleCalendarConnected').default(false),
  lastFeaturesVersion: timestamp('lastFeaturesVersion'),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
  personaId: uuid('personaId').references(() => persona.id),
  profileId: uuid('profileId').references(() => personaProfile.id),
  metadata: json('metadata').$type<{ isVoiceChat?: boolean }>(),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://github.com/vercel/ai-chatbot/blob/main/docs/04-migrate-to-parts.md
export const messageDeprecated = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  provider: varchar('provider'),
});

export type DBMessage = InferSelectModel<typeof message>;

// Message edit history table for tracking all edits
export const messageEditHistory = pgTable(
  'MessageEditHistory',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    previousContent: json('previousContent').notNull(), // Store the previous parts array
    newContent: json('newContent').notNull(), // Store the new parts array
    editedBy: uuid('editedBy')
      .notNull()
      .references(() => user.id),
    editedAt: timestamp('editedAt').notNull().defaultNow(),
    editReason: text('editReason'), // Optional reason for the edit
  },
  (table) => {
    return {
      messageIdx: index('edit_history_message_idx').on(table.messageId),
      userIdx: index('edit_history_user_idx').on(table.editedBy),
      timeIdx: index('edit_history_time_idx').on(table.editedAt),
    };
  },
);

export type MessageEditHistory = InferSelectModel<typeof messageEditHistory>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://github.com/vercel/ai-chatbot/blob/main/docs/04-migrate-to-parts.md
export const voteDeprecated = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  'Vote_v2',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const pinnedMessage = pgTable(
  'PinnedMessage',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    pinnedAt: timestamp('pinnedAt').notNull().defaultNow(),
  },
  (table) => {
    return {
      userMessageIdx: index('pinned_user_message_idx').on(
        table.userId,
        table.messageId,
      ),
      chatIdx: index('pinned_chat_idx').on(table.chatId),
    };
  },
);

export const bookmarkedChat = pgTable(
  'BookmarkedChat',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    bookmarkedAt: timestamp('bookmarkedAt').notNull().defaultNow(),
    note: text('note'),
  },
  (table) => {
    return {
      userChatIdx: uniqueIndex('bookmarked_user_chat_idx').on(
        table.userId,
        table.chatId,
      ),
      userIdx: index('bookmarked_user_idx').on(table.userId),
    };
  },
);

export type PinnedMessage = InferSelectModel<typeof pinnedMessage>;
export type BookmarkedChat = InferSelectModel<typeof bookmarkedChat>;

export const document = pgTable('Document', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  kind: varchar('kind', { enum: ['text', 'code', 'image', 'sheet', 'chart'] })
    .notNull()
    .default('text'),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
});

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable('Suggestion', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  documentId: uuid('documentId')
    .notNull()
    .references(() => document.id),
  documentCreatedAt: timestamp('documentCreatedAt').notNull(),
  originalText: text('originalText').notNull(),
  suggestedText: text('suggestedText').notNull(),
  description: text('description'),
  isResolved: boolean('isResolved').notNull().default(false),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('createdAt').notNull(),
});

export type Suggestion = InferSelectModel<typeof suggestion>;

// Fixed Stream table - removed duplicate primary key definition
export const stream = pgTable('Stream', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  createdAt: timestamp('createdAt').notNull(),
});

export type Stream = InferSelectModel<typeof stream>;

export const embeddings = pgTable(
  'Embeddings',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    chunk: text('chunk').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    embeddingIdx: index('embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  }),
);

export type Embedding = InferSelectModel<typeof embeddings>;

// System-level embeddings for personas and profiles (EOS knowledge base)
export const systemEmbeddings = pgTable(
  'SystemEmbeddings',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    namespace: varchar('namespace', { length: 128 }).notNull(), // e.g., 'eos-implementer', 'eos-implementer-vision-day-1'
    title: text('title').notNull(), // Document title
    chunk: text('chunk').notNull(), // Text chunk
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    metadata: json('metadata'), // Additional metadata (source, tags, etc.)
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    systemEmbeddingIdx: index('system_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
    namespaceIdx: index('namespace_idx').on(table.namespace),
  }),
);

export type SystemEmbedding = InferSelectModel<typeof systemEmbeddings>;

// New table for user settings
export const userSettings = pgTable('UserSettings', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  notificationsEnabled: boolean('notificationsEnabled').default(true),
  language: varchar('language', { length: 32 }).default('english'),
  fontSize: varchar('fontSize', { length: 16 }).default('medium'),
  displayName: varchar('displayName', { length: 64 }),
  // Company context fields
  companyName: varchar('companyName', { length: 128 }),
  companyType: varchar('companyType', { length: 64 }),
  companyDescription: text('companyDescription'),
  // Profile picture URL from Vercel Blob
  profilePicture: text('profilePicture'),
  // Daily message tracking
  dailyMessageCount: integer('dailyMessageCount').default(0),
  lastMessageCountReset: timestamp('lastMessageCountReset').defaultNow(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  selectedChatModel: text('selectedChatModel').default('gpt-4o-mini'),
  selectedProvider: text('selectedProvider').default('openai'),
  selectedVisibilityType: text('selectedVisibilityType').default('private'),
  selectedPersonaId: uuid('selectedPersonaId'),
  selectedProfileId: uuid('selectedProfileId'),
  selectedResearchMode: text('selectedResearchMode').default('off'),
});

export const userDocuments = pgTable('UserDocuments', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  fileName: varchar('fileName', { length: 255 }).notNull(),
  fileUrl: text('fileUrl').notNull(),
  fileSize: integer('fileSize').notNull(),
  fileType: varchar('fileType', { length: 255 }).notNull(),
  category: varchar('category', {
    enum: ['Scorecard', 'VTO', 'Rocks', 'A/C', 'Core Process'],
  }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type UserDocument = InferSelectModel<typeof userDocuments>;

// Google Calendar token table to store OAuth credentials
export const googleCalendarToken = pgTable(
  'GoogleCalendarToken',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: jsonb('token').notNull(), // Store the entire OAuth token object
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    // Ensure one token per user
    userIdUnique: unique().on(table.userId),
  }),
);

export type GoogleCalendarToken = InferSelectModel<typeof googleCalendarToken>;

// EOS Personas table for AI personalities with custom instructions and documents
export const persona = pgTable('Persona', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId').references(() => user.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  instructions: text('instructions').notNull(),
  iconUrl: text('iconUrl'), // URL for persona icon stored in blob storage
  isDefault: boolean('isDefault').default(false),
  isSystemPersona: boolean('isSystemPersona').default(false), // System-provided personas (read-only)
  knowledgeNamespace: varchar('knowledgeNamespace', { length: 128 }), // RAG namespace for this persona
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type Persona = InferSelectModel<typeof persona>;

// Junction table for persona-document relationships
export const personaDocument = pgTable(
  'PersonaDocument',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    personaId: uuid('personaId')
      .notNull()
      .references(() => persona.id, { onDelete: 'cascade' }),
    documentId: uuid('documentId')
      .notNull()
      .references(() => userDocuments.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    // Ensure unique persona-document pairs
    personaDocumentUnique: unique().on(table.personaId, table.documentId),
  }),
);

export type PersonaDocument = InferSelectModel<typeof personaDocument>;

// EOS Persona Profiles table for sub-groups within personas (e.g., Vision Building Day 2, etc.)
export const personaProfile = pgTable('PersonaProfile', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  personaId: uuid('personaId')
    .notNull()
    .references(() => persona.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  instructions: text('instructions').notNull(),
  isDefault: boolean('isDefault').default(false),
  knowledgeNamespace: varchar('knowledgeNamespace', { length: 128 }), // RAG namespace for this profile
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type PersonaProfile = InferSelectModel<typeof personaProfile>;

// Junction table for profile-document relationships
export const profileDocument = pgTable(
  'ProfileDocument',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    profileId: uuid('profileId')
      .notNull()
      .references(() => personaProfile.id, { onDelete: 'cascade' }),
    documentId: uuid('documentId')
      .notNull()
      .references(() => userDocuments.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    // Ensure unique profile-document pairs
    profileDocumentUnique: unique().on(table.profileId, table.documentId),
  }),
);

export type ProfileDocument = InferSelectModel<typeof profileDocument>;

// Voice recordings table for storing meeting recordings
export const voiceRecording = pgTable('VoiceRecording', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  audioUrl: text('audioUrl').notNull(), // URL to the audio file in blob storage
  duration: integer('duration'), // Duration in seconds
  fileSize: integer('fileSize'), // Size in bytes
  mimeType: varchar('mimeType', { length: 64 }).default('audio/webm'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type VoiceRecording = InferSelectModel<typeof voiceRecording>;

// Voice transcripts table for storing analyzed transcripts
export const voiceTranscript = pgTable('VoiceTranscript', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  recordingId: uuid('recordingId')
    .notNull()
    .references(() => voiceRecording.id, { onDelete: 'cascade' }),
  fullTranscript: text('fullTranscript').notNull(),
  segments: json('segments').notNull(), // Array of { speaker: number, text: string, start?: number, end?: number }
  speakerCount: integer('speakerCount').notNull().default(1),
  summary: text('summary'), // AI-generated summary
  keywords: json('keywords'), // Array of extracted keywords
  analyzedAt: timestamp('analyzedAt').notNull().defaultNow(),
});

export type VoiceTranscript = InferSelectModel<typeof voiceTranscript>;

// Nexus Research tables for storing research sessions and results
export const nexusResearchSession = pgTable('NexusResearchSession', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  chatId: uuid('chatId').references(() => chat.id, { onDelete: 'cascade' }),
  query: text('query').notNull(),
  status: varchar('status', {
    enum: [
      'planning',
      'searching',
      'analyzing',
      'synthesizing',
      'completed',
      'failed',
    ],
  })
    .notNull()
    .default('planning'),
  researchPlan: jsonb('researchPlan'), // Stores the planned research steps
  searchQueries: jsonb('searchQueries').notNull(), // Array of search queries used
  totalSources: integer('totalSources').default(0),
  completedSearches: integer('completedSearches').default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  completedAt: timestamp('completedAt'),
  metadata: jsonb('metadata'), // Additional metadata like model used, token count, etc.
});

export type NexusResearchSession = InferSelectModel<
  typeof nexusResearchSession
>;

// Store individual research results
export const nexusResearchResult = pgTable(
  'NexusResearchResult',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    sessionId: uuid('sessionId')
      .notNull()
      .references(() => nexusResearchSession.id, { onDelete: 'cascade' }),
    searchQuery: text('searchQuery').notNull(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    snippet: text('snippet'),
    content: text('content'), // Full scraped content
    relevanceScore: integer('relevanceScore'), // 0-100
    sourceType: varchar('sourceType', {
      enum: ['web', 'academic', 'news', 'documentation', 'forum', 'other'],
    }).default('web'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    metadata: jsonb('metadata'), // Additional source metadata
  },
  (table) => ({
    sessionIdx: index('research_result_session_idx').on(table.sessionId),
    urlIdx: index('research_result_url_idx').on(table.url),
  }),
);

export type NexusResearchResult = InferSelectModel<typeof nexusResearchResult>;

// Store research embeddings for semantic search
export const nexusResearchEmbedding = pgTable(
  'NexusResearchEmbedding',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    sessionId: uuid('sessionId')
      .notNull()
      .references(() => nexusResearchSession.id, { onDelete: 'cascade' }),
    resultId: uuid('resultId').references(() => nexusResearchResult.id, {
      onDelete: 'cascade',
    }),
    chunk: text('chunk').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    researchEmbeddingIdx: index('research_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
    sessionEmbeddingIdx: index('research_session_embedding_idx').on(
      table.sessionId,
    ),
  }),
);

export type NexusResearchEmbedding = InferSelectModel<
  typeof nexusResearchEmbedding
>;

// Cache for compiled research reports
export const nexusResearchReport = pgTable(
  'NexusResearchReport',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    sessionId: uuid('sessionId')
      .notNull()
      .references(() => nexusResearchSession.id, { onDelete: 'cascade' }),
    reportType: varchar('reportType', {
      enum: ['summary', 'detailed', 'technical', 'executive'],
    })
      .notNull()
      .default('detailed'),
    content: text('content').notNull(), // The compiled report in markdown
    sections: jsonb('sections'), // Structured sections of the report
    citations: jsonb('citations'), // Array of citations used
    visualizations: jsonb('visualizations'), // Chart/graph data
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    expiresAt: timestamp('expiresAt'), // For cache expiration
  },
  (table) => ({
    sessionReportIdx: uniqueIndex('research_session_report_idx').on(
      table.sessionId,
      table.reportType,
    ),
  }),
);

export type NexusResearchReport = InferSelectModel<typeof nexusResearchReport>;
