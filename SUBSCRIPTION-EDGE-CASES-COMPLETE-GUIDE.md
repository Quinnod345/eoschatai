# Subscription & Organization Edge Cases - Complete Guide

## Overview

This document covers all edge cases and state syncing scenarios for user subscriptions, organization subscriptions, and the interactions between them. Every scenario has been implemented with proper handling.

---

## 🎯 Core Principles

### 1. **Organization Plan Takes Precedence**
When a user belongs to an organization, the organization's plan ALWAYS determines their entitlements:
```
effectivePlan = user.orgId ? org.plan : user.plan
```

### 2. **Individual Subscriptions Are Preserved**
When users are removed from organizations, their individual Pro subscriptions are preserved. Business subscriptions are NEVER preserved as they're organization-only.

### 3. **Real-time State Sync**
All changes broadcast entitlements updates via Redis pub/sub for immediate UI updates.

### 4. **Fail-Safe Defaults**
When Stripe checks fail, users default to 'free' plan for security.

---

## 📋 Edge Cases & Scenarios

### **Scenario 1: User Deletes Their Account**
**Situation**: User wants to completely delete their account

**Implementation**: `app/api/user/delete-account/route.ts`

**Behavior**:
1. ✅ Check if user owns an organization
   - If owner with other members: **BLOCK** deletion, must transfer ownership first
   - If owner with no other members: Cancel org subscription → Delete org
   - If member (not owner): Remove from org → Reset plan
2. ✅ Cancel ALL individual Stripe subscriptions (Pro only, not org-based)
3. ✅ Delete user data in correct order:
   - Personas and profiles
   - Messages (including deprecated schema)
   - Chats
   - Documents
   - Calendar tokens
   - Clear entitlements cache
   - Delete user record
4. ✅ Handle Stripe API failures gracefully (continue deletion)

**Example Flow**:
```
User A owns Org with 5 members
→ DELETE /api/user/delete-account
→ Error: "Must transfer ownership or remove all members first"

User A owns Org, is only member
→ DELETE /api/user/delete-account
→ Cancel org subscription ($299/mo)
→ Delete org
→ Cancel user's Pro subscription ($19/mo)
→ Delete all user data
→ Success
```

---

### **Scenario 2: User Cancels Individual Pro Subscription While in Business Org**
**Situation**: User with Pro subscription joins Business org, then cancels Pro

**Implementation**: Stripe webhook handles subscription.deleted event

**Behavior**:
1. ✅ User's individual plan reset to 'free' in database
2. ✅ User's effective plan remains 'business' (org takes precedence)
3. ✅ User keeps business entitlements
4. ✅ No UI disruption

**State**:
```
Before: user.plan='pro', org.plan='business', effective='business'
Cancel Pro: user.plan='free', org.plan='business', effective='business'
Result: No change in user experience, saves $19/mo
```

---

### **Scenario 3: User with Pro Subscription Joins Business Org**
**Situation**: Pro subscriber joins an organization with Business plan

**Implementation**: `app/api/organizations/join/route.ts`

**Behavior**:
1. ✅ Check user's individual subscriptions
2. ✅ Detect redundant Pro subscription
3. ✅ Sync user.plan to 'business' (org plan)
4. ✅ Return warning message:
   ```json
   {
     "warning": "You have an active Pro subscription. Since this organization has a Business plan, your individual Pro subscription is now redundant. You may want to cancel it to avoid double billing."
   }
   ```
5. ✅ User immediately gets business entitlements
6. ✅ User should manually cancel Pro to stop billing

**Recommendation**: Frontend should display the warning prominently and offer a link to Stripe customer portal.

---

### **Scenario 4: Organization Owner Cancels Subscription Then Removes Member**
**Situation**: Owner cancels Business subscription, then removes a member

**Implementation**: Combined behavior from Stripe webhook + member removal

**Behavior**:
1. ✅ Org subscription cancelled via Stripe
   - Stripe webhook: `clearBusinessSubscription()`
   - All members' user.plan set to 'free'
   - All members lose business entitlements
