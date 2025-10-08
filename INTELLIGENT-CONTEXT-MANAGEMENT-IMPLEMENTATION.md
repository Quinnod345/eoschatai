# Intelligent Context Management Implementation

## Overview
Implemented an intelligent document context management system that automatically manages embeddings in the RAG database based on user selection.

## What Was Implemented

### 1. **Database Schema Changes**
Added `isContext` boolean field to both document tables:
- **UserDocuments table**: `isContext` defaults to `true` (user-uploaded documents)
- **Document table**: `isContext` defaults to `false` (AI-generated composer documents)

**Migration file created**: `drizzle/0020_add_is_context_to_documents.sql`

### 2. **API Endpoint: `/api/documents/toggle-context`**
A new POST endpoint that handles toggling context on/off for both user documents and composers:

**Request body:**
```json
{
  "documentId": "uuid",
  "isContext": true,
  "documentType": "user-document" | "composer-document"
}
```

**Behavior:**
- When `isContext` is `true`: Generates embeddings and stores them in the Upstash Vector database (user-specific namespace)
- When `isContext` is `false`: Deletes all embeddings for that document from the vector database
- Provides real-time feedback about the operation status

### 3. **Updated Document Upload**
Modified `/app/api/documents/upload/route.ts` to:
- Accept optional `isContext` parameter (defaults to `true`)
- Only generate embeddings if `isContext` is `true`
- Skip embedding generation for documents marked as non-context

### 4. **Updated Documents API**
Modified `/app/api/documents/route.ts` to:
- Include `isContext` field in response for both user documents and composer documents
- Frontend can now display the current context status

### 5. **Enhanced Document Context Modal UI**
Updated `components/document-context-modal.tsx` with:

**For User Documents:**
- Toggle checkbox that controls `isContext` status
- Real-time embedding management (generates/deletes embeddings on toggle)
- Loading spinner while processing
- Visual indicator (green checkmark) when document is active in RAG database
- Disabled state during toggle operation

**For Composer Documents:**
- Same intelligent toggle functionality as user documents
- Visual feedback showing "Active in RAG database" or "Click to enable as context"
- Processing state with spinner
- Prevents multiple simultaneous toggles

### 6. **Smart Embedding Management**
The system now intelligently manages embeddings:
- ✅ Embeddings are ONLY generated when needed (when `isContext` is true)
- ✅ Embeddings are automatically deleted when documents are removed from context
- ✅ No wasted storage or processing for unused documents
- ✅ Real-time sync between UI state and database state

## To Complete the Setup

You need to run the database migration to add the `isContext` columns. You have two options:

### Option 1: Interactive Drizzle Push (Recommended)
```bash
npx drizzle-kit push
```
When prompted about the `isContext` column in the `Document` table:
- Select **"+ isContext create column"** (option 1)

When prompted about the `isContext` column in the `UserDocuments` table:
- Select **"+ isContext create column"** (option 1)

### Option 2: Manual SQL Execution
Run this SQL directly in your database:

```sql
-- Add isContext to UserDocuments
ALTER TABLE "UserDocuments" ADD COLUMN "isContext" boolean DEFAULT true;

-- Add isContext to Document
ALTER TABLE "Document" ADD COLUMN "isContext" boolean DEFAULT false;
```

## How It Works

### User Workflow:
1. User opens Document Context modal
2. Sees all uploaded documents with toggle switches
3. **Toggle ON**: 
   - Document is marked as `isContext = true` in database
   - Embeddings are generated from document content
   - Embeddings stored in user's namespace in Upstash Vector
   - Green checkmark appears with "Embedded in RAG database" tooltip
4. **Toggle OFF**:
   - Document is marked as `isContext = false` in database
   - All embeddings for that document are deleted from vector database
   - Checkmark disappears
   - Document content remains in database but won't be used for context

### Composer Workflow:
1. User clicks "Choose Composers" in Document Context modal
2. Sees grid of all composer documents with visual cards
3. **Click to Enable**:
   - Composer marked as `isContext = true`
   - Content is chunked and embedded
   - Stored in user's vector namespace
   - Card shows "Active in RAG database"
4. **Click to Disable**:
   - Composer marked as `isContext = false`
   - Embeddings deleted
   - Card returns to default state

## Key Features

✅ **Intelligent**: Only processes what's needed  
✅ **Fast**: Real-time updates with visual feedback  
✅ **Efficient**: Saves storage and processing costs  
✅ **User-Friendly**: Clear visual indicators of status  
✅ **Reliable**: Error handling with user feedback  
✅ **Scalable**: Works with both user documents and AI-generated composers  

## Files Modified

### Core Logic
- `lib/db/schema.ts` - Added `isContext` fields
- `app/api/documents/toggle-context/route.ts` - NEW toggle endpoint
- `app/api/documents/upload/route.ts` - Conditional embedding
- `app/api/documents/route.ts` - Include isContext in responses
- `lib/ai/user-rag.ts` - Existing embedding functions (reused)

### UI Components
- `components/document-context-modal.tsx` - Enhanced with toggles and status indicators

### Database
- `drizzle/0020_add_is_context_to_documents.sql` - Migration file

## Testing the Implementation

After running the migration:

1. **Test User Document Upload:**
   - Upload a document
   - It should automatically have embeddings (isContext = true by default)
   - Toggle it off → embeddings should be deleted
   - Toggle it back on → embeddings should be regenerated

2. **Test Composer Documents:**
   - Create a VTO or Accountability Chart
   - Open Document Context modal → Choose Composers
   - Click a composer card → should show "Processing embeddings..."
   - After completion → should show "Active in RAG database"
   - Click again → embeddings should be removed

3. **Test RAG Context:**
   - Enable a document as context
   - Ask the AI a question related to that document
   - AI should use the document content in its response
   - Disable the document
   - Ask the same question → AI should not have access to that content

## Benefits

1. **Cost Savings**: Only store embeddings for documents actually being used
2. **Performance**: Faster uploads when documents don't need to be embedded immediately
3. **User Control**: Users decide exactly what the AI can access
4. **Flexibility**: Can enable/disable documents without deleting them
5. **Transparency**: Clear visual feedback about what's active in the RAG system

## Notes

- User documents default to `isContext = true` (backward compatible)
- Composer documents default to `isContext = false` (must opt-in)
- All embedding operations use the existing `processUserDocument` and `deleteUserDocument` functions from `lib/ai/user-rag.ts`
- Embeddings are stored in user-specific namespaces in Upstash Vector
- The system gracefully handles errors and provides user feedback via toasts

