# EOSAI Public API Documentation

The EOSAI Public API provides OpenAI-compatible endpoints for accessing EOS methodology expertise programmatically. This API is designed for developers building applications that need EOS guidance.

## Base URL

```
https://eosbot.ai/api/v1
```

## Authentication

All API requests require authentication via API key. You can pass the API key in one of two ways:

### Authorization Header (Recommended)

```bash
Authorization: Bearer eos_your_api_key_here
```

### X-API-Key Header

```bash
X-API-Key: eos_your_api_key_here
```

## Rate Limits

API keys have two levels of rate limiting:

- **Requests per minute (RPM)**: Default 60 requests/minute
- **Requests per day (RPD)**: Default 1,000 requests/day

Rate limit headers are included in all responses:

```
X-RateLimit-Limit-RPM: 60
X-RateLimit-Remaining-RPM: 59
X-RateLimit-Reset-RPM: 2026-02-04T12:00:00.000Z
X-RateLimit-Limit-RPD: 1000
X-RateLimit-Remaining-RPD: 999
X-RateLimit-Reset-RPD: 2026-02-05T00:00:00.000Z
```

When rate limited, you'll receive a `429 Too Many Requests` response with a `Retry-After` header.

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat` | Create a chat completion with EOS context |
| POST | `/v1/conversations` | Create a persistent conversation |
| GET | `/v1/conversations` | List all conversations |
| GET | `/v1/conversations/{id}` | Get a conversation with messages |
| POST | `/v1/conversations/{id}/messages` | Send a message to a conversation |
| DELETE | `/v1/conversations/{id}` | Delete a conversation |
| POST | `/v1/embeddings` | Generate vector embeddings |
| POST | `/v1/documents/analyze` | Analyze documents and answer questions |
| GET | `/v1/models` | List available models |
| GET | `/v1/usage` | Get usage statistics |

---

## Chat Completions

### POST /v1/chat

Create a chat completion. This is the main endpoint for single-turn interactions with EOSAI.

#### Request Body

```json
{
  "messages": [
    {"role": "user", "content": "How do I set up a Level 10 Meeting?"}
  ],
  "model": "eosai-v1",
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 4096,
  "include_eos_context": true,
  "eos_namespace": "eos-implementer"
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `messages` | array | Yes | - | Array of message objects with `role` and `content` |
| `model` | string | No | `eosai-v1` | Model to use (see Models section) |
| `stream` | boolean | No | `false` | Enable streaming responses via SSE |
| `temperature` | number | No | `0.7` | Sampling temperature (0-2) |
| `max_tokens` | number | No | `4096` | Maximum tokens in response (1-16384) |
| `top_p` | number | No | - | Nucleus sampling parameter |
| `frequency_penalty` | number | No | - | Frequency penalty (-2 to 2) |
| `presence_penalty` | number | No | - | Presence penalty (-2 to 2) |
| `stop` | string/array | No | - | Stop sequences |
| `include_eos_context` | boolean | No | `true` | Include EOS knowledge base context |
| `eos_namespace` | string | No | `eos-implementer` | EOS knowledge namespace to use |

#### Message Roles

- `system` - System instructions (optional)
- `user` - User messages
- `assistant` - Previous assistant responses

#### Non-Streaming Response

```json
{
  "id": "eosai-abc123",
  "object": "chat.completion",
  "created": 1707048000,
  "model": "eosai-v1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "A Level 10 Meeting is a weekly 90-minute meeting..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 250,
    "total_tokens": 265
  }
}
```

#### Streaming Response

When `stream: true`, the response is sent as Server-Sent Events (SSE):

```
data: {"id":"eosai-abc123","object":"chat.completion.chunk","created":1707048000,"model":"eosai-v1","choices":[{"index":0,"delta":{"content":"A "},"finish_reason":null}]}

data: {"id":"eosai-abc123","object":"chat.completion.chunk","created":1707048000,"model":"eosai-v1","choices":[{"index":0,"delta":{"content":"Level "},"finish_reason":null}]}

...

data: {"id":"eosai-abc123","object":"chat.completion.chunk","created":1707048000,"model":"eosai-v1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

---

## Conversations

Conversations provide persistent, stateful multi-turn interactions. Unlike the `/chat` endpoint where you must send the full message history each time, conversations automatically maintain history.

### POST /v1/conversations

Create a new conversation.

#### Request Body

```json
{
  "title": "EOS Implementation Questions",
  "model": "eosai-v1",
  "system_prompt": "You are an EOS expert helping with quarterly planning.",
  "metadata": {
    "client_id": "12345",
    "project": "Q1 Planning"
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `title` | string | No | null | Human-readable title (max 256 chars) |
| `model` | string | No | `eosai-v1` | Model to use for this conversation |
| `system_prompt` | string | No | null | Custom system prompt (max 4096 chars) |
| `metadata` | object | No | null | Custom metadata to store |

#### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "object": "conversation",
  "title": "EOS Implementation Questions",
  "model": "eosai-v1",
  "system_prompt": "You are an EOS expert helping with quarterly planning.",
  "metadata": {"client_id": "12345", "project": "Q1 Planning"},
  "message_count": 0,
  "total_tokens": 0,
  "created_at": "2026-02-04T12:00:00.000Z",
  "updated_at": "2026-02-04T12:00:00.000Z"
}
```

---

### GET /v1/conversations

List all conversations for your API key.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Maximum results (1-100) |
| `offset` | integer | 0 | Number to skip for pagination |

#### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "object": "conversation",
      "title": "EOS Implementation Questions",
      "model": "eosai-v1",
      "message_count": 4,
      "total_tokens": 1250,
      "created_at": "2026-02-04T12:00:00.000Z",
      "updated_at": "2026-02-04T14:30:00.000Z"
    }
  ],
  "has_more": false
}
```

---

### GET /v1/conversations/{id}

Get a single conversation with all its messages.

#### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "object": "conversation",
  "title": "EOS Implementation Questions",
  "model": "eosai-v1",
  "system_prompt": null,
  "metadata": null,
  "message_count": 2,
  "total_tokens": 500,
  "created_at": "2026-02-04T12:00:00.000Z",
  "updated_at": "2026-02-04T12:05:00.000Z",
  "messages": [
    {
      "id": "msg-123",
      "role": "user",
      "content": "What is a Level 10 Meeting?",
      "token_count": 8,
      "created_at": "2026-02-04T12:00:00.000Z"
    },
    {
      "id": "msg-124",
      "role": "assistant",
      "content": "A Level 10 Meeting is a weekly...",
      "token_count": 492,
      "created_at": "2026-02-04T12:00:05.000Z"
    }
  ]
}
```

---

### POST /v1/conversations/{id}/messages

Send a message to a conversation and get an AI response. The conversation's history is automatically included for context.

#### Request Body

```json
{
  "content": "How do I run an effective Level 10 Meeting?",
  "stream": false,
  "include_eos_context": true,
  "eos_namespace": "eos-implementer"
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `content` | string | Yes | - | The message content (1-32000 chars) |
| `stream` | boolean | No | `false` | Enable streaming response |
| `include_eos_context` | boolean | No | `true` | Include EOS knowledge base context |
| `eos_namespace` | string | No | `eos-implementer` | EOS namespace to search |

#### Non-Streaming Response

```json
{
  "id": "req-xyz789",
  "object": "conversation.message",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "assistant",
  "content": "To run an effective Level 10 Meeting, follow these steps...",
  "token_count": 350,
  "finish_reason": "stop",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 350,
    "total_tokens": 500
  }
}
```

#### Streaming Response

When `stream: true`:

```
data: {"id":"req-xyz789","object":"conversation.message.chunk","conversation_id":"550e8400-...","delta":{"content":"To "},"finish_reason":null}

data: {"id":"req-xyz789","object":"conversation.message.chunk","conversation_id":"550e8400-...","delta":{"content":"run "},"finish_reason":null}

...

data: {"id":"req-xyz789","object":"conversation.message.chunk","conversation_id":"550e8400-...","delta":{},"finish_reason":"stop"}

data: [DONE]
```

---

### DELETE /v1/conversations/{id}

Delete a conversation and all its messages.

#### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "object": "conversation.deleted",
  "deleted": true
}
```

---

## Embeddings

### POST /v1/embeddings

Generate vector embeddings for text input(s). Uses OpenAI's text-embedding-ada-002 model (1536 dimensions).

#### Request Body

```json
{
  "input": "What is the Entrepreneurial Operating System?",
  "model": "text-embedding-ada-002",
  "encoding_format": "float"
}
```

For multiple inputs:

```json
{
  "input": [
    "What are EOS Rocks?",
    "How does Level 10 Meeting work?",
    "Explain the Accountability Chart"
  ]
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input` | string/array | Yes | - | Text(s) to embed (max 32000 chars each, max 100 items) |
| `model` | string | No | `text-embedding-ada-002` | Embedding model |
| `encoding_format` | string | No | `float` | Output format: `float` or `base64` |

#### Response

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0023064255, -0.009327292, 0.015797086, ...]
    }
  ],
  "model": "text-embedding-ada-002",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

---

## Document Analysis

### POST /v1/documents/analyze

Analyze a document and answer questions about it. Supports two input methods:

1. **JSON**: Send document text directly
2. **Form Data**: Upload a file

#### JSON Request

```json
{
  "document": "Our company's core values are: 1. Customer First - We prioritize customer needs...",
  "question": "What are the company's core values?",
  "model": "eosai-v1",
  "stream": false,
  "include_eos_context": false,
  "max_chunks": 5
}
```

#### Form Data Request

```bash
curl -X POST https://eosbot.ai/api/v1/documents/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@company-handbook.pdf" \
  -F "question=What are the company's core values?" \
  -F "model=eosai-v1"
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `document` | string | Yes* | - | Document text (max 100000 chars) |
| `file` | file | Yes* | - | File upload (PDF, DOCX, XLSX, PPTX, TXT, MD, or images) |
| `question` | string | Yes | - | Question about the document (max 4000 chars) |
| `model` | string | No | `eosai-v1` | Model to use |
| `stream` | boolean | No | `false` | Enable streaming response |
| `include_eos_context` | boolean | No | `false` | Include EOS knowledge base context |
| `eos_namespace` | string | No | `eos-implementer` | EOS namespace |
| `max_chunks` | integer | No | 5 | Max document chunks to analyze (1-20) |

*Either `document` or `file` is required.

#### Supported File Types

- **Documents**: PDF, DOCX, XLSX, PPTX, TXT, MD
- **Images**: JPEG, PNG, GIF, WebP, BMP
- **Max file size**: 10MB

#### Response

```json
{
  "id": "doc-analysis-123",
  "object": "document.analysis",
  "answer": "The company's core values are: 1. Customer First - prioritizing customer needs...",
  "model": "eosai-v1",
  "chunks_analyzed": 3,
  "total_chunks": 8,
  "finish_reason": "stop",
  "usage": {
    "prompt_tokens": 1200,
    "completion_tokens": 250,
    "total_tokens": 1450
  }
}
```

For image uploads, the response includes additional fields:

```json
{
  "id": "doc-analysis-123",
  "object": "document.analysis",
  "answer": "The image shows a V/TO diagram with...",
  "model": "eosai-v1",
  "file": {
    "name": "vto-diagram.png",
    "type": "image"
  },
  "image_analysis": {
    "description": "A Vision/Traction Organizer diagram showing...",
    "extracted_text": "Core Values: Integrity, Excellence..."
  },
  "finish_reason": "stop",
  "usage": {...}
}
```

---

## Models

### GET /v1/models

List available models and EOS knowledge namespaces.

#### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "eosai-v1",
      "object": "model",
      "created": 1706140800,
      "owned_by": "eosai",
      "description": "Default EOSAI model - Best balance of speed and quality",
      "context_window": 200000,
      "max_output_tokens": 4096,
      "capabilities": ["chat", "eos_rag"]
    },
    {
      "id": "eosai-v1-fast",
      "object": "model",
      "created": 1706140800,
      "owned_by": "eosai",
      "description": "Fast EOSAI model - Optimized for quick responses",
      "context_window": 200000,
      "max_output_tokens": 4096,
      "capabilities": ["chat", "eos_rag"]
    },
    {
      "id": "eosai-v1-pro",
      "object": "model",
      "created": 1706140800,
      "owned_by": "eosai",
      "description": "Pro EOSAI model - Enhanced reasoning with extended thinking",
      "context_window": 200000,
      "max_output_tokens": 16384,
      "capabilities": ["chat", "eos_rag", "extended_thinking"]
    }
  ],
  "eos_namespaces": [
    {
      "id": "eos-implementer",
      "name": "EOS Implementer",
      "description": "General EOS implementation knowledge"
    },
    {
      "id": "eos-implementer-quarterly-session",
      "name": "Quarterly Session",
      "description": "Quarterly planning and review session facilitation"
    }
  ]
}
```

---

## Usage

### GET /v1/usage

Get usage statistics for your API key.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | `30` | Number of days to include (1-90) |

#### Response

```json
{
  "object": "usage",
  "api_key": {
    "id": "uuid",
    "name": "My Production Key",
    "prefix": "eos_abcd...",
    "created_at": "2026-01-15T10:00:00.000Z",
    "expires_at": null,
    "is_active": true,
    "scopes": ["chat"]
  },
  "rate_limits": {
    "requests_per_minute": 60,
    "requests_per_day": 1000,
    "remaining_rpm": 55,
    "remaining_rpd": 850,
    "reset_rpm": "2026-02-04T12:01:00.000Z",
    "reset_rpd": "2026-02-05T00:00:00.000Z"
  },
  "usage": {
    "period_days": 30,
    "total_requests": 1250,
    "total_tokens": 875000,
    "average_response_time_ms": 1200,
    "error_rate": 0.02,
    "lifetime_requests": 5000,
    "lifetime_tokens": 3500000
  },
  "usage_by_day": [
    {"date": "2026-02-01", "requests": 45, "tokens": 31500},
    {"date": "2026-02-02", "requests": 52, "tokens": 36400}
  ],
  "usage_by_endpoint": [
    {"endpoint": "/v1/chat", "requests": 1200},
    {"endpoint": "/v1/conversations/messages", "requests": 150},
    {"endpoint": "/v1/models", "requests": 50}
  ]
}
```

---

## Error Handling

All errors follow the OpenAI error format:

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key",
    "param": null
  }
}
```