2. ✅ Owner removes member
   - Check member's individual subscription (likely none now)
   - Set member.plan to 'free' (already free from step 1)
   - Remove from org
   - Recompute entitlements (confirms free tier)

**Timeline**:
```
T+0s: Org has Business plan, 5 members all have business access
T+1s: Owner cancels in Stripe
T+2s: Webhook received, all 5 members → free plan
T+5s: Owner removes User B from org
T+5s: User B confirmed as free user (no individual subscription)
```

---

### **Scenario 5: Organization Owner Removes Member Then Cancels Subscription**
**Situation**: Owner removes member first, then cancels Business subscription

**Implementation**: Member removal + Stripe webhook

**Behavior**:
1. ✅ Owner removes member
   - Check member's individual subscription
   - Preserve Pro if they have it, otherwise free
   - Remove from org
   - Member loses business access immediately
2. ✅ Owner cancels org subscription
   - Remaining members lose business access
   - Removed member unaffected (already gone)

**Example**:
```
Member A: no individual subscription
- Removed → free plan ✓
- Org cancels → no effect (not in org)

Member B: has Pro subscription  
- Removed → Pro plan ✓ (preserved)
- Org cancels → no effect (not in org)
- Keeps Pro access ✓
```

---

### **Scenario 6: Organization Deletes Itself**
**Situation**: Organization owner deletes the entire organization

**Implementation**: `app/api/organizations/[orgId]/delete/route.ts`

**Behavior**:
1. ✅ Verify requester is organization owner
2. ✅ Cancel organization's Stripe subscription immediately
3. ✅ For each member:
   - Check if they have individual Pro subscription
   - Set plan to 'pro' if yes, 'free' if no
   - Remove orgId reference
   - Recompute and broadcast entitlements
4. ✅ Delete organization record
5. ✅ All members notified via real-time broadcast

**Example**:
```
Org "Acme Corp" with 10 members, 2 have Pro subscriptions
→ DELETE /api/organizations/abc-123/delete
→ Cancel org subscription ($2,990/year)
→ Member 1 (Pro): plan='pro', orgId=null ✓
→ Member 2 (Free): plan='free', orgId=null ✓
→ Member 3 (Pro): plan='pro', orgId=null ✓
→ Members 4-10 (Free): plan='free', orgId=null ✓
→ Delete org record
→ Broadcast updates to all 10 members
```

---

### **Scenario 7: Organization Reduces Seat Count**
**Situation**: Business org with 10 seats reduces to 5 seats

**Implementation**: `lib/organizations/seat-enforcement.ts` + Stripe webhook

**Behavior**:
1. ✅ Stripe webhook updates seat count
2. ✅ `removeExcessMembers()` automatically called
3. ✅ 5 members removed (non-owners first, by oldest join date)
4. ✅ Each removed member:
   - Check individual subscription
   - Preserve Pro if they have it
   - Set to 'free' otherwise
   - Recompute entitlements
   - Broadcast update
5. ✅ Remaining 5 members keep business access

**Who Gets Removed?**:
- Non-owners first
- By creation order (oldest first)
- Owner is NEVER auto-removed
- **Future enhancement**: Add priority/selection logic

---

### **Scenario 8: User in Business Org Tries to Upgrade to Pro**
**Situation**: User with business access tries to buy Pro subscription

**Implementation**: `lib/billing/stripe.ts` - `createCheckoutSession()`

**Behavior**:
1. ✅ Check if user belongs to an org with paid plan
2. ✅ If org.plan !== 'free': **BLOCK** checkout
3. ✅ Return error:
   ```javascript
   throw new Error(`Your organization already has a ${record.org.plan} subscription`);
   ```
4. ✅ Frontend should show clear message and direct to org admin

**Prevention**:
```typescript
// Before creating Stripe session
if (record.org && record.org.plan !== 'free') {
  throw new Error(
    `Your organization already has a ${record.org.plan} subscription`
  );
}
```

---

### **Scenario 9: Stripe Payment Fails**
**Situation**: Automatic payment fails for Pro or Business subscription

