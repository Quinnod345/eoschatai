# Round 2: Additional Subscription Bugs Found

**Date**: October 8, 2025  
**Status**: 🔍 Discovered during comprehensive testing

---

## New Bugs Identified

### 1. 🚨 Email Change Doesn't Sync to Stripe

**File**: `app/api/account/update-email/route.ts`

**Problem**: When user changes email in app, Stripe customer email isn't updated

**Current Code**:
```typescript
// Update the email
await db.update(user).set({ email }).where(eq(user.id, session.user.id));
// ❌ Doesn't update Stripe customer
```

**Impact**:
- Stripe invoices go to old email
- Payment failure notifications go to wrong address
- Customer portal shows wrong email
- Refunds/receipts sent to old email

**Fix Required**:
```typescript
await db.update(user).set({ email }).where(eq(user.id, session.user.id));

// NEW: Update Stripe customer email
const [userRecord] = await db
  .select({ stripeCustomerId: user.stripeCustomerId })
  .from(user)
  .where(eq(user.id, session.user.id));

if (userRecord?.stripeCustomerId) {
  try {
    const { getStripeClient } = await import('@/lib/stripe/client');
    const stripe = getStripeClient();
    
    if (stripe) {
      await stripe.customers.update(userRecord.stripeCustomerId, {
        email: email,
      });
      console.log(`Updated Stripe customer ${userRecord.stripeCustomerId} email to ${email}`);
    }
  } catch (error) {
    console.error('Failed to update Stripe customer email:', error);
    // Continue - don't fail email update if Stripe fails
  }
}
```

**Priority**: P1 - High (affects billing communications)

---

### 2. ⚠️ Organization Name Has No Validation

**File**: `app/api/organizations/route.ts` (line 47)

**Current Code**:
```typescript
if (!name || typeof name !== 'string' || name.trim().length === 0) {
  return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
}
```

**Problems**:
- No max length validation
- No uniqueness check (multiple orgs can have same name)
- Allows special characters that might break UI
- No SQL injection protection (though parameterized queries help)

**Fix Required**:
```typescript
// Validate name
if (!name || typeof name !== 'string') {
  return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
}

const trimmedName = name.trim();

if (trimmedName.length === 0) {
  return NextResponse.json({ error: 'Organization name cannot be empty' }, { status: 400 });
}

if (trimmedName.length > 100) {
  return NextResponse.json({ error: 'Organization name must be 100 characters or less' }, { status: 400 });
}

// Optional: Check for profanity/banned words
// Optional: Check uniqueness (though not required)
```

**Priority**: P2 - Medium (data quality)

---

### 3. ⚠️ Unhandled Subscription Statuses: incomplete & incomplete_expired

**File**: `lib/billing/stripe.ts`

**Problem**: Missing status handling for:
- `incomplete` - Subscription created but first payment not confirmed
- `incomplete_expired` - First payment never confirmed, expired after 23 hours

**Current Code**: Only handles `active`, `trialing`, `past_due`, `unpaid`, `canceled`

**Fix Required**:
```typescript
// Check subscription status and handle edge cases
const status = subscription.status;

// Handle incomplete subscriptions (first payment not confirmed)
if (status === 'incomplete' || status === 'incomplete_expired') {
  console.log(
    `[stripe] Subscription ${subscription.id} is ${status}. First payment not completed.`
  );
  // Don't grant access for incomplete subscriptions
  return;
}

// ... existing status handling
```

**Impact**: Without this, incomplete subscriptions might grant access before payment

**Priority**: P1 - High (revenue protection)

---

### 4. ⚠️ Usage Counter Overflow

**File**: `lib/entitlements/index.ts` (line 479)

**Current Code**:
```typescript
const nextValue = Math.max(0, current[field] + delta);
```

**Problem**: What if usage counter overflows?
- `delta` could be huge number
- `current[field]` could be near MAX_SAFE_INTEGER
- Addition could exceed safe integer range
- Could wrap around to negative

**Fix Required**:
```typescript
const nextValue = Math.max(
  0, 
  Math.min(
    Number.MAX_SAFE_INTEGER, 
    current[field] + delta
  )
);
```

**Priority**: P3 - Low (extremely unlikely in practice)

---

### 5. ⚠️ Stripe Customer Email Mismatch

**Problem**: If Stripe customer email differs from DB email, which is source of truth?

**Scenarios**:
- User changes email in app → Stripe not updated (fixed above)
- User changes email via Stripe customer portal → App not updated
- Email bounces → Stripe marks it, app doesn't know

**Fix Required**: Add webhook handler for `customer.updated`

```typescript
case 'customer.updated': {
  const customer = event.data.object as Stripe.Customer;
  const previous = (event.data as any).previous_attributes as any;
  
  // Check if email changed
  if (previous?.email && customer.email !== previous.email) {
    // Find user by old stripeCustomerId
    const [user] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.stripeCustomerId, customer.id));
      
    if (user && customer.email) {
      // Update user email in database
      await db
        .update(userTable)
        .set({ email: customer.email })
        .where(eq(userTable.id, user.id));
        
      console.log(`Updated user ${user.id} email from ${user.email} to ${customer.email}`);
    }
  }
  break;
}
```

**Priority**: P2 - Medium (data consistency)

---

