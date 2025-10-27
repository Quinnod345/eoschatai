# Usage Counter Reset System - Debug Guide

## Overview

The daily chat usage counter (`chats_today`) should reset automatically at midnight UTC via a cron job. This guide helps you debug and manually test the reset functionality.

## How Daily Resets Work

### Automatic Reset (Production)

1. **Vercel Cron Job** - Configured in `vercel.json`:
   ```json
   {
     "path": "/api/cron/usage/daily",
     "schedule": "0 0 * * *"  // Runs at 00:00 UTC daily
   }
   ```

2. **Endpoint**: `/api/cron/usage/daily`
   - Requires `Authorization: Bearer ${CRON_SECRET}` header
   - Resets `chats_today` and `deep_runs_day` for ALL users
   - Logs execution time and status

### Manual Reset on Subscription Purchase

When a user upgrades to premium (Pro/Business), their usage counters are immediately reset:
- ✅ Stripe checkout completion
- ✅ Subscription webhook (created/updated)
- ✅ Organization subscription activation
- ✅ Admin plan changes (dev only)

## Debug Options

### 1. Debug Web Page (Development Only)

Visit: `http://localhost:3000/debug/usage`

Features:
- View current usage state
- Reset your own counters
- Reset all users (admin)
- Real-time results

### 2. Settings Modal Reset Button (Development Only)

In development mode, a "Reset" button appears next to chat usage in Settings > Usage.

### 3. API Endpoint

```bash
# Reset your own usage
curl -X POST http://localhost:3000/api/debug/reset-usage \
  -H "Content-Type: application/json" \
  -d '{"scope": "self"}' \
  -H "Cookie: your-session-cookie"

# Reset all users (dev only)
curl -X POST http://localhost:3000/api/debug/reset-usage \
  -H "Content-Type: application/json" \
  -d '{"scope": "all"}' \
  -H "Cookie: your-session-cookie"
```

### 4. Test Script

Run the test script to simulate the cron job:

```bash
node scripts/test-daily-reset.mjs
```

This will:
- Check your configuration
- Call the cron endpoint
- Display results and timing
- Provide troubleshooting tips

## Common Issues & Solutions

### Issue: Cron Never Runs

**Symptoms:**
- Usage counters never reset
- No logs in Vercel dashboard

**Solutions:**

1. **Check Vercel Cron is Enabled:**
   - Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
   - Ensure cron jobs are enabled for your plan

2. **Verify CRON_SECRET:**
   ```bash
   # In Vercel dashboard, check Environment Variables
   # Should have: CRON_SECRET=your-secret-key
   ```

3. **Check Logs:**
   - Vercel Dashboard → Your Project → Logs
   - Filter by "/api/cron/usage/daily"
   - Look for execution logs

### Issue: Cron Runs but Fails

**Symptoms:**
- Cron logs show 401 Unauthorized
- Or 500 Internal Server Error

**Solutions:**

1. **401 Unauthorized:**
   ```bash
   # CRON_SECRET mismatch
   # Verify in Vercel: Settings → Environment Variables
   # Must match between vercel.json config and endpoint
   ```

2. **500 Internal Server Error:**
   - Check database connection
   - Look for error details in logs
   - May need to check PostgreSQL query permissions

### Issue: Reset Works in Dev, Not Production

**Causes:**
- Vercel cron not configured
- Wrong environment variables
- Database permissions

**Fix:**
```bash
# 1. Push vercel.json
git add vercel.json
git commit -m "Add cron configuration"
git push

# 2. Redeploy
vercel --prod

# 3. Check environment variables in Vercel dashboard
```

## Manual Testing

### Test Locally

1. **Start dev server:**
   ```bash
   pnpm dev
   ```

2. **Run test script:**
   ```bash
   node scripts/test-daily-reset.mjs
   ```

3. **Or use debug page:**
   - Navigate to `http://localhost:3000/debug/usage`
   - Click "Reset My Usage Counters"

### Test in Production

⚠️ **Warning:** This resets real user data!

```bash
# Get your CRON_SECRET from Vercel
CRON_SECRET="your-secret"

# Call the endpoint
curl -X POST https://your-app.vercel.app/api/cron/usage/daily \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Monitoring

### Check if Cron is Running

1. **Vercel Dashboard:**
   - Deployments → Select deployment → Functions
   - Look for `/api/cron/usage/daily` logs

2. **Check user data:**
   ```sql
   -- Run this query at different times of day
   SELECT 
     id, 
     email, 
     plan,
     "usageCounters"->>'chats_today' as chats_today,
     "usageCounters"->>'deep_runs_day' as deep_runs_day
   FROM "User"
   LIMIT 10;
   ```

3. **Expected behavior:**
   - Before midnight UTC: counters increase
   - After midnight UTC: counters should be 0

## Environment Variables

Required environment variables:

```env
# .env.local (local development)
CRON_SECRET=your-secret-key-here

# Vercel (production)
# Set in: Dashboard → Project → Settings → Environment Variables
CRON_SECRET=your-secret-key-here

# Optional: Allow debug endpoints in production
ALLOW_DEBUG_ENDPOINTS=true  # NOT recommended for production
```

## Logs to Look For

### Successful Reset
```
[cron] Daily usage reset started at: 2024-01-15T00:00:01.234Z
[cron] Daily usage reset completed successfully in 145ms
```

### Failed Reset
```
[cron] Unauthorized request to daily usage reset
# OR
[cron] Failed to reset daily usage counters { error: ... }
```

## Architecture

### Files Involved

1. **Cron Configuration:**
   - `vercel.json` - Cron schedule
   - `app/api/cron/usage/daily/route.ts` - Endpoint

2. **Reset Logic:**
   - `lib/entitlements/index.ts` - `resetDailyUsageCounters()`
   - `lib/entitlements/index.ts` - `resetUserDailyUsageCounters(userId)`

3. **Subscription Integration:**
   - `lib/billing/stripe.ts` - Resets on upgrade
   - `app/api/billing/admin/route.ts` - Dev plan changes

4. **Debug Tools:**
   - `app/api/debug/reset-usage/route.ts` - Manual reset API
   - `app/debug/usage/page.tsx` - Debug UI
   - `scripts/test-daily-reset.mjs` - Test script

### Database Schema

Usage counters are stored in the `User` table:

```typescript
{
  usageCounters: {
    chats_today: number,      // Reset daily
    deep_runs_day: number,    // Reset daily
    asr_minutes_month: number, // Reset monthly
    exports_month: number,     // Reset monthly
    // ... others
  }
}
```

## Quick Reference

| Task | Command/URL |
|------|-------------|
| Debug page | `http://localhost:3000/debug/usage` |
| Test cron | `node scripts/test-daily-reset.mjs` |
| Manual reset API | `POST /api/debug/reset-usage` |
| Settings button | Settings → Usage → "Reset" (dev only) |
| Check logs | Vercel Dashboard → Logs |
| Cron schedule | Midnight UTC (00:00) |

## Support

If issues persist:
1. Check all environment variables are set
2. Verify database connection
3. Check Vercel cron job status
4. Review error logs
5. Test with debug tools first