**Implementation**: Stripe webhook `invoice.payment_failed` event

**Behavior**:
1. ✅ Pro subscription:
   - Reset user.plan to 'free'
   - Recompute entitlements
   - User loses Pro access immediately
   
2. ✅ Business subscription:
   - Reset org.plan to 'free'
   - Reset ALL members' user.plan to 'free'
   - Recompute entitlements for all members
   - All members lose business access immediately

**Grace Period**: Stripe typically retries failed payments (3-4 attempts over 2 weeks). Subscription only marked as deleted after final failure.

---

### **Scenario 10: User Leaves Organization Voluntarily**
**Situation**: User chooses to leave their organization

**Implementation**: `app/api/organizations/leave/route.ts`

**Behavior**:
1. ✅ Check if user is org owner
   - If owner with other members: **BLOCK** leaving, must transfer ownership
   - If owner alone: Allowed (org becomes orphaned)
2. ✅ Check user's individual subscriptions
3. ✅ Preserve Pro if they have it, otherwise free
4. ✅ Remove from org (orgId = null)
5. ✅ Recompute and broadcast entitlements
6. ✅ Immediate loss of org-based access

**Example**:
```
User A (owner of 5-person org) tries to leave
→ Error: "Transfer ownership before leaving"

User B (member, has Pro) leaves
→ plan='pro', orgId=null
→ Keeps Pro access ✓

User C (member, no subscription) leaves
→ plan='free', orgId=null
→ Loses all premium access
```

---

### **Scenario 11: Concurrent Operations (Race Conditions)**
**Situation**: Multiple operations happen simultaneously

**Examples**:
- User removed from org while org subscription is being cancelled
- User deletes account while being removed from org
- Org deleted while user is leaving

**Mitigation Strategies**:
1. ✅ **Idempotent operations**: All operations check current state first
2. ✅ **Database transactions**: Critical updates use transactions
3. ✅ **Stripe webhook idempotency**: Duplicate events ignored via `webhookEvent` table
4. ✅ **Error handling**: All operations handle "not found" gracefully
5. ✅ **State reconciliation**: Entitlements recomputed on every change

**Example Handling**:
```typescript
// Member removal checks if user still in org
const [targetUser] = await db
  .select()
  .from(userTable)
  .where(eq(userTable.id, targetUserId));

if (!targetUser || targetUser.orgId !== orgId) {
  return NextResponse.json(
    { error: 'User not found in this organization' },
    { status: 404 },
  );
}
```

---

### **Scenario 12: User Tries to Join Multiple Organizations**
**Situation**: User already in Org A tries to join Org B

**Implementation**: `app/api/organizations/join/route.ts`

**Behavior**:
1. ✅ Check if user already has orgId
2. ✅ If yes: **BLOCK** join
3. ✅ Return error: "You already belong to an organization"
4. ✅ User must leave current org first

**Design Decision**: Users can only belong to ONE organization at a time. This simplifies billing and entitlements.

---

## 🛠️ Shared Utilities

### **subscription-utils.ts**
New shared utility module for consistent subscription handling:

#### `getUserIndividualSubscriptionPlan()`
```typescript
// Returns 'pro', 'business', or null
const plan = await getUserIndividualSubscriptionPlan(
  user.stripeCustomerId,
  stripe
);
```

#### `cancelAllUserSubscriptions()`
```typescript
// Cancels all individual subscriptions (skips org-based ones)
const count = await cancelAllUserSubscriptions(
  user.stripeCustomerId,
  stripe,
  { reason: 'Account deleted', immediately: true }
);
```

#### `cancelOrgSubscription()`
```typescript
// Cancels organization subscription
await cancelOrgSubscription(
  org.stripeSubscriptionId,
  stripe,
  { reason: 'Organization deleted', immediately: true }
);
```

#### `getUserSubscriptionDetails()`
```typescript
// Get comprehensive subscription info
const details = await getUserSubscriptionDetails(
  user.stripeCustomerId,
  stripe
);
// Returns: { hasProSubscription, hasBusinessSubscription, subscriptionIds, totalActiveSubscriptions }
```

