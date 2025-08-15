# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
pnpm dev              # Start development server (port 3000)
pnpm lint             # Run ESLint and Biome linting
pnpm format           # Format code with Biome
```

### Build & Production
```bash
pnpm build            # Run migrations and build Next.js app
pnpm start            # Start production server
```

### Database Operations
```bash
pnpm db:generate      # Generate Drizzle migrations from schema changes
pnpm db:migrate       # Apply database migrations
pnpm db:push          # Push schema changes directly to database
pnpm db:studio        # Open Drizzle Studio for database inspection
pnpm db:pgvector      # Setup pgvector extension for embeddings
```

### Testing
```bash
pnpm test             # Run Playwright E2E tests
```

### Feature Setup
```bash
pnpm redis:setup      # Configure Redis for resumable streams
pnpm upload-docs      # Upload documents to knowledge base
```

## High-Level Architecture

### Technology Stack
- **Framework**: Next.js 15.3 with App Router
- **Database**: PostgreSQL (Neon/Vercel) with Drizzle ORM
- **AI SDK**: Vercel AI SDK supporting OpenAI provider
- **Auth**: Auth.js with Google OAuth and credentials
- **Vector DB**: Upstash Vector for RAG implementation
- **File Storage**: Vercel Blob
- **UI**: shadcn/ui components with Radix UI and Tailwind CSS
- **Animations**: GSAP, Framer Motion, Locomotive Scroll

### Core Architecture Patterns

1. **Chat System Flow**:
   - Entry: `/app/(chat)/api/chat/route.ts` - Main streaming chat endpoint
   - RAG Integration: `/app/api/chat-rag/route.ts` - Enhanced chat with context retrieval
   - Message handling uses Vercel AI SDK's streaming capabilities
   - Support for resumable streams via Redis cache

2. **RAG (Retrieval-Augmented Generation) System**:
   - Document upload → Chunking → Embedding → Storage in Upstash Vector
   - Query → Embedding → Vector search → Context retrieval → Enhanced AI response
   - Fallback to PostgreSQL pgvector if Upstash unavailable
   - Key files: `lib/ai/user-rag.ts`, `lib/ai/embeddings.ts`

3. **Authentication Flow**:
   - Auth.js configuration in `app/(auth)/auth.ts`
   - User types: guest (limited), regular, premium
   - Google OAuth + credentials authentication
   - Session management with JWT

4. **Persona System**:
   - System personas: Pre-configured AI behaviors
   - User personas: Custom personas with document knowledge bases
   - Profile management for different use cases
   - Files: `lib/ai/persona-rag.ts`, `app/api/personas/`

5. **Composer System**:
   - Support for code, text, charts, and spreadsheets
   - Server-side rendering in `/composer/*/server.ts`
   - Client components with enhanced editing capabilities
   - Integration with chat messages for interactive content

6. **Database Schema**:
   - Users, chats, messages, documents, personas, profiles
   - Vector embeddings for semantic search
   - Defined in `lib/db/schema.ts`

### Key Directories
- `/app/(auth)/` - Authentication pages and logic
- `/app/(chat)/` - Main chat interface and API routes
- `/components/` - React components (chat UI, composer, etc.)
- `/lib/ai/` - AI providers, tools, RAG implementation
- `/lib/db/` - Database schema and queries
- `/composer/` - Composer rendering components
- `/hooks/` - Custom React hooks for chat, shortcuts, etc.

### Environment Variables Required
- `AUTH_SECRET` - Authentication secret
- `OPENAI_API_KEY` - OpenAI API key
- `POSTGRES_URL` - Database connection
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage
- `UPSTASH_VECTOR_REST_URL` & `UPSTASH_VECTOR_REST_TOKEN` - Vector database
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - Google OAuth
- `REDIS_URL` (optional) - For resumable streams

### Important Patterns
- All chat routes use streaming responses
- Vector embeddings use 1536 dimensions (OpenAI standard)
- Database migrations must be run before deployment
- Guest users have limited message counts
- Document processing happens asynchronously
- UI animations are performance-optimized with lazy loading