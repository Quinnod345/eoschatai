# Manual Testing Guide for Firesearch Integration

## Prerequisites

1. Ensure you have the following environment variables set:
   ```bash
   FIRECRAWL_API_KEY=your_firecrawl_api_key
   OPENAI_API_KEY=your_openai_api_key
   UPSTASH_REDIS_REST_URL=your_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_redis_token
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Test Scenarios

### 1. Basic Deep Research Test

1. Open the chat interface
2. Click on the research mode selector (should show "Standard" by default)
3. Select "Deep Research" mode
4. Enter a research query like:
   - "What are the latest developments in quantum computing?"
   - "How does the EOS business framework work?"
   - "Compare different AI model architectures"

**Expected Results:**
- Research plan should appear with sub-questions
- Progress indicator should show different phases
- Multiple search queries should execute
- Final response should include citations
- Follow-up questions should appear after completion

### 2. Follow-up Questions Test

1. Complete a deep research query
2. Wait for follow-up questions to appear
3. Click on one of the follow-up questions

**Expected Results:**
- Selected question should populate the input field
- New research should start automatically
- Previous follow-up questions should disappear

### 3. Citation Verification

1. Complete a deep research query
2. Check the response for citation numbers [1], [2], etc.
3. Scroll down to see citation references

**Expected Results:**
- Citations in text should match reference list
- Each citation should have title, URL, and snippet
- Clicking citations should open source URLs

### 4. Error Handling Test

1. Temporarily set an invalid API key
2. Try to run a deep research query

**Expected Results:**
- Error message should appear
- UI should gracefully handle the error
- No broken UI states

### 5. Rate Limiting Test

1. Run 10 deep research queries quickly
2. Try to run an 11th query

**Expected Results:**
- Rate limit error should appear
- Error should indicate when you can try again
- UI should remain functional

### 6. Session Persistence Test (if implemented)

1. Start a deep research query
2. Refresh the page mid-search
3. Return to the same chat

**Expected Results:**
- Research should resume or show completion
- No data loss should occur

## API Testing with cURL

### Test the Firesearch endpoint directly:

```bash
# Basic research query
curl -X POST http://localhost:3000/api/firesearch \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "query": "What is machine learning?",
    "chatId": "test-chat-id",
    "depth": "standard"
  }'

# Test with comprehensive depth
curl -X POST http://localhost:3000/api/firesearch \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "query": "Explain transformer architecture in detail",
    "chatId": "test-chat-id",
    "depth": "comprehensive"
  }'
```

## Console Monitoring

While testing, monitor the browser console and server logs for:

1. **Browser Console:**
   - Look for `[Chat]` prefixed logs
   - Check for `[Firesearch Orchestrator]` messages
   - Verify SSE events are being received

2. **Server Console:**
   - Look for `[Firesearch API]` logs
   - Check for `[Firesearch Service]` messages
   - Monitor for any error stack traces

## Performance Metrics to Track

1. **Research Duration:**
   - Standard depth: 1-2 minutes
   - Comprehensive depth: 3-5 minutes

2. **Source Quality:**
   - Should return 10-20 relevant sources
   - Sources should have good relevance scores

3. **Response Quality:**
   - Comprehensive summary with citations
   - Well-structured markdown output
   - Relevant follow-up questions

## Common Issues and Solutions

### Issue: No results returned
- Check API keys are valid
- Verify network connectivity
- Check rate limits

### Issue: Follow-up questions not appearing
- Ensure `FIRESEARCH_FOLLOWUP` is not set to 'false'
- Check browser console for errors
- Verify the response includes followUpQuestions

### Issue: Slow performance
- Check network latency
- Monitor API response times
- Consider reducing search depth

### Issue: Citations not matching
- Verify citation extraction logic
- Check source ordering
- Ensure citation numbers are sequential

## Rollback Plan

If critical issues are found:

1. Revert the chat route changes to use old Nexus orchestrator
2. Keep Firesearch code but disable the feature
3. Use feature flag to control access
4. Continue testing in isolation

## Success Criteria

The integration is considered successful when:

- [ ] All test scenarios pass
- [ ] Performance meets expectations
- [ ] No critical errors in 100 queries
- [ ] User feedback is positive
- [ ] Follow-up questions enhance experience
- [ ] Citations are accurate and helpful



