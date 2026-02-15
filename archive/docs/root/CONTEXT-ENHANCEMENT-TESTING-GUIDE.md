# Context & Memory Enhancement Testing Guide

This guide provides comprehensive testing procedures for the newly implemented context and memory enhancements.

## Prerequisites

Before testing, ensure migrations are applied:

```bash
pnpm db:auto-migrate
```

This will apply:
- `drizzle/add-conversation-summary.sql` - Chat summary columns
- `drizzle/add-composer-summaries.sql` - Composer summary columns
- `drizzle/add-context-tracking.sql` - Context tracking table

## Phase 1: Memory Retrieval System

### Test 1.1: Save and Retrieve Memories

**Steps:**
1. Start a new chat
2. Say: "Remember that my company name is Acme Manufacturing"
3. Wait for AI to confirm saving via addResource tool
4. Start a NEW chat
5. Ask: "What is my company name?"

**Expected:**
- AI should respond with "Acme Manufacturing" from memory
- Console should log: `Memory RAG: Retrieved X relevant memories`
- Response should reference the saved memory

### Test 1.2: Memory Types and Confidence

**Steps:**
1. Save different memory types:
   - "Remember that I prefer concise responses" (preference)
   - "Remember that we run quarterly planning sessions" (company)
   - "Remember to follow up on the hiring process next week" (task)
2. Ask a general question
3. Check console logs for memory retrieval

**Expected:**
- Memories should be grouped by type in console
- High-confidence memories appear first
- Relevant memories included in AI responses

## Phase 2: Message History Limiting

### Test 2.1: Long Conversation Handling

**Steps:**
1. Create a chat with >50 messages (or use existing long chat)
2. Send a new message
3. Check console logs for message retrieval

**Expected:**
- Console shows: `Message Retrieval: Loaded 50 of X total messages`
- Only last 50 messages sent to AI
- Conversation summary loaded if available

### Test 2.2: Conversation Summarization

**Steps:**
1. Create a chat with >50 messages discussing specific topics
2. Wait for summary to generate (may be async)
3. Check database for `Chat.conversationSummary`
4. Send new message and check if summary is used

**Expected:**
- Summary generated covering main topics
- Console: `Message History: Using existing summary (X chars)`
- Older context preserved via summary

## Phase 3: Token Budget Management

### Test 3.1: Token Counting

**Steps:**
1. Start a chat
2. Upload large documents or enable many context sources
3. Send complex query
4. Check console logs for token counting

**Expected:**
- Console shows: `Context Assembler: Total tokens: X`
- Budget tracking: `Budget used: X%`
- No context overflow errors

### Test 3.2: Context Compression

**Steps:**
1. Create scenario with >12,000 tokens of context
2. Send query that triggers all RAG layers
3. Monitor console for compression

**Expected:**
- High-priority contexts compressed instead of dropped
- Console: `Context Assembler: Compressed "X" (Y → Z tokens)`
- Response still includes critical information

## Phase 4: Context Deduplication

### Test 4.1: Duplicate Detection

**Steps:**
1. Upload same content as both user document and persona document
2. Ask query that matches that content
3. Check console for deduplication

**Expected:**
- Duplicate chunks identified
- Console: `Deduplicator: Removed X duplicate chunks`
- Only one instance of duplicate content in context

## Phase 5: Adaptive Retrieval Limits

### Test 5.1: Simple Query

**Steps:**
1. Ask simple general question: "What is EOS?"
2. Check console logs

**Expected:**
- Console: `Query complexity: simple`
- Fewer chunks retrieved (3 system, 5 persona, 3 user)
- Fast response time

### Test 5.2: Complex Query

**Steps:**
1. Ask complex personalized question: "Based on my uploaded V/TO, quarterly rocks, and previous discussions about our Q4 plan, what should we prioritize next quarter?"
2. Check console logs

**Expected:**
- Console: `Query complexity: complex`
- More chunks retrieved (8 system, 14 persona, 14 user)
- Comprehensive context included

### Test 5.3: Context Requirement Detection

**Steps:**
1. Ask general question: "What is a Scorecard?"
2. Check if user docs were skipped
3. Ask specific question: "What are my Scorecard metrics?"
4. Check if user docs were loaded

**Expected:**
- General query: `Skipping user document retrieval (not required)`
- Specific query: User docs retrieved and used

## Phase 6: Composer Summarization

### Test 6.1: Large Composer Summary Generation

**Steps:**
1. Create large VTO composer (>5000 chars)
2. Check database `Document.contentSummary`
3. Query about the VTO

**Expected:**
- Summary generated and stored
- Console: `RAG: Document is large (X chars), generating summary...`
- Console: `RAG: Added X summary embeddings`

### Test 6.2: Summary vs Full Content

**Steps:**
1. Create small composer (<5000 chars)
2. Create large composer (>5000 chars)
3. Check embeddings for both

**Expected:**
- Small composer: No summary generated
- Large composer: Both summary and full content embeddings
- Summary embeddings marked with `isSummary: true`

## Phase 7: Context Effectiveness Tracking

### Test 7.1: Usage Logging

**Steps:**
1. Send several messages with different complexities
2. Check `ContextUsageLog` table

**Expected:**
- Each message has log entry
- Chunk counts match console logs
- Token counts recorded
- Model and metadata captured

### Test 7.2: Feedback Submission

**Steps:**
1. Add `<ContextFeedback messageId={message.id} />` to message component
2. Send message
3. Click thumbs up/down
4. Check database

