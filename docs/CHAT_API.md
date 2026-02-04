# EOSAI Chat API Documentation

> Complete reference for EOSAI's chat endpoints, message formats, tools, and streaming protocols.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Internal Chat API](#internal-chat-api)
4. [Public API (v1)](#public-api-v1)
5. [Chat History & Management](#chat-history--management)
6. [Message Formats](#message-formats)
7. [AI Tools](#ai-tools)
8. [Streaming Protocol](#streaming-protocol)
9. [Error Handling](#error-handling)
10. [Rate Limits](#rate-limits)
11. [Examples](#examples)

---

## Overview

EOSAI provides two distinct chat APIs:

| API | Purpose | Auth Method | RAG Context |
|-----|---------|-------------|-------------|
| **Internal Chat** (`/api/chat`) | Web app users | Session (Auth.js) | Full (system + user + persona + memory) |
| **Public API** (`/api/v1/chat`) | External integrations | API Key | System EOS knowledge only |

### Base URLs

```
Production: https://eosbot.ai
Development: http://localhost:3000
```

---

## Authentication

### Internal API (Session-Based)

The internal chat API uses Auth.js (NextAuth) session authentication. Users must be logged in via:
- Google OAuth
- Email/password credentials

Session is automatically handled via cookies.

### Public API (API Key)

The v1 public API uses API key authentication. Include the key in requests via:

```http
Authorization: Bearer <your-api-key>
```

Or:

```http
X-API-Key: <your-api-key>
```

#### API Key Scopes

| Scope | Permissions |
|-------|-------------|
| `chat` | Send chat completions |
| `models` | List available models |
| `usage` | View usage statistics |

---

## Internal Chat API

### POST `/api/chat`

Create a streaming chat completion for authenticated users.

#### Request Headers

```http
Content-Type: application/json
Cookie: <session-cookie>
```

#### Request Body

```typescript
{
  // Required
  id: string;                          // Chat UUID (create new or continue existing)
  message: {
    id: string;                        // Message ID (nanoid format)
    role: "user";
    parts: MessagePart[];              // AI SDK 5 parts-based format
    content?: string;                  // Optional text content
    createdAt?: Date;
  };
  selectedChatModel: "chat-model" | "claude-sonnet";
  selectedProvider: "openai" | "anthropic";
  selectedVisibilityType: "public" | "private";

  // Optional
  selectedPersonaId?: string;          // UUID or "eos-implementer"
  selectedProfileId?: string;          // Profile UUID (for EOS Implementer profiles)
  selectedResearchMode?: "off" | "nexus";
  composerDocumentId?: string;         // Active composer document UUID
}
```

#### Message Part Types

```typescript
// Text part
{
  type: "text";
  text: string;  // 1-100,000 characters
}

// File part (for uploads)
{
  type: "file";
  url: string;
  mediaType: string;
  mimeType?: string;
}
```

#### Response

Returns a streaming response using Vercel AI SDK's UI Message Stream format.

**Headers:**
```http
Content-Type: text/plain; charset=utf-8
X-Vercel-AI-Data-Stream: v1
X-Stream-ID: <uuid>
```

**Stream Events:**
- Text deltas
- Tool invocations
- Data events (composer updates, citations)
- Finish signals

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `invalid_request` | Invalid request body |
| 401 | `unauthorized` | Not authenticated |
| 403 | `forbidden` | Don't own the chat |
| 429 | `DAILY_LIMIT_REACHED` | Message limit exceeded |
| 500 | `internal_error` | Server error |

##### Daily Limit Error Response

```json
{
  "error": "DAILY_LIMIT_REACHED",
  "message": "You have reached your daily message limit.",
  "limit": 200,
  "used": 200,
  "plan": "pro"
}
```

---

### POST `/api/chat/save-message`

Save an assistant message after streaming completes (called by client).

#### Request Body

```typescript
{
  chatId: string;
  messageId: string;
  message: {
    id: string;
    role: "assistant";
    parts: MessagePart[];
    createdAt: Date;
  }
}
```

#### Response

```json
{ "success": true }
```

---

### GET `/api/chat/[id]`

Retrieve a chat by ID.

#### Response

```typescript
{
  id: string;
  userId: string;
  title: string;
  visibility: "public" | "private";
  personaId?: string;
  profileId?: string;
  conversationSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### PATCH `/api/chat/[id]`

Update chat persona/profile.

#### Request Body

```typescript
{
  personaId?: string;   // Persona UUID or "eos-implementer"
  profileId?: string;   // Profile UUID
}
```

---

### POST `/api/chat/[id]/stop`

Stop a streaming response.

---

## Public API (v1)

### POST `/api/v1/chat`

OpenAI-compatible chat completions endpoint with EOS RAG context.

#### Request Headers

```http
Content-Type: application/json
Authorization: Bearer <api-key>
```

#### Request Body

```typescript
{
  // Required
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;

  // Optional
  model?: string;              // Default: "eosai-v1"
  stream?: boolean;            // Default: false
  temperature?: number;        // 0-2, default: 0.7
  max_tokens?: number;         // 1-16384, default: 4096
  top_p?: number;              // 0-1
  frequency_penalty?: number;  // -2 to 2
  presence_penalty?: number;   // -2 to 2
  stop?: string | string[];

  // EOSAI-specific
  include_eos_context?: boolean;  // Default: true
  eos_namespace?: string;         // Default: "eos-implementer"
}
```

#### Available Models

| Model | Description | Max Tokens |
|-------|-------------|------------|
| `eosai-v1` | Default - balanced speed/quality | 4,096 |
| `eosai-v1-fast` | Optimized for quick responses | 4,096 |
| `eosai-v1-pro` | Enhanced reasoning | 16,384 |

#### EOS Namespaces

| Namespace | Description |
|-----------|-------------|
| `eos-implementer` | General EOS implementation |
| `eos-implementer-quarterly-session` | Quarterly planning |
| `eos-implementer-focus-day` | Focus Day facilitation |
| `eos-implementer-vision-day-1` | Vision Building Day 1 |
| `eos-implementer-vision-day-2` | Vision Building Day 2 |

#### Non-Streaming Response

```typescript
{
  id: string;                    // Request ID
  object: "chat.completion";
  created: number;               // Unix timestamp
  model: string;
  choices: [{
    index: 0;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: "stop" | "length";
  }];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }
}
```

#### Streaming Response

Server-Sent Events (SSE) format:

```
data: {"id":"eosai-xxx","object":"chat.completion.chunk","created":1234567890,"model":"eosai-v1","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"eosai-xxx","object":"chat.completion.chunk","created":1234567890,"model":"eosai-v1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

---

### GET `/api/v1/models`

List available models.

#### Response

```typescript
{
  object: "list";
  data: Array<{
    id: string;
    object: "model";
    created: number;
    owned_by: "eosai";
    description: string;
    context_window: number;
    max_output_tokens: number;
    capabilities: string[];
  }>;
  eos_namespaces: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}
```

---

### GET `/api/v1/usage`

Get API key usage statistics.

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | number | 30 | Days of history (1-90) |

#### Response

```typescript
{
  object: "usage";
  api_key: {
    id: string;
    name: string;
    prefix: string;
    created_at: string;
    expires_at: string | null;
    is_active: boolean;
    scopes: string[];
  };
  rate_limits: {
    requests_per_minute: number;
    requests_per_day: number;
    remaining_rpm: number;
    remaining_rpd: number;
    reset_rpm: string;
    reset_rpd: string;
  };
  usage: {
    period_days: number;
    total_requests: number;
    total_tokens: number;
    average_response_time_ms: number;
    error_rate: number;
    lifetime_requests: number;
    lifetime_tokens: number;
  };
  usage_by_day: Record<string, number>;
  usage_by_endpoint: Record<string, number>;
}
```

---

## Chat History & Management

### GET `/api/history`

List user's chat history with pagination.

#### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Results per page (default: 10) |
| `starting_after` | string | Cursor for forward pagination |
| `ending_before` | string | Cursor for backward pagination |

#### Response

```typescript
Array<{
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  visibility: "public" | "private";
  personaId?: string;
  profileId?: string;
}>
```

---

## Message Formats

### AI SDK 5 Message Structure

EOSAI uses Vercel AI SDK 5's parts-based message format:

```typescript
interface UIMessage {
  id: string;              // nanoid format
  role: "user" | "assistant" | "system";
  parts: MessagePart[];    // Primary content
  content?: string;        // Optional text (legacy)
  createdAt?: Date;
}

type MessagePart =
  | { type: "text"; text: string }
  | { type: "file"; url: string; mediaType: string; name?: string }
  | { type: "tool-invocation"; toolInvocationId: string; toolName: string; args: any; state: string; result?: any };
```

### Database Message Format

Messages are stored in `Message_v2` table:

```typescript
{
  id: string;               // UUID
  chatId: string;          // Parent chat UUID
  role: "user" | "assistant" | "system";
  parts: MessagePart[];    // JSONB
  attachments: Attachment[];
  provider: "openai" | "anthropic";
  reasoning?: string;      // Extended thinking output
  stoppedAt?: Date;        // If manually stopped
  createdAt: Date;
}
```

---

## AI Tools

The chat API supports multiple AI-callable tools:

### createDocument

Create a new composer document.

```typescript
{
  title: string;
  kind: "text" | "code" | "sheet" | "chart" | "image" | "vto" | "accountability";
}
```

### updateDocument

Update an existing composer document.

```typescript
{
  id: string;           // Document UUID
  description: string;  // Detailed edit instructions
}
```

### searchWeb

Search the web for current information.

```typescript
{
  query: string;  // Search query
}
```

Returns up to 10 results with 5KB of content each.

### getCalendarEvents

Retrieve Google Calendar events.

```typescript
{
  timeMin?: string;    // ISO date (default: now)
  timeMax?: string;    // ISO date (default: +7 days)
  maxResults?: number; // Default: 10
  searchTerm?: string; // Filter by keyword
}
```

### createCalendarEvent

Create a Google Calendar event.

```typescript
{
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string;  // ISO format
  endDateTime: string;    // ISO format
  attendees?: string[];   // Email addresses
}
```

### addResource

Save information to the knowledge base.

```typescript
{
  title: string;
  content: string;
}
```

### getInformation

Retrieve from the knowledge base.

```typescript
{
  query: string;
  limit?: number;  // Default: 5
}
```

---

## Streaming Protocol

### Internal Chat Streaming

Uses Vercel AI SDK's `createUIMessageStream`:

```typescript
// Response format
Content-Type: text/plain; charset=utf-8
X-Vercel-AI-Data-Stream: v1
```

Stream events include:
- Text tokens
- Tool invocations (start, result)
- Custom data events (composer, citations)
- Finish signal

### Resumable Streams

When Redis is configured, streams are resumable:

```typescript
// Headers
X-Stream-ID: <uuid>
X-Resumable-Stream: true
```

---

## Error Handling

### Standard Error Response

```typescript
{
  error: {
    message: string;
    type: "api_error" | "invalid_request_error" | "server_error";
    code: string;
    param?: string;  // For validation errors
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `missing_api_key` | 401 | No API key provided |
| `invalid_api_key` | 401 | Invalid or expired key |
| `insufficient_scope` | 403 | Missing required scope |
| `rate_limit_exceeded` | 429 | Too many requests |
| `model_not_allowed` | 403 | Model not in allowlist |
| `model_not_found` | 400 | Unknown model ID |
| `invalid_json` | 400 | Malformed JSON body |
| `invalid_param` | 400 | Invalid parameter value |
| `internal_error` | 500 | Server error |
| `stream_error` | 500 | Streaming failure |

---

## Rate Limits

### Public API Limits

Rate limits are per API key:

| Limit | Default |
|-------|---------|
| Requests per minute (RPM) | 60 |
| Requests per day (RPD) | 1,000 |

### Rate Limit Headers

```http
X-RateLimit-Limit-RPM: 60
X-RateLimit-Remaining-RPM: 59
X-RateLimit-Reset-RPM: 2024-01-01T00:01:00Z
X-RateLimit-Limit-RPD: 1000
X-RateLimit-Remaining-RPD: 999
X-RateLimit-Reset-RPD: 2024-01-02T00:00:00Z
```

### Internal API Limits

Based on user plan:

| Plan | Messages/Day | Uploads | Storage |
|------|--------------|---------|---------|
| Free | 20 | 5 | 100MB |
| Pro | 200 | 100 | 1GB |
| Business | 1,000 | 1,000 | 10GB |

---

## Examples

### Internal Chat Request

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    id: crypto.randomUUID(),
    message: {
      id: nanoid(),
      role: 'user',
      parts: [{ type: 'text', text: 'What is a Level 10 Meeting?' }],
    },
    selectedChatModel: 'chat-model',
    selectedProvider: 'anthropic',
    selectedVisibilityType: 'private',
    selectedPersonaId: 'eos-implementer',
  }),
});

// Handle streaming response
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value));
}
```

### Public API Request (Non-Streaming)

```javascript
const response = await fetch('https://eosbot.ai/api/v1/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key',
  },
  body: JSON.stringify({
    model: 'eosai-v1',
    messages: [
      { role: 'user', content: 'Explain the V/TO in EOS' }
    ],
    include_eos_context: true,
    eos_namespace: 'eos-implementer',
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### Public API Request (Streaming)

```javascript
const response = await fetch('https://eosbot.ai/api/v1/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key',
  },
  body: JSON.stringify({
    model: 'eosai-v1',
    messages: [
      { role: 'user', content: 'What are Rocks in EOS?' }
    ],
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
  
  for (const line of lines) {
    const data = line.slice(6);
    if (data === '[DONE]') break;
    
    const parsed = JSON.parse(data);
    const content = parsed.choices[0]?.delta?.content;
    if (content) process.stdout.write(content);
  }
}
```

### Python Example (Public API)

```python
import requests

response = requests.post(
    'https://eosbot.ai/api/v1/chat',
    headers={
        'Authorization': 'Bearer your-api-key',
        'Content-Type': 'application/json',
    },
    json={
        'model': 'eosai-v1',
        'messages': [
            {'role': 'user', 'content': 'What is IDS in EOS?'}
        ],
        'temperature': 0.7,
    }
)

data = response.json()
print(data['choices'][0]['message']['content'])
```

### cURL Example

```bash
curl -X POST https://eosbot.ai/api/v1/chat \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "eosai-v1",
    "messages": [
      {"role": "user", "content": "What are the 6 Key Components of EOS?"}
    ]
  }'
```

---

## Appendix

### Token Budgets

| Model | System Prompt | Message History | Max Output |
|-------|---------------|-----------------|------------|
| Claude Sonnet 4.5 | 16,000 | 12,000 | 64,000 |
| Claude 3.5 Haiku | 8,000 | 6,000 | 8,192 |

### RAG Pipelines (Priority Order)

1. **System RAG** - EOS methodology knowledge (Upstash)
2. **Memory RAG** - User facts/preferences (pgvector)
3. **Persona RAG** - Persona-specific documents (Upstash)
4. **Conversation Summary** - Long chat context (PostgreSQL)
5. **User RAG** - User-uploaded documents (Upstash)

### Chunk Limits by Query Complexity

| Complexity | System | Persona | User | Memories |
|------------|--------|---------|------|----------|
| Simple | 3 | 5 | 3 | 3 |
| Medium | 5 | 10 | 10 | 5 |
| Complex | 8 | 14 | 14 | 10 |

---

*Last updated: 2026-02-04*
*Version: 3.0.19*
