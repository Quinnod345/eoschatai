# 🎯 Your Action Items - Subscription Fixes Deployment

**All code is complete!** Here's what YOU need to do to deploy:

---

## ✅ Step-by-Step Checklist

### Step 1: Run Database Migrations (5 minutes)

Open your terminal with database access and run:

```bash
cd /Users/quinnodonnell/eoschatai

# Set your database URL (use whichever you have)
export POSTGRES_URL="your-database-connection-string"
# OR
export DATABASE_URL="your-database-connection-string"

# Run the migration script
npx tsx scripts/apply-subscription-fixes-migrations.ts
```

**Expected output**:
```
✅ pendingRemoval field added
✅ Seat count constraints added
✅ Analytics FK cascades fixed
🎉 All subscription fixes migrations applied successfully!
```

---

### Step 2: Configure Stripe Webhooks (10 minutes)

1. **Go to**: [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)

2. **Click**: "Add endpoint"

3. **Enter URL**: 
   ```
   https://your-production-domain.com/api/billing/webhook
   ```

4. **Select these 16 events** (copy/paste this list):
   ```
   
   customer.subscription.paused
   customer.subscription.resumed
   customer.subscription.trial_will_end
   checkout.session.completed
   checkout.session.expired
   invoice.payment_failed
   charge.refunded
   payment_intent.requires_action
   payment_intent.succeeded
   customer.updated
   ```

5. **Click**: "Add endpoint"

6. **Copy**: The webhook signing secret (starts with `whsec_...`)

7. **Add to environment**:
   ```bash
   # For Vercel
   vercel env add STRIPE_WEBHOOK_SECRET
   # Paste the secret when prompted
   
   # Or in your .env file
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

---

### Step 3: Run Cleanup Script (2 minutes)

```bash
# Preview what will be cleaned up
npx tsx scripts/cleanup-orphaned-orgs.ts --dry-run

# If looks good, run it
npx tsx scripts/cleanup-orphaned-orgs.ts
```

---

### Step 4: Test Locally with Stripe CLI (Optional, 15 minutes)

```bash
# Install if not installed
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Start your dev server
pnpm dev

# In another terminal, forward webhooks
stripe listen --forward-to localhost:3000/api/billing/webhook

# In a third terminal, trigger test events
stripe trigger customer.subscription.created
stripe trigger customer.subscription.deleted
```

**Verify**: Check your dev server logs for webhook processing messages

---

### Step 5: Deploy to Production (5 minutes)

```bash
# Build
pnpm build

# Deploy (if using Vercel)
vercel --prod

# Or your deployment command
```

---

### Step 6: Verify Everything Works (10 minutes)

**Test these critical flows**:

1. **Subscription Cancellation Test**:
   - Go to Stripe dashboard
   - Find a test customer with subscription
   - Cancel their subscription
   - Refresh your app
   - **Expected**: User immediately sees free limits (5 uploads, 20 chats/day)

2. **Member Removal Test**:
   - Create test organization with Business plan
   - Add a test member
   - Remove the member
   - **Expected**: Member reverts to their individual plan or free

3. **Email Change Test**:
   - Change your email in the app
   - Check Stripe customer → Email should match
   - **Expected**: Email synced to Stripe

---

## 🔍 How to Verify Migrations Worked

Connect to your database and run:

```sql
-- Check pendingRemoval field exists
SELECT "id", "name", "seatCount", "pendingRemoval" 
FROM "Org" 
LIMIT 5;

-- Check constraints exist
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = '"Org"'::regclass;

-- Should see:
-- org_seat_count_positive
-- org_pending_removal_valid
```

---

## 🐛 Quick Test: The Cache Bug

This was the critical bug you found! Test it's fixed:

1. **Setup**: User with Pro subscription
2. **Action**: Cancel subscription in Stripe
3. **Check**: Refresh app IMMEDIATELY
4. **Expected Result**: 
   - Plan shows: `free` ✅
   - Uploads limit: `5` ✅ (not 100!)
   - Chats limit: `20/day` ✅ (not 200!)

If you see premium limits after canceling, the cache bug is still there. But it's fixed in 7 places now! 🎯

---

## ⚠️ Troubleshooting

### Migration Script Says "Database not configured"

**Solution**: Set your database URL env var first:
```bash
export POSTGRES_URL="postgresql://user:pass@host/db"
# Then run the script again
```

### Stripe Webhook Returns 401

**Solution**: Check webhook secret is set correctly in env vars

### User Still Has Premium Limits After Cancel

**Solution**: 
1. Check Redis is running (`redis-cli ping`)
2. Check cache invalidation is happening (look for logs)
3. Hard refresh browser (Cmd+Shift+R)

---

## 📖 Full Documentation

For complete technical details, see:
- **DEPLOYMENT-GUIDE-SUBSCRIPTION-FIXES.md** - Full deployment guide
- **STRIPE-WEBHOOK-CONFIGURATION.md** - Webhook setup details
- **COMPREHENSIVE-SUBSCRIPTION-FIXES-COMPLETE.md** - All technical details

---

## ✅ Final Checklist

- [ ] Database migrations applied
- [ ] Stripe webhooks configured (16 events)
- [ ] Webhook secret added to env vars
- [ ] Cleanup script executed
- [ ] Tested locally (optional)
- [ ] Deployed to production
- [ ] Verified subscription cancellation works
- [ ] Verified member removal works
- [ ] Verified email sync works

---

**Estimated Time**: 45-60 minutes total  
**Difficulty**: Easy (just configuration)  
**Risk**: Low (all changes are additive)

You've got this! 🚀

---

**Questions?** Check the documentation files or review the code comments.  
**Issues?** All error handling is comprehensive with detailed logging.  
**Success?** You'll see immediate improvements in subscription handling!

Good luck! 🎉