**Expected:**
- Feedback recorded in `ContextUsageLog.userFeedback`
- API response: `{ success: true }`

### Test 7.3: Analysis Script

**Steps:**
```bash
pnpm tsx scripts/analyze-context-effectiveness.ts
```

**Expected:**
- Statistics report displayed
- Breakdown by complexity
- Optimization opportunities identified
- No errors

## Critical Preservation Tests

### Test P.1: Composer Editing (CRITICAL)

**Steps:**
1. Create VTO composer via chat
2. Wait for composer to appear in right panel
3. Say: "Add a section about our core values"
4. Verify updateDocument tool is called
5. Check that composer updates correctly

**Expected:**
- `updateDocument` tool invoked with correct documentId
- Composer panel updates in real-time
- No errors in console
- Edit applies correctly

### Test P.2: Composer Creation Context

**Steps:**
1. Perform web search: "Latest EOS best practices 2024"
2. Say: "Create a document summarizing these best practices"
3. Check composer content

**Expected:**
- `createDocument` tool receives search results in context
- Composer contains actual search content, not meta-message
- Recent conversation context included

### Test P.3: Split-View Mode Detection

**Steps:**
1. Open composer in split view
2. Send casual message: "Thanks!"
3. Send edit request: "Add more detail to the introduction"

**Expected:**
- Casual message: Normal chat response, no tool call
- Edit request: `updateDocument` tool called
- Correct documentId used

## Regression Tests

### Test R.1: Existing Chats Load

**Steps:**
1. Open existing chat (created before enhancements)
2. Verify messages load correctly
3. Send new message

**Expected:**
- Old chats load without errors
- Message history works
- Can continue conversation normally

### Test R.2: Persona Documents Still Work

**Steps:**
1. Select persona with documents
2. Ask question related to persona docs
3. Check that persona RAG retrieves correctly

**Expected:**
- Persona documents retrieved
- Context included in response
- No breaking changes to persona system

### Test R.3: System Personas Function

**Steps:**
1. Select EOS Implementer persona
2. Choose a profile (e.g., Vision Building Day 1)
3. Ask profile-specific question

**Expected:**
- System knowledge retrieved from correct namespace
- Profile-specific context included
- Responses use specialized knowledge

## Performance Tests

### Test Perf.1: Response Time

**Steps:**
1. Send simple query
2. Measure time to first token
3. Send complex query with all context sources
4. Measure time to first token

**Expected:**
- Simple query: <2 seconds to first token
- Complex query: <4 seconds to first token
- Parallel RAG calls complete in <500ms each

### Test Perf.2: Memory Impact

**Steps:**
1. Chat with 100+ messages
2. Monitor memory usage
3. Check for memory leaks

**Expected:**
- No significant memory growth over time
- Encoding cache properly managed
- No leaked embeddings

## Validation Checklist

Before marking complete, verify:

- [ ] Memories are retrieved and used in responses
- [ ] Long chats load only 50 recent messages
- [ ] Conversation summaries generated for >50 message chats
- [ ] Token counting works correctly
- [ ] Context stays within budget
- [ ] Compression works for oversized context
- [ ] Query complexity analysis functions
- [ ] Adaptive limits adjust based on complexity
- [ ] Large composers generate summaries
- [ ] Summary embeddings created
- [ ] Context usage logged to database
- [ ] Feedback endpoint works
- [ ] Composer editing still functions correctly
- [ ] Document tools receive proper context
- [ ] No breaking changes to existing features

## Troubleshooting

### Issue: Memories not retrieved

**Check:**
- `UserMemory` table has active memories
- `UserMemoryEmbedding` table has embeddings
- Console shows: `Memory RAG: Retrieved X memories`

**Fix:**
- Verify migration applied
- Check if memories have `status='active'`
- Ensure embeddings were generated when memories were created

### Issue: Token counting errors

**Check:**
- `tiktoken` package installed
- Console shows encoding errors

**Fix:**
```bash
pnpm add tiktoken
```

### Issue: Context tracking not logging

**Check:**
- `ContextUsageLog` table exists
- Console shows tracking errors

**Fix:**
- Apply migration: `drizzle/add-context-tracking.sql`
- Check database permissions

### Issue: Composer editing broken

**Check:**
- `composerDocumentId` still passed to chat route
- `updateDocument` tool still has access to document content
- Split-view detection logic intact

**Fix:**
- Verify lines 1341-1386 in `lib/ai/prompts.ts` unchanged
- Check `updateDocument` tool implementation
- Review chat route preserves `composerDocumentId`

## Success Metrics

After all tests pass, expect:

1. **Memory Effectiveness**: >80% of saved memories used within 10 messages
2. **Message Limiting**: Long chats load in <2s
3. **Token Efficiency**: Context uses <60% of budget
4. **Deduplication**: 20-40% reduction in redundant chunks
5. **Adaptive Savings**: Simple queries use 50% fewer chunks
6. **Composer Efficiency**: Large docs use 70% fewer tokens
7. **Tracking Coverage**: 100% of responses logged

## Monitoring Commands

```bash
# Check memory count
pnpm db:studio
# Navigate to UserMemory table

# Run effectiveness analysis
pnpm tsx scripts/analyze-context-effectiveness.ts

# Check context logs
pnpm db:studio
# Navigate to ContextUsageLog table

# Tail server logs
tail -f logs/server-logs.txt | grep "Context Assembler"
```

