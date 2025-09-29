import { pgTable, foreignKey, uuid, timestamp, text, boolean, varchar, json, uniqueIndex, index, unique, jsonb, integer, vector, primaryKey } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"




export const suggestion = pgTable("Suggestion", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid().notNull(),
	documentCreatedAt: timestamp({ mode: 'string' }).notNull(),
	originalText: text().notNull(),
	suggestedText: text().notNull(),
	description: text(),
	isResolved: boolean().default(false).notNull(),
	userId: uuid().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
},
(table) => {
	return {
		suggestionUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Suggestion_userId_User_id_fk"
		}),
		suggestionDocumentIdDocumentIdFk: foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "Suggestion_documentId_Document_id_fk"
		}),
	}
});

export const message = pgTable("Message", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid().notNull(),
	role: varchar().notNull(),
	content: json().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
},
(table) => {
	return {
		messageChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Message_chatId_Chat_id_fk"
		}),
	}
});

export const bookmarkedChat = pgTable("BookmarkedChat", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	chatId: uuid().notNull(),
	bookmarkedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	note: text(),
},
(table) => {
	return {
		bookmarkedUserChatIdx: uniqueIndex("bookmarked_user_chat_idx").using("btree", table.userId.asc().nullsLast(), table.chatId.asc().nullsLast()),
		bookmarkedUserIdx: index("bookmarked_user_idx").using("btree", table.userId.asc().nullsLast()),
		bookmarkedChatUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "BookmarkedChat_userId_User_id_fk"
		}),
		bookmarkedChatChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "BookmarkedChat_chatId_Chat_id_fk"
		}),
	}
});

export const user = pgTable("User", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 64 }).notNull(),
	password: varchar({ length: 64 }),
	providerId: varchar({ length: 64 }),
	googleCalendarConnected: boolean().default(false),
	lastFeaturesVersion: timestamp({ mode: 'string' }),
});

export const chat = pgTable("Chat", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	userId: uuid().notNull(),
	title: text().notNull(),
	visibility: varchar().default('private').notNull(),
	personaId: uuid(),
	profileId: uuid(),
	metadata: json(),
},
(table) => {
	return {
		chatUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Chat_userId_User_id_fk"
		}),
		chatPersonaIdPersonaIdFk: foreignKey({
			columns: [table.personaId],
			foreignColumns: [persona.id],
			name: "Chat_personaId_Persona_id_fk"
		}),
		chatProfileIdPersonaProfileIdFk: foreignKey({
			columns: [table.profileId],
			foreignColumns: [personaProfile.id],
			name: "Chat_profileId_PersonaProfile_id_fk"
		}),
	}
});

export const stream = pgTable("Stream", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
},
(table) => {
	return {
		streamChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Stream_chatId_Chat_id_fk"
		}),
	}
});

export const messageV2 = pgTable("Message_v2", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid().notNull(),
	role: varchar().notNull(),
	parts: json().notNull(),
	attachments: json().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	provider: varchar(),
},
(table) => {
	return {
		messageV2ChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Message_v2_chatId_Chat_id_fk"
		}),
	}
});

export const googleCalendarToken = pgTable("GoogleCalendarToken", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	token: jsonb().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		googleCalendarTokenUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "GoogleCalendarToken_userId_User_id_fk"
		}).onDelete("cascade"),
		googleCalendarTokenUserIdUnique: unique("GoogleCalendarToken_userId_unique").on(table.userId),
	}
});

export const documentRevision = pgTable("DocumentRevision", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	content: text().notNull(),
	title: text(),
	kind: varchar({ length: 32 }).notNull(),
	userId: uuid().notNull(),
},
(table) => {
	return {
		documentRevisionDocIdx: index("document_revision_doc_idx").using("btree", table.documentId.asc().nullsLast()),
		documentRevisionDocTimeIdx: index("document_revision_doc_time_idx").using("btree", table.documentId.asc().nullsLast(), table.createdAt.asc().nullsLast()),
		documentRevisionDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "DocumentRevision_documentId_fkey"
		}).onDelete("cascade"),
		documentRevisionUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "DocumentRevision_userId_fkey"
		}).onDelete("cascade"),
	}
});

