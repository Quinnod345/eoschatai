# RAG System Flow Diagram for EOS Chat AI

## Overview

This document provides a comprehensive breakdown of how the Retrieval-Augmented Generation (RAG) system works with personas and EOS Implementer profiles in the EOS Chat AI application.

## 🔄 Complete RAG Flow Funnel

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER MESSAGE                              │
│                   "What is my Core Process?"                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CHAT ROUTE PROCESSING                         │
│                  /app/(chat)/api/chat/route.ts                   │
│                                                                  │
│  1. Extract query text from message                              │
│  2. Check selectedPersonaId and selectedProfileId                │
│  3. Initiate parallel RAG operations                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PARALLEL RAG EXECUTION                          │
│                    (All run simultaneously)                      │
├─────────────────────────┴────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │  Company RAG     │  │   User RAG       │  │  Persona RAG   ││
│  │                  │  │                  │  │                ││
│  │ findRelevant     │  │ userRagContext   │  │ personaRag     ││
│  │ Content()        │  │ Prompt()         │  │ ContextPrompt()││
│  │                  │  │                  │  │                ││
│  │ Vector search    │  │ User's uploaded  │  │ Persona's      ││
│  │ in company KB    │  │ documents        │  │ documents      ││
│  └──────────────────┘  └──────────────────┘  └────────────────┘│
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    System RAG                             │  │
│  │                                                           │  │
│  │  systemRagContextPrompt()                                 │  │
│  │                                                           │  │
│  │  1. Check if persona is system persona                    │  │
│  │  2. If yes, retrieve from Upstash namespaces              │  │
│  │  3. Use hierarchical search with profile fallback         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SYSTEM PROMPT ASSEMBLY                         │
│                      lib/ai/prompts.ts                           │
│                                                                  │
│  systemPrompt({                                                  │
│    ragContext,        // Company knowledge                       │
│    userRagContext,    // User documents                          │
│    personaRagContext, // Persona documents                       │
│    systemRagContext,  // System knowledge                        │
│    selectedPersonaId,                                            │
│    selectedProfileId                                             │
│  })                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DOCUMENT PRIORITIZATION                         │
│                                                                  │
│  Priority Order:                                                 │
│  1. System Knowledge (if system persona/profile selected)        │
│  2. Persona Documents (if user persona selected)                 │
│  3. User Documents                                               │
│  4. Company Knowledge Base                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI MODEL RESPONSE                             │
│                                                                  │
│  The AI uses the prioritized context to generate a response      │
│  that incorporates the most relevant information                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Detailed Component Breakdown

### 1. System RAG Component (`lib/ai/system-rag.ts`)

```typescript
systemRagContextPrompt(personaId, profileId, query)
```

**Purpose**: Retrieves knowledge from Upstash vector database for system personas

**Process**:
1. **Namespace Determination**:
   - Base namespace: `eos-implementer`
   - Profile namespace: `eos-implementer-{profile-name}`
   
2. **Hierarchical Search**:
   ```
   IF profile is selected:
     1. Search in profile namespace first
     2. If < 3 results, search in base namespace
     3. Combine results (max 5 total)
   ELSE:
     Search only in base namespace
   ```

3. **Vector Search Parameters**:
   - Top K: 5 results
   - Include metadata: true
   - Include vectors: false

### 2. EOS Implementer Profiles & Namespaces

```
EOS Implementer Persona
├── General (eos-implementer)
├── Vision Building Day 1 (eos-implementer-vision-day-1)
├── Vision Building Day 2 (eos-implementer-vision-day-2)
├── Quarterly Planning (eos-implementer-quarterly-planning)
├── Level 10 Meeting (eos-implementer-level-10)
├── IDS Process (eos-implementer-ids)
└── Annual Planning (eos-implementer-annual-planning)
```

### 3. Document Upload Process

