# EOSAI API Documentation

Complete REST API reference for EOSAI - Enterprise Operating System AI Assistant.

## Base URL

- **Production**: `https://eosbot.ai/api`
- **Development**: `http://localhost:3000/api`

## Authentication

All endpoints require authentication via Auth.js session cookies. Users must authenticate through the web application.

## Rate Limits

| Plan | Chat Messages/Day | Storage | Custom Personas |
|------|-------------------|---------|-----------------|
| Free | 25 | 100MB | 3 |
| Pro | 100 | 1GB | 10 |
| Business | Unlimited | 10GB | Unlimited |

---

## Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/me` | Get current user info and entitlements |
| GET | `/me/plan` | Get user's current plan |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat` | Send message (streaming response) |
| GET | `/chat/{id}` | Get chat by ID |
| DELETE | `/chat/{id}` | Delete chat |
| POST | `/chat/{id}/stop` | Stop streaming |
| GET | `/chats/messages` | Get messages for a chat |

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user-settings` | Get user settings |
| POST | `/user-settings` | Update settings |
| POST | `/user/clear-history` | Clear chat history |
| DELETE | `/user/delete-account` | Delete account |
| GET | `/user/export-data` | Export all data |
| GET | `/user/message-count` | Get usage counts |

### Organizations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/organizations` | Get current org |
| POST | `/organizations` | Create org |
| POST | `/organizations/join` | Join with invite code |
| POST | `/organizations/leave` | Leave org |
| GET | `/organizations/{orgId}/members` | List members |
| DELETE | `/organizations/{orgId}/members/{userId}` | Remove member |

### Calendar

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calendar/status` | Connection status |
| GET | `/calendar/auth` | Initiate OAuth |
| POST | `/calendar/disconnect` | Disconnect |
| GET | `/calendar/events` | List events |
| POST | `/calendar/events` | Create event |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user-documents` | List documents |

**Categories**: `scorecard`, `rocks`, `vto`, `core_process`, `accountability_chart`, `other`

### Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/personas` | List all personas |
| POST | `/personas` | Create persona |
| DELETE | `/personas?id={id}` | Delete persona |
| GET | `/personas/{id}` | Get persona |
| PATCH | `/personas/{id}` | Update persona |
| GET | `/personas/{id}/profiles` | Get sub-profiles |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Search all content |

**Parameters**: `q`, `types`, `dateRange`, `personas`, `documentTypes`, `limit`, `offset`

### Feedback

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/feedback` | Get feedback history |
| POST | `/feedback` | Submit feedback |

**Categories**: `accuracy`, `helpfulness`, `tone`, `length`, `clarity`, `other`

### Voice

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/voice/recordings` | List recordings |
| POST | `/voice/recordings` | Upload recording |
| POST | `/voice/recordings/transcribe` | Transcribe |

### Composer

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/composer-documents/{id}/history` | Get history |
| POST | `/composer-documents/{id}/history/undo` | Undo |
| POST | `/composer-documents/{id}/history/redo` | Redo |

---

## Example: Send Chat Message

```bash
curl -X POST https://eosbot.ai/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "id": "chat-uuid",
    "message": {
      "id": "msg-uuid",
      "role": "user",
      "parts": [{"type": "text", "text": "What is the V/TO?"}]
    },
    "selectedPersonaId": "eos-implementer"
  }'
```

---

## Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `BAD_REQUEST` | Invalid request |
| 401 | `UNAUTHORIZED` | Not authenticated |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `FEATURE_LOCKED` | Requires higher plan |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `DAILY_LIMIT_REACHED` | Rate limited |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Related Documentation

- **[Chat API Reference](./CHAT_API.md)** - Detailed chat endpoint documentation with streaming protocols, message formats, tools, and examples
- **[Public API Reference](./PUBLIC-API.md)** - OpenAI-compatible v1 API for external integrations
- **[OpenAPI Specification](./openapi.yaml)** - Full OpenAPI 3.1 spec
