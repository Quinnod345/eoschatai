# Circle Course Upstash - Quick Start Guide

## TL;DR

Circle courses now use Upstash Vector with **shared namespaces** to eliminate data duplication and improve performance.

### Before (Old System)
- ❌ Each user activation triggered full course sync
- ❌ Data duplicated for every user
- ❌ Slow activation (1-2 minutes)
- ❌ Used PostgreSQL (crashed with large courses)
- ❌ Expensive (multiple copies of same data)

### After (New System)
- ✅ One-time sync per course (admin runs script)
- ✅ All users share the same course data
- ✅ Instant activation (~200ms)
- ✅ Uses Upstash Vector (no crashes)
- ✅ Cost-effective (single copy of data)

## Quick Start

### 1. Sync a Course (One Time, Admin Only)

```bash
# Sync course to Upstash
tsx scripts/sync-circle-course-to-upstash.ts 123456

# Where 123456 is your Circle course ID
```

**This creates namespace:** `circle-course-123456`

### 2. Users Activate the Course

Send users to:
```
https://yourdomain.com/api/circle/activate-course?courseId=123456&audience=implementer
```

Or they can click the link from Circle.so.

**What happens:**
- ✅ Persona created instantly
- ✅ References shared namespace `circle-course-123456`
- ✅ No data syncing required
- ✅ User can start chatting immediately

### 3. Users Chat with Course

- Select course persona from dropdown
- Ask questions
- System automatically pulls relevant content from Upstash

## Management Commands

```bash
# List all courses and their status
tsx scripts/list-circle-courses.ts

# List with Upstash verification (slower)
tsx scripts/list-circle-courses.ts --check-upstash

# Re-sync a course (after content updates)
tsx scripts/sync-circle-course-to-upstash.ts 123456
```

## How It Works

```
Admin: Sync Course → Upstash
         ↓
   [circle-course-123456]
         ↓
User 1: Activate → Persona A → References circle-course-123456
User 2: Activate → Persona B → References circle-course-123456
User 3: Activate → Persona C → References circle-course-123456
         ↓
   All users share the same course data in Upstash!
```

## Environment Variables

Required:
```bash
UPSTASH_USER_RAG_REST_URL=https://...
UPSTASH_USER_RAG_REST_TOKEN=...
CIRCLE_API_TOKEN=...
CIRCLE_HEADLESS_AUTH_TOKEN=...
CIRCLE_SPACE_ID=...  # Optional, can pass as argument
```

## Troubleshooting

### Course activation says "pending" or "failed"
**Fix:** Run the sync script first
```bash
tsx scripts/sync-circle-course-to-upstash.ts <courseId>
```

### No course content in chat responses
**Check:**
1. Course was synced: `tsx scripts/list-circle-courses.ts --check-upstash`
2. Persona has correct namespace (should start with `circle-course-`)
3. Upstash environment variables are set

### Want to update course content
**Re-sync:**
```bash
tsx scripts/sync-circle-course-to-upstash.ts <courseId>
```
This overwrites existing data. User personas continue to work.

## File Changes

**New Files:**
- `scripts/sync-circle-course-to-upstash.ts` - Sync script
- `scripts/list-circle-courses.ts` - Management script
- `CIRCLE-COURSE-UPSTASH-GUIDE.md` - Full documentation

**Modified Files:**
- `app/api/circle/activate-course/route.ts` - No longer syncs data
- `lib/ai/persona-rag.ts` - Queries Upstash for circle-course-* namespaces

**Deprecated (still work but not used):**
- `app/api/circle/sync-course/route.ts` - Old sync endpoint
- `app/api/circle/process-embeddings/route.ts` - Old PostgreSQL processor

## Migration from Old System

If you have courses using the old PostgreSQL system:

1. Run sync script for each course:
   ```bash
   tsx scripts/sync-circle-course-to-upstash.ts <courseId>
   ```

2. Update existing personas manually in database:
   ```sql
   UPDATE "Persona"
   SET "knowledgeNamespace" = 'circle-course-{courseId}'
   WHERE id = '<persona-id>';
   ```

3. Test that queries work correctly

4. (Optional) Clean up old PostgreSQL data

## Benefits Summary

| Metric | Old System | New System |
|--------|-----------|------------|
| Sync Time | 1-2 min per user | 1-2 min one-time |
| Activation Time | 1-2 minutes | ~200ms |
| Storage Cost | N × course size | 1 × course size |
| Memory Usage | High (Next.js crash risk) | Low (standalone script) |
| Scalability | Poor (duplicates) | Excellent (shared) |

## Next Steps

1. Sync your first course
2. Test user activation
3. Verify chat responses include course content
4. Sync remaining courses
5. Update any existing personas (if migrating)

For detailed information, see: `CIRCLE-COURSE-UPSTASH-GUIDE.md`
