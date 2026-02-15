# Circle Course Upstash Integration Guide

This guide explains the optimized Circle.so course integration that uses Upstash Vector for efficient, shared course data storage.

## Overview

The new system syncs Circle.so course content to Upstash Vector **once** and shares it across all users. This approach:

- **Reduces costs**: One copy of course data instead of duplicates per user
- **Improves performance**: No data syncing during user activation
- **Prevents crashes**: Standalone script avoids Next.js memory issues
- **Enables instant activation**: Users can activate courses immediately

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Admin runs sync script (one time per course)            │
│     tsx scripts/sync-circle-course-to-upstash.ts <courseId> │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Course content fetched from Circle.so API               │
│     - Lessons, posts, sections                              │
│     - Course metadata and descriptions                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Content chunked and embedded                            │
│     - Text chunking (1000 chars, 200 overlap)               │
│     - OpenAI embeddings (text-embedding-ada-002)            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Stored in Upstash Vector                                │
│     Namespace: circle-course-{courseId}                     │
│     - Shared across all users                               │
│     - Includes metadata (lesson IDs, order, etc.)           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  5. User activates course (instant)                         │
│     GET /api/circle/activate-course?courseId=xxx            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Persona created with reference to shared namespace      │
│     knowledgeNamespace: "circle-course-{courseId}"          │
│     - No data duplication                                   │
│     - Instant activation                                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Chat queries use shared namespace                       │
│     - personaRagContextPrompt detects circle-course-* ns    │
│     - Queries Upstash directly                              │
│     - Returns relevant course content                       │
└─────────────────────────────────────────────────────────────┘
```

### Namespace Convention

All Circle courses use the namespace pattern:
```
circle-course-{courseId}
```

For example:
- Course ID `123456` → Namespace `circle-course-123456`
- Course ID `789012` → Namespace `circle-course-789012`

This allows:
- Easy identification of Circle course data
- Shared access across all users
- Separation from user-specific persona data

## Usage

### Step 1: Sync Course to Upstash (One Time)

Before users can activate a course, you must sync it to Upstash:

```bash
# Basic usage (uses CIRCLE_SPACE_ID from env)
tsx scripts/sync-circle-course-to-upstash.ts <courseId>

# With explicit space ID
tsx scripts/sync-circle-course-to-upstash.ts <courseId> <spaceId>

# Example
tsx scripts/sync-circle-course-to-upstash.ts 123456
```

**Output:**
```
========================================
Circle Course → Upstash Sync
========================================

Course ID: 123456
Space ID: 789012
Namespace: circle-course-123456

📡 Initializing Upstash Vector client...
✅ Upstash client initialized

📚 Fetching course content from Circle.so...
✅ Fetched course: EOS Implementer Training
   Lessons: 15

📄 Converting course to documents...
✅ Created 16 documents

[1/16] Processing: EOS Implementer Training - Overview
   Content length: 2450 chars
   Chunks: 3
   🔄 Generating embeddings...
   ✅ Generated 3 embeddings
   📤 Uploading batch 1/1 (3 vectors)...
   ✅ Uploaded batch 1/1
   ✅ Completed: EOS Implementer Training - Overview

...

========================================
✅ Sync Complete!
========================================
Course: EOS Implementer Training
Namespace: circle-course-123456
Documents processed: 16
Total chunks: 45
Total vectors stored: 45
========================================

🔍 Verifying storage...
✅ Verification successful - vectors are stored correctly
   Sample vector ID: doc-0-chunk-0

✨ Course is now ready to use!
   Users can activate this course and it will reference namespace: circle-course-123456
```

### Step 2: User Activates Course

Users can now activate the course instantly via the Circle.so link:

```
https://yourdomain.com/api/circle/activate-course?courseId=123456&audience=implementer
```

Or programmatically:
```typescript
const response = await fetch('/api/circle/activate-course?courseId=123456&audience=implementer');
const data = await response.json();

console.log(data);
// {
//   personaId: "uuid-here",
//   courseName: "EOS Implementer Training",
//   syncStatus: "complete",
//   namespace: "circle-course-123456",
//   isNewActivation: true
// }
```

**What happens:**
1. System checks if course persona already exists
2. If not, creates new persona with `knowledgeNamespace: "circle-course-{courseId}"`
3. Creates user subscription to the persona
4. Returns immediately (no data syncing required)

### Step 3: Using the Course in Chat

Once activated, users can chat with the course assistant:

1. Select the course persona from the dropdown
2. Ask questions about the course content
3. The system automatically:
   - Detects the `circle-course-*` namespace
   - Queries Upstash Vector for relevant content
   - Includes course material in AI context
   - Generates course-aligned responses

**Example:**
```
User: "What are the core concepts in lesson 3?"

System:
- Generates embedding for query
- Searches namespace "circle-course-123456"
- Retrieves top 10 relevant chunks
- Filters by relevance (>50%)
- Injects into AI context
- AI responds with course-specific content
```

## Environment Variables

Required environment variables:

```bash
# Upstash Vector (for user RAG and Circle courses)
UPSTASH_USER_RAG_REST_URL=https://your-upstash-url.upstash.io
UPSTASH_USER_RAG_REST_TOKEN=your-token-here

