# Circle Sync System

This document describes the full Circle membership-to-plan sync system in EOS AI, including:

- User-initiated Circle connect flow
- Circle webhook sync flow
- Legacy Circle webhook + reconciliation flow
- Plan/entitlement behavior with Circle-backed orgs
- Operational configuration and troubleshooting

---

## Goals

- Map Circle tiers to EOS AI plans (`free`, `pro`, `business`)
- Keep user access in sync when Circle membership changes
- Allow Stripe and Circle to coexist without clobbering each other
- Support Circle-backed orgs as resource-sharing only (not seat-billed)

---

## Tier Mapping

Tier mapping is centralized in `lib/integrations/circle.ts`:

- `discoverer` -> `free`
- `explorer` (or configured middle tier) -> `pro`
- `mastery` -> `business`

Env overrides:

- `CIRCLE_TIER_FREE`
- `CIRCLE_TIER_PRO`
- `CIRCLE_TIER_BUSINESS`

Fallback aliases are also supported (for example: `strengthen`, `pro`, `business`, `team`).

---

## Data Model

Schema updates are in `lib/db/schema.ts` and migration `drizzle/0055_circle_subscription_source.sql`.

### User

- `plan` (`plan_type`)
- `subscriptionSource` (`subscription_source`: `stripe | circle`)
- `circleId` (new canonical Circle member id)
- `circleMemberEmail` (canonical Circle email used for matching)
- `circleMemberId` (legacy field retained for compatibility)

### Org

- `plan`
- `subscriptionSource` (`stripe | circle`)
- `seatCount`, `pendingRemoval`, `stripeSubscriptionId`

### Shared infra tables

- `WebhookEvents`: idempotency/dedup for webhook processing
- `CircleSyncLog`: legacy Circle sync logging/audit trail

---

## High-Level Architecture

```mermaid
flowchart TD
    userAction[User clicks Circle connect] --> connectApi[/api/integrations/circle/connect]
    connectApi --> memberLookup[Circle member lookup by email]
    memberLookup --> tierMap[Map Circle tier to EOS plan]
    tierMap --> updateUser[Update User plan and subscriptionSource circle]
    updateUser --> entitlements[Invalidate and recompute entitlements]
    updateUser --> optionalOrg[Optional Circle resource org creation for Mastery]

    circleWebhook[Circle webhook event] --> webhookApi[/api/integrations/circle/webhook]
    webhookApi --> verifySig[Verify signature if CIRCLE_WEBHOOK_SECRET is set]
    verifySig --> dedupe[Deduplicate via WebhookEvents]
    dedupe --> resolveTier[Resolve tier from payload or Circle lookup]
    resolveTier --> webhookUpdate[Update User plan and subscriptionSource circle]
    webhookUpdate --> webhookEntitlements[Recompute entitlements]

    legacyWebhook[/api/webhooks/circle] --> legacySync[lib/integrations/circle-sync.ts]
    legacyCron[/api/cron/circle-sync] --> legacySync
    legacySync --> legacyLogs[CircleSyncLog entries]
```

---

## Runtime Flows

## 1) User-Initiated Connect Flow

Entry points:

- UI CTA in `components/premium-features-modal.tsx` (`Already have Circle? Connect membership`)
- Modal container in `components/account-provider.tsx`
- UX flow in `components/circle-connect-flow.tsx`

API:

- `POST /api/integrations/circle/connect` (`app/api/integrations/circle/connect/route.ts`)

Behavior:

1. Auth required
2. Looks up member in Circle via `getMemberByEmail()` using the authenticated account email (no user-entered email override)
3. Maps tier to plan via `mapCircleTierToPlan()`
4. Updates user:
   - `plan = mappedPlan`
   - `subscriptionSource = 'circle'`
   - `circleId`, `circleMemberId` (legacy), `circleMemberEmail`
5. Recomputes/broadcasts entitlements
6. If `mappedPlan === 'business'` and `createOrg === true`, creates Circle org:
   - `org.subscriptionSource = 'circle'`
   - `org.plan = 'free'` (resource-sharing org model)
   - Adds owner role and attaches user to org

---

## 2) New Circle Webhook Sync Flow

API:

- `POST /api/integrations/circle/webhook` (`app/api/integrations/circle/webhook/route.ts`)

Behavior:

1. Parses raw JSON payload
2. Verifies signature if `CIRCLE_WEBHOOK_SECRET` exists
3. Dedupes via `WebhookEvents`
4. Extracts event id/member id/email/tier from known payload paths
5. If tier missing but email exists, performs Circle lookup to resolve tier
6. Maps tier -> plan
7. Resolves target user by:
   - `circleId`
   - `circleMemberEmail`
   - account `email` fallback
