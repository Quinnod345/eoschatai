import { sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import {
  pgEnum,
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

export const planTypeEnum = pgEnum('plan_type', ['free', 'pro', 'business']);
export type PlanType = (typeof planTypeEnum.enumValues)[number];

// Declare user table first - orgId FK will be added after org table is declared
export const user = pgTable(
  'User',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    email: varchar('email', { length: 64 }).notNull(),
    password: varchar('password', { length: 64 }),
    providerId: varchar('providerId', { length: 64 }),
    googleCalendarConnected: boolean('googleCalendarConnected').default(false),
    lastFeaturesVersion: timestamp('lastFeaturesVersion'),
    plan: planTypeEnum('plan').notNull().default('free'),
    stripeCustomerId: text('stripeCustomerId'),
    entitlements: jsonb('entitlements').notNull().default(sql`'{}'::jsonb`),
    usageCounters: jsonb('usageCounters').notNull().default(sql`'{}'::jsonb`),
    orgId: uuid('orgId'),
    storageUsed: integer('storageUsed').notNull().default(0),
    storageQuota: integer('storageQuota').notNull().default(104857600), // 100MB
  },
  (table) => ({
    orgIdx: index('user_org_idx').on(table.orgId),
    storageIdx: index('user_storage_idx').on(table.storageUsed),
  }),
);

export const org = pgTable(
  'Org',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    name: text('name'),
    plan: planTypeEnum('plan').notNull().default('free'),
    stripeSubscriptionId: text('stripeSubscriptionId'),
    seatCount: integer('seatCount').notNull().default(1),
    pendingRemoval: integer('pendingRemoval').default(0), // Number of members pending removal due to seat reduction
    limits: jsonb('limits').notNull().default(sql`'{}'::jsonb`),
    ownerId: uuid('ownerId').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    stripeSubscriptionIdx: index('org_stripe_subscription_idx').on(
      table.stripeSubscriptionId,
    ),
    ownerIdx: index('org_owner_idx').on(table.ownerId),
  }),
);

export type User = InferSelectModel<typeof user>;
export type Org = InferSelectModel<typeof org>;

export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
  personaId: uuid('personaId').references(() => persona.id, {
    onDelete: 'set null',
  }),
  profileId: uuid('profileId').references(() => personaProfile.id, {
    onDelete: 'set null',
  }),
  metadata: json('metadata').$type<{ isVoiceChat?: boolean }>(),
  conversationSummary: text('conversationSummary'),
  lastSummarizedAt: timestamp('lastSummarizedAt'),
  totalMessages: integer('totalMessages').default(0),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://github.com/vercel/ai-chatbot/blob/main/docs/04-migrate-to-parts.md
export const messageDeprecated = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  provider: varchar('provider'),
  // When a user stops generation mid-stream, this timestamp is set
  // Messages with stoppedAt set don't count toward daily message limits
  stoppedAt: timestamp('stoppedAt'),
  // Store Claude's extended thinking content for display when revisiting chats
  reasoning: text('reasoning'),
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
      .references(() => user.id, { onDelete: 'set null' }),
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
      .references(() => chat.id, { onDelete: 'cascade' }),
    messageId: uuid('messageId')
      .notNull()
      .references(() => messageDeprecated.id, { onDelete: 'cascade' }),
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
      .references(() => chat.id, { onDelete: 'cascade' }),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

// Feedback table for detailed user feedback on messages
export const feedback = pgTable(
  'Feedback',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    isPositive: boolean('isPositive').notNull(), // true for thumbs up, false for thumbs down
    category: varchar('category', {
      enum: ['accuracy', 'helpfulness', 'tone', 'length', 'clarity', 'other'],
    }),
    description: text('description'), // Detailed feedback text
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => {
    return {
      userMessageIdx: index('feedback_user_message_idx').on(
        table.userId,
        table.messageId,
      ),
      chatIdx: index('feedback_chat_idx').on(table.chatId),
    };
  },
);

export type Feedback = InferSelectModel<typeof feedback>;

export const pinnedMessage = pgTable(
  'PinnedMessage',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
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
      .references(() => user.id, { onDelete: 'cascade' }),
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
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

export const webhookEvent = pgTable(
  'WebhookEvents',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    eventId: text('eventId').notNull(),
    processedAt: timestamp('processedAt'),
  },
  (table) => ({
    eventIdx: uniqueIndex('webhook_events_event_id_idx').on(table.eventId),
  }),
);

export type WebhookEvent = InferSelectModel<typeof webhookEvent>;