### 6. ⚠️ Admin Billing Tool Missing Entitlement Order Bug

**File**: `app/api/billing/admin/route.ts` (line 44)

**Current Code**:
```typescript
await getUserEntitlements(session.user.id);
await invalidateUserEntitlementsCache(session.user.id);
await broadcastEntitlementsUpdated(session.user.id);
```

**Problem**: SAME CACHE BUG as before! Cache should be invalidated FIRST.

**Fix Required**:
```typescript
// CRITICAL: Invalidate cache FIRST
await invalidateUserEntitlementsCache(session.user.id);
await getUserEntitlements(session.user.id);
await broadcastEntitlementsUpdated(session.user.id);
```

**Priority**: P0 - Critical (same as fixed bug)

---

### 7. ⚠️ No Protection Against Stripe Webhook Replay Attacks

**File**: `lib/billing/stripe.ts`

**Current Protection**:
- ✅ Webhook signature verification
- ✅ Event ID deduplication (`hasWebhookBeenProcessed`)

**Missing Protection**:
- ❌ No timestamp validation (events could be from months ago)
- ❌ No expiry on `webhookEvent` table (grows forever)
- ❌ Dedupe table never cleaned up

**Fix Required**:
```typescript
// In handleStripeWebhook
const eventTimestamp = event.created * 1000; // Convert to ms
const now = Date.now();
const fiveMinutes = 5 * 60 * 1000;

// Reject events older than 5 minutes
if (now - eventTimestamp > fiveMinutes) {
  console.warn(`[stripe] Rejecting old webhook event ${event.id} from ${new Date(eventTimestamp)}`);
  return NextResponse.json({ received: false, reason: 'event_too_old' }, { status: 400 });
}

// Add TTL to webhookEvent table
// Clean up old events (older than 30 days)
```

**Priority**: P2 - Medium (security)

---

### 8. ⚠️ Usage Counters Not Reset on Plan Downgrade

**Problem**: When user downgrades from Business to Free:
- Counters show: uploads_total: 847 / 5
- They've already exceeded free tier limit
- Can they upload more? Can they use features?

**Current Behavior**: Unclear - might block immediately or grandfather usage

**Questions**:
1. Should we reset counters on downgrade?
2. Should we allow "overage" usage to remain?
3. Should we lock features until next reset period?

**Recommendation**: Document expected behavior and implement consistently

**Priority**: P2 - Medium (UX clarity)

---

### 9. ⚠️ Organization Creation Race Condition

**File**: `app/api/organizations/route.ts` (line 55-64)

**Current Code**:
```typescript
const [existingUser] = await db.select().from(userTable)...
if (existingUser?.orgId) {
  return NextResponse.json({ error: 'Already belong to org' });
}

// Later: Create org and update user
await db.insert(orgTable)...
await db.update(userTable).set({ orgId: newOrg.id })...
```

**Problem**: Between the check and the update:
- User could join another org via invitation
- Creates org anyway
- User ends up in TWO orgs (data corruption)

**Fix Required**: Use transaction

```typescript
await db.transaction(async (tx) => {
  // Re-check user doesn't have orgId
  const [user] = await tx.select().from(userTable)...
  if (user?.orgId) {
    throw new Error('Already belong to organization');
  }
  
  // Create org and update user atomically
  const [newOrg] = await tx.insert(orgTable)...
  await tx.update(userTable).set({ orgId: newOrg.id })...
});
```

**Priority**: P1 - High (data corruption possible)

---

### 10. ⚠️ Seat Count Can Be 0

**Problem**: Despite constraint `seatCount > 0`, what if:
- Stripe webhook sends quantity: 0
- Direct DB manipulation sets it to 0
- Migration error

**Current Code**: `normalizeSeatCount()` has minimum of 1 ✓

**But**: updateOrgSeatCount accepts any number:
```typescript
await db.update(orgTable).set({ seatCount: newSeatCount })
```

**Fix Required**: Add validation

```typescript
export async function updateOrgSeatCount(orgId: string, newSeatCount: number) {
  // Validate seat count
  if (newSeatCount < 1 || newSeatCount > 10000) {
    console.error(`[seat-enforcement] Invalid seat count ${newSeatCount}, clamping to valid range`);
    newSeatCount = Math.max(1, Math.min(10000, newSeatCount));
  }
  
  // Continue with existing logic...
}
```

**Priority**: P2 - Medium (edge case protection)

---

## Summary

**Total Bugs Found in Round 2**: 10

### By Priority
- **P0 Critical**: 1 (admin tool cache bug)
- **P1 High**: 3 (email sync, incomplete status, org creation race)
- **P2 Medium**: 5 (name validation, customer email sync, webhook replay, usage reset, seat validation)
- **P3 Low**: 1 (counter overflow)

### By Category
- **Subscription**: 3 bugs
- **Organization**: 3 bugs
- **Email/Stripe Sync**: 2 bugs
- **Security**: 1 bug
- **Data Validation**: 1 bug

---

## Immediate Action Items

1. ✅ Fix admin billing tool cache order (P0)
2. ✅ Handle incomplete subscription statuses (P1)
3. ✅ Add email sync to Stripe (P1)
4. ✅ Add transaction to org creation (P1)
5. Document expected behavior for usage counter resets (P2)

---

**Next**: Fix these bugs then do Round 3 search










