export const personaComposerDocument = pgTable("PersonaComposerDocument", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	personaId: uuid().notNull(),
	documentId: uuid().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		personaComposerDocUnique: uniqueIndex("persona_composer_doc_unique").using("btree", table.personaId.asc().nullsLast(), table.documentId.asc().nullsLast()),
		personaComposerDocumentPersonaIdFkey: foreignKey({
			columns: [table.personaId],
			foreignColumns: [persona.id],
			name: "PersonaComposerDocument_personaId_fkey"
		}).onDelete("cascade"),
		personaComposerDocumentDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "PersonaComposerDocument_documentId_fkey"
		}).onDelete("cascade"),
	}
});

export const l10RecordingContext = pgTable("L10RecordingContext", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	recordingId: uuid().notNull(),
	meetingId: uuid().notNull(),
	agendaItemId: uuid(),
	issueId: uuid(),
	contextType: varchar().notNull(),
},
(table) => {
	return {
		l10RecordingContextRecordingIdVoiceRecordingIdFk: foreignKey({
			columns: [table.recordingId],
			foreignColumns: [voiceRecording.id],
			name: "L10RecordingContext_recordingId_VoiceRecording_id_fk"
		}).onDelete("cascade"),
	}
});

export const userSettings = pgTable("UserSettings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	notificationsEnabled: boolean().default(true),
	language: varchar({ length: 32 }).default('english'),
	fontSize: varchar({ length: 16 }).default('medium'),
	displayName: varchar({ length: 64 }),
	companyName: varchar({ length: 128 }),
	companyType: varchar({ length: 64 }),
	companyDescription: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	profilePicture: text(),
	dailyMessageCount: integer().default(0),
	lastMessageCountReset: timestamp({ mode: 'string' }).defaultNow(),
	selectedChatModel: text().default('gpt-4o-mini'),
	selectedProvider: text().default('openai'),
	selectedVisibilityType: text().default('private'),
	selectedPersonaId: uuid(),
	selectedProfileId: uuid(),
	selectedResearchMode: text().default('off'),
	primaryAccountabilityId: uuid(),
	primaryVtoId: uuid(),
	primaryScorecardId: uuid(),
	currentBundleId: uuid(),
	contextDocumentIds: jsonb(),
	usePrimaryDocsForContext: boolean().default(true),
	usePrimaryDocsForPersona: boolean().default(true),
	personaContextDocumentIds: jsonb(),
	contextComposerDocumentIds: jsonb(),
	contextRecordingIds: jsonb(),
	autocompleteEnabled: boolean().default(true),
	companyIndustry: text(),
	companySize: text(),
	companyWebsite: text(),
	companyCountry: text(),
	companyState: text(),
},
(table) => {
	return {
		userSettingsUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "UserSettings_userId_User_id_fk"
		}).onDelete("cascade"),
	}
});

export const personaDocument = pgTable("PersonaDocument", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	personaId: uuid().notNull(),
	documentId: uuid().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		personaDocumentPersonaIdPersonaIdFk: foreignKey({
			columns: [table.personaId],
			foreignColumns: [persona.id],
			name: "PersonaDocument_personaId_Persona_id_fk"
		}).onDelete("cascade"),
		personaDocumentDocumentIdUserDocumentsIdFk: foreignKey({
			columns: [table.documentId],
			foreignColumns: [userDocuments.id],
			name: "PersonaDocument_documentId_UserDocuments_id_fk"
		}).onDelete("cascade"),
		personaDocumentPersonaIdDocumentIdUnique: unique("PersonaDocument_personaId_documentId_unique").on(table.personaId, table.documentId),
	}
});