8. Updates user to Circle source + mapped plan
9. Recomputes/broadcasts entitlements

If user is not found, event is still marked processed and returned as ignored.

---

## 3) Legacy Circle Sync System (Still Present)

Main files:

- `app/api/webhooks/circle/route.ts`
- `lib/integrations/circle-sync.ts`
- `app/api/cron/circle-sync/route.ts`
- `app/api/admin/circle-sync/route.ts`

Capabilities:

- Handles webhook-style payment/tier payloads
- Can resolve native Circle payload IDs to member/paywall names
- Creates users when needed, updates plans, logs sync actions to `CircleSyncLog`
- Nightly reconciliation job through `POST /api/cron/circle-sync`
- Admin log/metrics endpoint via `GET /api/admin/circle-sync`

Feature flag:

- `FEATURE_FLAG_CIRCLE_SYNC` gates legacy webhook + cron routes

---

## Entitlements and Org Behavior

Entitlement source logic in `lib/entitlements/index.ts`:

- If `org.subscriptionSource === 'circle'`:
  - Effective entitlement plan comes from `user.plan` (individual membership)
- Else:
  - Effective plan is `org.plan` when in org, otherwise `user.plan`

This enforces the resource-sharing model:

- Circle org membership shares resources (personas/docs)
- It does **not** share business subscription access
- Access remains tied to each member's own plan source/tier

---

## Seat and Billing Behavior for Circle Orgs

Circle orgs bypass seat-billing mechanics:

- `lib/organizations/seat-enforcement.ts`
  - `hasAvailableSeats()` returns true for Circle orgs
  - `updateOrgSeatCount()` no-ops for Circle orgs
  - seat usage returns effectively unlimited availability

- `app/api/organizations/[orgId]/seats/route.ts`
  - Returns error for Circle orgs (`seat management` disabled)

- Join/accept flows (`app/api/organizations/join/route.ts`, `app/api/organizations/accept/route.ts`)
  - Skip seat-cap checks for Circle orgs
  - Keep member's existing plan for Circle orgs (no org-plan overwrite)

- Leave/remove flows preserve Circle plans:
  - `app/api/organizations/leave/route.ts`
  - `app/api/organizations/[orgId]/members/[userId]/route.ts`

---

## Stripe Interop Rules

Stripe should not downgrade Circle-owned access:

- `lib/billing/stripe.ts` checks `subscriptionSource` before clearing plans
- For `customer.subscription.deleted` and related clear paths:
  - Skip downgrade when user/org source is `circle`
- Stripe checkout/subscription apply paths explicitly set source to `stripe`

This prevents accidental access loss when a user has both systems in play.

---

## Required and Optional Environment Variables

### Primary Circle connect/webhook flow

- `CIRCLE_API_TOKEN` or `CIRCLE_HEADLESS_AUTH_TOKEN`
- `CIRCLE_COMMUNITY_ID` (optional, recommended for scoped search)
- `CIRCLE_WEBHOOK_SECRET` (optional but strongly recommended)
- `CIRCLE_TIER_FREE` (optional)
- `CIRCLE_TIER_PRO` (optional)
- `CIRCLE_TIER_BUSINESS` (optional)
- `CIRCLE_HEADLESS_API_BASE_URL` (optional override)

### Legacy sync/reconciliation flow

- `FEATURE_FLAG_CIRCLE_SYNC`
- `CIRCLE_ADMIN_API_TOKEN` (for admin reconciliation paths)
- `CIRCLE_ADMIN_API_BASE_URL` (optional)
- `CIRCLE_PAYWALL_ID_MAP` (optional JSON mapping)
- `CRON_SECRET` (required for `/api/cron/circle-sync`)

---

## Operational Notes

- Webhook idempotency:
  - New webhook route dedupes via `WebhookEvents`
  - Legacy flow also dedupes and logs action results

- Observability:
  - Legacy actions are queryable via `/api/admin/circle-sync`
  - New webhook flow currently relies on standard app logs + `WebhookEvents`

- Routing strategy:
  - Avoid sending the same Circle events to both `/api/webhooks/circle` and `/api/integrations/circle/webhook` unless dual-processing is explicitly intended.

- Backward compatibility:
  - `circleMemberId` remains in use in legacy paths
  - New paths write both `circleId` and `circleMemberId` to avoid drift

---

## Known Constraints

- New Circle webhook route supports signature verification only when `CIRCLE_WEBHOOK_SECRET` is configured.
- Tier extraction is payload-shape tolerant, but unknown tier names are rejected until mapping/aliases are updated.
- Circle resource orgs intentionally do not elevate member subscription access.

