# Additional Subscription & Billing Bugs Found

**Date**: October 8, 2025  
**Priority**: Mixed (P1-P3)  
**Status**: 🔴 Not Fixed

---

## Critical Bugs (P0-P1)

### 1. 🚨 Orphaned Organizations with Active Subscriptions

**File**: `app/api/organizations/leave/route.ts` (line 50)

**Problem**: When the owner is the last member and leaves, the organization becomes orphaned:
- Org still exists in database
- Org might have active Stripe subscription
- No members can access it
- Subscription continues billing
- No one can delete the org or cancel subscription

**Current Code**:
```typescript
if (memberCount.length > 1) {
  return NextResponse.json({ error: 'Transfer ownership first' }, { status: 400 });
}
// If owner is the last member, they can leave (org will be orphaned) ❌
```

**Fix Required**:
```typescript
if (organization?.ownerId === session.user.id) {
  const memberCount = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.orgId, user.orgId));

  if (memberCount.length > 1) {
    return NextResponse.json({
      error: 'Transfer ownership before leaving'
    }, { status: 400 });
  }
  
  // NEW: If last member, DELETE the organization instead
  if (memberCount.length === 1) {
    // Cancel org subscription
    if (organization.stripeSubscriptionId) {
      const stripe = getStripeClient();
      await stripe.subscriptions.cancel(organization.stripeSubscriptionId);
    }
    
    // Delete invitations
    await db.delete(orgInvitation).where(eq(orgInvitation.orgId, user.orgId));
    
    // Delete organization
    await db.delete(orgTable).where(eq(orgTable.id, user.orgId));
  }
}
```

**Impact**: 
- Revenue loss (orphaned subscriptions continue billing no one)
- Database bloat (orphaned orgs accumulate)
- No way to clean up without direct DB access

---

### 2. 🚨 Missing Owner Transfer API

**Problem**: No endpoint exists to transfer organization ownership.

**Required**: Owner can't transfer ownership before leaving, as the error message suggests.

**Fix Required**: Create endpoint `POST /api/organizations/[orgId]/transfer-ownership`

```typescript
export async function POST(request: Request, { params }: RouteParams) {
  const { newOwnerId } = await request.json();
  
  // 1. Verify requester is current owner
  // 2. Verify newOwner is member of org
  // 3. Update org.ownerId
  // 4. Optionally: Update roles table
  // 5. Log transfer event
}
```

**Without this**: Users can't comply with "transfer ownership before leaving" error.

---

### 3. 🚨 Webhook Processing Race Conditions

**File**: `lib/billing/stripe.ts`

**Problem**: Multiple webhooks can process simultaneously for the same subscription:
- `subscription.updated` + `subscription.paused` arrive at same time
- Both try to update user.plan
- Database race condition
- Inconsistent state

**Example**:
```
T+0ms: Webhook A: subscription.updated (quantity change)
T+5ms: Webhook B: subscription.deleted (payment failed)
Both processing simultaneously...
```

**Fix Required**: Add subscription-level locking

```typescript
const processSubscriptionEvent = async (event: Stripe.Event) => {
  const subscription = event.data.object as Stripe.Subscription;
  
  // NEW: Use Redis lock to prevent concurrent processing
  const redis = getRedisClient();
  const lockKey = `subscription:lock:${subscription.id}`;
  
  if (redis) {
    const lock = await redis.set(lockKey, '1', { 
      nx: true, // Only set if doesn't exist
      ex: 30    // Expire after 30 seconds
    });
    
    if (!lock) {
      // Another webhook is processing this subscription
      console.log(`[stripe] Subscription ${subscription.id} is locked, skipping`);
      return;
    }
  }
  
  try {
    // Existing processing logic...
  } finally {
    if (redis) {
      await redis.del(lockKey);
    }
  }
};
```

---

### 4. 🚨 Stripe Customer Not Found Errors

**File**: Multiple files using `getUserIndividualSubscriptionPlan()`

**Problem**: Code assumes Stripe customer exists, but:
- Customer could be deleted in Stripe
- Customer ID could be invalid/corrupted
- Stripe API could return 404

**Current Code**:
```typescript
const individualPlan = stripe
  ? await getUserIndividualSubscriptionPlan(member.stripeCustomerId, stripe)
  : null;
```

**No error handling** - 404 throws and breaks entire flow.

**Fix Required** in `lib/billing/subscription-utils.ts`:

```typescript
export async function getUserIndividualSubscriptionPlan(
  stripeCustomerId: string | null | undefined,
  stripe: Stripe,
  userId?: string,
): Promise<'pro' | 'business' | null> {
  if (!stripeCustomerId) return null;

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 100,
    });
    // ... existing logic
  } catch (error: any) {
    // NEW: Handle 404 specifically
    if (error?.statusCode === 404 || error?.type === 'invalid_request_error') {
      console.warn(
        `[subscription-utils] Stripe customer ${stripeCustomerId} not found, resetting to null`,
      );
      
      // Clear invalid customer ID from database
      if (userId) {
        await db.update(userTable)
          .set({ stripeCustomerId: null })
          .where(eq(userTable.id, userId));
      }
      
      return null;
    }
    
    console.warn('[subscription-utils] Failed to check subscription:', error);
    return null;
  }
}
```

---

## High Priority (P1)

### 5. ⚠️ Subscription Metadata Missing org_id

**File**: `lib/billing/stripe.ts` (line 650)

**Problem**: Business subscription processing assumes `subscription.metadata.org_id` exists:

```typescript
if (subscription.metadata?.org_id) {
  await updateOrgSeatCount(subscription.metadata.org_id, newQty);
}
```

**But**: What if metadata is missing/corrupted?
- Old subscriptions created before metadata was added
- Manual subscription created in Stripe dashboard
- Metadata accidentally cleared

**Fix Required**:
```typescript
// Fallback: Find org by stripeSubscriptionId
if (!subscription.metadata?.org_id) {
  const [org] = await db
    .select({ id: orgTable.id })
    .from(orgTable)
    .where(eq(orgTable.stripeSubscriptionId, subscription.id));
    
  if (org) {
    console.log(`[stripe] Found org ${org.id} by subscription ID`);
    await updateOrgSeatCount(org.id, newQty);
  } else {
    console.error(`[stripe] Cannot find org for subscription ${subscription.id}`);
  }
}
```

---

### 6. ⚠️ Redis Complete Failure Handling

**Problem**: If Redis is completely down:
- Cache operations fail silently ✓ (good)
- Broadcast operations fail silently ✓ (good)
- **BUT**: Redis locking won't work (if implemented)
- **AND**: Users won't get real-time updates

**Fix Required**: Add health check and fallback

```typescript
let redisDown = false;

export const checkRedisHealth = async (): Promise<boolean> => {
  const redis = getRedisClient();
  if (!redis) return false;
  
  try {
    await redis.ping();
    redisDown = false;
    return true;
  } catch (error) {
    console.error('[redis] Health check failed:', error);
    redisDown = true;
    return false;
  }
};

// In broadcast:
export const broadcastEntitlementsUpdated = async (userId: string) => {
  if (redisDown) {
    console.warn('[entitlements] Redis is down, skipping broadcast');
    return;
  }
  
  // Existing logic...
};
```

---

### 7. ⚠️ Direct Database Seat Count Updates

**File**: `lib/organizations/seat-enforcement.ts`

**Problem**: Code protects against invalid seat counts via `normalizeSeatCount()`, but:
- Direct database updates bypass this
- Admin tools could set invalid values
- Migration scripts might corrupt data

**Scenarios**:
- `seatCount = 0` → Division by zero? No members allowed?
- `seatCount = -5` → Negative seats?
- `seatCount = 999999999` → Memory issues?

**Fix Required**: Add database constraint

```sql
-- In migration
ALTER TABLE "Org" 
  ADD CONSTRAINT "org_seat_count_positive" 
  CHECK ("seatCount" > 0 AND "seatCount" <= 10000);

ALTER TABLE "Org"
  ADD CONSTRAINT "pending_removal_valid"
  CHECK ("pendingRemoval" >= 0 AND "pendingRemoval" <= "seatCount");
```

---

## Medium Priority (P2)

### 8. ⚠️ Refunds Not Handled

**Problem**: When Stripe issues a refund:
- No `charge.refunded` webhook handler
- No `customer.subscription.updated` logic for refunds
- Users keep access even though refunded

**Fix Required**:
```typescript
case 'charge.refunded': {
  const charge = event.data.object as Stripe.Charge;
  // Find associated subscription
  // If full refund, cancel subscription
  // If partial refund, log but keep access
  break;
}
```

---

### 9. ⚠️ Trial Period Edge Cases

**File**: `lib/billing/stripe.ts`

**Problem**: Trial handling is incomplete:
- `status === 'trialing'` grants access ✓
- **BUT**: What happens when trial ends?
  - Stripe sends `subscription.updated` with `status: 'active'`
  - OR sends `subscription.updated` with `status: 'past_due'` if payment fails
  - OR sends `subscription.deleted` if payment fails and retries exhausted

