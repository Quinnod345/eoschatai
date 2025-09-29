import { relations } from 'drizzle-orm/relations';
import {
  suggestion,
  document,
  chat,
  message,
  bookmarkedChat,
  persona,
  personaProfile,
  stream,
  messageV2,
  googleCalendarToken,
  documentRevision,
  personaComposerDocument,
  voiceRecording,
  l10RecordingContext,
  userSettings,
  personaDocument,
  userDocuments,
  pinnedMessage,
  embeddings,
  profileDocument,
  bundleDocument,
  voiceTranscript,
  messageEditHistory,
  nexusResearchSession,
  nexusResearchEmbedding,
  nexusResearchResult,
  nexusResearchReport,
  feedback,
  l10Meeting,
  l10AgendaItem,
  userDocument,
  userDocumentEmbedding,
  l10Issue,
  l10Todo,
  documentVersion,
  documentEditOperation,
  documentHistoryPointer,
  userMemory,
  userMemoryEmbedding,
  documentHistory,
  documentEditSession,
  documentUndoStack,
  vote,
  voteV2,
} from './schema';
import { org, user } from '../lib/db/schema';

export const suggestionRelations = relations(suggestion, ({ one }) => ({
  user: one(user, {
    fields: [suggestion.userId],
    references: [user.id],
  }),
  document: one(document, {
    fields: [suggestion.documentId],
    references: [document.id],
  }),
}));

export const orgRelations = relations(org, ({ one, many }) => ({
  owner: one(user, {
    fields: [org.ownerId],
    references: [user.id],
  }),
  members: many(user),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  suggestions: many(suggestion),
  bookmarkedChats: many(bookmarkedChat),
  chats: many(chat),
  googleCalendarTokens: many(googleCalendarToken),
  documentRevisions: many(documentRevision),
  userSettings: many(userSettings),
  personas: many(persona),
  pinnedMessages: many(pinnedMessage),
  documents: many(document),
  userDocuments_userId: many(userDocuments),
  bundleDocuments: many(bundleDocument),
  messageEditHistories: many(messageEditHistory),
  nexusResearchSessions: many(nexusResearchSession),
  voiceRecordings: many(voiceRecording),
  feedbacks: many(feedback),
  l10Meetings: many(l10Meeting),
  userDocuments: many(userDocument),
  userDocumentEmbeddings: many(userDocumentEmbedding),
  documentVersions: many(documentVersion),
  documentEditOperations: many(documentEditOperation),
  documentHistoryPointers: many(documentHistoryPointer),
  documentHistories: many(documentHistory),
  documentEditSessions: many(documentEditSession),
  userMemories: many(userMemory),
  documentUndoStacks: many(documentUndoStack),
  org: one(org, {
    fields: [user.orgId],
    references: [org.id],
  }),
}));

export const documentRelations = relations(document, ({ one, many }) => ({
  suggestions: many(suggestion),
  documentRevisions: many(documentRevision),
  personaComposerDocuments: many(personaComposerDocument),
  user: one(user, {
    fields: [document.userId],
    references: [user.id],
  }),
  embeddings: many(embeddings),
  bundleDocuments: many(bundleDocument),
  documentVersions: many(documentVersion),
  documentEditOperations: many(documentEditOperation),
  documentHistoryPointers: many(documentHistoryPointer),
  documentHistories: many(documentHistory),
  documentEditSessions: many(documentEditSession),
  documentUndoStacks: many(documentUndoStack),
}));

export const messageRelations = relations(message, ({ one, many }) => ({
  chat: one(chat, {
    fields: [message.chatId],
    references: [chat.id],
  }),
  votes: many(vote),
}));

export const chatRelations = relations(chat, ({ one, many }) => ({
  messages: many(message),
  bookmarkedChats: many(bookmarkedChat),
  user: one(user, {
    fields: [chat.userId],
    references: [user.id],
  }),
  persona: one(persona, {
    fields: [chat.personaId],
    references: [persona.id],
  }),
  personaProfile: one(personaProfile, {
    fields: [chat.profileId],
    references: [personaProfile.id],
  }),
  streams: many(stream),
  messageV2s: many(messageV2),
  pinnedMessages: many(pinnedMessage),
  nexusResearchSessions: many(nexusResearchSession),
  feedbacks: many(feedback),
  votes: many(vote),
  voteV2s: many(voteV2),
}));

