# Circle.so Course Assistants Setup Guide

This guide explains how to set up and configure the Circle.so course assistant integration for EOS Academy.

## Overview

The Circle.so Course Assistants feature allows you to create AI-powered course assistants for your EOS Academy courses hosted on Circle.so. When implementers or clients click a link in a Circle course, they're redirected to EOSAI where a course-specific persona is activated with all course content automatically synced.

## Environment Variables

Add the following environment variables to your `.env.local` file:

### Required Variables

```env
# Circle.so API Configuration
CIRCLE_API_TOKEN=your_admin_api_token_here
CIRCLE_HEADLESS_AUTH_TOKEN=your_headless_auth_token_here
```

**CIRCLE_API_TOKEN**: Your Circle.so **Admin API** token for managing space groups and community data:
1. Go to **Settings** > **Developers** > **Tokens**
2. Create a new token with type **"Admin API"**
3. Copy the token value

**CIRCLE_HEADLESS_AUTH_TOKEN**: Your Circle.so **Headless Auth** token for fetching post content:
1. Go to **Settings** > **Developers** > **Tokens**
2. Create a new token with type **"Headless Auth"**
3. Copy the token value

**Note**: You need BOTH tokens - the Admin API token for space group management and the Headless Auth token for accessing post content.

### Optional Variables

```env
# Circle.so Space ID (optional - can be provided per-link)
CIRCLE_SPACE_ID=your_default_space_id

# Circle.so API Base URL (optional - defaults to https://app.circle.so/api/v1)
CIRCLE_API_BASE_URL=https://app.circle.so/api/v1
```

**CIRCLE_SPACE_ID**: Your default Circle.so space ID. This can be overridden on a per-course basis via URL parameters, but setting a default simplifies your course links. The space ID is the numeric ID visible in your Circle admin URL.

**CIRCLE_API_BASE_URL**: The base URL for the Circle.so Admin API. The default is `https://app.circle.so/api/v1`. Only change this if you're using a custom Circle.so instance or testing environment.

## Getting Your Circle.so API Token

1. Log in to your Circle.so admin dashboard
2. Navigate to **Settings** > **Developers** > **Tokens**
3. Click **Create New Token**
4. Set the token type to **"Admin API"** (NOT "Headless Auth")
5. Copy the generated token and add it to your `.env.local` file

**Important**: The token type must be "Admin API" to access course/space group data. Headless Auth tokens are only for member-facing features.

## Getting Your Space ID

Your Space ID is the numeric ID of your Circle community:

1. Log in to your Circle.so admin dashboard
2. Look at the URL: `https://app.circle.so/c/{SPACE_ID}/home`
3. The number in the URL is your space ID (e.g., `2310423`)
4. Alternatively, in the terminal, run:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_TOKEN" \
        https://app.circle.so/api/v1/me
   ```
   This will return your community info including the space ID

## Getting Course IDs (Space Group IDs)

In Circle.so, courses are called "Space Groups". To get the ID of a course/space group:

**Method 1: Via Admin UI**
1. Go to your Circle community
2. Navigate to the course/space group
3. Look at the URL: `https://app.circle.so/c/{SPACE_ID}/space-group/{COURSE_ID}`
4. The `COURSE_ID` is the numeric ID you need

**Method 2: Via API**
```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     https://app.circle.so/api/v1/space_groups?per_page=100
```

This will list all your courses/space groups with their IDs and names.

## Database Migration

Before using course assistants, you need to apply the database migration:

```bash
# Apply the Circle.so course assistant migration
pnpm db:migrate
```

This creates the `CircleCoursePersona` table that tracks course-to-persona mappings.

## Creating Course Assistant Links

### Link Format

Course assistant links follow this pattern:

```
https://your-eosai-domain.com/academy/course/{COURSE_ID}?spaceId={SPACE_ID}&audience={AUDIENCE}
```

**Parameters:**
- `{COURSE_ID}` - The Circle.so course ID (required)
- `{SPACE_ID}` - The Circle.so space ID (optional if `CIRCLE_SPACE_ID` env var is set)
- `{AUDIENCE}` - Target audience: `implementer` or `client` (optional, defaults to `implementer`)

### Example Links

**For Implementers:**
```
https://eosai.com/academy/course/focus-day-101?audience=implementer
```

**For Clients:**
```
https://eosai.com/academy/course/vision-building?audience=client
```

