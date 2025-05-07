# RAG Setup Guide for EOS Chat AI

This guide will walk you through setting up the Retrieval-Augmented Generation (RAG) system for EOS Chat AI.

## 1. Environment Configuration

Create a `.env` file in the project root with the following variables:

```
# Database connection
DATABASE_URL="postgres://username:password@localhost:5432/eoschatai"

# OpenAI API Key (required for embeddings)
OPENAI_API_KEY="your-openai-api-key"
```

Replace the placeholder values:
- `username`: Your PostgreSQL username
- `password`: Your PostgreSQL password
- `your-openai-api-key`: Your OpenAI API key from [platform.openai.com](https://platform.openai.com)

## 2. Database Setup

### Set up a PostgreSQL database with pgvector support

You have several options:

#### Option A: Local PostgreSQL with pgvector

1. Install PostgreSQL 14+ on your system
2. Install the pgvector extension:
   ```bash
   psql -d yourdb -c "CREATE EXTENSION vector;"
   ```

#### Option B: Vercel Postgres (requires Vercel account)

1. Create a new Postgres database from the Vercel dashboard
2. Connect it to your project
3. Vercel Postgres natively supports pgvector extensions

#### Option C: Supabase or Neon with pgvector

Both Supabase and Neon provide PostgreSQL with pgvector extension enabled.

## 3. Run Migrations

After setting up your database and configuring the environment variables, run:

```bash
pnpm run db:pgvector
```

This will:
- Enable the pgvector extension in PostgreSQL
- Create the embeddings table in your database

## 4. Index Existing Documents

After successful migration, you need to index your existing documents:

### Using the Chat Interface:
Simply ask the AI: "Please index all documents in the knowledge base"

### Using the API:
Send a POST request to `/api/chat-rag` with the following payload:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Please index all documents in the knowledge base"
    }
  ]
}
```

## 5. Testing the RAG System

Test if RAG is working properly:

1. Add knowledge through chat: "Remember that the Core Values of EOS are simplicity, clarity, and being purpose-driven."
2. Query the knowledge: "What are the Core Values of EOS?"

## 6. Integration with Existing Chat

To use RAG in your existing chat interface, update your frontend code to use the `/api/chat-rag` endpoint instead of the regular chat endpoint.

## Troubleshooting

### Connection Issues
- Verify your PostgreSQL connection details in the `.env` file
- Ensure your database server is running and accessible

### pgvector Extension
- Confirm the pgvector extension is properly installed
- Check PostgreSQL version (should be 14+)

### OpenAI API Issues
- Verify your OpenAI API key is valid and has sufficient quota
- Check for any rate limiting or error messages

### Embedding Generation
- If embeddings aren't being created, check OpenAI API logs
- Verify the models used for embeddings are available on your account 