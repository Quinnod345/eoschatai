# Nexus Resumable Streams Implementation

## Overview

The Nexus mode now features robust, resumable streams that can survive page reloads, network interruptions, and browser crashes. This implementation uses Redis for state persistence and provides seamless recovery of interrupted searches.

## Key Features

### 1. Stream State Persistence
- **Redis Storage**: All stream states are stored in Redis with 2-hour TTL
- **Checkpoint System**: Progress is saved at key points during search execution
- **Lock Mechanism**: Prevents duplicate processing of the same stream

### 2. Automatic Recovery
- **Page Reload Recovery**: Automatically resumes interrupted searches on page load
- **Session Storage**: Stream IDs are stored in browser session storage for quick recovery
- **Progress Preservation**: Resumes exactly where the search left off

### 3. Stream Components

#### Stream State Structure
```typescript
interface NexusStreamState {
  streamId: string;
  sessionId: string;
  chatId: string;
  query: string;
  phase: 'planning' | 'research' | 'analyzing' | 'generating' | 'complete' | 'error';
  startTime: number;
  lastUpdate: number;
  progress: {
    totalSearches: number;
    completedSearches: number;
    sourcesFound: number;
    currentSearchIndex?: number;
    currentSearchQuery?: string;
  };
  results: any[];
  error?: string;
  researchPlan?: any;
  checkpointData?: any;
}
```

#### Redis Keys
- `nexus:stream:{streamId}:state` - Main stream state
- `nexus:stream:{streamId}:checkpoint` - Progress checkpoint
- `nexus:stream:{streamId}:results` - Search results cache
- `nexus:stream:{streamId}:lock` - Processing lock

### 4. Implementation Files

#### `/lib/ai/nexus-resumable-stream.ts`
Core resumable stream functionality:
- Stream state management
- Lock acquisition/release
- Checkpoint saving/loading
- Stream execution with resume capability

#### `/app/(chat)/api/nexus-chat/route.ts`
Enhanced nexus chat endpoint:
- Stream ID generation and tracking
- Resume request handling
- State persistence throughout search process
- Progress updates with stream ID

#### `/app/api/chat/route.ts`
Main chat route integration:
- Generates stream ID for nexus searches
- Forwards stream ID to client
- Handles stream recovery requests

#### `/components/chat.tsx`
Client-side recovery:
- Stores stream ID in session storage
- Automatic recovery on mount
- Resume notification handling
- Progress restoration

## Usage Flow

### 1. New Search
1. User activates Nexus mode and sends query
2. Chat route generates unique stream ID
3. Stream ID sent to client and stored in session storage
4. Nexus endpoint creates initial stream state in Redis
5. Search proceeds with regular progress updates

### 2. Interruption Handling
1. If page reloads or connection drops:
   - Stream state persists in Redis
   - Lock prevents duplicate processing
   - Progress checkpoints preserve search state

### 3. Recovery Process
1. On page load, chat component checks for stored stream ID
2. If found and Nexus mode active, sends resume request
3. Nexus endpoint loads existing state from Redis
4. Stream resumes from last checkpoint
5. Client receives "nexus-stream-resumed" event
6. Search continues seamlessly

## Event Types

### Stream Management Events
- `nexus-stream-id`: Initial stream ID assignment
- `nexus-stream-resumed`: Stream successfully resumed
- `nexus-resume-conflict`: Stream already being processed

### Progress Events (Enhanced)
All progress events now include `streamId` for tracking:
- `nexus-phase-update`
- `nexus-search-progress`
- `nexus-search-detail`
- `nexus-sites-found`
- `nexus-search-complete`
- `nexus-error`

## Configuration

### Environment Variables
```env
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### Redis TTL Settings
- Stream state: 2 hours
- Checkpoints: 1 hour
- Locks: 30 seconds (auto-renewed)

## Error Handling

### Lock Conflicts
- If stream is already being processed, user receives conflict message
- Prevents duplicate searches and resource waste

### State Recovery Failures
- Falls back to starting new search if state corrupted
- Clears invalid session storage entries
- Logs errors for debugging

### Network Failures
- Checkpoints allow resuming from last successful batch
- Partial results are preserved
- Failed searches can be retried

## Performance Considerations

### Checkpoint Frequency
- Checkpoints saved before each search batch
- State updated after each batch completion
- Balance between recovery granularity and Redis operations

### Batch Processing
- Searches processed in batches of 2
- 8-second delay between batches for rate limiting
- Batches can resume independently

### Redis Operations
- Minimal Redis calls during normal operation
- Bulk updates where possible
- TTL ensures automatic cleanup

## Testing Recovery

### Manual Testing
1. Start a Nexus search
2. Reload page mid-search
3. Observe automatic recovery
4. Check console for recovery logs

### Simulating Failures
1. Network interruption: Disable network mid-search
2. Browser crash: Force close browser
3. Server restart: Restart server during search

### Verification
- Check Redis for persisted state: `redis-cli GET nexus:stream:{streamId}:state`
- Monitor session storage in browser DevTools
- Review console logs for recovery events

## Future Enhancements

### Planned Features
1. **Multi-device Resume**: Resume searches across devices
2. **Search History**: View and resume past searches
3. **Partial Results**: Show partial results during recovery
4. **Progress Analytics**: Track search performance metrics

### Optimization Opportunities
1. **Compression**: Compress state data in Redis
2. **Selective Checkpoints**: Smart checkpoint timing
3. **Result Streaming**: Stream results as available
4. **Parallel Recovery**: Resume multiple searches simultaneously 