**With Custom Space ID:**
```
https://eosai.com/academy/course/scorecard-mastery?spaceId=abc123&audience=implementer
```

## Embedding Links in Circle.so

### In Course Descriptions

Add the activation link to your course description or welcome message:

```html
<p>Access your AI Course Assistant: <a href="https://eosai.com/academy/course/your-course-id?audience=implementer" target="_blank">Launch Assistant</a></p>
```

### In Lesson Content

Add assistant links to specific lessons:

```html
<p>Have questions about this lesson? <a href="https://eosai.com/academy/course/your-course-id?audience=client" target="_blank">Ask the Course Assistant</a></p>
```

### As Course Actions/Buttons

Use Circle.so's custom buttons feature to add a prominent "Course Assistant" button.

## How It Works

### First-Time Activation

1. User clicks the course assistant link in Circle.so
2. User is redirected to EOSAI (login required)
3. System creates a new course-specific persona
4. System fetches all course content from Circle.so API
5. Content is processed and embedded in the persona's RAG namespace
6. Activation modal displays with course information
7. User can start chatting with the course assistant

### Subsequent Activations

1. User clicks the course assistant link
2. System detects existing course persona
3. Activation modal displays immediately (no re-sync needed)
4. User can start chatting with the course assistant

### Content Sync

The initial sync typically takes 30-60 seconds depending on course size:

1. **Overview Document**: Course description and summary
2. **Lesson Documents**: Each lesson is converted to a separate document
3. **Vector Embeddings**: All content is chunked and embedded for semantic search
4. **Persona Namespace**: Content is isolated in the course persona's namespace (e.g., `circle-course-907974`)

### What Gets Fetched

**For Course-Type Spaces** (like your Pasta course):
- ✅ ALL sections in the course
- ✅ ALL lessons in each section
- ✅ Full lesson content from `rich_text_body.circle_ios_fallback_text`
- ✅ Lesson names, descriptions, and order
- ✅ Handles pagination automatically

**For Regular Discussion Spaces**:
- ✅ ALL posts in the space
- ✅ Post titles and full body content
- ✅ Pinned posts (prioritized first)
- ✅ Handles pagination automatically

**Example for Your Pasta Course:**
- Document 1: "Test - Overview" (course description)
- Document 2: "Test - Lesson 1: Tomato garlic pasta" (full recipe, ~1893 characters)
- Each document is chunked, embedded, and searchable

### User Subscriptions

Course personas are **shared system resources**:
- ✅ One persona serves all users (efficient)
- ✅ Users "subscribe" to see it in their persona list
- ✅ Users can remove it from their list (deactivates subscription)
- ✅ Persona and content remain for other users
- ✅ User can re-activate anytime by clicking the course link again

## Persona Instructions & Prioritization

Each course assistant uses specialized instructions based on:

1. **Course Type**: Different templates for Focus Day, Vision Building, Scorecard, Meetings, etc.
2. **Target Audience**: Separate instructions for implementers vs. clients
3. **Course Content**: Trained on all synced course materials

### Template Matching

The system automatically selects the appropriate template based on course name:

- **Focus Day** courses → Focus Day template
- **Vision Building** courses → Vision Building template
- **Scorecard/Data** courses → Data Component template
- **Meeting/Level 10** courses → Meeting Pulse template
- **Other** courses → Default EOS template

### Content Prioritization in Chat

When a user asks a question, the AI retrieves context in this priority order:

1. **Priority 1: System Knowledge** - Course assistant instructions and framework
2. **Priority 2: User Memories** - Facts the user asked to remember
3. **Priority 3: Persona Documents** 🔥 **YOUR COURSE CONTENT** 🔥
   - Retrieves up to 14 relevant chunks
   - Uses semantic search with 0.5 threshold (high recall)
   - Isolated in course persona namespace
   - **EXPLICITLY PRIORITIZED** over user documents
4. **Priority 4: Conversation Summary** - Previous chat context
5. **Priority 5: User Documents** - User's uploaded files
6. **Priority 6: Company Context** - User's company info

**The AI is explicitly instructed:**
> "HIGHEST PRIORITY: When persona documents are present, they take PRECEDENCE over both general user documents and company knowledge. Use this specialized content to demonstrate the persona's deep expertise in their domain."

This ensures course content is ALWAYS prioritized when answering questions!

## Removing Course Assistants

Users can remove course assistants from their persona list:

