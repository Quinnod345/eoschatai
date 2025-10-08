# Foreign Key Cascade Behavior - Subscription System

**Date**: October 8, 2025  
**Status**: ✅ Verified and Documented

---

## Overview

This document clarifies the foreign key relationships and ON DELETE behavior for the organization and subscription system to prevent accidental data loss.

---

## Foreign Key Relationships

### 1. User → Organization (`user.orgId`)

**Schema**: `lib/db/schema.ts` line 61  
**Migration**: `drizzle/0017_plan_and_entitlements.sql` line 27

```sql
ALTER TABLE "User" 
  ADD CONSTRAINT "User_orgId_Org_id_fk" 
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") 
  ON DELETE SET NULL;
```

**Behavior**: When an organization is deleted:
- ✅ Users' `orgId` is set to `NULL` (NOT deleted)
- ✅ Users remain in database
- ✅ Users lose org-based entitlements
- ✅ Users revert to individual plan

**Schema Updated**: Now explicitly specifies `{ onDelete: 'set null' }`

---

### 2. Organization → Owner (`org.ownerId`)

**Schema**: `lib/db/schema.ts` line 34  
**Migration**: `drizzle/add-org-owner.sql` line 5-6

```sql
ALTER TABLE "Org" 
  ADD CONSTRAINT "Org_ownerId_fkey" 
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") 
  ON DELETE SET NULL;
```

**Behavior**: When the owner user is deleted:
- ✅ Organization's `ownerId` is set to `NULL` (org becomes orphaned)
- ✅ Organization remains in database
- ⚠️ **POTENTIAL ISSUE**: Orphaned org with no owner

**Schema Updated**: Now explicitly references user with `{ onDelete: 'set null' }`

**Protection**: Account deletion now handles this:
- Checks if user owns an org
- Blocks deletion if org has other members
- Deletes org if user is only member

---

### 3. Analytics Event → User (`analyticsEvent.userId`)

**Schema**: `lib/db/schema.ts` line 290

```typescript
userId: uuid('userId').references(() => user.id),
```

**Behavior**: No `onDelete` specified
- ⚠️ **Database default**: Likely RESTRICT (prevents user deletion if analytics exist)
- Should be `SET NULL` or `CASCADE`

**Recommendation**: Add `{ onDelete: 'set null' }` to allow user deletion

---

### 4. Analytics Event → Organization (`analyticsEvent.orgId`)

**Schema**: `lib/db/schema.ts` line 291

```typescript
orgId: uuid('orgId').references(() => org.id),
```

**Behavior**: No `onDelete` specified
- ⚠️ **Database default**: Likely RESTRICT
- Should be `SET NULL` or `CASCADE`

**Recommendation**: Add `{ onDelete: 'set null' }` to allow org deletion

---

### 5. Persona → Organization (`persona.orgId`)

**Schema**: `lib/db/schema.ts` line 669

```typescript
orgId: uuid('orgId').references(() => org.id, { onDelete: 'cascade' }),
```