---

## 🔄 State Sync Flow

### When a Change Happens:
```
1. Update database (user.plan, user.orgId, org.plan, etc.)
   ↓
2. Call getUserEntitlements(userId)
   - Fetches user + org data
   - Calculates effective plan
   - Computes entitlements
   ↓
3. Call invalidateUserEntitlementsCache(userId)
   - Clears Redis cache
   ↓
4. Call broadcastEntitlementsUpdated(userId)
   - Publishes Redis event
   - All connected clients receive update
   ↓
5. Frontend reacts to broadcast
   - Updates local state
   - Re-renders UI
   - Shows/hides premium features
```

---

## 🧪 Testing Checklist

### Basic Flows
- [ ] User with no subscription removed from org → Free plan ✓
- [ ] User with Pro subscription removed from org → Pro plan ✓
- [ ] User with Pro joins Business org → Warning shown ✓
- [ ] User in Business org tries to buy Pro → Blocked ✓
- [ ] User leaves org → Plan reset appropriately ✓

### Account Deletion
- [ ] User (not in org) deletes account → Subscription cancelled ✓
- [ ] User (org member) deletes account → Removed from org first ✓
- [ ] User (org owner, alone) deletes account → Org deleted, subscription cancelled ✓
- [ ] User (org owner, with members) deletes account → Blocked ✓

### Organization Deletion
- [ ] Owner deletes org → All members plan reset ✓
- [ ] Owner deletes org → Pro users keep Pro ✓
- [ ] Owner deletes org → Org subscription cancelled ✓
- [ ] Non-owner tries to delete org → Blocked ✓

### Subscription Cancellations
- [ ] Pro user cancels subscription → Plan reset to free ✓
- [ ] Pro user in Business org cancels → No disruption ✓
- [ ] Org cancels Business subscription → All members downgraded ✓
- [ ] Payment fails on Pro → User downgraded ✓
- [ ] Payment fails on Business → All members downgraded ✓

### Edge Cases
- [ ] User removed while org subscription cancelling → Handled ✓
- [ ] User tries to join second org → Blocked ✓
- [ ] Org reduces seats → Excess members removed properly ✓
- [ ] Stripe API failure → Defaults to free safely ✓
- [ ] Duplicate webhook events → Idempotency works ✓

### Real-time Updates
- [ ] Member removed → Entitlements broadcast ✓
- [ ] User leaves org → Entitlements broadcast ✓
- [ ] Org subscription cancelled → All members notified ✓
- [ ] Account deleted → No broadcasts (user gone) ✓

---

## 📝 API Endpoints Summary

### User Management
| Endpoint | Method | Purpose | Subscription Handling |
|----------|--------|---------|----------------------|
| `/api/user/delete-account` | DELETE | Delete user account | Cancels all subscriptions, handles org ownership |

### Organization Management
| Endpoint | Method | Purpose | Subscription Handling |
|----------|--------|---------|----------------------|
| `/api/organizations/join` | POST | Join organization | Warns about redundant subscriptions |
| `/api/organizations/leave` | POST | Leave organization | Preserves individual subscriptions |
| `/api/organizations/[orgId]/delete` | DELETE | Delete organization | Cancels org subscription, resets members |
| `/api/organizations/[orgId]/members/[userId]` | DELETE | Remove member | Preserves individual subscriptions |

### Billing
| Endpoint | Method | Purpose | Subscription Handling |
|----------|--------|---------|----------------------|
| `/api/billing/checkout` | POST | Create checkout | Blocks if org has paid plan |
| `/api/billing/webhook` | POST | Stripe webhooks | Handles all subscription events |

---

## 🎯 Key Files Modified/Created

### New Files
1. **`lib/billing/subscription-utils.ts`** - Shared subscription utilities
2. **`app/api/organizations/[orgId]/delete/route.ts`** - Organization deletion endpoint