### Error Codes

| HTTP Status | Type | Code | Description |
|-------------|------|------|-------------|
| 400 | `invalid_request_error` | `invalid_json` | Request body is not valid JSON |
| 400 | `invalid_request_error` | `invalid_param` | A request parameter is invalid |
| 400 | `invalid_request_error` | `model_not_found` | The requested model doesn't exist |
| 401 | `authentication_error` | `missing_api_key` | No API key provided |
| 401 | `authentication_error` | `invalid_api_key` | API key is invalid or expired |
| 403 | `permission_error` | `insufficient_scope` | API key lacks required permissions |
| 403 | `permission_error` | `model_not_allowed` | API key cannot access this model |
| 404 | `invalid_request_error` | `not_found` | Resource not found |
| 429 | `rate_limit_error` | `rate_limit_exceeded` | Too many requests |
| 500 | `server_error` | `internal_error` | Server error |

---

## Code Examples

### cURL

```bash
# Non-streaming chat request
curl https://eosbot.ai/api/v1/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What are the 6 Key Components of EOS?"}
    ]
  }'

# Create a conversation
curl https://eosbot.ai/api/v1/conversations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Q1 Planning Session",
    "model": "eosai-v1"
  }'

# Send message to conversation
curl https://eosbot.ai/api/v1/conversations/CONVERSATION_ID/messages \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Help me set Rocks for my team",
    "stream": true
  }'

# Analyze a document
curl https://eosbot.ai/api/v1/documents/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@meeting-notes.pdf" \
  -F "question=What were the key action items?"
```