**Missing**: `trial_will_end` webhook (3 days before)

**Fix Required**:
```typescript
case 'customer.subscription.trial_will_end': {
  const subscription = event.data.object as Stripe.Subscription;
  // Send notification to user
  // Remind them to add payment method
  // Give them time to cancel before charging
  break;
}
```

---

### 10. ⚠️ Foreign Key Cascade Issues

**File**: `lib/db/schema.ts`

**Problem**: Need to verify foreign key ON DELETE behavior:

```typescript
// User to Org
orgId: uuid('orgId').references(() => org.id, { onDelete: ??? })

// Org to User (owner)
ownerId: uuid('ownerId').references(() => user.id, { onDelete: ??? })
```

**Questions**:
1. If org is deleted, what happens to users with that orgId?
   - Should be SET NULL
   - Current behavior unknown
   
2. If owner user is deleted, what happens to org?
   - Should be SET NULL (org becomes orphaned) or RESTRICT
   - Current: `ON DELETE SET NULL` (confirmed in migration)

**Potential Bug**: If org is deleted but foreign key is CASCADE:
- All members get deleted ❌
- Should only set orgId to NULL ✓

**Verification Needed**: Check actual schema in production database.

---

## Summary Table

| # | Bug | Priority | Impact | Complexity | Risk |
|---|-----|----------|--------|------------|------|
| 1 | Orphaned orgs | P0 | High - Revenue loss | Medium | High |
| 2 | No owner transfer | P1 | High - User frustration | Low | Low |
| 3 | Webhook races | P1 | Medium - State corruption | High | Medium |
| 4 | Customer not found | P1 | Medium - Broken flows | Low | Low |
| 5 | Missing metadata | P1 | Medium - Failed updates | Medium | Low |
| 6 | Redis failure | P1 | Low - No real-time | Medium | Low |
| 7 | Invalid seat counts | P1 | Low - Edge case | Low | Low |
| 8 | Refunds | P2 | Low - Rare | Medium | Low |
| 9 | Trial edge cases | P2 | Low - UX | Low | Low |
| 10 | FK cascades | P2 | Medium - Data loss? | Low | Medium |

---

## Recommended Action Plan

### Immediate (This Week)
1. **Fix orphaned org bug** - Delete org when last owner leaves
2. **Add customer not found handling** - Prevent crashes
3. **Verify FK cascades** - Check production schema

### Short Term (Next Sprint)
4. **Create owner transfer endpoint** - Required functionality
5. **Add subscription locking** - Prevent race conditions
6. **Add metadata fallback** - Handle missing org_id

### Medium Term (Next Month)
7. **Add database constraints** - Prevent invalid data
8. **Add Redis health checks** - Better observability
9. **Handle refunds** - Complete billing coverage
10. **Add trial notifications** - Better UX

---

## Testing Requirements

### For Each Fix

1. **Unit Tests**: Test individual functions
2. **Integration Tests**: Test full webhook flow
3. **Load Tests**: Test concurrent operations
4. **Edge Case Tests**: Test boundary conditions

### Specific Scenarios

```typescript
// Test: Orphaned org
test('last owner leaving deletes org and cancels subscription', async () => {
  // Setup: Create org with 1 owner
  // Action: Owner leaves
  // Assert: Org deleted, subscription cancelled
});

// Test: Concurrent webhooks
test('concurrent webhooks dont corrupt state', async () => {
  // Setup: Create subscription
  // Action: Send 2 webhooks simultaneously
  // Assert: State is consistent
});

// Test: Customer not found
test('invalid customer ID handled gracefully', async () => {
  // Setup: User with invalid stripeCustomerId
  // Action: Try to check subscription
  // Assert: Returns null, doesn't crash
});
```

---

## Additional Considerations

### Observability
- Add metrics for orphaned orgs
- Track Redis failures
- Monitor webhook processing times
- Alert on customer not found errors

### Documentation
- Document owner transfer process
- Add runbook for orphaned orgs
- Document refund handling policy
- Create troubleshooting guide

### Data Cleanup
- Find and fix existing orphaned orgs
- Clean up invalid customer IDs
- Audit existing subscriptions for missing metadata

---

**Status**: 10 additional bugs identified  
**Total Bugs Found**: 14 fixed + 10 new = 24 bugs  
**Implementation Priority**: Immediate fixes should be deployed ASAP










