export const persona = pgTable("Persona", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid(),
	name: varchar({ length: 128 }).notNull(),
	description: text(),
	instructions: text().notNull(),
	isDefault: boolean().default(false),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	iconUrl: text(),
	isSystemPersona: boolean().default(false),
	knowledgeNamespace: varchar({ length: 128 }),
},
(table) => {
	return {
		personaUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Persona_userId_User_id_fk"
		}).onDelete("cascade"),
	}
});

export const pinnedMessage = pgTable("PinnedMessage", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	messageId: uuid().notNull(),
	chatId: uuid().notNull(),
	pinnedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		pinnedChatIdx: index("pinned_chat_idx").using("btree", table.chatId.asc().nullsLast()),
		pinnedUserMessageIdx: index("pinned_user_message_idx").using("btree", table.userId.asc().nullsLast(), table.messageId.asc().nullsLast()),
		pinnedMessageUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "PinnedMessage_userId_User_id_fk"
		}),
		pinnedMessageMessageIdMessageV2IdFk: foreignKey({
			columns: [table.messageId],
			foreignColumns: [messageV2.id],
			name: "PinnedMessage_messageId_Message_v2_id_fk"
		}),
		pinnedMessageChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "PinnedMessage_chatId_Chat_id_fk"
		}),
	}
});

export const document = pgTable("Document", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	title: text().notNull(),
	content: text(),
	kind: varchar().default('text').notNull(),
	userId: uuid().notNull(),
	currentVersion: integer().default(1).notNull(),
	lastEditSequence: integer().default(0).notNull(),
},
(table) => {
	return {
		documentUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Document_userId_User_id_fk"
		}),
	}
});

export const embeddings = pgTable("Embeddings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid().notNull(),
	chunk: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	embedding: vector({ dimensions: 1536 }).notNull(),
},
(table) => {
	return {
		embeddingIdx: index("embedding_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
		embeddingsDocumentIdDocumentIdFk: foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "Embeddings_documentId_Document_id_fk"
		}).onDelete("cascade"),
	}
});

export const userDocuments = pgTable("UserDocuments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	fileName: varchar({ length: 255 }).notNull(),
	fileUrl: text().notNull(),
	fileSize: integer().notNull(),
	fileType: varchar({ length: 255 }).notNull(),
	category: varchar().notNull(),
	content: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		userDocumentsUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "UserDocuments_userId_User_id_fk"
		}).onDelete("cascade"),
	}
});

export const profileDocument = pgTable("ProfileDocument", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid().notNull(),
	documentId: uuid().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		profileDocumentProfileIdPersonaProfileIdFk: foreignKey({
			columns: [table.profileId],
			foreignColumns: [personaProfile.id],
			name: "ProfileDocument_profileId_PersonaProfile_id_fk"
		}).onDelete("cascade"),
		profileDocumentDocumentIdUserDocumentsIdFk: foreignKey({
			columns: [table.documentId],
			foreignColumns: [userDocuments.id],
			name: "ProfileDocument_documentId_UserDocuments_id_fk"
		}).onDelete("cascade"),
		profileDocumentProfileIdDocumentIdUnique: unique("ProfileDocument_profileId_documentId_unique").on(table.profileId, table.documentId),
	}
});

export const personaProfile = pgTable("PersonaProfile", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	personaId: uuid().notNull(),
	name: varchar({ length: 128 }).notNull(),
	description: text(),
	instructions: text().notNull(),
	isDefault: boolean().default(false),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	knowledgeNamespace: varchar({ length: 128 }),
},
(table) => {
	return {
		personaProfilePersonaIdPersonaIdFk: foreignKey({
			columns: [table.personaId],
			foreignColumns: [persona.id],
			name: "PersonaProfile_personaId_Persona_id_fk"
		}).onDelete("cascade"),
	}
});