# Circle.so API
CIRCLE_API_TOKEN=your-circle-api-token
CIRCLE_HEADLESS_AUTH_TOKEN=your-headless-token
CIRCLE_SPACE_ID=your-default-space-id  # Optional
```

## Administration

### List All Circle Courses

To see all synced courses:

```bash
tsx scripts/list-circle-courses.ts
```

### Re-sync a Course

If course content is updated, re-run the sync script:

```bash
tsx scripts/sync-circle-course-to-upstash.ts 123456
```

This will:
- Fetch latest content from Circle.so
- Overwrite existing vectors in the namespace
- Preserve user persona references

### Delete Course Data

To remove a course from Upstash (not implemented yet):

```bash
tsx scripts/delete-circle-course.ts 123456
```

**Warning:** This will break all personas referencing this course!

## Technical Details

### Vector Storage

Each course document chunk is stored with metadata:

```typescript
{
  id: "doc-{docIndex}-chunk-{chunkIndex}",
  vector: [1536-dim embedding],
  metadata: {
    courseId: "123456",
    courseName: "EOS Implementer Training",
    documentTitle: "Lesson 1: Introduction",
    documentIndex: 1,
    chunkIndex: 0,
    lessonId: "lesson-123",
    lessonOrder: 1,
    documentType: "lesson" | "overview",
    chunk: "actual text content here...",
    createdAt: "2024-01-01T00:00:00.000Z"
  }
}
```

### Query Process

When a user asks a question:

1. **Detection**: `personaRagContextPrompt` checks if `knowledgeNamespace` starts with `circle-course-`
2. **Embedding**: Query is embedded using `text-embedding-ada-002`
3. **Search**: Upstash Vector namespace is queried with topK=10
4. **Filtering**: Results filtered by relevance threshold (0.5)
5. **Grouping**: Results grouped by document title
6. **Context**: Top 3 chunks per document added to AI context
7. **Response**: AI generates response using course content

### Performance Characteristics

- **Sync time**: ~1-2 minutes per course (depending on size)
- **Activation time**: ~200ms (just database writes)
- **Query time**: ~300ms (Upstash Vector query)
- **Storage**: ~10KB per chunk (embedding + metadata)
- **Cost**: Single storage cost per course (not per user)

## Migration from Old System

If you have courses using the old system (per-user PostgreSQL storage):

1. Sync course to Upstash using new script
2. Update persona's `knowledgeNamespace` to `circle-course-{courseId}`
3. Old data in PostgreSQL will be unused but can remain
4. Consider cleanup script to remove old data (optional)

## Troubleshooting

### "No vectors found in namespace"

**Cause**: Course hasn't been synced yet  
**Solution**: Run sync script first

### "Missing Upstash environment variables"

**Cause**: Environment variables not set  
**Solution**: Add to `.env.local`:
```bash
UPSTASH_USER_RAG_REST_URL=...
UPSTASH_USER_RAG_REST_TOKEN=...
```

### "Failed to fetch course content from Circle.so"

**Cause**: Invalid Circle.so credentials or course ID  
**Solution**: 
- Verify `CIRCLE_API_TOKEN` and `CIRCLE_HEADLESS_AUTH_TOKEN`
- Check course ID is correct
- Ensure course is accessible with your credentials

### "No relevant course content found"

**Cause**: Query doesn't match course content  
**Solution**: 
- Try more specific questions
- Check if course was synced successfully
- Verify namespace in Upstash has vectors

## Best Practices

1. **Sync before launch**: Always sync courses before making them available to users
2. **Test after sync**: Verify sync worked by checking Upstash Vector database
3. **Update regularly**: Re-sync courses when content changes
4. **Monitor costs**: Track Upstash Vector usage in dashboard
5. **Backup course data**: Keep Circle.so as source of truth
6. **Document namespaces**: Keep a list of all course IDs and namespaces

## Future Enhancements

Potential improvements:

- **Auto-sync**: Webhook from Circle.so to trigger automatic syncing
- **Incremental sync**: Only sync changed content
- **Multi-language**: Support for course content in multiple languages
- **Analytics**: Track which lessons are queried most frequently
- **Versioning**: Support multiple versions of the same course
- **Admin UI**: Web interface to manage course syncing

## Support

For issues or questions:
1. Check logs in sync script output
2. Verify environment variables
3. Test with small course first
4. Review Upstash Vector dashboard
5. Check Circle.so API status

## Related Files

- **Sync Script**: `scripts/sync-circle-course-to-upstash.ts`
- **Activate Endpoint**: `app/api/circle/activate-course/route.ts`
- **Persona RAG**: `lib/ai/persona-rag.ts`
- **Circle Integration**: `lib/integrations/circle.ts`
- **User RAG**: `lib/ai/user-rag.ts`