export const analyticsEvent = pgTable(
  'AnalyticsEvent',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    eventName: varchar('eventName', { length: 128 }).notNull(),
    source: varchar('source', { length: 16 }).notNull(),
    userId: uuid('userId').references(() => user.id, { onDelete: 'set null' }),
    orgId: uuid('orgId').references(() => org.id, { onDelete: 'set null' }),
    properties: jsonb('properties').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('analytics_event_user_idx').on(table.userId),
    orgIdx: index('analytics_event_org_idx').on(table.orgId),
    nameIdx: index('analytics_event_name_idx').on(table.eventName),
  }),
);

export type AnalyticsEvent = InferSelectModel<typeof analyticsEvent>;

export const document = pgTable(
  'Document',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('kind', {
      enum: [
        'text',
        'code',
        'image',
        'sheet',
        'chart',
        'vto',
        'accountability',
      ],
    })
      .notNull()
      .default('text'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    isContext: boolean('isContext').default(false), // Controls whether embeddings exist for this composer document
    isShared: boolean('isShared').default(false), // Whether this document is shared
    shareSettings: json('shareSettings'), // Sharing settings for the document
    contentSummary: text('contentSummary'), // AI-generated summary for large documents
    // Composer enhancement fields
    tags: jsonb('tags').default([]), // Array of custom tags for categorization
    category: varchar('category', { length: 100 }), // User-defined category
    viewCount: integer('viewCount').default(0), // Number of times viewed
    editCount: integer('editCount').default(0), // Number of times edited
    mentionCount: integer('mentionCount').default(0), // Number of times mentioned
    lastAccessedAt: timestamp('lastAccessedAt'), // Last time this composer was accessed
    sourceDocumentId: uuid('sourceDocumentId'), // If converted from UserDocument, reference to original
  },
  (table) => ({
    // Performance indexes for composer features
    composerTitleIdx: index('composer_title_idx').on(table.title),
    composerTagsIdx: index('composer_tags_idx').using('gin', table.tags),
    composerCategoryIdx: index('composer_category_idx').on(table.category),
    composerLastAccessIdx: index('composer_last_access_idx').on(
      table.lastAccessedAt,
    ),
    composerUserKindIdx: index('composer_user_kind_idx').on(
      table.userId,
      table.kind,
    ),
  }),
);

export type Document = InferSelectModel<typeof document>;

// Composer Relationship table for tracking relationships between composers
export const composerRelationship = pgTable(
  'ComposerRelationship',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    sourceId: uuid('sourceId')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    targetId: uuid('targetId')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    relationshipType: varchar('relationshipType', {
      enum: ['parent', 'child', 'related', 'references', 'referenced_by'],
    }).notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    metadata: jsonb('metadata'), // Additional relationship context
  },
  (table) => ({
    sourceIdx: index('composer_rel_source_idx').on(table.sourceId),
    targetIdx: index('composer_rel_target_idx').on(table.targetId),
    typeIdx: index('composer_rel_type_idx').on(table.relationshipType),
    uniqueRelationship: unique('composer_rel_unique').on(
      table.sourceId,
      table.targetId,
      table.relationshipType,
    ),
  }),
);

export type ComposerRelationship = InferSelectModel<
  typeof composerRelationship
>;

// Composer Mention table for tracking where composers are mentioned
export const composerMention = pgTable(
  'ComposerMention',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    composerId: uuid('composerId')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    mentionedInChatId: uuid('mentionedInChatId').references(() => chat.id, {
      onDelete: 'cascade',
    }),
    mentionedInComposerId: uuid('mentionedInComposerId').references(
      () => document.id,
      { onDelete: 'cascade' },
    ),
    messageId: uuid('messageId').references(() => message.id, {
      onDelete: 'set null',
    }),
    mentionedAt: timestamp('mentionedAt').notNull().defaultNow(),
    mentionContext: text('mentionContext'), // Snippet of surrounding text for context
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    composerIdx: index('composer_mention_composer_idx').on(table.composerId),
    chatIdx: index('composer_mention_chat_idx').on(table.mentionedInChatId),
    inComposerIdx: index('composer_mention_in_composer_idx').on(
      table.mentionedInComposerId,
    ),
    messageIdx: index('composer_mention_message_idx').on(table.messageId),
    userIdx: index('composer_mention_user_idx').on(table.userId),
    timeIdx: index('composer_mention_time_idx').on(table.mentionedAt),
  }),
);

export type ComposerMention = InferSelectModel<typeof composerMention>;

// Organization member roles table
export const orgMemberRole = pgTable(
  'OrgMemberRole',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    orgId: uuid('orgId')
      .notNull()
      .references(() => org.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 })
      .notNull()
      .default('member')
      .$type<'owner' | 'admin' | 'member'>(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    unique: uniqueIndex('unique_user_org_role').on(table.userId, table.orgId),
  }),
);

export type OrgMemberRole = InferSelectModel<typeof orgMemberRole>;