export const bundleDocument = pgTable("BundleDocument", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	bundleId: uuid().notNull(),
	documentId: uuid().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		bundleUserDocUnique: uniqueIndex("bundle_user_doc_unique").using("btree", table.userId.asc().nullsLast(), table.bundleId.asc().nullsLast(), table.documentId.asc().nullsLast()),
		bundleDocumentUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "BundleDocument_userId_User_id_fk"
		}).onDelete("cascade"),
		bundleDocumentDocumentIdDocumentIdFk: foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "BundleDocument_documentId_Document_id_fk"
		}).onDelete("cascade"),
	}
});

export const systemEmbeddings = pgTable("SystemEmbeddings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	namespace: varchar({ length: 128 }).notNull(),
	title: text().notNull(),
	chunk: text().notNull(),
	embedding: vector({ dimensions: 1536 }).notNull(),
	metadata: json(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		namespaceIdx: index("namespace_idx").using("btree", table.namespace.asc().nullsLast()),
		systemEmbeddingIdx: index("system_embedding_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	}
});

export const voiceTranscript = pgTable("VoiceTranscript", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	recordingId: uuid().notNull(),
	fullTranscript: text().notNull(),
	segments: json().notNull(),
	speakerCount: integer().default(1).notNull(),
	summary: text(),
	keywords: json(),
	analyzedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	content: text(),
},
(table) => {
	return {
		voiceTranscriptRecordingIdVoiceRecordingIdFk: foreignKey({
			columns: [table.recordingId],
			foreignColumns: [voiceRecording.id],
			name: "VoiceTranscript_recordingId_VoiceRecording_id_fk"
		}).onDelete("cascade"),
	}
});

export const messageEditHistory = pgTable("MessageEditHistory", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	messageId: uuid().notNull(),
	previousContent: json().notNull(),
	newContent: json().notNull(),
	editedBy: uuid().notNull(),
	editedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	editReason: text(),
},
(table) => {
	return {
		editHistoryMessageIdx: index("edit_history_message_idx").using("btree", table.messageId.asc().nullsLast()),
		editHistoryTimeIdx: index("edit_history_time_idx").using("btree", table.editedAt.asc().nullsLast()),
		editHistoryUserIdx: index("edit_history_user_idx").using("btree", table.editedBy.asc().nullsLast()),
		messageEditHistoryMessageIdMessageV2IdFk: foreignKey({
			columns: [table.messageId],
			foreignColumns: [messageV2.id],
			name: "MessageEditHistory_messageId_Message_v2_id_fk"
		}).onDelete("cascade"),
		messageEditHistoryEditedByUserIdFk: foreignKey({
			columns: [table.editedBy],
			foreignColumns: [user.id],
			name: "MessageEditHistory_editedBy_User_id_fk"
		}),
	}
});

export const nexusResearchSession = pgTable("NexusResearchSession", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	chatId: uuid(),
	query: text().notNull(),
	status: varchar().default('planning').notNull(),
	researchPlan: jsonb(),
	searchQueries: jsonb().notNull(),
	totalSources: integer().default(0),
	completedSearches: integer().default(0),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp({ mode: 'string' }),
	metadata: jsonb(),
},
(table) => {
	return {
		nexusResearchSessionUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "NexusResearchSession_userId_User_id_fk"
		}).onDelete("cascade"),
		nexusResearchSessionChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "NexusResearchSession_chatId_Chat_id_fk"
		}).onDelete("cascade"),
	}
});

export const nexusResearchEmbedding = pgTable("NexusResearchEmbedding", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid().notNull(),
	resultId: uuid(),
	chunk: text().notNull(),
	embedding: vector({ dimensions: 1536 }).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		researchEmbeddingIdx: index("research_embedding_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
		researchSessionEmbeddingIdx: index("research_session_embedding_idx").using("btree", table.sessionId.asc().nullsLast()),
		nexusResearchEmbeddingSessionIdNexusResearchSessionIdFk: foreignKey({
			columns: [table.sessionId],
			foreignColumns: [nexusResearchSession.id],
			name: "NexusResearchEmbedding_sessionId_NexusResearchSession_id_fk"
		}).onDelete("cascade"),
		nexusResearchEmbeddingResultIdNexusResearchResultIdFk: foreignKey({
			columns: [table.resultId],
			foreignColumns: [nexusResearchResult.id],
			name: "NexusResearchEmbedding_resultId_NexusResearchResult_id_fk"
		}).onDelete("cascade"),
	}
});

