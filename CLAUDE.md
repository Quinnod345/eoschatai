# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
pnpm dev              # Start development server with Turbopack (port 3000)
pnpm lint             # Run ESLint and Biome linting
pnpm lint:fix         # Auto-fix lint issues
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
pnpm db:migrate       # Apply database migrations (npx tsx lib/db/migrate.ts)
pnpm db:push          # Push schema changes directly to database (--accept-data-loss flag)
pnpm db:studio        # Open Drizzle Studio for database inspection
pnpm db:pgvector      # Setup pgvector extension for embeddings
pnpm db:pull          # Pull schema from database
pnpm db:check         # Check migration status
```

### Testing
```bash
pnpm test             # Run Playwright E2E tests
pnpm test:unit        # Run Vitest unit tests
```

### Feature Setup & Utilities
```bash
pnpm redis:setup      # Configure Redis for resumable streams
pnpm redis:test       # Test Redis connection
pnpm upload-docs      # Upload documents to knowledge base
pnpm upload-knowledge # Upload system knowledge
pnpm seed:autocomplete # Seed autocomplete data
pnpm reset-vector     # Reset vector store
```

## High-Level Architecture

### Technology Stack
- **Framework**: Next.js 15.5.9 with App Router and React 19 RC
- **Database**: PostgreSQL (Neon/Vercel) with Drizzle ORM 0.34
- **AI SDK**: Vercel AI SDK 6.0 (`ai` package) with OpenAI and Anthropic providers
- **Auth**: Auth.js 5.0 beta (next-auth) with Google OAuth and credentials
- **Vector DB**: Upstash Vector for RAG + PostgreSQL pgvector fallback
- **File Storage**: Vercel Blob + AWS S3 client
- **UI**: shadcn/ui components with Radix UI and Tailwind CSS 3.4
- **Animations**: GSAP 3.13, Framer Motion 11, Motion 12
- **State Management**: Zustand 5.0 for global state
- **Streaming**: Redis for resumable streams with `resumable-stream` package
- **Payments**: Stripe for billing and subscriptions
- **Monitoring**: Sentry for error tracking

### Core Architecture Patterns

1. **Chat System Flow**:
   - Entry: `/app/api/chat/route.ts` - Main streaming chat endpoint (156KB+)
   - Uses Vercel AI SDK's `streamText` and `createUIMessageStream` for streaming
   - Support for resumable streams via Redis + `resumable-stream` package
   - Background conversation summaries via `triggerBackgroundSummary`
   - Message versioning with `Message_v2` table (parts-based format)

2. **RAG (Retrieval-Augmented Generation) System**:
   - Document upload → Chunking → Embedding → Storage in Upstash Vector
   - Query → Embedding → Vector search → Context retrieval → Enhanced AI response
   - Fallback to PostgreSQL pgvector if Upstash unavailable
   - Key files: `lib/ai/user-rag.ts`, `lib/ai/embeddings.ts`, `lib/ai/persona-rag.ts`
   - System RAG: `lib/ai/system-rag.ts`, `lib/ai/upstash-system-rag.ts`
   - Memory RAG: `lib/ai/memory-rag.ts` for conversation memory

3. **Authentication Flow**:
   - Auth.js configuration in `app/(auth)/auth.ts`
   - User types: guest (limited), free, pro, business (plan_type enum)
   - Google OAuth + credentials authentication
   - Session management with JWT
   - Guest auth endpoint: `/app/(auth)/api/auth/guest/route.ts`

4. **Persona System**:
   - System personas: Pre-configured AI behaviors
   - User personas: Custom personas with document knowledge bases
   - Profile management for different use cases
   - Course personas with templates: `lib/ai/course-persona-templates.ts`
   - Files: `lib/ai/persona-rag.ts`, `app/api/personas/`

5. **Composer System**:
   - Support for: code, text, charts, spreadsheets, images, VTO, accountability
   - Server-side rendering in `/composer/*/server.ts`
   - Client components with enhanced editing capabilities
   - Document history with undo/redo support
   - Actions defined in `composer/actions.ts`

6. **Mentions System**:
   - Smart mention detection: `lib/ai/smart-mention-detector.ts`
   - Mention processing: `lib/ai/mention-processor.ts`
   - Composer document fetching: `lib/mentions/composer-fetcher.ts`
   - Types and service: `lib/mentions/types.ts`, `lib/mentions/service.ts`

7. **Entitlements & Billing**:
   - Feature gating in `lib/entitlements/` (index, types, constants)
   - Plan types: free, pro, business
   - Usage counters and limits per user/org
   - Stripe integration for subscriptions
   - Organization billing with seat management

8. **Organization System**:
   - Multi-tenant support with orgs table
   - Invite codes: `lib/organizations/invite-codes.ts`
   - Permissions: `lib/organizations/permissions.ts`
   - Seat enforcement: `lib/organizations/seat-enforcement.ts`
   - Member removal: `lib/organizations/member-removal.ts`

9. **Database Schema** (`lib/db/schema.ts`):
   - Core: `User`, `Org`, `Chat`, `Message_v2` (parts-based)
   - Documents: user documents, composer documents with history
   - Personas: personas, persona profiles
   - Features: bookmarks, pins, votes, message edit history
   - Vector embeddings for semantic search
   - Storage tracking per user

### Key Directories
- `/app/(auth)/` - Authentication pages and auth.ts configuration
- `/app/(chat)/` - Main chat interface, suggestions, history, voting APIs
- `/app/api/` - API endpoints (chat, documents, billing, organizations, calendar)
- `/app/api/chat/route.ts` - Main chat streaming endpoint
- `/components/` - React components (multimodal-input, sidebar, modals)
- `/lib/ai/` - AI providers, RAG systems, embeddings, tools, prompts
- `/lib/db/` - Schema definition (`schema.ts`), migrations, queries (Drizzle ORM)
- `/lib/stores/` - Zustand stores (settings, account, upgrade, saved-content)
- `/lib/organizations/` - Organization management, permissions, billing
- `/lib/entitlements/` - Feature access, usage limits, premium gating
- `/lib/mentions/` - Mention detection and processing
- `/lib/stream/` - Stream buffer service for resumable streams
- `/composer/` - Composer rendering (code, text, chart, sheet, image, vto, accountability)
- `/hooks/` - Custom hooks (chat, personas, documents, shortcuts, features)
- `/drizzle/` - Database migrations and schema files
- `/scripts/` - Utility scripts for migrations, seeding, setup

### Environment Variables Required
- `AUTH_SECRET` - Authentication secret
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key (for Claude models)
- `POSTGRES_URL` - Database connection
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage
- `UPSTASH_VECTOR_REST_URL` & `UPSTASH_VECTOR_REST_TOKEN` - Vector database
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - Google OAuth
- `REDIS_URL` (optional) - For resumable streams
- `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET` - Stripe billing
- `SENTRY_DSN` - Error tracking (optional)

### Important Patterns
- All chat routes use streaming responses via Vercel AI SDK 6.0
- Vector embeddings use 1536 dimensions (OpenAI text-embedding-3-small)
- Database migrations must be run before deployment (auto-migrate in build)
- Guest users have limited message counts (tracked in user settings)
- Document processing happens asynchronously with progress tracking
- UI animations are performance-optimized with lazy loading
- Authentication uses JWT sessions with Auth.js
- File uploads limited to 50MB for PDFs, configurable for others
- Premium features gated by entitlements system in `lib/entitlements/`
- Organization support with Stripe billing integration
- Message format uses parts-based structure (`Message_v2` table)
- Resumable streams require Redis connection
- Background summaries triggered after conversations for memory
- Smart mention detection for @ mentions in chat input

### AI Tools Available
Located in `lib/ai/tools/` and `lib/ai/tools.ts`:
- `createDocument` - Create new documents/artifacts
- `updateDocument` - Update existing documents
- `requestSuggestions` - Get AI suggestions
- `getWeather` - Weather information
- `searchWeb` - Web search with citations
- `addResourceTool` - Add resources to knowledge base
- `getInformationTool` - Retrieve information from RAG
- `getCalendarEventsTool` - Google Calendar integration
- `createCalendarEventTool` - Create calendar events
