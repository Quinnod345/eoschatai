# EOSAI Complete API Reference

Complete REST API documentation for EOSAI - Enterprise Operating System AI Assistant.

**Last Updated:** February 4, 2026  
**Version:** 3.0.19

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Rate Limits](#rate-limits)
- [Error Handling](#error-handling)
- [Public API (v1)](#public-api-v1)
- [Internal API](#internal-api)
  - [Chat](#chat)
  - [User](#user)
  - [Organizations](#organizations)
  - [Documents](#documents)
  - [Personas](#personas)
  - [Voice & Recordings](#voice--recordings)
  - [Composer](#composer)
  - [Calendar](#calendar)
  - [Billing](#billing)
  - [API Keys](#api-keys)
  - [Search](#search)
  - [Feedback](#feedback)
  - [L10 Meetings](#l10-meetings)
  - [Circle Courses](#circle-courses)
  - [Admin](#admin)

---

## Overview

### Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://eosbot.ai/api` |
| Development | `http://localhost:3000/api` |

### API Types

EOSAI has two API types:

1. **Public API (`/api/v1/*`)** - OpenAI-compatible endpoints for external integrations. Requires API key authentication.
2. **Internal API (`/api/*`)** - Web app endpoints. Requires session authentication via Auth.js cookies.

---

## Authentication

### Public API (API Key)

Pass your API key in the `Authorization` header:

```bash
Authorization: Bearer eosai_sk_your_api_key_here
```

Or use the `X-API-Key` header:

```bash
X-API-Key: eosai_sk_your_api_key_here
```

### Internal API (Session)

Internal endpoints require authentication via Auth.js session cookies. Users authenticate through the web application at `https://eosbot.ai/login`.

---

## Rate Limits

### Public API Rate Limits

| Limit Type | Default | Header |
|------------|---------|--------|
| Requests per minute (RPM) | 60 | `X-RateLimit-Limit-RPM` |
| Requests per day (RPD) | 1,000 | `X-RateLimit-Limit-RPD` |

Rate limit headers included in responses:
- `X-RateLimit-Remaining-RPM`
- `X-RateLimit-Remaining-RPD`
- `X-RateLimit-Reset-RPM`
- `X-RateLimit-Reset-RPD`

### Internal API Rate Limits (by Plan)

| Plan | Chat Messages/Day | Storage | Custom Personas |
|------|-------------------|---------|-----------------|
| Free | 25 | 100MB | 3 |
| Pro | 100 | 1GB | 10 |
| Business | Unlimited | 10GB | Unlimited |

---

## Error Handling

### Public API Errors (OpenAI-compatible)

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "api_error",
    "code": "invalid_api_key"
  }
}
```

### Internal API Errors

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "requiredPlan": "pro",
  "feature": "feature_name"
}
```

### Common Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `BAD_REQUEST` | Invalid request parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `FEATURE_LOCKED` | Feature requires higher plan |
| 403 | `LIMIT_REACHED` | Usage limit exceeded |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

---

# Public API (v1)

The Public API provides OpenAI-compatible endpoints for programmatic access to EOS methodology expertise.

## POST /api/v1/chat

Create a chat completion with EOS knowledge.

### Request

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

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `messages` | array | Yes | - | Array of message objects with `role` and `content` |
| `model` | string | No | `eosai-v1` | Model to use |
| `stream` | boolean | No | `false` | Enable SSE streaming |
| `temperature` | number | No | `0.7` | Sampling temperature (0-2) |
| `max_tokens` | number | No | `4096` | Maximum response tokens (1-16384) |
| `top_p` | number | No | - | Nucleus sampling parameter |
| `frequency_penalty` | number | No | - | Frequency penalty (-2 to 2) |
| `presence_penalty` | number | No | - | Presence penalty (-2 to 2) |
| `stop` | string/array | No | - | Stop sequences |
| `include_eos_context` | boolean | No | `true` | Include EOS RAG context |
| `eos_namespace` | string | No | `eos-implementer` | EOS knowledge namespace |

### Response (Non-streaming)

```json
{
  "id": "eosai-abc123",
  "object": "chat.completion",
  "created": 1707048000,
  "model": "eosai-v1",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "A Level 10 Meeting is a weekly 90-minute meeting..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 250,
    "total_tokens": 265
  }
}
```

### Response (Streaming)

Server-Sent Events in OpenAI format:

```
data: {"id":"eosai-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"A "},"finish_reason":null}]}

data: [DONE]
```

---

## GET /api/v1/models

List available models and EOS namespaces.

### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "eosai-v1",
      "object": "model",
      "created": 1706140800,
      "owned_by": "eosai",
      "description": "Default EOSAI model",
      "context_window": 200000,
      "max_output_tokens": 4096,
      "capabilities": ["chat", "eos_rag"]
    },
    {
      "id": "eosai-v1-fast",
      "object": "model",
      "description": "Fast model for quick responses",
      "capabilities": ["chat", "eos_rag"]
    },
    {
      "id": "eosai-v1-pro",
      "object": "model",
      "description": "Pro model with extended thinking",
      "max_output_tokens": 16384,
      "capabilities": ["chat", "eos_rag", "extended_thinking"]
    }
  ],
  "eos_namespaces": [
    {"id": "eos-implementer", "name": "EOS Implementer"},
    {"id": "eos-implementer-quarterly-session", "name": "Quarterly Session"},
    {"id": "eos-implementer-focus-day", "name": "Focus Day"},
    {"id": "eos-implementer-vision-day-1", "name": "Vision Building Day 1"},
    {"id": "eos-implementer-vision-day-2", "name": "Vision Building Day 2"}
  ]
}
```

---

## GET /api/v1/usage

Get usage statistics for your API key.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | `30` | Days to include (1-90) |

### Response

```json
{
  "object": "usage",
  "api_key": {
    "id": "uuid",
    "name": "My Production Key",
    "prefix": "eosai_sk_abcd...",
    "is_active": true,
    "scopes": ["chat"]
  },
  "rate_limits": {
    "requests_per_minute": 60,
    "requests_per_day": 1000,
    "remaining_rpm": 55,
    "remaining_rpd": 850
  },
  "usage": {
    "period_days": 30,
    "total_requests": 1250,
    "total_tokens": 875000,
    "average_response_time_ms": 1200,
    "error_rate": 0.02
  },
  "usage_by_day": [
    {"date": "2024-02-01", "requests": 45, "tokens": 31500}
  ]
}
```

---

# Internal API

All internal endpoints require session authentication.

---

## Chat

### POST /api/chat

Send a message and receive AI response (streaming).

**Request:**
```json
{
  "id": "chat-uuid",
  "message": {
    "id": "msg-uuid",
    "role": "user",
    "parts": [{"type": "text", "text": "What is the V/TO?"}]
  },
  "selectedPersonaId": "eos-implementer",
  "selectedChatModel": "claude-sonnet"
}
```

**Response:** Server-Sent Events stream with AI response.

### GET /api/chat/{id}

Get a chat by ID.

**Response:**
```json
{
  "id": "uuid",
  "title": "Chat Title",
  "createdAt": "2024-02-04T12:00:00Z",
  "personaId": "eos-implementer"
}
```

### DELETE /api/chat/{id}

Delete a chat and all its messages.

### POST /api/chat/{id}/stop

Stop an in-progress streaming response.

### GET /api/chat/{id}/verify

Verify chat ownership.

### POST /api/chat/save-message

Save a message to an existing chat.

### GET /api/chats/messages

Get messages for a chat.

**Query Parameters:**
- `chatId` (required): Chat ID
- `limit`: Maximum messages to return

### GET /api/chats/by-document

Get chats associated with a document.

---

## User

### GET /api/me

Get current user info and entitlements.

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "entitlements": {
    "plan": "pro",
    "features": {...}
  }
}
```

### GET /api/me/plan

Get user's current plan details.

### GET /api/user-settings

Get user settings.

### POST /api/user-settings

Update user settings.

**Request:**
```json
{
  "defaultModel": "claude-sonnet",
  "theme": "dark",
  "showSuggestions": true
}
```

### POST /api/user/clear-history

Clear all chat history.

### DELETE /api/user/delete-account

Permanently delete user account and all data.

### GET /api/user/export-data

Export all user data as JSON.

### GET /api/user/data-stats

Get storage and usage statistics.

### GET /api/user/message-count

Get message usage counts.

### POST /api/user/profile-picture

Upload or update profile picture.

### POST /api/user/switch-organization

Switch to a different organization.

### GET /api/user/organizations

List user's organizations.

---

## Organizations

### GET /api/organizations

Get current organization.

### POST /api/organizations

Create a new organization.

**Request:**
```json
{
  "name": "My Company"
}
```

### POST /api/organizations/join

Join organization with invite code.

**Request:**
```json
{
  "inviteCode": "ABC123"
}
```

### POST /api/organizations/leave

Leave current organization.

### POST /api/organizations/accept

Accept email invitation.

### GET /api/organizations/{orgId}/members

List organization members.

### DELETE /api/organizations/{orgId}/members/{userId}

Remove a member from organization.

### PATCH /api/organizations/{orgId}/members/{userId}/role

Update member's role.

**Request:**
```json
{
  "role": "admin"
}
```

### GET /api/organizations/{orgId}/invitations

List pending invitations.

### POST /api/organizations/{orgId}/email-invite

Send email invitation.

**Request:**
```json
{
  "email": "newuser@example.com",
  "role": "member"
}
```

### GET /api/organizations/{orgId}/invite-code

Get or regenerate invite code.

### GET /api/organizations/{orgId}/seats

Get seat usage information.

### POST /api/organizations/{orgId}/transfer-ownership

Transfer organization ownership.

### DELETE /api/organizations/{orgId}/delete

Delete organization.

---

## Documents

### GET /api/documents

List documents by category or composer kind.

**Query Parameters:**
- `category`: `Scorecard`, `VTO`, `Rocks`, `A/C`, `Core Process`, `Other`
- `composerKind`: `text`, `code`, `image`, `sheet`, `chart`, `vto`, `accountability`
- `search`: Full-text search query
- `limit`: Max results (1-25)

### POST /api/documents/upload

Upload a document.

**Request:** `multipart/form-data`
- `file`: Document file
- `category`: Document category

### POST /api/documents/bulk-upload

Upload multiple documents.

### POST /api/documents/bulk-delete

Delete multiple documents.

### GET /api/documents/check-duplicate

Check for duplicate documents by hash.

### GET /api/documents/download

Download a document.

### POST /api/documents/convert

Convert document format.

### GET /api/documents/count

Get document count by category.

### POST /api/documents/toggle-context

Toggle document inclusion in AI context.

### GET /api/documents/versions

Get document version history.

### GET /api/documents/shared-with-me

List documents shared with user.

### POST /api/documents/sharing

Share a document.

### GET /api/documents/analytics

Get document analytics.

---

## User Documents (Legacy)

### GET /api/user-documents

List uploaded user documents.

---

## Personas

### GET /api/personas

List all available personas.

**Response:**
```json
{
  "systemPersonas": [...],
  "userPersonas": [...],
  "sharedPersonas": [...]
}
```

### POST /api/personas

Create a new persona.

**Request:**
```json
{
  "name": "Sales Coach",
  "description": "Helps with sales strategies",
  "instructions": "You are an expert sales coach...",
  "documentIds": ["doc-1", "doc-2"],
  "isShared": false
}
```

### GET /api/personas/{id}

Get persona by ID.

### PATCH /api/personas/{id}

Update a persona.

### DELETE /api/personas?id={id}

Delete a persona.

### POST /api/personas/{id}/icon

Upload persona icon.

### GET /api/personas/{id}/profiles

Get persona sub-profiles.

### POST /api/personas/process-document

Process document for persona knowledge base.

---

## Voice & Recordings

### GET /api/voice/recordings

List all recordings.

**Response:**
```json
{
  "recordings": [{
    "recording": {
      "id": "uuid",
      "title": "Team Meeting",
      "audioUrl": "https://...",
      "duration": 3600,
      "createdAt": "2024-02-04T12:00:00Z"
    },
    "transcript": {
      "fullTranscript": "...",
      "segments": [...]
    }
  }]
}
```

### POST /api/voice/recordings

Upload a new recording.

**Request:** `multipart/form-data`
- `audio`: Audio file
- `title`: Recording title
- `duration`: Duration in seconds
- `meetingType`: Optional meeting type
- `tags`: JSON array of tags

### GET /api/voice/recordings/{id}

Get recording by ID.

### DELETE /api/voice/recordings/{id}

Delete a recording.

### POST /api/voice/recordings/transcribe

Manually trigger transcription.

### GET /api/voice/recordings/status

Get transcription status.

### POST /api/voice/recordings/analyze

Analyze recording content.

### POST /api/voice/recordings/generate-summary

Generate AI summary of recording.

### POST /api/voice/recordings/send-to-chat

Send recording to a chat for analysis.

### GET /api/voice/messages

Get voice messages.

### POST /api/voice/batch-save

Batch save voice data.

### POST /api/voice/session

Create voice session.

---

## Composer

### GET /api/composer-documents/{id}/history

Get document edit history.

### POST /api/composer-documents/{id}/history/undo

Undo last edit.

### POST /api/composer-documents/{id}/history/redo

Redo last undone edit.

### GET /api/composer-documents/{id}/history/state

Get current document state.

### GET /api/composer-documents/history/session/{sessionId}

Get history by session.

### GET /api/composer-documents/history/version/{versionId}

Get specific version.

---

## Calendar

### GET /api/calendar/status

Check calendar connection status.

### GET /api/calendar/auth

Initiate Google Calendar OAuth.

### GET /api/calendar/auth/callback

OAuth callback handler.

### POST /api/calendar/disconnect

Disconnect calendar.

### GET /api/calendar/events

List calendar events.

**Query Parameters:**
- `start`: Start date (ISO 8601)
- `end`: End date (ISO 8601)
- `maxResults`: Maximum events

### POST /api/calendar/events

Create a calendar event.

**Request:**
```json
{
  "summary": "Team Meeting",
  "description": "Weekly sync",
  "start": "2024-02-04T14:00:00Z",
  "end": "2024-02-04T15:00:00Z",
  "attendees": ["user@example.com"]
}
```

---

## Billing

### GET /api/billing/prices

Get available pricing plans.

### POST /api/billing/checkout

Create Stripe checkout session.

**Request:**
```json
{
  "plan": "pro",
  "billing": "monthly",
  "seats": 5,
  "orgId": "org-uuid"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

### POST /api/billing/portal

Get Stripe customer portal URL.

### POST /api/billing/webhook

Stripe webhook handler.

### GET /api/billing/admin

Admin billing overview (admin only).

---

## API Keys

### GET /api/api-keys

List user's API keys.

**Response:**
```json
{
  "keys": [{
    "id": "uuid",
    "name": "Production Key",
    "keyPrefix": "eosai_sk_abc...",
    "usageCount": 1500,
    "lastUsedAt": "2024-02-04T12:00:00Z",
    "createdAt": "2024-01-15T10:00:00Z"
  }]
}
```

### POST /api/api-keys

Create a new API key.

**Request:**
```json
{
  "name": "My API Key",
  "expiresAt": "2025-01-01T00:00:00Z"
}
```

**Response:**
```json
{
  "key": {
    "id": "uuid",
    "name": "My API Key",
    "keyPrefix": "eosai_sk_abc...",
    "fullKey": "eosai_sk_abcdef123456..."
  },
  "message": "Save this key now - it will not be shown again."
}
```

### GET /api/api-keys/{id}

Get API key details.

### DELETE /api/api-keys/{id}

Revoke an API key.

### GET /api/api-keys/{id}/usage

Get API key usage statistics.

### GET /api/check-api-key

Validate an API key.

---

## Search

### GET /api/search

Search across all content.

**Query Parameters:**
- `q` (required): Search query
- `types`: Content types to search
- `dateRange`: Date range filter
- `personas`: Filter by personas
- `documentTypes`: Filter by document types
- `limit`: Max results
- `offset`: Pagination offset

### GET /api/search/filters

Get available search filters.

---

## Feedback

### GET /api/feedback

Get feedback history.

### POST /api/feedback

Submit feedback on a response.

**Request:**
```json
{
  "messageId": "msg-uuid",
  "rating": "positive",
  "category": "helpfulness",
  "comment": "Very helpful explanation!"
}
```

### POST /api/context-feedback

Submit feedback on RAG context quality.

---

## L10 Meetings

### GET /api/l10

Get L10 meeting data.

### GET /api/l10/todos

Get todos from L10 meetings.

### GET /api/l10/issues

Get issues (IDS) from L10 meetings.

---

## Messages

### GET /api/messages/{id}/context-sources

Get context sources used for a message.

### GET /api/messages/check-pinned

Check for pinned messages.

---

## Memories

### GET /api/memories

Get AI memories (learned context).

---

## Predictions

### GET /api/predictions

Get AI predictions.

### POST /api/predictions/rank

Rank predictions.

---

## Profiles

### GET /api/profiles/{id}

Get user profile.

---

## Storage

### GET /api/storage/stats

Get storage usage statistics.

---

## Analytics

### POST /api/analytics/events

Track analytics event.

---

## Export

### GET /api/export/vto

Export V/TO document.

### GET /api/export/ac

Export Accountability Chart.

### GET /api/export/meeting

Export meeting notes.

---

## Circle Courses

### POST /api/circle/activate-course

Activate a Circle course.

### POST /api/circle/activate-course-system

System activation for courses.

### GET /api/circle/check-activation

Check course activation status.

### GET /api/circle/course-details

Get course details.

### POST /api/circle/sync-course

Sync course content.

### POST /api/circle/process-embeddings

Process course embeddings.

### GET /api/circle/admin/personas

Admin: manage course personas.

---

## Account

### POST /api/account/update-email

Update account email.

### POST /api/account/update-password

Update account password.

---

## Provider Override

### POST /api/provider-override

Override AI provider (admin).

---

## Integrations

### POST /api/integrations/calendar/connect

Connect calendar integration.

---

## Admin

### GET /api/admin/subscription-health

Get subscription health metrics (admin only).

---

## Cron Jobs (Internal)

These endpoints are called by scheduled jobs:

- `GET /api/cron/grace-period-reminders`
- `GET /api/cron/subscription-health-check`
- `GET /api/cron/usage/daily`
- `GET /api/cron/usage/monthly`

---

## Webhooks

### POST /api/webhooks/resend

Resend email webhook handler.

---

## Debug (Development Only)

### POST /api/debug/reset-usage

Reset usage counters (dev only).

---

## Database

### POST /api/db-migrations

Run database migrations (admin only).

---

## Document Beacon

### POST /api/document/beacon

Track document activity (analytics).

---

## User Settings (Additional)

### DELETE /api/user-settings/google-calendar-token

Remove Google Calendar token.

---

## Migrate

### POST /api/migrate-user-settings

Migrate user settings to new schema.

---

# Code Examples

## Python (OpenAI SDK Compatible)

```python
from openai import OpenAI

client = OpenAI(
    api_key="eosai_sk_your_key_here",
    base_url="https://eosbot.ai/api/v1",
)

response = client.chat.completions.create(
    model="eosai-v1",
    messages=[
        {"role": "user", "content": "What makes a good Rock?"}
    ],
)

print(response.choices[0].message.content)
```

## JavaScript/TypeScript

```typescript
const response = await fetch('https://eosbot.ai/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'What is the People Analyzer?' }],
    model: 'eosai-v1',
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

## cURL

```bash
curl -X POST https://eosbot.ai/api/v1/chat \
  -H "Authorization: Bearer eosai_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What are the 6 Key Components?"}],
    "model": "eosai-v1"
  }'
```

---

# OpenAPI Specification

Full OpenAPI 3.1 specification available at [`docs/openapi.yaml`](./openapi.yaml).

---

# Support

- **API Support:** api@eosbot.ai
- **Documentation:** https://docs.eosbot.ai
- **EOS Methodology:** https://www.eosworldwide.com