export const nexusResearchResult = pgTable("NexusResearchResult", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid().notNull(),
	searchQuery: text().notNull(),
	url: text().notNull(),
	title: text().notNull(),
	snippet: text(),
	content: text(),
	relevanceScore: integer(),
	sourceType: varchar().default('web'),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	metadata: jsonb(),
},
(table) => {
	return {
		researchResultSessionIdx: index("research_result_session_idx").using("btree", table.sessionId.asc().nullsLast()),
		researchResultUrlIdx: index("research_result_url_idx").using("btree", table.url.asc().nullsLast()),
		nexusResearchResultSessionIdNexusResearchSessionIdFk: foreignKey({
			columns: [table.sessionId],
			foreignColumns: [nexusResearchSession.id],
			name: "NexusResearchResult_sessionId_NexusResearchSession_id_fk"
		}).onDelete("cascade"),
	}
});

export const nexusResearchReport = pgTable("NexusResearchReport", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid().notNull(),
	reportType: varchar().default('detailed').notNull(),
	content: text().notNull(),
	sections: jsonb(),
	citations: jsonb(),
	visualizations: jsonb(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp({ mode: 'string' }),
},
(table) => {
	return {
		researchSessionReportIdx: uniqueIndex("research_session_report_idx").using("btree", table.sessionId.asc().nullsLast(), table.reportType.asc().nullsLast()),
		nexusResearchReportSessionIdNexusResearchSessionIdFk: foreignKey({
			columns: [table.sessionId],
			foreignColumns: [nexusResearchSession.id],
			name: "NexusResearchReport_sessionId_NexusResearchSession_id_fk"
		}).onDelete("cascade"),
	}
});

export const voiceRecording = pgTable("VoiceRecording", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	title: varchar({ length: 255 }).notNull(),
	audioUrl: text().notNull(),
	duration: integer(),
	fileSize: integer(),
	mimeType: varchar({ length: 64 }).default('audio/webm'),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		voiceRecordingUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "VoiceRecording_userId_User_id_fk"
		}).onDelete("cascade"),
	}
});

export const feedback = pgTable("Feedback", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid().notNull(),
	messageId: uuid().notNull(),
	userId: uuid().notNull(),
	isPositive: boolean().notNull(),
	category: varchar(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		feedbackChatIdx: index("feedback_chat_idx").using("btree", table.chatId.asc().nullsLast()),
		feedbackUserMessageIdx: index("feedback_user_message_idx").using("btree", table.userId.asc().nullsLast(), table.messageId.asc().nullsLast()),
		feedbackChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Feedback_chatId_Chat_id_fk"
		}),
		feedbackMessageIdMessageV2IdFk: foreignKey({
			columns: [table.messageId],
			foreignColumns: [messageV2.id],
			name: "Feedback_messageId_Message_v2_id_fk"
		}),
		feedbackUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Feedback_userId_User_id_fk"
		}),
	}
});

export const l10Meeting = pgTable("L10Meeting", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	composerId: varchar({ length: 255 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	status: varchar().default('active').notNull(),
	attendees: json().notNull(),
	rating: integer(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		l10MeetingComposerIdx: index("l10_meeting_composer_idx").using("btree", table.composerId.asc().nullsLast()),
		l10MeetingStatusIdx: index("l10_meeting_status_idx").using("btree", table.status.asc().nullsLast()),
		l10MeetingUserIdx: index("l10_meeting_user_idx").using("btree", table.userId.asc().nullsLast()),
		l10MeetingUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "L10Meeting_userId_fkey"
		}).onDelete("cascade"),
	}
});