export const bookmarkedChatRelations = relations(bookmarkedChat, ({ one }) => ({
  user: one(user, {
    fields: [bookmarkedChat.userId],
    references: [user.id],
  }),
  chat: one(chat, {
    fields: [bookmarkedChat.chatId],
    references: [chat.id],
  }),
}));

export const personaRelations = relations(persona, ({ one, many }) => ({
  chats: many(chat),
  personaComposerDocuments: many(personaComposerDocument),
  personaDocuments: many(personaDocument),
  user: one(user, {
    fields: [persona.userId],
    references: [user.id],
  }),
  personaProfiles: many(personaProfile),
}));

export const personaProfileRelations = relations(
  personaProfile,
  ({ one, many }) => ({
    chats: many(chat),
    profileDocuments: many(profileDocument),
    persona: one(persona, {
      fields: [personaProfile.personaId],
      references: [persona.id],
    }),
  }),
);

export const streamRelations = relations(stream, ({ one }) => ({
  chat: one(chat, {
    fields: [stream.chatId],
    references: [chat.id],
  }),
}));

export const messageV2Relations = relations(messageV2, ({ one, many }) => ({
  chat: one(chat, {
    fields: [messageV2.chatId],
    references: [chat.id],
  }),
  pinnedMessages: many(pinnedMessage),
  messageEditHistories: many(messageEditHistory),
  feedbacks: many(feedback),
  userMemories: many(userMemory),
  voteV2s: many(voteV2),
}));

export const googleCalendarTokenRelations = relations(
  googleCalendarToken,
  ({ one }) => ({
    user: one(user, {
      fields: [googleCalendarToken.userId],
      references: [user.id],
    }),
  }),
);

export const documentRevisionRelations = relations(
  documentRevision,
  ({ one }) => ({
    document: one(document, {
      fields: [documentRevision.documentId],
      references: [document.id],
    }),
    user: one(user, {
      fields: [documentRevision.userId],
      references: [user.id],
    }),
  }),
);

export const personaComposerDocumentRelations = relations(
  personaComposerDocument,
  ({ one }) => ({
    persona: one(persona, {
      fields: [personaComposerDocument.personaId],
      references: [persona.id],
    }),
    document: one(document, {
      fields: [personaComposerDocument.documentId],
      references: [document.id],
    }),
  }),
);

export const l10RecordingContextRelations = relations(
  l10RecordingContext,
  ({ one }) => ({
    voiceRecording: one(voiceRecording, {
      fields: [l10RecordingContext.recordingId],
      references: [voiceRecording.id],
    }),
  }),
);

export const voiceRecordingRelations = relations(
  voiceRecording,
  ({ one, many }) => ({
    l10RecordingContexts: many(l10RecordingContext),
    voiceTranscripts: many(voiceTranscript),
    user: one(user, {
      fields: [voiceRecording.userId],
      references: [user.id],
    }),
    l10AgendaItems: many(l10AgendaItem),
    l10Issues: many(l10Issue),
  }),
);

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, {
    fields: [userSettings.userId],
    references: [user.id],
  }),
}));

export const personaDocumentRelations = relations(
  personaDocument,
  ({ one }) => ({
    persona: one(persona, {
      fields: [personaDocument.personaId],
      references: [persona.id],
    }),
    userDocument: one(userDocuments, {
      fields: [personaDocument.documentId],
      references: [userDocuments.id],
    }),
  }),
);

export const userDocumentsRelations = relations(
  userDocuments,
  ({ one, many }) => ({
    personaDocuments: many(personaDocument),
    user: one(user, {
      fields: [userDocuments.userId],
      references: [user.id],
    }),
    profileDocuments: many(profileDocument),
  }),
);

export const pinnedMessageRelations = relations(pinnedMessage, ({ one }) => ({
  user: one(user, {
    fields: [pinnedMessage.userId],
    references: [user.id],
  }),
  messageV2: one(messageV2, {
    fields: [pinnedMessage.messageId],
    references: [messageV2.id],
  }),
  chat: one(chat, {
    fields: [pinnedMessage.chatId],
    references: [chat.id],
  }),
}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  document: one(document, {
    fields: [embeddings.documentId],
    references: [document.id],
  }),
}));

