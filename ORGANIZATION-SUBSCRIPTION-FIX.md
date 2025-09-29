# Organization Subscription Fix

## Problem
When users joined an organization with a paid subscription, they were being redirected to Stripe to pay again instead of inheriting the organization's subscription benefits.

## Root Cause
The entitlements system was using the individual user's plan (`user.plan`) instead of checking if they belonged to an organization with a paid plan (`org.plan`).

## Solution

### 1. Fixed Entitlements Calculation
In `lib/entitlements/index.ts`, updated `getUserEntitlements` to use the organization's plan if the user belongs to one:

```typescript
// Before
const computed = computeEntitlements(record.user.plan, overrides);

// After
const effectivePlan = record.org?.plan ?? record.user.plan;
const computed = computeEntitlements(effectivePlan, overrides);
```

### 2. Prevent Duplicate Payments
In `lib/billing/stripe.ts`, added a check to prevent checkout if the user's organization already has a paid plan:

```typescript
// Check if user's organization already has a paid plan
if (record.org && record.org.plan !== 'free') {
  throw new Error(`Your organization already has a ${record.org.plan} subscription`);
}
```

### 3. Clear Cache on Join
In `app/api/organizations/join/route.ts`, added cache invalidation when a user joins an organization:

```typescript
// Clear entitlements cache to force refresh with new org plan
await invalidateUserEntitlementsCache(session.user.id);
```

### 4. Updated UI
In `components/premium-features-modal.tsx`:
- Shows organization subscription status
- Uses organization's plan for display
- Disables upgrade button if org has a subscription
- Shows appropriate messages

## How It Works Now

1. **User joins organization** → Their entitlements are immediately updated to match the org's plan
2. **User opens upgrade modal** → Sees their organization's subscription status
3. **User tries to upgrade** → System prevents duplicate payment and shows helpful message
4. **All org members** → Automatically have access to the organization's plan features

## Testing

1. Create an organization and upgrade it to Business
2. Invite another user to join
3. When they join, they should:
   - Immediately have Business features
   - See "Organization has business" in upgrade modal
   - Not be able to pay again

## Benefits
- No duplicate charges
- Seamless team collaboration
- Clear subscription status
- Proper entitlements inheritance