// Organization invitation tracking table
export const orgInvitation = pgTable(
  'OrgInvitation',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    orgId: uuid('orgId')
      .notNull()
      .references(() => org.id, { onDelete: 'cascade' }),
    invitedByUserId: uuid('invitedByUserId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    inviteCode: varchar('inviteCode', { length: 255 }).notNull(),
    resendId: varchar('resendId', { length: 255 }), // Resend email ID for tracking
    status: varchar('status', { length: 50 })
      .notNull()
      .default('sent')
      .$type<
        | 'sent'
        | 'delivered'
        | 'opened'
        | 'clicked'
        | 'bounced'
        | 'failed'
        | 'accepted'
      >(),
    sentAt: timestamp('sentAt').notNull().defaultNow(),
    deliveredAt: timestamp('deliveredAt'),
    openedAt: timestamp('openedAt'),
    clickedAt: timestamp('clickedAt'),
    acceptedAt: timestamp('acceptedAt'),
    expiresAt: timestamp('expiresAt').notNull(),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`), // Store additional Resend event data
  },
  (table) => ({
    orgIdx: index('org_invitation_org_idx').on(table.orgId),
    emailIdx: index('org_invitation_email_idx').on(table.email),
    codeIdx: index('org_invitation_code_idx').on(table.inviteCode),
    resendIdIdx: index('org_invitation_resend_id_idx').on(table.resendId),
    statusIdx: index('org_invitation_status_idx').on(table.status),
    // Unique constraint to prevent duplicate active invitations
    activeUnique: uniqueIndex('org_invitation_active_unique')
      .on(table.orgId, table.email)
      .where(sql`${table.status} NOT IN ('accepted', 'failed', 'bounced')`),
  }),
);

export type OrgInvitation = InferSelectModel<typeof orgInvitation>;

export const suggestion = pgTable('Suggestion', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  documentId: uuid('documentId')
    .notNull()
    .references(() => document.id, { onDelete: 'cascade' }),
  documentCreatedAt: timestamp('documentCreatedAt').notNull(),
  originalText: text('originalText').notNull(),
  suggestedText: text('suggestedText').notNull(),
  description: text('description'),
  isResolved: boolean('isResolved').notNull().default(false),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('createdAt').notNull(),
});

export type Suggestion = InferSelectModel<typeof suggestion>;

// Stream state enum for tracking stream lifecycle
export const streamStatusEnum = pgEnum('stream_status', [
  'active',
  'completed',
  'interrupted',
  'errored',
]);

// Stream table with state tracking for resumable streams
export const stream = pgTable(
  'Stream',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull(),
    // Stream state tracking fields
    status: streamStatusEnum('status').notNull().default('active'),
    lastActiveAt: timestamp('lastActiveAt').notNull().defaultNow(),
    messageId: uuid('messageId'), // The assistant message being streamed
    composerDocumentId: uuid('composerDocumentId'), // Active composer document if any
    metadata: jsonb('metadata'), // Additional state (research mode, partial content, etc.)
  },
  (table) => ({
    statusIdx: index('stream_status_idx').on(table.status),
    chatIdStatusIdx: index('stream_chat_status_idx').on(
      table.chatId,
      table.status,
    ),
  }),
);

export type Stream = InferSelectModel<typeof stream>;
export type StreamStatus = (typeof streamStatusEnum.enumValues)[number];

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
    isSummary: boolean('isSummary').default(false), // Whether this embedding is from a summary
  },
  (table) => ({
    embeddingIdx: index('embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
    summaryIdx: index('embedding_summary_idx').on(table.isSummary),
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
  // Company extras
  companyIndustry: text('companyIndustry'),
  companySize: text('companySize'),
  companyWebsite: text('companyWebsite'),
  companyCountry: text('companyCountry'),
  companyState: text('companyState'),
  // Profile picture URL from Vercel Blob
  profilePicture: text('profilePicture'),
  // Daily message tracking
  dailyMessageCount: integer('dailyMessageCount').default(0),
  lastMessageCountReset: timestamp('lastMessageCountReset').defaultNow(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  selectedChatModel: text('selectedChatModel').default('claude-sonnet'),
  selectedProvider: text('selectedProvider').default('anthropic'),
  selectedVisibilityType: text('selectedVisibilityType').default('private'),
  selectedPersonaId: uuid('selectedPersonaId'),
  selectedProfileId: uuid('selectedProfileId'),
  selectedResearchMode: text('selectedResearchMode').default('off'),
  // Primary bindings for key EOS artifacts
  primaryAccountabilityId: uuid('primaryAccountabilityId'),
  primaryVtoId: uuid('primaryVtoId'),
  primaryScorecardId: uuid('primaryScorecardId'),
  currentBundleId: uuid('currentBundleId'),
  // Context settings
  contextDocumentIds: jsonb('contextDocumentIds'), // array of Document.id strings
  contextComposerDocumentIds: jsonb('contextComposerDocumentIds'), // array of composer Document.id strings
  contextRecordingIds: jsonb('contextRecordingIds'), // array of VoiceRecording.id strings
  usePrimaryDocsForContext: boolean('usePrimaryDocsForContext').default(true),
  usePrimaryDocsForPersona: boolean('usePrimaryDocsForPersona').default(true),
  // Feature toggles
  autocompleteEnabled: boolean('autocompleteEnabled').default(true),
  personaContextDocumentIds: jsonb('personaContextDocumentIds'),
  // UI preferences
  disableGlassEffects: boolean('disableGlassEffects').default(true),
  disableEosGradient: boolean('disableEosGradient').default(true),
});

export const bundleDocument = pgTable(
  'BundleDocument',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    bundleId: uuid('bundleId').notNull(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    uniqueBinding: uniqueIndex('bundle_user_doc_unique').on(
      table.userId,
      table.bundleId,
      table.documentId,
    ),
  }),
);

export const userDocuments = pgTable(
  'UserDocuments',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    fileName: varchar('fileName', { length: 255 }).notNull(),
    fileUrl: text('fileUrl').notNull(),
    fileSize: integer('fileSize').notNull(),
    fileType: varchar('fileType', { length: 255 }).notNull(),
    category: varchar('category', {
      enum: [
        'Scorecard',
        'VTO',
        'Rocks',
        'A/C',
        'Core Process',
        'Persona Document',
        'Other',
      ],
    }).notNull(),
    content: text('content').notNull(),
    isContext: boolean('isContext').default(true), // Controls whether embeddings exist for this document
    contentHash: varchar('contentHash', { length: 64 }),
    processingStatus: varchar('processingStatus', {
      enum: ['pending', 'processing', 'ready', 'failed'],
    })
      .notNull()
      .default('ready'),
    processingError: text('processingError'),
    version: integer('version').notNull().default(1),
    parentDocumentId: uuid('parentDocumentId'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    contentHashIdx: index('user_documents_content_hash_idx').on(
      table.contentHash,
    ),
    processingStatusIdx: index('user_documents_processing_status_idx').on(
      table.processingStatus,
    ),
    parentIdIdx: index('user_documents_parent_id_idx').on(
      table.parentDocumentId,
    ),
  }),
);

export type UserDocument = InferSelectModel<typeof userDocuments>;

// User Document Versions
export const userDocumentVersion = pgTable(
  'UserDocumentVersion',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => userDocuments.id, { onDelete: 'cascade' }),
    versionNumber: integer('versionNumber').notNull(),
    fileName: varchar('fileName', { length: 255 }).notNull(),
    fileUrl: text('fileUrl').notNull(),
    fileSize: integer('fileSize').notNull(),
    content: text('content'),
    contentHash: varchar('contentHash', { length: 64 }),
    uploadedAt: timestamp('uploadedAt').notNull().defaultNow(),
    uploadedBy: uuid('uploadedBy')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    isActive: boolean('isActive').notNull().default(false),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    documentIdx: index('user_document_version_document_idx').on(
      table.documentId,
    ),
    versionNumberIdx: index('user_document_version_number_idx').on(
      table.documentId,
      table.versionNumber,
    ),
    activeIdx: index('user_document_version_active_idx').on(
      table.documentId,
      table.isActive,
    ),
    uniqueVersionIdx: uniqueIndex('user_document_version_unique_idx').on(
      table.documentId,
      table.versionNumber,
    ),
  }),
);

export type UserDocumentVersion = InferSelectModel<typeof userDocumentVersion>;

// Document Sharing - User Level
export const documentShareUser = pgTable(
  'DocumentShareUser',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => userDocuments.id, { onDelete: 'cascade' }),
    sharedById: uuid('sharedById')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sharedWithId: uuid('sharedWithId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    permission: varchar('permission', {
      enum: ['view', 'edit', 'comment'],
    })
      .notNull()
      .default('view'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    expiresAt: timestamp('expiresAt'),
  },
  (table) => ({
    documentIdx: index('document_share_user_document_idx').on(table.documentId),
    sharedWithIdx: index('document_share_user_shared_with_idx').on(
      table.sharedWithId,
    ),
    sharedByIdx: index('document_share_user_shared_by_idx').on(
      table.sharedById,
    ),
    uniqueShareIdx: unique('document_share_user_unique').on(
      table.documentId,
      table.sharedWithId,
    ),
  }),
);

export type DocumentShareUser = InferSelectModel<typeof documentShareUser>;

// Document Sharing - Organization Level
export const documentShareOrg = pgTable(
  'DocumentShareOrg',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => userDocuments.id, { onDelete: 'cascade' }),
    orgId: uuid('orgId')
      .notNull()
      .references(() => org.id, { onDelete: 'cascade' }),
    sharedById: uuid('sharedById')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    permission: varchar('permission', {
      enum: ['view', 'edit', 'comment'],
    })
      .notNull()
      .default('view'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    documentIdx: index('document_share_org_document_idx').on(table.documentId),
    orgIdx: index('document_share_org_org_idx').on(table.orgId),
    sharedByIdx: index('document_share_org_shared_by_idx').on(table.sharedById),
    uniqueOrgShareIdx: unique('document_share_org_unique').on(
      table.documentId,
      table.orgId,
    ),
  }),
);

export type DocumentShareOrg = InferSelectModel<typeof documentShareOrg>;

// User Memories tables
export const userMemory = pgTable('UserMemory', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  sourceMessageId: uuid('sourceMessageId').references(() => message.id, {
    onDelete: 'set null',
  }),
  summary: text('summary').notNull(),
  content: text('content'),
  topic: varchar('topic', { length: 128 }),
  memoryType: varchar('memoryType', {
    enum: [
      'preference',
      'profile',
      'company',
      'task',
      'knowledge',
      'personal',
      'other',
    ],
  })
    .notNull()
    .default('other'),
  confidence: integer('confidence').notNull().default(60), // 0-100
  status: varchar('status', {
    enum: ['active', 'pending', 'archived', 'dismissed'],
  })
    .notNull()
    .default('active'),
  tags: jsonb('tags'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  expiresAt: timestamp('expiresAt'),
});

export type UserMemory = InferSelectModel<typeof userMemory>;

export const userMemoryEmbedding = pgTable(
  'UserMemoryEmbedding',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    memoryId: uuid('memoryId')
      .notNull()
      .references(() => userMemory.id, { onDelete: 'cascade' }),
    chunk: text('chunk').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userMemoryEmbeddingIdx: index('user_memory_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
    memoryIdIdx: index('user_memory_id_idx').on(table.memoryId),
  }),
);

export type UserMemoryEmbedding = InferSelectModel<typeof userMemoryEmbedding>;

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

// Password reset tokens for email-based password recovery
export const passwordResetToken = pgTable(
  'PasswordResetToken',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 64 }).notNull(),
    expiresAt: timestamp('expiresAt').notNull(),
    usedAt: timestamp('usedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    tokenUnique: unique().on(table.token),
    userIdx: index('password_reset_token_user_idx').on(table.userId),
  }),
);

export type PasswordResetToken = InferSelectModel<typeof passwordResetToken>;

// EOS Personas table for AI personalities with custom instructions and documents
export const persona = pgTable('Persona', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId').references(() => user.id, { onDelete: 'cascade' }),
  orgId: uuid('orgId').references(() => org.id, { onDelete: 'cascade' }), // For shared org personas
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  instructions: text('instructions').notNull(),
  iconUrl: text('iconUrl'), // URL for persona icon stored in blob storage
  isDefault: boolean('isDefault').default(false),
  isSystemPersona: boolean('isSystemPersona').default(false), // System-provided personas (read-only)
  isShared: boolean('isShared').default(false), // Whether this persona is shared with the org
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

// Junction table for persona to composer-generated documents (Document table)
export const personaComposerDocument = pgTable(
  'PersonaComposerDocument',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    personaId: uuid('personaId')
      .notNull()
      .references(() => persona.id, { onDelete: 'cascade' }),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    // Ensure unique persona-composer-document pairs
    personaComposerDocumentUnique: unique().on(
      table.personaId,
      table.documentId,
    ),
  }),
);

export type PersonaComposerDocument = InferSelectModel<
  typeof personaComposerDocument
>;

// Circle.so course persona tracking table
export const circleCoursePersona = pgTable(
  'CircleCoursePersona',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    circleSpaceId: varchar('circleSpaceId', { length: 128 }).notNull(),
    circleCourseId: varchar('circleCourseId', { length: 128 }).notNull(),
    personaId: uuid('personaId')
      .notNull()
      .references(() => persona.id, { onDelete: 'cascade' }),
    courseName: varchar('courseName', { length: 256 }).notNull(),
    courseDescription: text('courseDescription'),
    targetAudience: varchar('targetAudience', { length: 32 }).notNull(), // 'implementer' or 'client'
    lastSyncedAt: timestamp('lastSyncedAt'),
    syncStatus: varchar('syncStatus', { length: 32 }).default('pending'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    // Ensure unique circle course ID
    circleCourseUnique: unique().on(table.circleCourseId),
    circleCourseIdx: index('circle_course_persona_course_idx').on(
      table.circleCourseId,
    ),
    personaIdx: index('circle_course_persona_persona_idx').on(table.personaId),
  }),
);

export type CircleCoursePersona = InferSelectModel<typeof circleCoursePersona>;

// User subscriptions to course personas (allows users to activate/deactivate course assistants)
export const userCoursePersonaSubscription = pgTable(
  'UserCoursePersonaSubscription',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    personaId: uuid('personaId')
      .notNull()
      .references(() => persona.id, { onDelete: 'cascade' }),
    isActive: boolean('isActive').notNull().default(true),
    activatedAt: timestamp('activatedAt').notNull().defaultNow(),
    deactivatedAt: timestamp('deactivatedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    // Ensure unique user-persona pairs
    userPersonaUnique: unique().on(table.userId, table.personaId),
    userIdx: index('user_course_persona_sub_user_idx').on(table.userId),
    personaIdx: index('user_course_persona_sub_persona_idx').on(
      table.personaId,
    ),
    activeIdx: index('user_course_persona_sub_active_idx').on(
      table.userId,
      table.isActive,
    ),
  }),
);

export type UserCoursePersonaSubscription = InferSelectModel<
  typeof userCoursePersonaSubscription
>;

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
  meetingType: varchar('meetingType', { length: 50 }), // L10, Quarterly, Annual, General, etc.
  tags: json('tags').$type<string[]>().default([]), // Array of tag strings
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
  content: text('content'), // Plain text content for easy access
  segments: json('segments').notNull(), // Array of { speaker: number, text: string, start?: number, end?: number }
  speakerCount: integer('speakerCount').notNull().default(1),
  summary: text('summary'), // AI-generated summary
  keywords: json('keywords'), // Array of extracted keywords
  analyzedAt: timestamp('analyzedAt').notNull().defaultNow(),
});

export type VoiceTranscript = InferSelectModel<typeof voiceTranscript>;

// L10 Meeting tables for EOS Level 10 meetings
export const l10Meeting = pgTable('L10Meeting', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  composerId: varchar('composerId', { length: 255 }).notNull(), // AC composer instance ID
  title: varchar('title', { length: 255 }).notNull(),
  date: timestamp('date').notNull(),
  status: varchar('status', { enum: ['active', 'completed', 'archived'] })
    .notNull()
    .default('active'),
  attendees: json('attendees').notNull(), // Array of seat IDs
  rating: integer('rating'), // 1-10 meeting rating
  notes: text('notes'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type L10Meeting = InferSelectModel<typeof l10Meeting>;

// L10 Agenda Items table
export const l10AgendaItem = pgTable('L10AgendaItem', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  meetingId: uuid('meetingId')
    .notNull()
    .references(() => l10Meeting.id, { onDelete: 'cascade' }),
  type: varchar('type', {
    enum: [
      'segue',
      'scorecard',
      'rocks',
      'headlines',
      'todo',
      'ids',
      'conclusion',
    ],
  }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  duration: integer('duration').notNull(), // Expected duration in minutes
  actualDuration: integer('actualDuration'), // Actual duration in seconds
  completed: boolean('completed').notNull().default(false),
  notes: text('notes'),
  recordingId: uuid('recordingId').references(() => voiceRecording.id, {
    onDelete: 'set null',
  }),
  startTime: timestamp('startTime'),
  endTime: timestamp('endTime'),
  orderIndex: integer('orderIndex').notNull(),
});

export type L10AgendaItem = InferSelectModel<typeof l10AgendaItem>;

// L10 Issues table
export const l10Issue = pgTable('L10Issue', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  meetingId: uuid('meetingId')
    .notNull()
    .references(() => l10Meeting.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  priority: varchar('priority', { enum: ['high', 'medium', 'low'] })
    .notNull()
    .default('medium'),
  status: varchar('status', {
    enum: ['identified', 'discussing', 'solving', 'solved'],
  })
    .notNull()
    .default('identified'),
  owner: varchar('owner', { length: 255 }), // Seat ID
  recordingId: uuid('recordingId').references(() => voiceRecording.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  resolvedAt: timestamp('resolvedAt'),
});

export type L10Issue = InferSelectModel<typeof l10Issue>;

// L10 ToDos table
export const l10Todo = pgTable('L10Todo', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  meetingId: uuid('meetingId')
    .notNull()
    .references(() => l10Meeting.id, { onDelete: 'cascade' }),
  task: text('task').notNull(),
  owner: varchar('owner', { length: 255 }).notNull(), // Seat ID
  dueDate: timestamp('dueDate'),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type L10Todo = InferSelectModel<typeof l10Todo>;

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

// Document History tables for undo/redo functionality
export const documentHistory = pgTable(
  'DocumentHistory',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'set null' }),
    operation: varchar('operation', {
      enum: ['create', 'update', 'delete', 'restore'],
    }).notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    metadata: jsonb('metadata'), // Store additional operation details
  },
  (table) => ({
    documentIdx: index('doc_history_document_idx').on(table.documentId),
    userIdx: index('doc_history_user_idx').on(table.userId),
    timestampIdx: index('doc_history_timestamp_idx').on(table.timestamp),
  }),
);

export type DocumentHistory = InferSelectModel<typeof documentHistory>;

// Document Version table for storing actual content versions
export const documentVersion = pgTable(
  'DocumentVersion',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    historyId: uuid('historyId')
      .notNull()
      .references(() => documentHistory.id, { onDelete: 'cascade' }),
    versionNumber: integer('versionNumber').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('kind', {
      enum: [
        'text',
        'code',
        'image',
        'sheet',
        'chart',
        'vto',
        'accountability',
      ],
    }).notNull(),
    createdAt: timestamp('createdAt').notNull(),
    metadata: jsonb('metadata'), // Store version-specific metadata
  },
  (table) => ({
    documentVersionIdx: uniqueIndex('doc_version_idx').on(
      table.documentId,
      table.versionNumber,
    ),
    historyIdx: index('doc_version_history_idx').on(table.historyId),
  }),
);

export type DocumentVersion = InferSelectModel<typeof documentVersion>;

// Document Edit Session table for grouping related edits
export const documentEditSession = pgTable(
  'DocumentEditSession',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'set null' }),
    startedAt: timestamp('startedAt').notNull().defaultNow(),
    endedAt: timestamp('endedAt'),
    isActive: boolean('isActive').notNull().default(true),
    editCount: integer('editCount').notNull().default(0),
  },
  (table) => ({
    documentUserIdx: index('edit_session_doc_user_idx').on(
      table.documentId,
      table.userId,
    ),
    activeIdx: index('edit_session_active_idx').on(table.isActive),
  }),
);

export type DocumentEditSession = InferSelectModel<typeof documentEditSession>;

// Document Undo Stack for managing undo/redo operations per user per document
export const documentUndoStack = pgTable(
  'DocumentUndoStack',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    currentVersionId: uuid('currentVersionId')
      .notNull()
      .references(() => documentVersion.id),
    undoStack: jsonb('undoStack').notNull().default('[]'), // Array of version IDs
    redoStack: jsonb('redoStack').notNull().default('[]'), // Array of version IDs
    maxStackSize: integer('maxStackSize').notNull().default(50),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    documentUserUniqueIdx: uniqueIndex('undo_stack_doc_user_idx').on(
      table.documentId,
      table.userId,
    ),
  }),
);

export type DocumentUndoStack = InferSelectModel<typeof documentUndoStack>;

// Context Usage Log for tracking effectiveness of RAG system
export const contextUsageLog = pgTable(
  'ContextUsageLog',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    chatId: uuid('chatId').references(() => chat.id, { onDelete: 'cascade' }),
    messageId: uuid('messageId').references(() => message.id, {
      onDelete: 'cascade',
    }),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    queryComplexity: varchar('queryComplexity', { length: 20 }),
    systemChunks: integer('systemChunks').default(0),
    personaChunks: integer('personaChunks').default(0),
    userChunks: integer('userChunks').default(0),
    memoryChunks: integer('memoryChunks').default(0),
    conversationSummaryUsed: boolean('conversationSummaryUsed').default(false),
    totalTokens: integer('totalTokens'),
    contextTokens: integer('contextTokens'),
    responseTokens: integer('responseTokens'),
    model: varchar('model', { length: 50 }),
    userFeedback: varchar('userFeedback', {
      enum: ['helpful', 'not_helpful', 'pending'],
    }).default('pending'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    metadata: jsonb('metadata'), // Additional tracking data
  },
  (table) => ({
    chatIdx: index('context_log_chat_idx').on(table.chatId),
    messageIdx: index('context_log_message_idx').on(table.messageId),
    userIdx: index('context_log_user_idx').on(table.userId),
    feedbackIdx: index('context_log_feedback_idx').on(table.userFeedback),
    complexityIdx: index('context_log_complexity_idx').on(
      table.queryComplexity,
    ),
    createdIdx: index('context_log_created_idx').on(table.createdAt),
  }),
);

export type ContextUsageLog = InferSelectModel<typeof contextUsageLog>;

// Public API Keys table for external API access
export const apiKey = pgTable(
  'ApiKey',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    // The key is stored hashed (SHA-256) for security
    keyHash: varchar('keyHash', { length: 64 }).notNull(),
    // Key prefix for identification (first 8 chars of the original key)
    keyPrefix: varchar('keyPrefix', { length: 12 }).notNull(),
    // User who owns this API key (nullable for org-level keys)
    userId: uuid('userId').references(() => user.id, { onDelete: 'cascade' }),
    // Organization that owns this API key (for org-level keys)
    orgId: uuid('orgId').references(() => org.id, { onDelete: 'cascade' }),
    // Human-readable name for the key
    name: varchar('name', { length: 128 }).notNull(),
    // Description of what this key is used for
    description: text('description'),
    // Whether the key is currently active
    isActive: boolean('isActive').notNull().default(true),
    // Rate limiting - requests per minute
    rateLimitRpm: integer('rateLimitRpm').notNull().default(60),
    // Rate limiting - requests per day
    rateLimitRpd: integer('rateLimitRpd').notNull().default(1000),
    // Usage tracking
    usageCount: integer('usageCount').notNull().default(0),
    usageTokens: integer('usageTokens').notNull().default(0),
    // Timestamps
    lastUsedAt: timestamp('lastUsedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    expiresAt: timestamp('expiresAt'),
    // Allowed models (null = all models)
    allowedModels: jsonb('allowedModels').$type<string[]>(),
    // Scopes/permissions for this key
    scopes: jsonb('scopes')
      .$type<string[]>()
      .notNull()
      .default(sql`'["chat"]'::jsonb`),
    // Metadata for additional configuration
    metadata: jsonb('metadata'),
  },
  (table) => ({
    keyHashIdx: uniqueIndex('api_key_hash_idx').on(table.keyHash),
    keyPrefixIdx: index('api_key_prefix_idx').on(table.keyPrefix),
    userIdx: index('api_key_user_idx').on(table.userId),
    orgIdx: index('api_key_org_idx').on(table.orgId),
    activeIdx: index('api_key_active_idx').on(table.isActive),
    expiresIdx: index('api_key_expires_idx').on(table.expiresAt),
  }),
);

export type ApiKey = InferSelectModel<typeof apiKey>;

// API Key Usage tracking for rate limiting and analytics
export const apiKeyUsage = pgTable(
  'ApiKeyUsage',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    apiKeyId: uuid('apiKeyId')
      .notNull()
      .references(() => apiKey.id, { onDelete: 'cascade' }),
    // Request details
    endpoint: varchar('endpoint', { length: 64 }).notNull(),
    method: varchar('method', { length: 10 }).notNull(),
    // Token usage for this request
    promptTokens: integer('promptTokens').default(0),
    completionTokens: integer('completionTokens').default(0),
    totalTokens: integer('totalTokens').default(0),
    // Response metadata
    statusCode: integer('statusCode'),
    responseTimeMs: integer('responseTimeMs'),
    // Model used
    model: varchar('model', { length: 64 }),
    // Request timestamp
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    // Error message if the request failed
    errorMessage: text('errorMessage'),
  },
  (table) => ({
    apiKeyIdx: index('api_key_usage_key_idx').on(table.apiKeyId),
    createdAtIdx: index('api_key_usage_created_idx').on(table.createdAt),
    endpointIdx: index('api_key_usage_endpoint_idx').on(table.endpoint),
  }),
);

export type ApiKeyUsage = InferSelectModel<typeof apiKeyUsage>;

// API Conversations table for persistent multi-turn conversations via public API
export const apiConversation = pgTable(
  'ApiConversation',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    apiKeyId: uuid('apiKeyId')
      .notNull()
      .references(() => apiKey.id, { onDelete: 'cascade' }),
    title: text('title'),
    model: varchar('model', { length: 64 }).default('eosai-v1'),
    systemPrompt: text('systemPrompt'),
    metadata: jsonb('metadata'),
    messageCount: integer('messageCount').notNull().default(0),
    totalTokens: integer('totalTokens').notNull().default(0),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    apiKeyIdx: index('api_conversation_key_idx').on(table.apiKeyId),
    createdIdx: index('api_conversation_created_idx').on(table.createdAt),
    updatedIdx: index('api_conversation_updated_idx').on(table.updatedAt),
  }),
);

export type ApiConversation = InferSelectModel<typeof apiConversation>;

// API Conversation Messages table for storing messages within API conversations
export const apiConversationMessage = pgTable(
  'ApiConversationMessage',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    conversationId: uuid('conversationId')
      .notNull()
      .references(() => apiConversation.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull(),
    content: text('content').notNull(),
    tokenCount: integer('tokenCount').default(0),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    conversationIdx: index('api_conv_message_conv_idx').on(
      table.conversationId,
    ),
    createdIdx: index('api_conv_message_created_idx').on(table.createdAt),
  }),
);

export type ApiConversationMessage = InferSelectModel<
  typeof apiConversationMessage
>;