export const profileDocumentRelations = relations(
  profileDocument,
  ({ one }) => ({
    personaProfile: one(personaProfile, {
      fields: [profileDocument.profileId],
      references: [personaProfile.id],
    }),
    userDocument: one(userDocuments, {
      fields: [profileDocument.documentId],
      references: [userDocuments.id],
    }),
  }),
);

export const bundleDocumentRelations = relations(bundleDocument, ({ one }) => ({
  user: one(user, {
    fields: [bundleDocument.userId],
    references: [user.id],
  }),
  document: one(document, {
    fields: [bundleDocument.documentId],
    references: [document.id],
  }),
}));

export const voiceTranscriptRelations = relations(
  voiceTranscript,
  ({ one }) => ({
    voiceRecording: one(voiceRecording, {
      fields: [voiceTranscript.recordingId],
      references: [voiceRecording.id],
    }),
  }),
);

export const messageEditHistoryRelations = relations(
  messageEditHistory,
  ({ one }) => ({
    messageV2: one(messageV2, {
      fields: [messageEditHistory.messageId],
      references: [messageV2.id],
    }),
    user: one(user, {
      fields: [messageEditHistory.editedBy],
      references: [user.id],
    }),
  }),
);

export const nexusResearchSessionRelations = relations(
  nexusResearchSession,
  ({ one, many }) => ({
    user: one(user, {
      fields: [nexusResearchSession.userId],
      references: [user.id],
    }),
    chat: one(chat, {
      fields: [nexusResearchSession.chatId],
      references: [chat.id],
    }),
    nexusResearchEmbeddings: many(nexusResearchEmbedding),
    nexusResearchResults: many(nexusResearchResult),
    nexusResearchReports: many(nexusResearchReport),
  }),
);

export const nexusResearchEmbeddingRelations = relations(
  nexusResearchEmbedding,
  ({ one }) => ({
    nexusResearchSession: one(nexusResearchSession, {
      fields: [nexusResearchEmbedding.sessionId],
      references: [nexusResearchSession.id],
    }),
    nexusResearchResult: one(nexusResearchResult, {
      fields: [nexusResearchEmbedding.resultId],
      references: [nexusResearchResult.id],
    }),
  }),
);

export const nexusResearchResultRelations = relations(
  nexusResearchResult,
  ({ one, many }) => ({
    nexusResearchEmbeddings: many(nexusResearchEmbedding),
    nexusResearchSession: one(nexusResearchSession, {
      fields: [nexusResearchResult.sessionId],
      references: [nexusResearchSession.id],
    }),
  }),
);

export const nexusResearchReportRelations = relations(
  nexusResearchReport,
  ({ one }) => ({
    nexusResearchSession: one(nexusResearchSession, {
      fields: [nexusResearchReport.sessionId],
      references: [nexusResearchSession.id],
    }),
  }),
);

export const feedbackRelations = relations(feedback, ({ one }) => ({
  chat: one(chat, {
    fields: [feedback.chatId],
    references: [chat.id],
  }),
  messageV2: one(messageV2, {
    fields: [feedback.messageId],
    references: [messageV2.id],
  }),
  user: one(user, {
    fields: [feedback.userId],
    references: [user.id],
  }),
}));

export const l10MeetingRelations = relations(l10Meeting, ({ one, many }) => ({
  user: one(user, {
    fields: [l10Meeting.userId],
    references: [user.id],
  }),
  l10AgendaItems: many(l10AgendaItem),
  l10Issues: many(l10Issue),
  l10Todos: many(l10Todo),
}));

export const l10AgendaItemRelations = relations(l10AgendaItem, ({ one }) => ({
  l10Meeting: one(l10Meeting, {
    fields: [l10AgendaItem.meetingId],
    references: [l10Meeting.id],
  }),
  voiceRecording: one(voiceRecording, {
    fields: [l10AgendaItem.recordingId],
    references: [voiceRecording.id],
  }),
}));

export const userDocumentRelations = relations(
  userDocument,
  ({ one, many }) => ({
    user: one(user, {
      fields: [userDocument.userId],
      references: [user.id],
    }),
    userDocumentEmbeddings: many(userDocumentEmbedding),
  }),
);

