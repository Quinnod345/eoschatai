# EOSAI API Documentation

This document describes the key API endpoints available in EOSAI.

## Table of Contents

- [Authentication](#authentication)
- [Chat API](#chat-api)
- [Documents API](#documents-api)
- [Personas API](#personas-api)
- [Organizations API](#organizations-api)
- [Calendar Integration](#calendar-integration)

---

## Authentication

EOSAI uses NextAuth.js for authentication. All API endpoints require authentication unless otherwise noted.

### Session Check

```http
GET /api/auth/session
```

Returns the current user session.

**Response:**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "image": "https://..."
  },
  "expires": "2024-02-01T00:00:00.000Z"
}
```

### Authentication Headers

For API requests, include the session cookie or use the authorization header:

```http
Authorization: Bearer <session_token>
```

---

## Chat API

### Send Message

```http
POST /api/chat
```

Streams an AI response for a given message.

**Request Body:**
```json
{
  "id": "chat_uuid",
  "message": {
    "id": "msg_uuid",
    "role": "user",
    "content": "What is the EOS model?"
  },
  "selectedChatModel": "gpt-4o",
  "selectedPersonaId": "eos-implementer",
  "selectedProfileId": "quarterly-session-facilitator"
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Chat session UUID |
| `message` | object | Yes | The user message object |
| `selectedChatModel` | string | No | AI model to use (default: gpt-4o) |
| `selectedPersonaId` | string | No | Persona ID for specialized responses |
| `selectedProfileId` | string | No | Profile ID for persona sub-specialization |

**Response:** Server-Sent Events (SSE) stream

```
data: {"type":"text","content":"The EOS model..."}
data: {"type":"text","content":" consists of six key components..."}
data: {"type":"done"}
```

### Get Chat History

```http
GET /api/history
```

Returns the user's chat history.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max chats to return (default: 20) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "chats": [
    {
      "id": "chat_uuid",
      "title": "EOS Implementation Discussion",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T11:45:00Z"
    }
  ],
  "total": 42
}
```

### Delete Chat

```http
DELETE /api/chat?id={chatId}
```

Deletes a chat and all its messages.

**Response:**
```json
{
  "success": true
}
```

---

## Documents API

### Upload Document

```http
POST /api/documents/upload
```

Uploads a document for RAG (Retrieval-Augmented Generation).

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The document file (PDF, DOCX, TXT, XLSX) |
| `personaId` | string | No | Associate with specific persona |

**Supported File Types:**
- PDF (`.pdf`)
- Word Documents (`.docx`)
- Text files (`.txt`)
- Excel spreadsheets (`.xlsx`)
- Images with OCR (`.png`, `.jpg`)

**Response:**
```json
{
  "id": "doc_uuid",
  "filename": "quarterly-report.pdf",
  "fileType": "application/pdf",
  "fileSize": 245000,
  "chunks": 15,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### List Documents

```http
GET /api/documents
```

Returns all documents for the authenticated user.

**Response:**
```json
{
  "documents": [
    {
      "id": "doc_uuid",
      "filename": "quarterly-report.pdf",
      "fileType": "application/pdf",
      "fileSize": 245000,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Delete Document

```http
DELETE /api/documents/{documentId}
```

Removes a document and its embeddings from the system.

**Response:**
```json
{
  "success": true
}
```

---

## Personas API

### List Personas

```http
GET /api/personas
```

Returns available personas for the user.

**Response:**
```json
{
  "personas": [
    {
      "id": "eos-implementer",
      "name": "EOS Implementer",
      "description": "Expert EOS Implementer with deep knowledge...",
      "isSystemPersona": true,
      "profiles": [
        {
          "id": "quarterly-session-facilitator",
          "name": "Quarterly Session Facilitator"
        }
      ]
    },
    {
      "id": "custom_uuid",
      "name": "My Custom Assistant",
      "description": "Specialized for my company...",
      "isSystemPersona": false
    }
  ]
}
```

### Create Persona

```http
POST /api/personas
```

Creates a custom persona.

**Request Body:**
```json
{
  "name": "Sales Coach",
  "description": "Helps with sales strategies and objection handling",
  "instructions": "You are an expert sales coach...",
  "icon": "💼"
}
```

**Response:**
```json
{
  "id": "persona_uuid",
  "name": "Sales Coach",
  "description": "Helps with sales strategies...",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Update Persona

```http
PATCH /api/personas/{personaId}
```

Updates a custom persona.

**Request Body:**
```json
{
  "name": "Updated Name",
  "instructions": "Updated instructions..."
}
```

### Delete Persona

```http
DELETE /api/personas/{personaId}
```

Deletes a custom persona and associated documents.

---

## Organizations API

### Create Organization

```http
POST /api/organizations
```

Creates a new organization.

**Request Body:**
```json
{
  "name": "Acme Corp",
  "domain": "acme.com"
}
```

**Response:**
```json
{
  "id": "org_uuid",
  "name": "Acme Corp",
  "domain": "acme.com",
  "inviteCode": "ACME2024",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Get Organization Members

```http
GET /api/organizations/{orgId}/members
```

Returns organization members (admin only).

**Response:**
```json
{
  "members": [
    {
      "id": "user_uuid",
      "email": "admin@acme.com",
      "name": "Admin User",
      "role": "admin",
      "joinedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Invite Member

```http
POST /api/organizations/{orgId}/email-invite
```

Sends an email invitation to join the organization.

**Request Body:**
```json
{
  "email": "newuser@acme.com",
  "role": "member"
}
```

### Join Organization

```http
POST /api/organizations/join
```

Join an organization using an invite code.

**Request Body:**
```json
{
  "inviteCode": "ACME2024"
}
```

---

## Calendar Integration

### Get Calendar Events

```http
GET /api/calendar/events
```

Retrieves upcoming calendar events (requires Google Calendar connection).

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `days` | number | Days ahead to fetch (default: 7) |
| `maxResults` | number | Maximum events (default: 10) |

**Response:**
```json
{
  "events": [
    {
      "id": "event_123",
      "summary": "Weekly L10 Meeting",
      "start": "2024-01-15T09:00:00Z",
      "end": "2024-01-15T10:30:00Z",
      "location": "Conference Room A",
      "attendees": ["john@acme.com", "jane@acme.com"]
    }
  ]
}
```

### Create Calendar Event

```http
POST /api/calendar/events
```

Creates a new calendar event.

**Request Body:**
```json
{
  "summary": "Quarterly Planning Session",
  "description": "Q1 planning with leadership team",
  "start": "2024-01-20T09:00:00Z",
  "end": "2024-01-20T17:00:00Z",
  "attendees": ["team@acme.com"]
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required or invalid |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

API requests are rate limited based on subscription tier:

| Tier | Requests/minute | Requests/day |
|------|-----------------|--------------|
| Free | 20 | 1,000 |
| Premium | 60 | 10,000 |
| Enterprise | 200 | Unlimited |

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1705312800
```

---

## Webhooks (Enterprise)

Enterprise customers can configure webhooks for real-time events.

### Supported Events

- `chat.created` - New chat session started
- `chat.completed` - Chat session ended
- `document.uploaded` - Document uploaded
- `member.joined` - New organization member

### Webhook Payload

```json
{
  "event": "chat.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "chatId": "chat_uuid",
    "userId": "user_uuid"
  },
  "signature": "sha256=..."
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Using fetch
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    id: chatId,
    message: { role: 'user', content: 'Hello' },
  }),
});

// Stream the response
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(new TextDecoder().decode(value));
}
```

### cURL

```bash
# Send a chat message
curl -X POST https://eosbot.ai/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "id": "chat-uuid",
    "message": {
      "role": "user",
      "content": "What is EOS?"
    }
  }'
```

---

For more examples and detailed integration guides, see our [Documentation](https://docs.eoschatai.com).
