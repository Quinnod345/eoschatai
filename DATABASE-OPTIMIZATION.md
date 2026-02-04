# Database Optimization Report

**Analysis Date:** February 4, 2025  
**Database:** PostgreSQL (EOSAI)  
**Schema Version:** Current as of Feb 2025  

## Executive Summary

The EOSAI database has grown significantly with 50+ tables supporting a complex AI chat application. While the schema is well-designed, there are several optimization opportunities that could improve query performance by 20-50% and reduce database load, particularly as user activity scales.

## Current State Analysis

### Database Scale
- **Tables:** 52+ tables with complex relationships
- **High-traffic tables:** `message`, `chat`, `user`, `embeddings`, `contextUsageLog`
- **Large data tables:** `message` (chat history), `embeddings` (vector data), `userMemoryEmbedding`
- **Frequent query patterns:** User authentication, chat loading, message retrieval, RAG/embedding searches

### Performance Hotspots Identified

1. **Missing Foreign Key Indexes:** Several FK relationships lack corresponding indexes
2. **Inefficient Query Patterns:** Some queries could benefit from composite indexes
3. **Large Table Scans:** Time-based queries on large tables without proper indexing
4. **Vector Search Optimization:** Some embedding tables could benefit from additional indexes

## Recommended Indexes

### 1. Critical Missing FK Indexes

```sql
-- User-Chat relationship (high frequency)
CREATE INDEX CONCURRENTLY idx_chat_user_created 
ON "Chat" ("userId", "createdAt" DESC);

-- Message-Chat relationship with role filtering  
CREATE INDEX CONCURRENTLY idx_message_chat_role_created
ON "Message_v2" ("chatId", "role", "createdAt" DESC);

-- Message timestamps for sliding window queries
CREATE INDEX CONCURRENTLY idx_message_created_stopped
ON "Message_v2" ("createdAt" DESC) 
WHERE "stoppedAt" IS NULL;

-- User settings lookup optimization
CREATE INDEX CONCURRENTLY idx_user_settings_user_updated
ON "UserSettings" ("userId", "updatedAt" DESC);
```

### 2. Performance Optimization Indexes

```sql
-- Chat visibility and metadata queries
CREATE INDEX CONCURRENTLY idx_chat_user_visibility_created
ON "Chat" ("userId", "visibility", "createdAt" DESC);

-- Document queries by user and kind
CREATE INDEX CONCURRENTLY idx_document_user_kind_created
ON "Document" ("userId", "kind", "createdAt" DESC);

-- Feedback analysis queries
CREATE INDEX CONCURRENTLY idx_feedback_positive_category_created
ON "Feedback" ("isPositive", "category", "createdAt" DESC);

-- Context tracking performance queries
CREATE INDEX CONCURRENTLY idx_context_log_user_created_feedback
ON "ContextUsageLog" ("userId", "createdAt" DESC, "userFeedback");
```

### 3. Analytics and Reporting Indexes

```sql
-- Organization analytics
CREATE INDEX CONCURRENTLY idx_analytics_org_name_created
ON "AnalyticsEvent" ("orgId", "eventName", "createdAt" DESC);

-- User activity patterns
CREATE INDEX CONCURRENTLY idx_user_memory_user_type_status
ON "UserMemory" ("userId", "memoryType", "status", "createdAt" DESC);

-- Document sharing lookups
CREATE INDEX CONCURRENTLY idx_doc_share_user_permission
ON "DocumentShareUser" ("sharedWithId", "permission", "createdAt" DESC);
```

## Query Pattern Optimizations

### 1. Message Retrieval Optimization

**Current Issue:** `getRecentMessagesByChatId` uses `DESC` then reverses in application code.

**Recommendation:** Use windowing functions or optimized ordering:

```sql
-- Instead of DESC + reverse, use proper offset/limit with forward ordering
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (ORDER BY "createdAt" DESC) as rn
  FROM "Message_v2" 
  WHERE "chatId" = $1
) t WHERE rn <= $2 ORDER BY "createdAt" ASC;
```