export const userDocumentEmbeddingRelations = relations(
  userDocumentEmbedding,
  ({ one }) => ({
    userDocument: one(userDocument, {
      fields: [userDocumentEmbedding.userDocumentId],
      references: [userDocument.id],
    }),
    user: one(user, {
      fields: [userDocumentEmbedding.userId],
      references: [user.id],
    }),
  }),
);

export const l10IssueRelations = relations(l10Issue, ({ one }) => ({
  l10Meeting: one(l10Meeting, {
    fields: [l10Issue.meetingId],
    references: [l10Meeting.id],
  }),
  voiceRecording: one(voiceRecording, {
    fields: [l10Issue.recordingId],
    references: [voiceRecording.id],
  }),
}));

export const l10TodoRelations = relations(l10Todo, ({ one }) => ({
  l10Meeting: one(l10Meeting, {
    fields: [l10Todo.meetingId],
    references: [l10Meeting.id],
  }),
}));

export const documentVersionRelations = relations(
  documentVersion,
  ({ one, many }) => ({
    document: one(document, {
      fields: [documentVersion.documentId],
      references: [document.id],
    }),
    user: one(user, {
      fields: [documentVersion.createdBy],
      references: [user.id],
    }),
    documentUndoStacks: many(documentUndoStack),
  }),
);

export const documentEditOperationRelations = relations(
  documentEditOperation,
  ({ one }) => ({
    document: one(document, {
      fields: [documentEditOperation.documentId],
      references: [document.id],
    }),
    user: one(user, {
      fields: [documentEditOperation.userId],
      references: [user.id],
    }),
  }),
);

export const documentHistoryPointerRelations = relations(
  documentHistoryPointer,
  ({ one }) => ({
    document: one(document, {
      fields: [documentHistoryPointer.documentId],
      references: [document.id],
    }),
    user: one(user, {
      fields: [documentHistoryPointer.userId],
      references: [user.id],
    }),
  }),
);

export const userMemoryEmbeddingRelations = relations(
  userMemoryEmbedding,
  ({ one }) => ({
    userMemory: one(userMemory, {
      fields: [userMemoryEmbedding.memoryId],
      references: [userMemory.id],
    }),
  }),
);

export const userMemoryRelations = relations(userMemory, ({ one, many }) => ({
  userMemoryEmbeddings: many(userMemoryEmbedding),
  user: one(user, {
    fields: [userMemory.userId],
    references: [user.id],
  }),
  messageV2: one(messageV2, {
    fields: [userMemory.sourceMessageId],
    references: [messageV2.id],
  }),
}));

export const documentHistoryRelations = relations(
  documentHistory,
  ({ one }) => ({
    document: one(document, {
      fields: [documentHistory.documentId],
      references: [document.id],
    }),
    user: one(user, {
      fields: [documentHistory.userId],
      references: [user.id],
    }),
  }),
);

export const documentEditSessionRelations = relations(
  documentEditSession,
  ({ one }) => ({
    document: one(document, {
      fields: [documentEditSession.documentId],
      references: [document.id],
    }),
    user: one(user, {
      fields: [documentEditSession.userId],
      references: [user.id],
    }),
  }),
);

export const documentUndoStackRelations = relations(
  documentUndoStack,
  ({ one }) => ({
    document: one(document, {
      fields: [documentUndoStack.documentId],
      references: [document.id],
    }),
    user: one(user, {
      fields: [documentUndoStack.userId],
      references: [user.id],
    }),
    documentVersion: one(documentVersion, {
      fields: [documentUndoStack.currentVersionId],
      references: [documentVersion.id],
    }),
  }),
);

export const voteRelations = relations(vote, ({ one }) => ({
  chat: one(chat, {
    fields: [vote.chatId],
    references: [chat.id],
  }),
  message: one(message, {
    fields: [vote.messageId],
    references: [message.id],
  }),
}));

export const voteV2Relations = relations(voteV2, ({ one }) => ({
  chat: one(chat, {
    fields: [voteV2.chatId],
    references: [chat.id],
  }),
  messageV2: one(messageV2, {
    fields: [voteV2.messageId],
    references: [messageV2.id],
  }),
}));