export const l10AgendaItem = pgTable("L10AgendaItem", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	meetingId: uuid().notNull(),
	type: varchar().notNull(),
	title: varchar({ length: 255 }).notNull(),
	duration: integer().notNull(),
	actualDuration: integer(),
	completed: boolean().default(false).notNull(),
	notes: text(),
	recordingId: uuid(),
	startTime: timestamp({ mode: 'string' }),
	endTime: timestamp({ mode: 'string' }),
	orderIndex: integer().notNull(),
},
(table) => {
	return {
		l10AgendaMeetingIdx: index("l10_agenda_meeting_idx").using("btree", table.meetingId.asc().nullsLast()),
		l10AgendaItemMeetingIdFkey: foreignKey({
			columns: [table.meetingId],
			foreignColumns: [l10Meeting.id],
			name: "L10AgendaItem_meetingId_fkey"
		}).onDelete("cascade"),
		l10AgendaItemRecordingIdFkey: foreignKey({
			columns: [table.recordingId],
			foreignColumns: [voiceRecording.id],
			name: "L10AgendaItem_recordingId_fkey"
		}),
	}
});

export const userDocument = pgTable("UserDocument", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	title: text().notNull(),
	content: text().notNull(),
	fileType: varchar({ length: 64 }).notNull(),
	fileSize: varchar({ length: 32 }).notNull(),
	status: varchar().default('processing').notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		userDocumentUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "UserDocument_userId_User_id_fk"
		}).onDelete("cascade"),
	}
});

export const userDocumentEmbedding = pgTable("UserDocumentEmbedding", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userDocumentId: uuid().notNull(),
	userId: uuid().notNull(),
	chunk: text().notNull(),
	embedding: vector({ dimensions: 1536 }).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		userDocUserIdIdx: index("user_doc_user_id_idx").using("btree", table.userId.asc().nullsLast()),
		userEmbeddingIdx: index("user_embedding_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
		userDocumentEmbeddingUserDocumentIdUserDocumentIdFk: foreignKey({
			columns: [table.userDocumentId],
			foreignColumns: [userDocument.id],
			name: "UserDocumentEmbedding_userDocumentId_UserDocument_id_fk"
		}).onDelete("cascade"),
		userDocumentEmbeddingUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "UserDocumentEmbedding_userId_User_id_fk"
		}).onDelete("cascade"),
	}
});

export const l10Issue = pgTable("L10Issue", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	meetingId: uuid().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	priority: varchar().default('medium').notNull(),
	status: varchar().default('identified').notNull(),
	owner: varchar({ length: 255 }),
	recordingId: uuid(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp({ mode: 'string' }),
},
(table) => {
	return {
		l10IssueMeetingIdx: index("l10_issue_meeting_idx").using("btree", table.meetingId.asc().nullsLast()),
		l10IssueMeetingIdFkey: foreignKey({
			columns: [table.meetingId],
			foreignColumns: [l10Meeting.id],
			name: "L10Issue_meetingId_fkey"
		}).onDelete("cascade"),
		l10IssueRecordingIdFkey: foreignKey({
			columns: [table.recordingId],
			foreignColumns: [voiceRecording.id],
			name: "L10Issue_recordingId_fkey"
		}),
	}
});

export const l10Todo = pgTable("L10Todo", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	meetingId: uuid().notNull(),
	task: text().notNull(),
	owner: varchar({ length: 255 }),
	dueDate: timestamp({ mode: 'string' }),
	completed: boolean().default(false).notNull(),
	completedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		l10TodoMeetingIdx: index("l10_todo_meeting_idx").using("btree", table.meetingId.asc().nullsLast()),
		l10TodoMeetingIdFkey: foreignKey({
			columns: [table.meetingId],
			foreignColumns: [l10Meeting.id],
			name: "L10Todo_meetingId_fkey"
		}).onDelete("cascade"),
	}
});