**Behavior**: When organization is deleted:
- ✅ Org personas are CASCADE deleted
- ✅ Correct behavior (org personas can't exist without org)

---

## Critical Issues Found

### Issue A: Analytics Foreign Keys Missing ON DELETE

**Files**: `lib/db/schema.ts` lines 290-291

**Problem**: 
- `analyticsEvent.userId` and `analyticsEvent.orgId` have no `onDelete` specified
- PostgreSQL defaults to RESTRICT
- **This blocks user/org deletion if analytics events exist**

**Fix Required**:
```typescript
userId: uuid('userId').references(() => user.id, { onDelete: 'set null' }),
orgId: uuid('orgId').references(() => org.id, { onDelete: 'set null' }),
```

---

### Issue B: Orphaned Organizations Still Possible

**Scenario**: Owner user deleted externally (e.g., via direct DB access, admin tool)

**Current**: org.ownerId → SET NULL (org orphaned)

**Problems**:
- No owner to manage subscription
- No one can delete org
- No one can cancel Stripe subscription
- Subscription continues billing

**Mitigation**: 
- Account deletion endpoint checks org ownership ✓
- But doesn't prevent external deletion
- Need periodic cleanup job to find orphaned orgs

**Recommended Cleanup Script**:
```typescript
// scripts/cleanup-orphaned-orgs.ts
async function cleanupOrphanedOrgs() {
  const orphanedOrgs = await db
    .select()
    .from(orgTable)
    .where(isNull(orgTable.ownerId));
    
  for (const org of orphanedOrgs) {
    // Check if org has any members
    const memberCount = await db
      .select({ count: count() })
      .from(userTable)
      .where(eq(userTable.orgId, org.id));
      
    if (memberCount[0].count === 0) {
      // No members, safe to delete
      if (org.stripeSubscriptionId) {
        await stripe.subscriptions.cancel(org.stripeSubscriptionId);
      }
      await db.delete(orgTable).where(eq(orgTable.id, org.id));
      console.log(`Deleted orphaned org ${org.id}`);
    } else {
      // Has members but no owner - assign first member as owner
      const [firstMember] = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.orgId, org.id))
        .limit(1);
        
      if (firstMember) {
        await db
          .update(orgTable)
          .set({ ownerId: firstMember.id })
          .where(eq(orgTable.id, org.id));
        console.log(`Assigned ${firstMember.id} as owner of orphaned org ${org.id}`);
      }
    }
  }
}
```

---

## Correct Behaviors Confirmed

### ✅ Organization Deletion
When org is deleted:
1. All users with `orgId = <deleted_org>` → `orgId = NULL`
2. Users remain in database
3. Entitlements recomputed to individual plans
4. Org personas CASCADE deleted (correct)

### ✅ Owner Deletion (via API)
When owner user deleted via `/api/user/delete-account`:
1. Checks if owns org with members → BLOCKS deletion ✓
2. If owns org alone → Deletes org first ✓
3. If member (not owner) → Removes from org ✓

### ⚠️ Owner Deletion (External)
When owner user deleted externally (bypassing API):
1. org.ownerId → NULL (orphaned)
2. Org still exists
3. Subscription still active
4. **Needs cleanup job**

---

## Migration Required

### Fix Analytics FK Constraints

**File**: `drizzle/fix-analytics-fk-cascades.sql`

```sql
-- Drop existing constraints if they exist
ALTER TABLE "AnalyticsEvent" 
  DROP CONSTRAINT IF EXISTS "AnalyticsEvent_userId_User_id_fk";
  
ALTER TABLE "AnalyticsEvent"
  DROP CONSTRAINT IF EXISTS "AnalyticsEvent_orgId_Org_id_fk";

-- Re-add with proper ON DELETE behavior
ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_userId_User_id_fk"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_orgId_Org_id_fk"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL;
```

---

## Recommendations

### Immediate
1. ✅ **Update schema** - Add `onDelete` to all FK relationships
2. ⚠️ **Run migration** - Fix analytics FK constraints
3. ⚠️ **Create cleanup job** - Handle existing orphaned orgs

### Short Term
4. Add database triggers to prevent orphaned orgs
5. Add monitoring for orphaned resources
6. Add admin dashboard to view orphaned entities

### Long Term
7. Consider soft deletes instead of hard deletes
8. Add audit trail for all deletions
9. Implement data retention policies

---

## Testing Checklist

- [x] Verify user deletion sets orgId to NULL
- [x] Verify org deletion sets user.orgId to NULL
- [x] Verify owner deletion via API blocks if org has members
- [ ] Test analytics events don't block user deletion (after migration)
- [ ] Test analytics events don't block org deletion (after migration)
- [ ] Create orphaned org cleanup job
- [ ] Test FK constraints in staging

---

## Summary

**Good News**: 
- Core FK relationships (user↔org) are correct
- Schema now matches database migrations
- Account deletion API properly handles org ownership

**Action Required**:
- Fix analytics FK constraints (currently block deletions)
- Create orphaned org cleanup job
- Add monitoring for orphaned resources

**Status**: 2 out of 3 FK relationships correct, 1 needs fix

---

**Implementation**: AI Assistant  
**Review Status**: Schema updated, migration needed  
**Priority**: Medium (analytics fix), Low (cleanup job)














