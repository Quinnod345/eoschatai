# Organization Email Invitation Tracking

This document explains the email invitation tracking system for organization business plans.

## Overview

The system tracks email invitation status using Resend's webhook capabilities, allowing organization admins to see when invitations are sent, delivered, opened, clicked, and accepted.

## Implementation Details

### 1. Database Schema

Created a new `OrgInvitation` table to track invitation status:
- `id`: Unique invitation ID
- `orgId`: Organization ID
- `invitedByUserId`: User who sent the invitation
- `email`: Recipient email address
- `inviteCode`: Invitation code for acceptance
- `resendId`: Resend email ID for webhook tracking
- `status`: Current status (sent, delivered, opened, clicked, bounced, failed, accepted)
- `sentAt`, `deliveredAt`, `openedAt`, `clickedAt`, `acceptedAt`: Timestamps for each status
- `expiresAt`: Invitation expiration date
- `metadata`: Additional data from Resend events

### 2. Resend Webhook Endpoint

Created `/api/webhooks/resend` to receive email status updates:
- Handles Resend webhook events (delivered, opened, clicked, bounced, complained)
- Updates invitation status in the database
- Preserves status progression (e.g., won't downgrade from "clicked" to "opened")

### 3. Updated Invitation APIs

- **POST `/api/organizations/[orgId]/email-invite`**: 
  - Creates tracking record when sending invitations
  - Prevents duplicate active invitations
  - Stores Resend email ID for tracking

- **GET `/api/organizations/accept`**:
  - Marks invitation as "accepted" when user joins

- **GET `/api/organizations/[orgId]/invitations`**:
  - Fetches all pending invitations with status
  - Shows invite details for organization admins

- **DELETE `/api/organizations/[orgId]/invitations`**:
  - Allows canceling/revoking invitations

### 4. UI Updates

Enhanced the organization settings component:
- `EmailInviteForm`: Triggers refresh after sending
- `PendingInvitations`: New component showing invitation list with:
  - Email address
  - Status badge (Sent, Delivered, Opened, Clicked, etc.)
  - Invitation date
  - Cancel button for each invitation

## Setup Requirements

1. **Database Migration**: Run `npm run db:auto-migrate` to create the new table
2. **Resend Webhook**: Configure Resend webhook endpoint in Resend dashboard:
   - URL: `https://your-domain.com/api/webhooks/resend`
   - Events: Select email.sent, email.delivered, email.opened, email.clicked, email.bounced
3. **Environment Variables**: 
   - `RESEND_WEBHOOK_SECRET`: For webhook signature verification
   - `NEXT_PUBLIC_APP_URL` or `APP_URL`: Should include full URL with protocol (e.g., `https://app.eosbot.ai`)

## Usage

1. Admin invites user via email in organization settings
2. System creates tracking record with "sent" status
3. Resend sends webhook events as email progresses
4. Status updates automatically: sent → delivered → opened → clicked
5. When user accepts, status changes to "accepted" and they're removed from pending list
6. Admin can see real-time status in the organization settings

## Status Flow

```
sent → delivered → opened → clicked → accepted
         ↓           ↓         ↓
      bounced     failed    failed
```

## Features

- Real-time status tracking via Resend webhooks
- Prevents duplicate invitations
- Automatic expiration handling
- Visual status badges in UI
- Ability to cancel pending invitations

## Troubleshooting

### Invalid URL Error in Production
If you see `TypeError: Invalid URL` with a URL like `app.eosbot.ai/invite/accept`:
- The environment variable is missing the protocol (`https://`)
- Solution: Ensure `NEXT_PUBLIC_APP_URL` or `APP_URL` includes the full URL with protocol
- The code now automatically adds `https://` in production if missing

