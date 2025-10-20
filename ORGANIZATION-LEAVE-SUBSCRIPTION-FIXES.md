# Organization Leave & Subscription Bug Fixes

## Issues Fixed

### 1. **Foreign Key Constraint Error (Organization Deletion)**
**Problem**: Users couldn't leave organizations because the `AnalyticsEvent` table had FK constraints without proper CASCADE behavior.

**Error**:
```
update or delete on table "Org" violates foreign key constraint "AnalyticsEvent_orgId_Org_id_fk" on table "AnalyticsEvent"
```

**Fix Applied**:
- Updated FK constraints to use `ON DELETE SET NULL` for both `userId` and `orgId` in `AnalyticsEvent` table
- Applied via migration script: `scripts/apply-analytics-fk-fix.ts`
- Verified constraints are now properly set

**Files Changed**:
- Created: `scripts/apply-analytics-fk-fix.ts` - Migration script
- Migration was successfully applied to the database

---

### 2. **Stale Subscription ID Error**
**Problem**: Subscription IDs stored in database didn't match Stripe, causing errors when trying to cancel subscriptions during org deletion.

**Error**:
```
No such subscription: 'sub_1SBSlgGgSNaQGtJwRSC5N3I7'
StripeInvalidRequestError: resource_missing
```

**Root Causes**:
1. Subscriptions deleted directly in Stripe dashboard
2. Subscriptions expired and auto-deleted by Stripe
3. Failed webhooks not updating database
4. Test data with invalid subscription IDs

**Fixes Applied**:

#### A. Improved Error Handling in `cancelOrgSubscription()`
**File**: `lib/billing/subscription-utils.ts`

```typescript
// Now gracefully handles missing subscriptions
catch (error) {
  if (
    error instanceof Error &&
    'type' in error &&
    error.type === 'StripeInvalidRequestError' &&
    'code' in error &&
    error.code === 'resource_missing'
  ) {
    console.warn(`Subscription not found in Stripe, continuing`);
    return false; // Instead of throwing
  }
  throw error;
}
```

#### B. Updated Leave Organization Route
**File**: `app/api/organizations/leave/route.ts`

- Now uses the improved `cancelOrgSubscription()` function
- Logs warnings instead of errors for missing subscriptions
- Continues with org deletion even if subscription doesn't exist

#### C. Updated Delete Organization Route
**File**: `app/api/organizations/[orgId]/delete/route.ts`

- Same improvements as leave route
- Better error handling and logging

#### D. Created Stale Subscription Cleanup Script
**File**: `scripts/fix-stale-subscriptions.ts`

This script:
- Identifies users with paid plans but no active Stripe subscriptions
- Identifies organizations with invalid subscription IDs
- Can run in dry-run mode to see issues
- Can apply fixes to clean up stale data

**Usage**:
```bash
# Check for issues (no changes)
npx tsx scripts/fix-stale-subscriptions.ts --dry-run

# Fix issues
npx tsx scripts/fix-stale-subscriptions.ts --fix
```

---

## Testing Instructions

### Test 1: Leave Organization (Last Owner)
1. Create a test organization
2. Add a subscription (or use existing org with stale subscription ID)
3. As the owner, try to leave the organization
4. **Expected**: Should successfully delete org even if subscription doesn't exist in Stripe
5. **Check logs**: Should see warning about missing subscription, but deletion continues

### Test 2: Leave Organization (AnalyticsEvent FK)
1. Create a test organization
2. Generate some analytics events for the org
3. As the last owner, try to leave
4. **Expected**: Should successfully delete org without FK constraint errors
5. **Verify**: Analytics events should have `orgId` set to NULL

### Test 3: Delete Organization
1. Create a test organization with members
2. Try to delete the organization
3. **Expected**: Should succeed even with missing/stale subscription
4. **Verify**: All members reset to free plan

### Test 4: Stale Subscription Cleanup
```bash
# First, check what would be fixed
npx tsx scripts/fix-stale-subscriptions.ts --dry-run

# If results look good, apply fixes
npx tsx scripts/fix-stale-subscriptions.ts --fix
```

---

## Production Deployment Checklist

### Pre-Deployment
- [ ] Backup database
- [ ] Test all fixes in staging environment
- [ ] Run stale subscription cleanup in dry-run mode on production
- [ ] Review what subscriptions would be affected

### Deployment Steps
1. **Apply Database Migration**:
   ```bash
   npx tsx scripts/apply-analytics-fk-fix.ts
   ```
   
2. **Clean Up Stale Subscriptions** (optional):
   ```bash
   # Review first
   npx tsx scripts/fix-stale-subscriptions.ts --dry-run
   
   # Then apply if needed
   npx tsx scripts/fix-stale-subscriptions.ts --fix
   ```