### Python

```python
import requests

API_KEY = "YOUR_API_KEY"
BASE_URL = "https://eosbot.ai/api/v1"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# Simple chat request
response = requests.post(
    f"{BASE_URL}/chat",
    headers=HEADERS,
    json={
        "messages": [
            {"role": "user", "content": "How do I run an effective L10 meeting?"}
        ],
        "model": "eosai-v1",
    },
)
result = response.json()
print(result["choices"][0]["message"]["content"])

# Create and use a conversation
conv_response = requests.post(
    f"{BASE_URL}/conversations",
    headers=HEADERS,
    json={"title": "My Planning Session"},
)
conversation = conv_response.json()
conversation_id = conversation["id"]

# Send messages to the conversation
msg_response = requests.post(
    f"{BASE_URL}/conversations/{conversation_id}/messages",
    headers=HEADERS,
    json={"content": "What is the V/TO?"},
)
print(msg_response.json()["content"])

# Continue the conversation (history is maintained)
msg_response = requests.post(
    f"{BASE_URL}/conversations/{conversation_id}/messages",
    headers=HEADERS,
    json={"content": "How do I fill it out for a new company?"},
)
print(msg_response.json()["content"])
```

### Python with OpenAI SDK

```python
from openai import OpenAI

# Point the OpenAI client at EOSAI
client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://eosbot.ai/api/v1",
)

# Works just like OpenAI!
response = client.chat.completions.create(
    model="eosai-v1",
    messages=[
        {"role": "user", "content": "What makes a good Rock?"}
    ],
    stream=True,
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### JavaScript/TypeScript

```typescript
const API_KEY = 'YOUR_API_KEY';
const BASE_URL = 'https://eosbot.ai/api/v1';