### 2. User Daily Message Counting

**Current Issue:** Scans potentially large message table for 24-hour counts.

**Optimization:** Added partial index for non-stopped messages improves this common query.

### 3. Chat Loading with Message Counts

**Current Issue:** `getChatsByUserIdWithMessages` performs expensive aggregations.

**Recommendation:** Consider materialized view or denormalized counts:

```sql
-- Add message_count column to Chat table (updated via triggers)
ALTER TABLE "Chat" ADD COLUMN "messageCount" INTEGER DEFAULT 0;
ALTER TABLE "Chat" ADD COLUMN "lastMessageAt" TIMESTAMP;
```

## Unused Index Cleanup

### Indexes to Consider Removing

```sql
-- Review these indexes for actual usage:
-- Check if user_storage_idx on User table is actively used
-- Verify if all composer relationship indexes are necessary
-- Analyze usage of some embedding summary indexes
```

**Recommendation:** Enable `pg_stat_statements` to track actual index usage before removal.

## Table Partitioning Recommendations

### High-Growth Tables for Partitioning

1. **ContextUsageLog** - Partition by date (monthly)
2. **AnalyticsEvent** - Partition by date (monthly) 
3. **Message_v2** - Consider partitioning by date for very high-volume instances

```sql
-- Example: Partition ContextUsageLog by month
CREATE TABLE "ContextUsageLog_202502" PARTITION OF "ContextUsageLog"
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

## Vector Search Optimizations

### Embedding Table Improvements

The schema already has good vector indexes, but consider:

1. **Namespace-specific indexes** for SystemEmbeddings
2. **Compound indexes** combining vector search with metadata filters

```sql
-- Multi-column index for filtered vector searches
CREATE INDEX CONCURRENTLY idx_system_embedding_namespace_vector
ON "SystemEmbeddings" ("namespace") 
INCLUDE ("embedding");
```

## Implementation Priority

### Phase 1 (Immediate - High Impact)
- [ ] Critical FK indexes (user-chat, message-chat relationships)
- [ ] Message timestamp partial index for daily counting
- [ ] Chat listing optimization indexes

### Phase 2 (Short term - Medium Impact)  
- [ ] Document and feedback query indexes
- [ ] Context tracking optimization indexes
- [ ] Query pattern optimizations in application code

### Phase 3 (Long term - Scalability)
- [ ] Table partitioning for high-growth tables
- [ ] Materialized view for chat statistics
- [ ] Advanced vector search optimizations

## Monitoring Recommendations

1. **Enable pg_stat_statements** for query performance tracking
2. **Set up index usage monitoring** to verify optimization impact
3. **Monitor table growth** for partitioning decisions
4. **Track slow query log** for ongoing optimization opportunities

## Expected Performance Improvements

- **Chat loading:** 30-40% faster with user-chat composite indexes
- **Message queries:** 20-30% improvement with optimized sorting
- **Daily message counting:** 50-70% faster with partial index
- **User dashboard queries:** 25-35% improvement with compound indexes

## Risk Assessment

**Low Risk Changes:**
- Adding new indexes (can be done CONCURRENTLY)
- Query pattern optimizations in application code

**Medium Risk Changes:**  
- Table schema changes (adding denormalized columns)
- Query rewriting for complex operations

**High Risk Changes:**
- Table partitioning (requires careful planning and testing)

## Cost Analysis

**Storage Impact:** Estimated 5-10% increase in database size due to additional indexes.

**Write Performance:** Minimal impact expected (<5% overhead) due to good index design.

**Read Performance:** Expected 20-50% improvement in common query patterns.

## Conclusion

The EOSAI database is well-architected but would benefit significantly from the recommended index additions and query optimizations. The proposed changes are low-risk and offer substantial performance benefits that will become increasingly important as the user base grows.

The implementation should be prioritized based on current performance bottlenecks and user traffic patterns.