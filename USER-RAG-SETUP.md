# User RAG System Setup Guide

This guide explains how to set up and use the new User RAG (Retrieval-Augmented Generation) system that replaces the old document context approach with a more sophisticated RAG-based solution using Upstash Vector namespaces.

## Overview

The User RAG system provides:
- **User-specific namespaces**: Each user's documents are stored in their own Upstash Vector namespace
- **Semantic search**: Documents are chunked and embedded for better retrieval
- **Query-based retrieval**: Only relevant document chunks are included in prompts
- **Better performance**: Reduces prompt size and improves response relevance

## Prerequisites

1. **Upstash Vector Database**: You'll need a second Upstash Vector database for user documents
2. **Environment Variables**: New environment variables for the user RAG database
3. **Existing Setup**: Your current RAG system should be working

## Setup Instructions

### 1. Create a New Upstash Vector Database

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Vector database for user documents
3. Choose the same region as your existing database for better performance
4. Set dimensions to **1536** (for OpenAI text-embedding-ada-002)
5. Choose a similarity function (cosine recommended)

### 2. Environment Variables

Add these new environment variables to your `.env.local`:

```bash
# User RAG Database (separate from your main RAG database)
UPSTASH_USER_RAG_REST_URL=your_user_rag_database_url
UPSTASH_USER_RAG_REST_TOKEN=your_user_rag_database_token

# Keep your existing RAG variables for the main knowledge base
UPSTASH_VECTOR_REST_URL=your_main_rag_database_url
UPSTASH_VECTOR_REST_TOKEN=your_main_rag_database_token
```

### 3. Migration

Run the migration script to move existing user documents to the new RAG system:

```bash
# Migrate all existing user documents
npm run tsx scripts/migrate-to-user-rag.ts migrate

# Test the migration for a specific user
npm run tsx scripts/migrate-to-user-rag.ts test <userId> "my scorecard"

# Check statistics
npm run tsx scripts/migrate-to-user-rag.ts stats
```

## How It Works

### Document Processing

When a user uploads a document:

1. **Chunking**: Document content is split into overlapping chunks (~1000 characters)
2. **Embedding**: Each chunk is converted to a 1536-dimensional vector using OpenAI
3. **Storage**: Vectors are stored in the user's namespace with metadata
4. **Indexing**: Upstash automatically indexes the vectors for fast retrieval

### Query Processing

When a user asks a question:

1. **Query Embedding**: The user's question is converted to a vector
2. **Namespace Search**: Only the user's documents are searched using their namespace
3. **Relevance Filtering**: Only chunks above a relevance threshold are returned
4. **Context Building**: Relevant chunks are formatted and added to the prompt

### Namespace Structure

Each user gets their own namespace identified by their `userId`:

```
Namespace: user-123e4567-e89b-12d3-a456-426614174000
├── document-1-chunk-0
├── document-1-chunk-1
├── document-2-chunk-0
└── ...
```

## API Usage

### Adding Documents

```typescript
import { processUserDocument } from '@/lib/ai/user-rag';

await processUserDocument(
  userId,
  documentId,
  content,
  {
    fileName: 'My Scorecard.pdf',
    category: 'Scorecard',
    fileType: 'pdf'
  }
);
```

### Searching Documents

```typescript
import { findRelevantUserContent } from '@/lib/ai/user-rag';

const results = await findRelevantUserContent(
  userId,
  'What are my quarterly rocks?',
  5, // limit
  0.7 // minimum relevance
);
```

### Using in Prompts

The system automatically includes relevant user documents in prompts:

```typescript
import { systemPrompt } from '@/lib/ai/prompts';

const prompt = await systemPrompt({
  selectedProvider: 'chat-model',
  requestHints: {},
  ragContext: [], // Main knowledge base results
  userId: session.user.id,
  query: userMessage // This triggers user document retrieval
});
```

## Tools Available

### For AI Tools

```typescript
import { userRagTools } from '@/lib/ai/user-rag-tools';

// Add document
await userRagTools.addUserDocument.execute({
  title: 'Q1 Scorecard',
  content: '...',
  category: 'Scorecard'
}, userId);

// Search documents
await userRagTools.getUserDocuments.execute({
  query: 'quarterly rocks',
  limit: 5
}, userId);

// Remove document
await userRagTools.removeUserDocument.execute({
  documentId: 'doc-123'
}, userId);
```

## Benefits Over Old System

### Old Document Context System
- ❌ Included ALL user documents in every prompt
- ❌ Large prompt sizes (could hit token limits)
- ❌ No relevance filtering
- ❌ Poor performance with many documents
- ❌ No semantic search capabilities

### New User RAG System
- ✅ Only includes RELEVANT document chunks
- ✅ Smaller, more focused prompts
- ✅ Semantic search finds the best matches
- ✅ Scales well with document count
- ✅ User-specific namespaces for data isolation
- ✅ Query-based retrieval for better context

## Monitoring and Debugging

### Check User Stats

```bash
npm run tsx scripts/migrate-to-user-rag.ts stats
```

### Test User Queries

```bash
npm run tsx scripts/migrate-to-user-rag.ts test <userId> "your test query"
```

### Debug Logs

The system provides detailed logging:

```
User RAG: Processing document doc-123 for user user-456
User RAG: Generated 5 chunks from document
User RAG: Generated embeddings with dimension 1536
User RAG: Successfully stored batch 1 of 1 in namespace user-456
User RAG: Searching for user user-456 with query: "scorecard"
User RAG: Found 3 results, 2 above threshold (70%) for user user-456
```

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   ```
   Error: Missing UPSTASH_USER_RAG environment variables
   ```
   Solution: Add the new environment variables to `.env.local`

2. **No Results Found**
   ```
   User RAG: No results found for user user-123
   ```
   Solution: Check if documents were migrated, run migration script

3. **Dimension Mismatch**
   ```
   Invalid vector dimension
   ```
   Solution: Ensure your Upstash Vector database is configured for 1536 dimensions

4. **Rate Limiting**
   ```
   Error storing vector batch
   ```
   Solution: The system includes delays, but you may need to increase them for large migrations

### Performance Tips

1. **Relevance Threshold**: Adjust `minRelevance` parameter (0.6-0.8 recommended)
2. **Chunk Size**: Default 1000 characters works well, adjust if needed
3. **Batch Size**: Default 100 vectors per batch, reduce if hitting rate limits
4. **Query Optimization**: More specific queries return better results

## Migration Checklist

- [ ] Create new Upstash Vector database
- [ ] Add environment variables
- [ ] Run migration script
- [ ] Test with sample queries
- [ ] Update application code to use new system
- [ ] Monitor performance and adjust settings
- [ ] Consider removing old document context code

## Next Steps

After successful migration:

1. **Test thoroughly** with various user queries
2. **Monitor performance** and adjust relevance thresholds
3. **Update documentation** for your team
4. **Consider removing** the old `documentContextPrompt` function
5. **Implement user-facing features** like document management UI

## Support

If you encounter issues:

1. Check the logs for detailed error messages
2. Verify environment variables are set correctly
3. Test with the migration script's test command
4. Check Upstash Console for database status
5. Review the relevance scores in debug logs 