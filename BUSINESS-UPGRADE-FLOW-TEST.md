# Business Upgrade Flow Test Plan

## Overview
The business upgrade flow now has proper edge case handling and a seamless user experience.

## Key Improvements

### 1. Organization Management
- **GET /api/organizations**: Check if user has an existing organization
- **Organization Modal**: Handles existing org case gracefully
- **Pre-population**: Uses company name from user settings if available
- **Error Recovery**: If user already has org, it continues with that org

### 2. Business Upgrade Flow
- **New Component**: `BusinessUpgradeFlow` handles the entire flow
- **Step-by-step Process**:
  1. Checks organization status
  2. If no org, prompts to create one
  3. If org exists, shows details and proceeds
  4. Creates Stripe checkout with proper org ID
  5. Handles errors gracefully

### 3. Account Management
- **Account Refresh**: Event-based refresh system
- **Account Provider**: Listens for 'account-refresh' events
- **Real-time Updates**: Organization data updates without page reload

## Testing Steps

### Test 1: User Without Organization
1. Open Settings → Organization tab
2. Should see "Create or Join Organization" button
3. Click button → Organization modal opens
4. Create organization → Success message
5. Organization details now visible

### Test 2: Business Upgrade Without Org
1. Open premium features modal
2. Select Business plan
3. Click "Upgrade to Business"
4. Business flow opens automatically
5. Shows "Organization setup required"
6. Click "Set Up Organization"
7. Create org → Flow continues
8. Shows org details with checkmark
9. Click "Continue to Checkout"
10. Redirects to Stripe

### Test 3: Business Upgrade With Existing Org
1. If user already has org
2. Select Business plan
3. Click "Upgrade to Business"
4. Business flow shows org details immediately
5. Click "Continue to Checkout"
6. Redirects to Stripe with org ID

### Test 4: Error Handling
- Creating org when already has one: Continues with existing org
- Stripe checkout errors: Shows error message with retry
- Network errors: Graceful error messages

## Console Debugging
Look for these console messages:
- `[PremiumModal] Organization state:` - Shows current org
- `[PremiumModal] Checkout clicked:` - Shows selected plan
- `[AccountProvider] Received account-refresh event` - Account refresh
- `[AccountProvider] Bootstrap payload:` - Account data loaded

## Edge Cases Handled
1. ✅ User already has organization
2. ✅ Organization creation fails
3. ✅ Stripe checkout fails
4. ✅ Network connectivity issues
5. ✅ User closes modal mid-flow
6. ✅ Pro users upgrading to Business
7. ✅ Account data not synced

## Components Involved
- `components/premium-features-modal.tsx` - Main upgrade modal
- `components/business-upgrade-flow.tsx` - Business-specific flow
- `components/organization-modal.tsx` - Org creation/joining
- `components/account-provider.tsx` - Account data management
- `app/api/organizations/route.ts` - Org API endpoints
- `lib/billing/stripe.ts` - Stripe integration