export const documentVersion = pgTable("DocumentVersion", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid().notNull(),
	version: integer().notNull(),
	title: text().notNull(),
	content: text(),
	kind: varchar({ length: 32 }).default('text').notNull(),
	metadata: json(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid().notNull(),
},
(table) => {
	return {
		documentVersionCreatedIdx: index("document_version_created_idx").using("btree", table.createdAt.asc().nullsLast()),
		documentVersionDocumentIdx: index("document_version_document_idx").using("btree", table.documentId.asc().nullsLast()),
		documentVersionUnique: uniqueIndex("document_version_unique").using("btree", table.documentId.asc().nullsLast(), table.version.asc().nullsLast()),
		documentVersionUserIdx: index("document_version_user_idx").using("btree", table.createdBy.asc().nullsLast()),
		documentVersionDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "DocumentVersion_documentId_fkey"
		}).onDelete("cascade"),
		documentVersionCreatedByFkey: foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "DocumentVersion_createdBy_fkey"
		}),
	}
});

export const documentEditOperation = pgTable("DocumentEditOperation", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid().notNull(),
	userId: uuid().notNull(),
	sequenceNumber: integer().notNull(),
	operationType: varchar({ length: 32 }).notNull(),
	position: integer().notNull(),
	length: integer(),
	content: text(),
	previousContent: text(),
	metadata: json(),
	timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
	isUndone: boolean().default(false).notNull(),
},
(table) => {
	return {
		documentEditDocumentIdx: index("document_edit_document_idx").using("btree", table.documentId.asc().nullsLast()),
		documentEditSequenceIdx: index("document_edit_sequence_idx").using("btree", table.documentId.asc().nullsLast(), table.sequenceNumber.asc().nullsLast()),
		documentEditSequenceUnique: uniqueIndex("document_edit_sequence_unique").using("btree", table.documentId.asc().nullsLast(), table.sequenceNumber.asc().nullsLast()),
		documentEditTimestampIdx: index("document_edit_timestamp_idx").using("btree", table.timestamp.asc().nullsLast()),
		documentEditUserIdx: index("document_edit_user_idx").using("btree", table.userId.asc().nullsLast()),
		documentEditOperationDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "DocumentEditOperation_documentId_fkey"
		}).onDelete("cascade"),
		documentEditOperationUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "DocumentEditOperation_userId_fkey"
		}),
	}
});

export const documentHistoryPointer = pgTable("DocumentHistoryPointer", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid().notNull(),
	userId: uuid().notNull(),
	currentVersion: integer().default(1).notNull(),
	currentSequenceNumber: integer().default(0).notNull(),
	lastModified: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		documentHistoryPointerUnique: uniqueIndex("document_history_pointer_unique").using("btree", table.documentId.asc().nullsLast(), table.userId.asc().nullsLast()),
		documentHistoryPointerDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "DocumentHistoryPointer_documentId_fkey"
		}).onDelete("cascade"),
		documentHistoryPointerUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "DocumentHistoryPointer_userId_fkey"
		}),
	}
});

export const userMemoryEmbedding = pgTable("UserMemoryEmbedding", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	memoryId: uuid().notNull(),
	chunk: text().notNull(),
	embedding: vector({ dimensions: 1536 }).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		userMemoryEmbeddingIdx: index("user_memory_embedding_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
		userMemoryIdIdx: index("user_memory_id_idx").using("btree", table.memoryId.asc().nullsLast()),
		userMemoryEmbeddingMemoryIdFkey: foreignKey({
			columns: [table.memoryId],
			foreignColumns: [userMemory.id],
			name: "UserMemoryEmbedding_memoryId_fkey"
		}).onDelete("cascade"),
	}
});

export const documentHistory = pgTable("DocumentHistory", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid().notNull(),
	userId: uuid().notNull(),
	operation: varchar().notNull(),
	timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
	metadata: jsonb(),
},
(table) => {
	return {
		docHistoryDocumentIdx: index("doc_history_document_idx").using("btree", table.documentId.asc().nullsLast()),
		docHistoryTimestampIdx: index("doc_history_timestamp_idx").using("btree", table.timestamp.asc().nullsLast()),
		docHistoryUserIdx: index("doc_history_user_idx").using("btree", table.userId.asc().nullsLast()),
		documentHistoryDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "DocumentHistory_documentId_fkey"
		}).onDelete("cascade"),
		documentHistoryUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "DocumentHistory_userId_fkey"
		}),
	}
});