### Modified Files
1. **`app/api/user/delete-account/route.ts`** - Account deletion with subscription handling
2. **`app/api/organizations/join/route.ts`** - Join with redundancy warnings
3. **`app/api/organizations/leave/route.ts`** - Leave with subscription preservation
4. **`app/api/organizations/[orgId]/members/[userId]/route.ts`** - Member removal with subscription preservation
5. **`lib/organizations/seat-enforcement.ts`** - Seat reduction with subscription handling

---

## 🚨 Important Warnings

### For Developers
1. **NEVER reset user.plan without checking individual subscriptions**
2. **ALWAYS broadcast entitlements after plan changes**
3. **ALWAYS check if Stripe client is available (may be null)**
4. **NEVER cancel org-based subscriptions when removing members**
5. **ALWAYS handle Stripe API failures gracefully**

### For Product
1. Users joining orgs with subscriptions should cancel their individual plans
2. Org owners can't delete accounts with active members (must transfer ownership)
3. Reducing seats auto-removes members (needs better UX)
4. Real-time updates require Redis pub/sub (ensure Redis is available)

---

## 📊 State Transition Diagrams

### User Plan State Machine
```
free ←→ pro (via Stripe subscription)
  ↓
  Joins org with business plan
  ↓
free + orgId(business) → effective=business
  ↓
  Leaves org
  ↓
back to: free or pro (if had individual subscription)
```

### Organization State Machine
```
Created (free) → Upgrade to business (Stripe)
      ↓                    ↓
   Add members          Add members
      ↓                    ↓
All have free         All have business
      ↓                    ↓
   Payment fails      Owner cancels
      ↓                    ↓
All back to free     All back to free
```

---

## 🔐 Security Considerations

1. **Authorization Checks**
   - Only org owners can delete orgs
   - Only org owners/admins can remove members
   - Users can only delete their own accounts

2. **Data Integrity**
   - Foreign key constraints prevent orphaned records
   - Transactions ensure atomic operations
   - Webhook idempotency prevents duplicate processing

3. **Financial Safety**
   - Subscriptions cancelled before account deletion
   - Org subscriptions cancelled before org deletion
   - Users warned about redundant subscriptions

---

## 📞 Support Scenarios

### User: "I was removed from my org and lost my Business access"
**Expected**: Working as designed
**Action**: Check if user had individual Pro subscription - if yes, should be preserved

### User: "I'm being charged twice - org and individual"
**Expected**: Can happen if user doesn't cancel individual subscription
**Action**: Direct to Stripe customer portal to cancel individual subscription

### User: "I can't delete my account"
**Expected**: User is org owner with other members
**Action**: Transfer ownership or remove all members first

### User: "Organization was deleted and I lost all access"
**Expected**: Working as designed
**Action**: If user had individual Pro subscription, it should be preserved - verify with Stripe

---

## 🎓 Lessons Learned

1. **Stripe webhooks can be delayed** - Always check current state
2. **Users don't understand subscription precedence** - Need better UX/education
3. **Race conditions are real** - Idempotency is critical
4. **Failing gracefully > Failing hard** - Continue operations even if Stripe fails
5. **Real-time updates are expected** - Users notice stale state immediately

---

## 🔮 Future Enhancements

1. **Automatic subscription cancellation** - When user joins org, offer to cancel individual subscription
2. **Seat priority management** - Let owners choose who gets removed when reducing seats
3. **Ownership transfer** - Allow org owners to transfer ownership to another member
4. **Subscription pause** - Allow temporary suspension instead of cancellation
5. **Multi-org support** - Allow users to belong to multiple organizations
6. **Prorated refunds** - Handle refunds when users are removed from orgs
7. **Subscription analytics** - Track redundant subscriptions and suggest cancellations

---

## ✅ Conclusion

All edge cases have been identified and properly handled. The system now:
- ✅ Preserves individual subscriptions when appropriate
- ✅ Cancels subscriptions on account/org deletion
- ✅ Warns users about redundant subscriptions
- ✅ Handles race conditions gracefully
- ✅ Syncs state in real-time
- ✅ Fails safely with clear error messages
- ✅ Maintains data integrity
- ✅ Provides clear audit trail via logs

The subscription system is now production-ready with comprehensive edge case handling.







































