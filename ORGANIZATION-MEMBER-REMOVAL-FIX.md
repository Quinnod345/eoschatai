# Organization Member Removal & Subscription Fix

## Problem

When an organization leader cancelled their business subscription and removed users from the organization, those users retained their business subscription entitlements even though they no longer belonged to an organization.

### Root Cause

Multiple endpoints were setting `user.orgId = null` when removing users from organizations, but they were **NOT**:
1. Resetting the user's `plan` field back to 'free' (or their individual plan if they had one)
2. Recomputing the user's entitlements
3. Broadcasting the entitlements update to connected clients

Since the entitlements system uses `record.org?.plan ?? record.user.plan`, when users had no org but still had `user.plan = 'business'`, they would retain business-level access.

## Solution

### 1. Fixed Member Removal Endpoint
**File**: `app/api/organizations/[orgId]/members/[userId]/route.ts`

When an organization owner removes a member:
- ✅ Checks if the user has an active individual Stripe subscription (Pro)
- ✅ If they do, preserves their Pro plan
- ✅ If they don't, resets their plan to 'free'
- ✅ Removes them from the organization (`orgId = null`)
- ✅ Forces entitlements recomputation with the new plan
- ✅ Broadcasts the entitlements update to all connected clients

```typescript
// Check if user has their own individual Stripe subscription
let newPlan: 'free' | 'pro' | 'business' = 'free';
if (targetUser.stripeCustomerId) {
  const stripe = await import('@/lib/billing/stripe');
  const subscriptions = await stripe.subscriptions.list({
    customer: targetUser.stripeCustomerId,
    status: 'active',
    limit: 1,
  });

  if (subscriptions.data.length > 0) {
    const priceId = subscription.items.data[0]?.price?.id;
    if (priceId === proMonthly || priceId === proAnnual) {
      newPlan = 'pro';
    }
  }
}

// Remove from org and reset plan
await db.update(userTable).set({ 
  orgId: null,
  plan: newPlan,
})

// Recompute entitlements
await getUserEntitlements(targetUserId);
await invalidateUserEntitlementsCache(targetUserId);
await broadcastEntitlementsUpdated(targetUserId);
```

### 2. Fixed Leave Organization Endpoint
**File**: `app/api/organizations/leave/route.ts`

When a user voluntarily leaves an organization:
- ✅ Checks if the user has an active individual Stripe subscription
- ✅ Preserves their individual plan or resets to 'free'
- ✅ Removes them from the organization
- ✅ Forces entitlements recomputation
- ✅ Broadcasts the update

The implementation is identical to the member removal logic, ensuring consistency.

### 3. Fixed Seat Enforcement Removal
**File**: `lib/organizations/seat-enforcement.ts`

When an organization reduces their seat count and excess members are automatically removed:
- ✅ Checks each removed user's individual Stripe subscription
- ✅ Preserves individual plans or resets to 'free'
- ✅ Recomputes entitlements for each removed user
- ✅ Broadcasts updates for all removed users

This ensures that automatic seat enforcement follows the same rules as manual removal.

## Key Behaviors

### Individual Subscription Preservation
If a user has their own **active** individual Stripe subscription for:
- Pro Monthly plan
- Pro Annual plan

Their plan will be preserved when removed from an organization.

**Business subscriptions are NEVER preserved** because:
- Business plans are organization-based by design
- Individual business subscriptions shouldn't exist
- Users removed from orgs should lose business access unless they belong to another business org

### Plan Reset Flow
```
User in Business Org (plan='business', orgId='abc123')
      ↓ (Owner removes user)
User with no individual subscription:
  → plan='free', orgId=null, entitlements=free tier

User with Pro subscription:
  → plan='pro', orgId=null, entitlements=pro tier
```

### Entitlements Calculation
After removal, the entitlements calculation works as follows:
```typescript
effectivePlan = record.org?.plan ?? record.user.plan
// With no org: effectivePlan = record.user.plan
// If plan was reset to 'free': effectivePlan = 'free' ✅
// If plan was preserved as 'pro': effectivePlan = 'pro' ✅
```

## Files Modified

1. **`app/api/organizations/[orgId]/members/[userId]/route.ts`**
   - DELETE endpoint: Added plan reset and entitlements recomputation

2. **`app/api/organizations/leave/route.ts`**
   - POST endpoint: Added plan reset and entitlements recomputation

3. **`lib/organizations/seat-enforcement.ts`**
   - `removeExcessMembers()`: Added plan reset and entitlements recomputation

## Testing Checklist

### Basic Flow Tests
- [ ] **Remove user with no individual subscription**
  - User should be set to plan='free'
  - User should lose business entitlements immediately
  - UI should update without page refresh

- [ ] **Remove user with Pro subscription**
  - User should keep plan='pro'
  - User should have Pro entitlements
  - UI should reflect Pro access

- [ ] **User voluntarily leaves org**
  - Same behavior as being removed
  - Plan resets appropriately
  - Entitlements update correctly

### Organization Subscription Cancellation
- [ ] **Org owner cancels Business subscription**
  - Org plan resets to 'free'
  - All members get free entitlements (handled by existing clearBusinessSubscription)
  
- [ ] **Org owner cancels subscription THEN removes member**
  - Member already has free plan from cancellation
  - Removal works correctly
  - No business access remains

- [ ] **Org owner removes member THEN cancels subscription**
  - Member immediately loses access upon removal
  - Subsequent cancellation doesn't affect removed member
  - Remaining members lose access after cancellation

### Edge Cases
- [ ] **Stripe API failure during check**
  - Defaults to 'free' for safety
  - Logs warning
  - User doesn't retain business access

- [ ] **User has inactive/cancelled Pro subscription**
  - Stripe returns no active subscriptions
  - Plan resets to 'free'
  - User loses premium access

- [ ] **Multiple rapid removals (race conditions)**
  - Each removal processes independently
  - Entitlements cache properly invalidated
  - Final state is consistent

- [ ] **User removed from org and joins another org**
  - First removal: plan reset + entitlements updated
  - Join new org: plan synced to new org + entitlements updated
  - No lingering business access from first org

### Seat Enforcement
- [ ] **Org reduces seats from 10 to 5**
  - 5 members automatically removed
  - Each member's plan reset appropriately
  - All removed members lose access
  - Entitlements broadcasted for all

## Error Handling

All endpoints include try-catch blocks for:
1. **Stripe API failures**: Defaults to 'free' plan for safety
2. **Entitlements update failures**: Logs warning but continues
3. **Database failures**: Returns 500 error with clear message

## Real-time Updates

All endpoints now properly broadcast entitlements updates via:
```typescript
await broadcastEntitlementsUpdated(userId);
```

This triggers:
- Redis pub/sub notification
- Client-side cache invalidation
- UI re-render without page refresh
- Proper access control gates

## Migration Impact

**No database migration needed** - This is purely logic fixes in the API endpoints.

Existing users who were incorrectly retaining business access will be fixed when:
- They interact with any organization operation
- Their entitlements are next recomputed
- Admin manually triggers entitlements recomputation if needed

## Related Documentation

- `ORGANIZATION-SUBSCRIPTION-FIX.md` - Original org subscription inheritance fix
- `SUBSCRIPTION-FIXES-SUMMARY.md` - Comprehensive subscription system overview
- `lib/entitlements/index.ts` - Core entitlements calculation logic
- `lib/billing/stripe.ts` - Stripe webhook handlers and subscription management







