```
eos-implementer-documents/
├── general/              → eos-implementer
├── vision-day-1/         → eos-implementer-vision-day-1
├── vision-day-2/         → eos-implementer-vision-day-2
├── quarterly-planning/   → eos-implementer-quarterly-planning
├── level-10/             → eos-implementer-level-10
├── ids/                  → eos-implementer-ids
└── annual-planning/      → eos-implementer-annual-planning
```

**Upload Script** (`scripts/upload-user-documents.ts`):
1. Reads files from profile directories
2. Chunks content (1000 chars, 200 overlap)
3. Generates embeddings via OpenAI
4. Stores in Upstash with metadata

### 4. RAG Context Integration

**System Prompt Structure**:
```
1. Base EOS Knowledge
2. Persona Instructions (if selected)
3. Profile Instructions (if selected)
4. System Knowledge Context (if system persona)
5. Persona Document Context (if user persona)
6. User Document Context
7. Company Knowledge Base
```

## 🔍 Example Query Flow

**User Query**: "Help me prepare for our Quarterly Session"
**Selected Persona**: EOS Implementer
**Selected Profile**: Quarterly Planning

```
1. Query Processing:
   - Extract: "Help me prepare for our Quarterly Session"
   - Persona ID: eos-implementer-id
   - Profile ID: quarterly-planning-id

2. Parallel RAG Calls:
   - Company RAG: Searches general EOS knowledge
   - User RAG: Searches user's uploaded documents
   - Persona RAG: (skipped - system persona)
   - System RAG: Searches eos-implementer-quarterly-planning namespace

3. System RAG Detail:
   - Primary search: eos-implementer-quarterly-planning
   - Finds: Quarterly planning templates, agendas, best practices
   - Secondary search: eos-implementer (if needed)
   - Returns: Combined relevant chunks

4. Context Assembly:
   - System Knowledge: Quarterly planning expertise
   - User Documents: Their specific Rocks, Issues, etc.
   - Company Knowledge: General EOS principles

5. AI Response:
   - Uses quarterly planning expertise from system RAG
   - References user's specific business context
   - Provides tailored preparation guidance
```

## 🔐 Access Control

### EOS Implementer Visibility
```typescript
// Only users with @eosworldwide.com or quinn@upaway.dev see EOS Implementer
if (!hasEOSAccess(user.email)) {
  // Filter out EOS Implementer from persona list
}
```

### System Persona Restrictions
- ✅ Can use system personas
- ✅ Can switch between profiles
- ❌ Cannot edit system personas
- ❌ Cannot create/edit profiles
- ❌ Cannot upload documents to system personas

## 📈 Performance Optimizations

1. **Parallel Execution**: All RAG operations run simultaneously
2. **Conditional Execution**: Only runs RAG for selected components
3. **Caching**: Upstash provides built-in caching
4. **Chunk Limits**: Max 5 results per search
5. **Hierarchical Fallback**: Ensures relevant results even with specific profiles

## 🛠️ Troubleshooting

### Common Issues

1. **System RAG not returning results**:
   - Check namespace exists in Upstash
   - Verify documents uploaded to correct folder
   - Check embedding generation succeeded

2. **Wrong context priority**:
   - Verify persona `isSystemPersona` flag
   - Check system prompt assembly order
   - Review document prioritization logic

3. **Profile content not specific**:
   - Ensure profile namespace has content
   - Check hierarchical search is working
   - Verify profile ID is passed correctly

### Debug Logging

Enable detailed logging by checking console for:
- `System RAG: Starting retrieval...`
- `System RAG: Found X results in namespace Y`
- `System Prompt: Including system knowledge context`

## 🚀 Future Enhancements

1. **Semantic Routing**: Route to specific namespaces based on query intent
2. **Dynamic Weighting**: Adjust result weights based on relevance scores
3. **Cross-Namespace Search**: Search multiple related namespaces
4. **Caching Layer**: Add Redis caching for frequent queries
5. **Analytics**: Track which knowledge sources are most useful 