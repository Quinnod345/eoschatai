-- Database Optimization Migration
-- Created: 2025-02-04
-- Description: Add critical performance indexes and optimize query patterns

-- ============================================================================
-- CRITICAL PERFORMANCE INDEXES
-- ============================================================================

-- User-Chat relationship optimization (high frequency queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_user_created 
ON "Chat" ("userId", "createdAt" DESC);

-- Message-Chat relationship with role filtering for user message queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_chat_role_created
ON "Message_v2" ("chatId", "role", "createdAt" DESC);

-- Message timestamp optimization for daily counting (excludes stopped messages)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_created_stopped
ON "Message_v2" ("createdAt" DESC) 
WHERE "stoppedAt" IS NULL;

-- User settings lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_settings_user_updated
ON "UserSettings" ("userId", "updatedAt" DESC);

-- ============================================================================
-- QUERY PATTERN OPTIMIZATION INDEXES
-- ============================================================================

-- Chat visibility and metadata queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_user_visibility_created
ON "Chat" ("userId", "visibility", "createdAt" DESC);

-- Document queries by user and kind (frequently used in document listing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_user_kind_created
ON "Document" ("userId", "kind", "createdAt" DESC);

-- Document context flag queries (for RAG operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_user_context
ON "Document" ("userId", "isContext", "createdAt" DESC);

-- Feedback analysis queries (for product insights)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_positive_category_created
ON "Feedback" ("isPositive", "category", "createdAt" DESC);

-- Context tracking performance queries (for RAG optimization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_context_log_user_created_feedback
ON "ContextUsageLog" ("userId", "createdAt" DESC, "userFeedback");

-- ============================================================================
-- ANALYTICS AND REPORTING INDEXES
-- ============================================================================

-- Organization analytics optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_org_name_created
ON "AnalyticsEvent" ("orgId", "eventName", "createdAt" DESC);

-- User activity and memory pattern analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_memory_user_type_status
ON "UserMemory" ("userId", "memoryType", "status", "createdAt" DESC);

-- Document sharing permission lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doc_share_user_permission
ON "DocumentShareUser" ("sharedWithId", "permission", "createdAt" DESC);

-- Organization document sharing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doc_share_org_permission
ON "DocumentShareOrg" ("orgId", "permission", "createdAt" DESC);

-- ============================================================================
-- SPECIALIZED INDEXES FOR SPECIFIC USE CASES
-- ============================================================================

-- Stream management optimization (for real-time chat features)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_chat_status_active
ON "Stream" ("chatId", "status", "lastActiveAt" DESC);

-- Persona and profile usage optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_persona_user_shared
ON "Persona" ("userId", "isShared", "isSystemPersona");

-- User document processing status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_docs_user_status
ON "UserDocuments" ("userId", "processingStatus", "createdAt" DESC);

-- Voice recording queries by user and type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_recording_user_type
ON "VoiceRecording" ("userId", "meetingType", "createdAt" DESC);

-- ============================================================================
-- VECTOR SEARCH OPTIMIZATIONS
-- ============================================================================

-- System embeddings with namespace filtering (for persona knowledge)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_embedding_namespace_created
ON "SystemEmbeddings" ("namespace", "createdAt" DESC);

-- User memory embeddings optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_embedding_memory_created
ON "UserMemoryEmbedding" ("memoryId", "createdAt" DESC);

-- ============================================================================
-- FOREIGN KEY RELATIONSHIP OPTIMIZATIONS
-- ============================================================================

-- Composer document relationships
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_composer_rel_source_type
ON "ComposerRelationship" ("sourceId", "relationshipType", "createdAt" DESC);

-- Composer mentions optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_composer_mention_composer_time
ON "ComposerMention" ("composerId", "mentionedAt" DESC);

-- Organization member role lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_member_org_role
ON "OrgMemberRole" ("orgId", "role", "createdAt" DESC);

-- Organization invitation tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_invite_status_created
ON "OrgInvitation" ("status", "sentAt" DESC) 
WHERE "status" NOT IN ('accepted', 'failed', 'bounced');

-- ============================================================================
-- RESEARCH AND NEXUS OPTIMIZATIONS
-- ============================================================================

-- Research session queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_research_session_user_status
ON "NexusResearchSession" ("userId", "status", "createdAt" DESC);

-- Research results optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_research_result_session_relevance
ON "NexusResearchResult" ("sessionId", "relevanceScore" DESC);

-- ============================================================================
-- MAINTENANCE AND CLEANUP INDEXES
-- ============================================================================

-- Document version management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doc_version_doc_created
ON "DocumentVersion" ("documentId", "createdAt" DESC);

-- Document history tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doc_history_doc_operation
ON "DocumentHistory" ("documentId", "operation", "timestamp" DESC);

-- Webhook event processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_processed
ON "WebhookEvents" ("processedAt") 
WHERE "processedAt" IS NOT NULL;

-- ============================================================================
-- NOTES
-- ============================================================================

-- All indexes are created with CONCURRENTLY to avoid blocking operations
-- IF NOT EXISTS prevents errors if indexes already exist
-- Partial indexes are used where appropriate to reduce storage overhead
-- Composite indexes are ordered by selectivity (most selective first)
-- DESC ordering matches common query patterns for recent-first retrieval