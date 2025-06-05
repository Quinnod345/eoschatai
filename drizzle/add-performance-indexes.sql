-- Performance indexes for frequently queried columns

-- Chat table indexes
CREATE INDEX IF NOT EXISTS idx_chat_user_id ON "Chat" ("userId");
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON "Chat" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_chat_user_created ON "Chat" ("userId", "createdAt" DESC);

-- Message table indexes
CREATE INDEX IF NOT EXISTS idx_message_chat_id ON "Message_v2" ("chatId");
CREATE INDEX IF NOT EXISTS idx_message_created_at ON "Message_v2" ("createdAt");
CREATE INDEX IF NOT EXISTS idx_message_chat_created ON "Message_v2" ("chatId", "createdAt");

-- Vote table indexes
CREATE INDEX IF NOT EXISTS idx_vote_chat_id ON "Vote_v2" ("chatId");
CREATE INDEX IF NOT EXISTS idx_vote_message_id ON "Vote_v2" ("messageId");

-- UserDocuments table indexes
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON "UserDocuments" ("userId");
CREATE INDEX IF NOT EXISTS idx_user_documents_created_at ON "UserDocuments" ("createdAt" DESC);

-- Persona table indexes
CREATE INDEX IF NOT EXISTS idx_persona_user_id ON "Persona" ("userId");

-- Composite indexes for search optimization
CREATE INDEX IF NOT EXISTS idx_chat_visibility_user ON "Chat" ("visibility", "userId");
CREATE INDEX IF NOT EXISTS idx_message_role_chat ON "Message_v2" ("role", "chatId");

-- Partial indexes for specific queries
CREATE INDEX IF NOT EXISTS idx_message_user_messages ON "Message_v2" ("chatId", "createdAt") 
WHERE "role" = 'user';

-- Add PostgreSQL statistics for better query planning
ANALYZE "Chat";
ANALYZE "Message_v2";
ANALYZE "Vote_v2";
ANALYZE "UserDocuments";
ANALYZE "Persona"; 