// Simple chat request
async function askEOSAI(question: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: question }],
      model: 'eosai-v1',
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// Using conversations for multi-turn interactions
async function createConversation(title: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/conversations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  const data = await response.json();
  return data.id;
}

async function sendMessage(conversationId: string, content: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  const data = await response.json();
  return data.content;
}

// Usage
const conversationId = await createConversation('My EOS Session');
const answer1 = await sendMessage(conversationId, 'What is a V/TO?');
const answer2 = await sendMessage(conversationId, 'How do I complete the Vision section?');
// The AI remembers the context from previous messages!
```

### JavaScript (Streaming)

```typescript
async function streamEOSAI(question: string) {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: question }],
      stream: true,
    }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      const parsed = JSON.parse(data);
      const content = parsed.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }
  }
}
```

---

## EOS Knowledge Namespaces

The API includes access to EOSAI's EOS knowledge base via RAG (Retrieval-Augmented Generation). You can specify which namespace to use for context:

| Namespace | Description |
|-----------|-------------|
| `eos-implementer` | General EOS implementation knowledge (default) |
| `eos-implementer-quarterly-session` | Quarterly session facilitation |
| `eos-implementer-focus-day` | Focus Day facilitation |
| `eos-implementer-vision-day-1` | Vision Building Day 1 |
| `eos-implementer-vision-day-2` | Vision Building Day 2 |

To use a specific namespace:

```json
{
  "messages": [...],
  "eos_namespace": "eos-implementer-quarterly-session"
}
```

To disable EOS context (use only the model's general knowledge):

```json
{
  "messages": [...],
  "include_eos_context": false
}
```

---

## Best Practices

1. **Use conversations for multi-turn interactions**: Creates a better experience and reduces token usage
2. **Choose the right model**: Use `eosai-v1-fast` for simple queries, `eosai-v1-pro` for complex analysis
3. **Leverage EOS namespaces**: Use specific namespaces when asking about particular EOS sessions
4. **Handle rate limits gracefully**: Implement exponential backoff on 429 responses
5. **Stream for long responses**: Use streaming for better UX with longer responses
6. **Use document analysis for files**: Upload files directly instead of extracting text manually

---

## Support

For API support, contact: api@eosbot.ai

For EOS methodology questions, visit: [EOS Worldwide](https://www.eosworldwide.com)