3. **Deploy Code Changes**:
   - Deploy updated `lib/billing/subscription-utils.ts`
   - Deploy updated `app/api/organizations/leave/route.ts`
   - Deploy updated `app/api/organizations/[orgId]/delete/route.ts`

4. **Monitor**:
   - Watch for `[leave-org]` and `[delete-org]` logs
   - Check for any remaining FK constraint errors
   - Monitor subscription cancellation attempts

### Post-Deployment
- [ ] Test leaving an organization in production
- [ ] Test deleting an organization in production
- [ ] Verify analytics events are being created correctly
- [ ] Check Stripe dashboard for any canceled subscriptions

---

## Why These Bugs Occurred

### 1. FK Constraint Issue
- The `AnalyticsEvent` table was added later
- Initial schema didn't specify `ON DELETE` behavior
- Default behavior is `RESTRICT`, which blocks deletion
- Schema in code had `onDelete: 'set null'` but database constraint wasn't updated

### 2. Subscription Sync Issue
- Subscriptions can be deleted directly in Stripe dashboard
- Test mode subscriptions get deleted after a certain period
- Failed webhooks don't update the database
- No cleanup process for orphaned subscription IDs
- Code assumed subscription always exists in Stripe

---

## Prevention Measures

### Implemented
1. **Robust Error Handling**: All subscription cancellations now handle missing subscriptions gracefully
2. **Database Constraints**: FK constraints now properly cascade deletes
3. **Cleanup Script**: Can identify and fix stale data
4. **Better Logging**: Clear logs for debugging subscription issues

### Recommended
1. **Regular Cleanup**: Run stale subscription script monthly
2. **Webhook Monitoring**: Set up alerts for failed Stripe webhooks
3. **Subscription Validation**: Periodically validate DB subscriptions against Stripe
4. **Test Data Cleanup**: Regularly clean up test organizations and subscriptions

---

## Related Files

### Modified Files
- `lib/billing/subscription-utils.ts` - Improved error handling
- `app/api/organizations/leave/route.ts` - Better subscription cancellation
- `app/api/organizations/[orgId]/delete/route.ts` - Better subscription cancellation

### New Files
- `scripts/apply-analytics-fk-fix.ts` - FK constraint migration
- `scripts/fix-stale-subscriptions.ts` - Cleanup script

### Schema Files
- `lib/db/schema.ts` - AnalyticsEvent table definition
- `drizzle/fix-analytics-fk-cascades.sql` - SQL migration file

---

## Support & Troubleshooting

### If Users Still Can't Leave Organizations

1. **Check Database Constraints**:
   ```sql
   SELECT conname, confdeltype 
   FROM pg_constraint 
   WHERE conrelid = '"AnalyticsEvent"'::regclass 
     AND contype = 'f';
   ```
   Both FK constraints should have `confdeltype = 'n'` (SET NULL)

2. **Check for Other FK References**:
   ```sql
   SELECT conname, conrelid::regclass as table_name
   FROM pg_constraint
   WHERE confrelid = '"Org"'::regclass
     AND contype = 'f';
   ```
   Look for any constraints without proper ON DELETE behavior

3. **Manual Cleanup**:
   ```sql
   -- Check what would be affected
   SELECT id, "userId", "orgId"
   FROM "AnalyticsEvent"
   WHERE "orgId" = '<org-id>';
   
   -- Set to NULL manually if needed
   UPDATE "AnalyticsEvent"
   SET "orgId" = NULL
   WHERE "orgId" = '<org-id>';
   ```

### If Subscription Errors Persist

1. **Verify Subscription in Stripe**:
   - Check Stripe dashboard for the subscription ID
   - If doesn't exist, run cleanup script

2. **Check Logs**:
   ```bash
   # Look for subscription errors
   grep "Failed to cancel" logs/*.log
   ```

3. **Manual Cleanup**:
   ```sql
   -- Clear stale subscription ID
   UPDATE "Org"
   SET "stripeSubscriptionId" = NULL,
       "plan" = 'free',
       "seatCount" = 1
   WHERE id = '<org-id>';
   ```

---

## Summary

✅ **Fixed**: FK constraint blocking organization deletion  
✅ **Fixed**: Stale subscription ID errors  
✅ **Created**: Cleanup scripts for both issues  
✅ **Improved**: Error handling and logging  
✅ **Documented**: Testing and deployment procedures  

All code changes are backwards compatible and won't break existing functionality. The fixes handle edge cases gracefully and continue operations even when external services (Stripe) have stale data.




