export const documentEditSession = pgTable("DocumentEditSession", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid().notNull(),
	userId: uuid().notNull(),
	startedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	endedAt: timestamp({ mode: 'string' }),
	isActive: boolean().default(true).notNull(),
	editCount: integer().default(0).notNull(),
},
(table) => {
	return {
		editSessionActiveIdx: index("edit_session_active_idx").using("btree", table.isActive.asc().nullsLast()),
		editSessionDocUserIdx: index("edit_session_doc_user_idx").using("btree", table.documentId.asc().nullsLast(), table.userId.asc().nullsLast()),
		documentEditSessionDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "DocumentEditSession_documentId_fkey"
		}).onDelete("cascade"),
		documentEditSessionUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "DocumentEditSession_userId_fkey"
		}),
	}
});

export const userMemory = pgTable("UserMemory", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	sourceMessageId: uuid(),
	summary: text().notNull(),
	content: text(),
	topic: varchar({ length: 128 }),
	memoryType: varchar().default('other').notNull(),
	confidence: integer().default(60).notNull(),
	status: varchar().default('active').notNull(),
	tags: jsonb(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp({ mode: 'string' }),
},
(table) => {
	return {
		userMemoryUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "UserMemory_userId_fkey"
		}).onDelete("cascade"),
		userMemorySourceMessageIdFkey: foreignKey({
			columns: [table.sourceMessageId],
			foreignColumns: [messageV2.id],
			name: "UserMemory_sourceMessageId_fkey"
		}).onDelete("set null"),
	}
});

export const documentUndoStack = pgTable("DocumentUndoStack", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid().notNull(),
	userId: uuid().notNull(),
	currentVersionId: uuid().notNull(),
	undoStack: jsonb().default([]).notNull(),
	redoStack: jsonb().default([]).notNull(),
	maxStackSize: integer().default(50).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		undoStackDocUserIdx: uniqueIndex("undo_stack_doc_user_idx").using("btree", table.documentId.asc().nullsLast(), table.userId.asc().nullsLast()),
		documentUndoStackDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "DocumentUndoStack_documentId_fkey"
		}).onDelete("cascade"),
		documentUndoStackUserIdFkey: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "DocumentUndoStack_userId_fkey"
		}),
		documentUndoStackCurrentVersionIdFkey: foreignKey({
			columns: [table.currentVersionId],
			foreignColumns: [documentVersion.id],
			name: "DocumentUndoStack_currentVersionId_fkey"
		}),
	}
});

export const vote = pgTable("Vote", {
	chatId: uuid().notNull(),
	messageId: uuid().notNull(),
	isUpvoted: boolean().notNull(),
},
(table) => {
	return {
		voteChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Vote_chatId_Chat_id_fk"
		}),
		voteMessageIdMessageIdFk: foreignKey({
			columns: [table.messageId],
			foreignColumns: [message.id],
			name: "Vote_messageId_Message_id_fk"
		}),
		voteChatIdMessageIdPk: primaryKey({ columns: [table.chatId, table.messageId], name: "Vote_chatId_messageId_pk"}),
	}
});

export const voteV2 = pgTable("Vote_v2", {
	chatId: uuid().notNull(),
	messageId: uuid().notNull(),
	isUpvoted: boolean().notNull(),
},
(table) => {
	return {
		voteV2ChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Vote_v2_chatId_Chat_id_fk"
		}),
		voteV2MessageIdMessageV2IdFk: foreignKey({
			columns: [table.messageId],
			foreignColumns: [messageV2.id],
			name: "Vote_v2_messageId_Message_v2_id_fk"
		}),
		voteV2ChatIdMessageIdPk: primaryKey({ columns: [table.chatId, table.messageId], name: "Vote_v2_chatId_messageId_pk"}),
	}
});