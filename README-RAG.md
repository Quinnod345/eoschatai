# RAG Implementation for EOS Chat AI

This document explains how to set up and use the Retrieval-Augmented Generation (RAG) capabilities in the EOS Chat AI application.

## Overview

RAG enhances the AI's responses by retrieving relevant information from a knowledge base before generating a response. This implementation includes:

1. **Vector Database**: Store text chunks and their vector embeddings
2. **Document Processing**: Automatically process and embed documents
3. **Context Retrieval**: Find and use relevant information when answering questions
4. **Tools**: AI tools for retrieving context and indexing documents

## Setup

### 1. Install Dependencies

```bash
npm install pgvector
```

### 2. Configure Database

Run the pgvector migration script to enable vector search:

```bash
npm run db:pgvector
```

This will:
- Enable the pgvector extension in your Postgres database
- Create the required tables for storing embeddings
- Update the database schema

### 3. Index Existing Documents

After setup, you can index existing documents by:

1. Using the chat interface and asking the AI to "index all documents"
2. Manually triggering the indexing through the API

## Usage

### RAG-enabled Chat Endpoint

A new API endpoint is available at `/api/chat-rag` which provides RAG capabilities. To use it:

1. Update your client to send requests to this endpoint
2. Or modify your existing endpoint to incorporate RAG

### Available Tools

The RAG implementation includes several tools:

1. **retrieve_context**: Searches the knowledge base for relevant information
2. **index_documents**: Processes and embeds documents for search
3. **add_to_knowledge**: Adds new information directly to the knowledge base

### Sample Interactions

#### Adding Knowledge

```
User: Remember that the Core Values of EOS are simplicity, clarity, and being purpose-driven.

AI: I've added this information to the knowledge base. Your EOS Core Values are simplicity, clarity, and being purpose-driven.
```

#### Retrieving Knowledge

```
User: What are the Core Values of EOS?

AI: Based on our knowledge base, the Core Values of EOS are simplicity, clarity, and being purpose-driven.
```

## Customization

### Chunking Strategy

You can modify the chunking strategy in `/lib/ai/embeddings.ts` to adjust how documents are split:

- **Size-based chunking**: Current implementation splits by sentences with a maximum size
- **Semantic chunking**: Consider implementing more advanced chunking methods

### Similarity Threshold

The similarity threshold for retrieval is set to 0.7 by default. You can adjust this:

```typescript
// In embeddings.ts
export const findRelevantContent = async (
  query: string,
  similarityThreshold = 0.7, // <-- Adjust this value
  limit = 5
) => {
  // ...
}
```

## Troubleshooting

If you encounter issues:

1. **Database Connection**: Ensure your Postgres database supports pgvector
2. **Embedding Generation**: Check OpenAI API access and rate limits
3. **No Results Found**: Verify documents are properly indexed and the similarity threshold isn't too high

## Architecture

- `/lib/db/schema.ts`: Database schema with embeddings table
- `/lib/ai/embeddings.ts`: Chunking and embedding utilities
- `/lib/ai/tools/retrieve-context.ts`: RAG retrieval tool
- `/lib/ai/tools/index-documents.ts`: Document indexing tool
- `/app/api/chat-rag/route.ts`: Example RAG-enabled API endpoint 