# Complete Guide to RAG in EOS Chat AI

This comprehensive guide will walk you through all aspects of the Retrieval-Augmented Generation (RAG) system implemented in EOS Chat AI, from theory to practical implementation.

## Table of Contents
1. [What is RAG?](#what-is-rag)
2. [Setup Instructions](#setup-instructions)
3. [How the RAG System Works](#how-the-rag-system-works)
4. [Using the RAG System](#using-the-rag-system)
5. [Advanced Customization](#advanced-customization)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)

## What is RAG?

Retrieval-Augmented Generation (RAG) is an AI framework that enhances Large Language Models (LLMs) by retrieving relevant information from a knowledge base before generating responses. This approach offers several advantages:

- **Factual Accuracy**: Grounds responses in verified information
- **Up-to-date Knowledge**: Access to information beyond the model's training data
- **Domain Specificity**: Tailors responses to your organization's specific needs
- **Reduced Hallucinations**: Decreases instances of fabricated information

In EOS Chat AI, RAG allows the AI to specifically reference EOS concepts, tools, methodologies, and company-specific information when responding to user queries.

## Setup Instructions

### Prerequisites

- PostgreSQL database with pgvector extension
- OpenAI API key
- Node.js environment running the EOS Chat AI application

### Step 1: Install the pgvector Package

```bash
pnpm add pgvector
```

### Step 2: Configure Environment Variables

Create a `.env` file with:

```
DATABASE_URL="postgres://username:password@localhost:5432/eoschatai"
OPENAI_API_KEY="your-openai-api-key"
```

### Step 3: Run Database Migrations

```bash
pnpm run db:pgvector
```

### Step 4: Index Documents

Through the chat interface, ask:
```
Please index all documents in the knowledge base
```

Or using the API endpoint directly:
```bash
curl -X POST http://localhost:3000/api/chat-rag \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Please index all documents in the knowledge base"}]}'
```

## How the RAG System Works

The RAG system in EOS Chat AI follows this pipeline:

1. **Document Processing**: Text documents are chunked into smaller segments
2. **Embedding Generation**: Each chunk is converted into a vector embedding using OpenAI's embedding model
3. **Storage**: Embeddings are stored in a PostgreSQL database with pgvector extension
4. **Query Processing**: User queries are also converted to embeddings
5. **Similarity Search**: The system finds document chunks most similar to the query
6. **Context Augmentation**: Retrieved information is included in the AI's prompt
7. **Response Generation**: The AI generates a response using both the retrieved context and its own knowledge

### Key Components

- **embeddings.ts**: Contains the chunking and embedding logic
- **retrieve-context.ts**: Tool for finding relevant information
- **index-documents.ts**: Tool for processing and embedding documents
- **prompts.ts**: Contains the RAG context integration with prompts

## Using the RAG System

### Adding Knowledge

You can add information to the knowledge base in two ways:

1. **Document Creation**: Use the existing document creation interface to add text documents
2. **Inline Knowledge**: Tell the AI to remember information within a conversation

Example:
```
User: Remember that the Core Values of EOS are simplicity, clarity, and being purpose-driven.

AI: I've added this information to the knowledge base. Your EOS Core Values are simplicity, clarity, and being purpose-driven.
```

### Retrieving Knowledge

When you ask a question, the RAG system automatically retrieves relevant information:

```
User: What are the Core Values of EOS?

AI: Based on our knowledge base, the Core Values of EOS are simplicity, clarity, and being purpose-driven.
```

### Integrating with Existing UI

To use the RAG-enabled chat in your frontend components:

```jsx
import { useChat } from '@ai-sdk/react';

function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat-rag', // Point to the RAG-enabled endpoint
  });
  
  // Rest of your component...
}
```

## Advanced Customization

### Chunking Strategy

The current implementation chunks documents by sentences with a maximum size limit. You can customize this in `embeddings.ts`:

```typescript
export const generateChunks = (
  content: string,
  maxChunkSize = 512, // Adjust this value as needed
): string[] => {
  // Consider implementing more sophisticated chunking strategies:
  // - Paragraph-based chunking
  // - Semantic chunking with overlapping text
  // - Fixed-size chunking with overlap
  
  // Current implementation (sentence-based):
  const sentences = content.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= maxChunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
};
```

### Similarity Search Configuration

You can adjust the similarity threshold and limit in `embeddings.ts`:

```typescript
export const findRelevantContent = async (
  query: string,
  similarityThreshold = 0.7, // Adjust this value as needed
  limit = 5                   // Adjust this value as needed
): Promise<{ chunk: string; similarity: number }[]> => {
  // ...implementation
};
```

### Embedding Models

The current implementation uses OpenAI's `text-embedding-ada-002` model. You can switch to a different embedding model:

```typescript
// In embeddings.ts
// const embeddingModel = openai.embedding('text-embedding-ada-002');
const embeddingModel = openai.embedding('text-embedding-3-small'); // Newer, more efficient model
```

## API Reference

### `/api/chat-rag` Endpoint

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "What are the Core Values of EOS?"
    }
  ],
  "chatId": "optional-chat-id"
}
```

**Response:**
A streaming response with AI-generated content based on retrieved context.

### RAG Tools

#### `retrieve_context`
Searches for relevant information in the knowledge base.

```typescript
{
  name: 'retrieve_context',
  parameters: {
    query: string // The query to search for
  },
  returns: {
    found: boolean,
    message: string,
    context: Array<{ content: string, relevance: number }>
  }
}
```

#### `add_to_knowledge`
Adds new information to the knowledge base.

```typescript
{
  name: 'add_to_knowledge',
  parameters: {
    content: string // The content to add
  },
  returns: string // Status message
}
```

#### `index_documents`
Processes and indexes documents.

```typescript
{
  name: 'index_documents',
  parameters: {
    documentId?: string // Optional specific document ID
    reindex: boolean    // Whether to reindex existing documents
  },
  returns: {
    success: boolean,
    message: string,
    indexed: number,
    skipped: number
  }
}
```

## Troubleshooting

### "No relevant information found"

If the system isn't finding relevant information:

1. **Check Indexing**: Ensure documents are properly indexed
2. **Adjust Similarity Threshold**: Lower the threshold (e.g., from 0.7 to 0.6) to return more matches
3. **Review Query Phrasing**: Try rewording your question to match document terminology

### Performance Issues

If vector searches are slow:

1. **Optimize Index**: Check PostgreSQL's HNSW index settings
2. **Limit Results**: Reduce the `limit` parameter in the `findRelevantContent` function
3. **Monitor Database**: Check for database performance bottlenecks

### Embedding Errors

If you encounter errors with embedding generation:

1. **API Key**: Verify your OpenAI API key is valid and has sufficient quota
2. **Model Availability**: Ensure the embedding model is available for your account
3. **Rate Limits**: Implement rate limiting and retries for embedding generation

## Further Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Vercel AI SDK](https://sdk.vercel.ai/docs) 