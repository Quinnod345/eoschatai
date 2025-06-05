# Persona RAG Implementation

## Overview

This document describes the implementation of the three-tier RAG (Retrieval-Augmented Generation) system that supports personas with their own document namespaces. The system runs three parallel RAG instances with different prioritization levels.

## Architecture

### Three RAG Instances

1. **Company RAG** (Lowest Priority)
   - Contains general EOS knowledge and company-wide information
   - Sent with the system message
   - Uses the main Upstash Vector database

2. **User RAG** (Medium Priority)
   - Contains user-specific uploaded documents
   - Sent with the user message
   - Uses the user's ID as namespace in the User RAG database

3. **Persona RAG** (Highest Priority)
   - Contains documents specifically associated with a persona
   - Sent with the user message
   - Uses the persona's ID as namespace in the User RAG database
   - Only active when a persona is selected

### Parallel Execution

All three RAG instances run in parallel for optimal performance:

```typescript
const [relevantContent, userRagContext, personaRagContext] = await Promise.all([
  // Company RAG
  findRelevantContent(queryText, 5),
  
  // User RAG
  userRagContextPrompt(session.user.id, queryText),
  
  // Persona RAG (only if persona selected)
  personaRagContextPrompt(selectedPersonaId, queryText, session.user.id)
]);
```

## Document Prioritization

The system follows a strict prioritization order:

1. **FIRST**: Persona-specific documents (when a persona is selected)
2. **SECOND**: User's general documents
3. **THIRD**: Company knowledge base

This ensures that:
- Persona expertise is always prioritized when using a persona
- User-specific information overrides general knowledge
- Company knowledge provides fallback information

## Implementation Details

### Persona Document Processing

When a persona is created or updated with documents:

1. Documents are associated with the persona in the `personaDocument` table
2. Documents are processed into the persona's vector namespace:
   ```typescript
   await processPersonaDocuments(personaId, documentIds, userId);
   ```
3. Each document is chunked and embedded
4. Vectors are stored using the persona ID as the namespace

### Persona RAG Retrieval

When a message is sent with a selected persona:

1. The system verifies the persona belongs to the user
2. Retrieves document IDs associated with the persona
3. Searches the persona's namespace for relevant content
4. Filters results to only include persona-associated documents
5. Returns formatted context for the AI

### Namespace Management

- **User documents**: Stored in namespace = `userId`
- **Persona documents**: Stored in namespace = `personaId`
- This allows complete isolation between different contexts
- Personas can have their own specialized knowledge base

## API Changes

### POST /api/personas
- Now processes documents into persona namespace on creation
- Handles document embedding asynchronously

### PUT /api/personas/[id]
- Tracks document changes (additions/removals)
- Updates persona namespace accordingly
- Only clears namespace when all documents are removed

### DELETE /api/personas/[id]
- Cleans up persona's vector namespace
- Removes all associated vectors

## System Prompt Integration

The system prompt now includes three document contexts:

```typescript
${context}                    // Company RAG
${personaDocumentContext}     // Persona RAG (highest priority)
${userDocumentContext}        // User RAG (medium priority)
```

Each context includes specific instructions for the AI on how to use and prioritize the information.

## Features

1. **Specialized Knowledge**: Personas can have their own curated knowledge base
2. **Better Performance**: Parallel execution reduces latency
3. **Clear Prioritization**: AI knows which sources to prioritize
4. **Namespace Isolation**: Complete separation between different contexts
5. **Scalability**: Each persona can have unlimited documents
6. **Custom Document Upload**: Users can upload documents directly in the persona wizard

## Custom Document Upload

The persona wizard now includes a custom document upload feature that allows users to:

1. **Upload documents directly** during persona creation or editing
2. **Process documents exclusively** for that persona's namespace
3. **Maintain separation** from general user documents

### How it works:

1. In the Knowledge Base step of the persona wizard, users see two sections:
   - **Available Documents**: Existing documents from their library
   - **Upload Custom Documents**: New upload area for persona-specific documents

2. Users can upload multiple files (PDF, Word, Text, CSV, Excel) up to 10MB each

3. For new personas:
   - Documents are uploaded and queued
   - After persona creation, documents are automatically processed into the persona's namespace

4. For existing personas:
   - Documents can be uploaded and processed immediately
   - A "Process Documents" button appears to trigger the processing

### Technical Implementation:

- Documents are uploaded via `/api/documents/upload`
- Processing happens via `/api/personas/process-document`
- Documents are stored in the persona's namespace (using persona ID)
- The same Upstash database is used as user RAG, just with different namespaces

## Usage Example

When a user with a "Financial Advisor" persona asks about quarterly planning:

1. **Persona RAG** returns financial planning templates and guides
2. **User RAG** returns their company's specific quarterly data
3. **Company RAG** returns general EOS quarterly planning principles

The AI combines all three, prioritizing the financial perspective from the persona while incorporating the user's specific data and general EOS principles.

## Future Enhancements

1. **Individual document removal** from persona namespaces
2. **Persona-specific embedding models** for specialized domains
3. **Cross-persona document sharing** for team collaboration
4. **Persona knowledge inheritance** from parent personas 