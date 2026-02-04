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
Authorization: Bearer eosai_sk_your_api_key_here
```

### X-API-Key Header

```bash
X-API-Key: eosai_sk_your_api_key_here
```

## Rate Limits

API keys have two levels of rate limiting:

- **Requests per minute (RPM)**: Default 60 requests/minute
- **Requests per day (RPD)**: Default 1,000 requests/day

Rate limit headers are included in all responses:

```
X-RateLimit-Limit-RPM: 60
X-RateLimit-Remaining-RPM: 59
X-RateLimit-Reset-RPM: 2024-02-04T12:00:00.000Z
X-RateLimit-Limit-RPD: 1000
X-RateLimit-Remaining-RPD: 999
X-RateLimit-Reset-RPD: 2024-02-05T00:00:00.000Z
```

When rate limited, you'll receive a `429 Too Many Requests` response with a `Retry-After` header.

---

## Endpoints

### POST /v1/chat

Create a chat completion. This is the main endpoint for interacting with EOSAI.

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
      "description": "Pro EOSAI model - Enhanced reasoning for complex scenarios",
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
    "prefix": "eosai_sk_abcd...",
    "created_at": "2024-01-15T10:00:00.000Z",
    "expires_at": null,
    "is_active": true,
    "scopes": ["chat"]
  },
  "rate_limits": {
    "requests_per_minute": 60,
    "requests_per_day": 1000,
    "remaining_rpm": 55,
    "remaining_rpd": 850,
    "reset_rpm": "2024-02-04T12:01:00.000Z",
    "reset_rpd": "2024-02-05T00:00:00.000Z"
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
    {"date": "2024-02-01", "requests": 45, "tokens": 31500},
    {"date": "2024-02-02", "requests": 52, "tokens": 36400}
  ],
  "usage_by_endpoint": [
    {"endpoint": "/v1/chat", "requests": 1200},
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
    "type": "api_error",
    "code": "invalid_api_key"
  }
}
```

### Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `invalid_json` | Request body is not valid JSON |
| 400 | `invalid_param` | A request parameter is invalid |
| 400 | `model_not_found` | The requested model doesn't exist |
| 401 | `missing_api_key` | No API key provided |
| 401 | `invalid_api_key` | API key is invalid or expired |
| 403 | `insufficient_scope` | API key lacks required permissions |
| 403 | `model_not_allowed` | API key cannot access this model |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `internal_error` | Server error |

---

## Code Examples

### cURL

```bash
# Non-streaming request
curl https://eosbot.ai/api/v1/chat \
  -H "Authorization: Bearer eosai_sk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What are the 6 Key Components of EOS?"}
    ]
  }'

# Streaming request
curl https://eosbot.ai/api/v1/chat \
  -H "Authorization: Bearer eosai_sk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Explain the V/TO"}
    ],
    "stream": true
  }'
```

### Python

```python
import requests

API_KEY = "eosai_sk_your_key_here"
BASE_URL = "https://eosbot.ai/api/v1"

# Non-streaming request
response = requests.post(
    f"{BASE_URL}/chat",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "messages": [
            {"role": "user", "content": "How do I run an effective L10 meeting?"}
        ],
        "model": "eosai-v1",
    },
)

result = response.json()
print(result["choices"][0]["message"]["content"])
```

### Python (Streaming with OpenAI SDK)

```python
from openai import OpenAI

# Point the OpenAI client at EOSAI
client = OpenAI(
    api_key="eosai_sk_your_key_here",
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
const API_KEY = 'eosai_sk_your_key_here';

async function askEOSAI(question: string): Promise<string> {
  const response = await fetch('https://eosbot.ai/api/v1/chat', {
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

// Usage
const answer = await askEOSAI('What is the People Analyzer?');
console.log(answer);
```

### JavaScript (Streaming)

```typescript
async function streamEOSAI(question: string) {
  const response = await fetch('https://eosbot.ai/api/v1/chat', {
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

1. **Use conversation history**: Include previous messages for context-aware responses
2. **Choose the right model**: Use `eosai-v1-fast` for simple queries, `eosai-v1-pro` for complex analysis
3. **Leverage EOS namespaces**: Use specific namespaces when asking about particular EOS sessions
4. **Handle rate limits gracefully**: Implement exponential backoff on 429 responses
5. **Stream for long responses**: Use streaming for better UX with longer responses

---

## Support

For API support, contact: api@eosbot.ai

For EOS methodology questions, visit: [EOS Worldwide](https://www.eosworldwide.com)
