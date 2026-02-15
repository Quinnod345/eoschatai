# Circle.so Course Assistant Architecture

## Complete Data Flow

### What Gets Fetched from Circle.so

When a course is activated, the system intelligently fetches ALL content:

#### 1. Space Group (Course) Metadata
**API**: Admin API  
**Endpoint**: `GET /api/v1/space_groups/{courseId}`

Fetches:
- Course name
- Course description  
- List of all space IDs in the course (`space_order_array`)

#### 2. For Each Space in the Course

The system checks the space type and fetches accordingly:

**Course-Type Space** (e.g., "Pasta" - `space_type: "course"`):

1. **Fetch Sections**  
   **API**: Headless Member API  
   **Endpoint**: `GET /api/headless/v1/courses/{spaceId}/sections`
   
   Returns:
   ```json
   {
     "sections": [
       {
         "id": 782593,
         "name": "How to make pasta",
         "lessons": [...]
       }
     ]
   }
   ```

2. **Fetch Each Lesson**  
   **API**: Headless Member API  
   **Endpoint**: `GET /api/headless/v1/courses/{spaceId}/lessons/{lessonId}`
   
   Returns:
   ```json
   {
     "id": 2969534,
     "name": "Tomato garlic pasta",
     "rich_text_body": {
       "circle_ios_fallback_text": "Full lesson content...",
       "body": {...} // TipTap JSON
     }
   }
   ```

**Regular Space** (discussion/community space):

**Fetch Posts**  
**API**: Headless Member API  
**Endpoint**: `GET /api/headless/v1/spaces/{spaceId}/posts?per_page=100`

Returns:
```json
{
  "posts": [
    {
      "id": 123456,
      "name": "Post Title",
      "body": "Full post content",
      "is_pinned": false
    }
  ]
}
```

### Document Creation

Each piece of content becomes a structured document:

```typescript
{
  title: "Test - Lesson 1: Tomato garlic pasta",
  content: "🍝 Gourmet Roasted Tomato & Garlic Spaghetti\nIngredients...",
  metadata: {
    lessonId: "2969534",
    order: 1,
    type: "lesson"
  }
}
```

**Plus** an overview document:
```typescript
{
  title: "Test - Overview",
  content: "[Course description]",
  metadata: {
    type: "overview"
  }
}
```

### RAG Processing Pipeline

Each document goes through:

1. **Chunking** (`lib/ai/user-rag.ts`):
   - Split into ~500-800 character chunks
   - 200 character overlap between chunks
   - Preserves context across boundaries

2. **Embedding** (`lib/ai/embeddings.ts`):
   - OpenAI `text-embedding-3-small` model
   - 1536 dimensions per embedding
   - Semantic understanding of content

3. **Storage** (Vector Database):
   - Namespace: `circle-course-{courseId}` (e.g., `circle-course-907974`)
   - Isolated from other personas and users
   - Metadata includes: documentId, fileName, category, fileType

4. **Database Records**:
   - `UserDocuments` table: Full document text
   - `PersonaDocument` junction: Links document to persona
   - `CircleCoursePersona`: Tracks sync status and course metadata

## How Retrieval Works in Chat

### When User Asks: "How do I make tomato garlic pasta?"

**Step 1: Query Analysis**
- User's question is analyzed
- Persona ID is detected: `672a0960-49a9-4006-a42e-85466e590312`

**Step 2: Persona RAG Retrieval** (`lib/ai/persona-rag.ts:113-118`)
```typescript
const relevantDocs = await findRelevantUserContent(
  "672a0960-49a9-4006-a42e-85466e590312", // Persona namespace
  "How do I make tomato garlic pasta?",    // User query
  14,                                        // Up to 14 chunks (MORE than user RAG)
  0.5,                                       // Lower threshold = better recall
);
```

**Step 3: Semantic Search**
- Searches ONLY in `circle-course-907974` namespace
- Finds chunks with high similarity to the query
- Returns results sorted by relevance:
  ```
  [
    {
      content: "🍝 Gourmet Roasted Tomato & Garlic Spaghetti\nIngredients...",
      relevance: 0.95,
      metadata: { documentId: "...", fileName: "Tomato garlic pasta" }
    },
    ...
  ]
  ```

**Step 4: Context Injection**
The top 3 chunks per file are injected into the prompt:

```
## PERSONA DOCUMENT CONTEXT

The following information has been retrieved from documents specifically 
associated with the "Test Assistant" persona:

### Course Content

**Test - Lesson 1: Tomato garlic pasta** (1 relevant sections):

[Relevance: 95.3%]
🍝 Gourmet Roasted Tomato & Garlic Spaghetti
Ingredients (serves 2–3)
• 1 lb (450g) cherry or grape tomatoes
• 1 head of garlic
...

**CRITICAL INSTRUCTIONS FOR PERSONA DOCUMENTS:**
1. **HIGHEST PRIORITY**: Persona documents take PRECEDENCE over general user documents
2. **EXPERTISE ALIGNMENT**: Use this specialized content to demonstrate deep expertise
3. **AUTHORITATIVE VOICE**: Present with confidence and authority
```

**Step 5: AI Response**
The AI generates a response using:
1. Course assistant instructions (from template)
2. Course lesson content (from RAG)
3. User's question context

Result: Accurate, authoritative answer about making tomato garlic pasta!

## Multi-Space Course Example

If your "EOS A-Z" course (ID: 782928) has multiple spaces:

```
EOS A-Z (Space Group 782928)
├── Space 1: Accountability Chart (course-type)
│   ├── Section 1: Introduction
│   │   ├── Lesson 1: What is an A/C?
│   │   └── Lesson 2: Building Your A/C
│   └── Section 2: Advanced Topics
│       └── Lesson 3: A/C Best Practices
├── Space 2: Vision Building (course-type)
│   └── Section 1: V/TO
│       ├── Lesson 1: Core Values
│       └── Lesson 2: 10-Year Target
└── Space 3: Community Discussion (regular)
    ├── Post 1: Welcome!
    └── Post 2: Common Questions
```

**The assistant will fetch:**
- Overview: "EOS A-Z" course description
- 5 lessons from course-type spaces (Accountability Chart + Vision Building)
- 2 posts from regular discussion space
- **Total: 8 documents**, all searchable in one unified assistant

## Why This Works

### Namespace Isolation
Each course persona gets its own vector namespace:
- `circle-course-907974` for Test course
- `circle-course-782928` for EOS A-Z course
- `circle-course-815352` for Biz Dev course

This ensures:
- ✅ No content leakage between courses
- ✅ Faster, more accurate search (smaller search space)
- ✅ Course-specific relevance scoring

### Subscription Model
Course personas are system personas (shared resources):
- **One persona** = One set of embeddings for ALL users
- **User subscriptions** = Who sees it in their persona list
- **Benefits**: 
  - Efficient (no duplicate content processing)
  - Consistent (all users get same quality answers)
  - Manageable (users can hide courses they don't need)

### Priority System
The explicit priority instructions ensure:
- Course content is never overshadowed by user documents
- AI presents information with authority
- Persona instructions frame the course knowledge appropriately

## Token Usage & Efficiency

### Per Course
- **One-time cost**: Embedding all lessons (charged once)
- **Per-query cost**: Embedding user question + retrieval (minimal)
- **Context tokens**: ~3,000-6,000 tokens per query (14 chunks @ ~200-400 tokens each)

### Optimization
- Lower similarity threshold (0.5) = better recall, more context
- More chunks (14 vs. 10 for user RAG) = comprehensive answers
- Isolated namespaces = faster search, lower latency

## Your Complete Course Links

Based on your Circle.so space groups:

### For Implementers
```
EOS A-Z: https://eosai.com/academy/course/782928?spaceId=2310423&audience=implementer
Biz Dev: https://eosai.com/academy/course/815352?spaceId=2310423&audience=implementer
Practice Management: https://eosai.com/academy/course/815357?spaceId=2310423&audience=implementer
Path to Mastery: https://eosai.com/academy/course/815371?spaceId=2310423&audience=implementer
Implementer Community: https://eosai.com/academy/course/813417?spaceId=2310423&audience=implementer
Test (Pasta): https://eosai.com/academy/course/907974?spaceId=2310423&audience=implementer
```

### For Clients
```
Client Resources: https://eosai.com/academy/course/815361?spaceId=2310423&audience=client
Getting Started: https://eosai.com/academy/course/839429?spaceId=2310423&audience=client
EOS A-Z (Client): https://eosai.com/academy/course/782928?spaceId=2310423&audience=client
```

## Summary

✅ **Comprehensive Fetching**: ALL sections, lessons, and posts from ALL spaces in a course  
✅ **Intelligent Detection**: Automatically handles course-type and regular spaces  
✅ **Priority System**: Course content is highest priority in AI responses  
✅ **User Control**: Subscribe/unsubscribe without affecting other users  
✅ **Efficient**: One persona per course, shared across all users  
✅ **Isolated**: Each course has its own vector namespace  
✅ **Customized**: Instructions adapt to course type and audience  

Your Pasta course will have full access to the "Tomato garlic pasta" lesson and can answer questions about ingredients, cooking methods, temperatures, and techniques! 🍝