1. **Via Personas Dropdown**: Click the delete/trash icon on a course persona
2. **What Happens**:
   - Your subscription is deactivated (you won't see it anymore)
   - The persona and its content remain in the system
   - Other users are not affected
   - You can re-activate anytime by clicking the course link again

**Note**: Course personas are **never fully deleted** - they're shared resources. When you "delete" one, you're just unsubscribing from it.

## Testing Your Setup

### Test API Connection

Create a test script to verify your Circle.so API connection:

```javascript
// test-circle-connection.mjs
import { testCircleConnection } from './lib/integrations/circle.ts';

const result = await testCircleConnection();
console.log('Circle.so connection:', result ? 'SUCCESS' : 'FAILED');
```

Run with: `node test-circle-connection.mjs`

### Test Course Activation

1. Create a test course in Circle.so (or use an existing one)
2. Get the course ID from the Circle.so admin panel
3. Generate a test link: `https://your-domain.com/academy/course/{TEST_COURSE_ID}?audience=implementer`
4. Click the link while logged in to EOSAI
5. Verify the activation modal appears
6. Wait for sync to complete
7. Start a chat and ask questions about the course content

## Troubleshooting

### "CIRCLE_API_TOKEN environment variable is not set"

Make sure you've added `CIRCLE_API_TOKEN` to your `.env.local` file and restarted your development server.

### "Failed to fetch course details from Circle.so"

1. Verify your API token is valid and active
2. Check that the course ID and space ID are correct
3. Ensure the course exists and is accessible via the API
4. Check Circle.so API status and rate limits

### Sync Status Stuck on "Pending" or "Syncing"

1. Check server logs for sync errors
2. Verify the Circle.so API is responding correctly
3. Check that document processing is working (vector DB connectivity)
4. Manually trigger sync via: `POST /api/circle/sync-course`

### Course Assistant Not Appearing in Personas List

Course assistants are system personas and should appear in the personas dropdown for all users. If not:

1. Check that `isSystemPersona` is set to `true` in the database
2. Verify the persona was created successfully
3. Clear browser cache and refresh the personas list

## API Endpoints

### Activation Endpoint

```
GET /api/circle/activate-course?courseId={ID}&spaceId={SPACE_ID}&audience={AUDIENCE}
```

Creates or retrieves course persona and triggers content sync.

### Sync Endpoint

```
POST /api/circle/sync-course
Body: { courseId, spaceId, personaId }
```

Manually trigger course content sync.

### Sync Status Endpoint

```
GET /api/circle/sync-course?courseId={ID}
```

Check the current sync status of a course.

## Best Practices

### Course Content Structure

For best results, structure your Circle.so courses with:

1. Clear, descriptive lesson titles
2. Well-organized content with headings
3. Comprehensive lesson descriptions
4. Consistent formatting across lessons

### Link Placement

- Add assistant links to course welcome messages
- Include links in complex lessons where students may need help
- Add to course completion pages for ongoing support

### Audience Segmentation

- Use `audience=implementer` for implementer training courses
- Use `audience=client` for client-facing courses
- Create separate links if the same course serves both audiences

### Content Updates

When you update course content in Circle.so:

1. The assistant will use the originally synced content
2. To update, manually trigger a re-sync via the API
3. Future enhancement: Automatic periodic re-sync

## Security Considerations

### API Token Protection

- Never commit your `CIRCLE_API_TOKEN` to version control
- Use environment variables for all sensitive credentials
- Rotate API tokens periodically

### Authentication

- Course activation pages require EOSAI authentication
- Circle.so API calls are made server-side only
- User-specific access controls can be added in future versions

## Future Enhancements

Potential improvements for future iterations:

1. **SSO Integration**: Full Circle.so SSO for seamless authentication
2. **Automatic Re-sync**: Periodic updates when course content changes
3. **Admin Dashboard**: Manage course assistants, view sync logs, manual sync triggers
4. **Course Analytics**: Track assistant usage, popular questions, engagement metrics
5. **Multi-Language Support**: Course assistants in different languages
6. **Custom Instructions**: Allow course creators to customize assistant behavior
7. **Advanced RAG**: Course-specific prompts, document prioritization, citation links

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review server logs for detailed error messages
3. Test API connectivity with the test script
4. Contact EOS AI support with:
   - Course ID and space ID
   - Error messages from browser console
   - Screenshots of the issue
   - Server logs if available


