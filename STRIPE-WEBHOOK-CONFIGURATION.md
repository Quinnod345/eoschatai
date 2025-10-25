# Stripe Webhook Configuration Guide

**Purpose**: Configure all required Stripe webhooks for the subscription system  
**Status**: Ready to configure  
**Date**: October 8, 2025

---

## 📋 Quick Setup

### Step 1: Access Stripe Dashboard

1. Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Switch to your project (test or live mode)
3. Navigate to: **Developers** → **Webhooks**

---

### Step 2: Add Webhook Endpoint

**Click**: "Add endpoint"

**Endpoint URL**: 
```
https://yourdomain.com/api/billing/webhook
```

**Description**: 
```
Subscription & billing events for EOSAI
```

---

### Step 3: Select Events to Listen To

Select **ALL** of these 16 events:

#### ✅ Subscription Events (8)
- [x] `customer.subscription.created`
- [x] `customer.subscription.updated`
- [x] `customer.subscription.deleted`
- [x] `customer.subscription.paused`
- [x] `customer.subscription.resumed`
- [x] `customer.subscription.trial_will_end`

#### ✅ Payment Events (4)
- [x] `checkout.session.completed`
- [x] `checkout.session.expired`
- [x] `invoice.payment_failed`
- [x] `charge.refunded`

#### ✅ Payment Intent Events (2)
- [x] `payment_intent.requires_action`
- [x] `payment_intent.succeeded`

#### ✅ Customer Events (1)
- [x] `customer.updated`

---

### Step 4: Copy Webhook Signing Secret

After creating the webhook, you'll see a **Signing secret** that starts with `whsec_...`

**Copy this secret** and add it to your environment variables:

```bash
# .env.local (for development)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Vercel (for production)
vercel env add STRIPE_WEBHOOK_SECRET
# Paste the secret when prompted
```

---

## 🧪 Testing Webhooks

### Step 1: Install Stripe CLI (if not already)

```bash
brew install stripe/stripe-cli/stripe
```

### Step 2: Login to Stripe

```bash
stripe login
```

### Step 3: Forward Webhooks to Local Dev

```bash
# Start your dev server first
pnpm dev

# In another terminal, forward webhooks
stripe listen --forward-to localhost:3000/api/billing/webhook
```

This will give you a webhook secret for testing: `whsec_test_...`

### Step 4: Trigger Test Events

```bash
# Test subscription creation
stripe trigger customer.subscription.created

# Test payment failure
stripe trigger invoice.payment_failed

# Test subscription deletion
stripe trigger customer.subscription.deleted
```

### Step 5: Verify in Your App

1. Check server logs for webhook processing
2. Cancel a test subscription → Check limits update immediately
3. Update org seat count → Check pendingRemoval flag set

---

## 🔍 What Each Webhook Does

### Subscription Lifecycle
```
customer.subscription.created → Grant access
customer.subscription.updated → Sync seat count changes
customer.subscription.paused → Revoke access
customer.subscription.resumed → Restore access
customer.subscription.deleted → Downgrade to free
customer.subscription.trial_will_end → Notify user (3 days before)
```

### Payment Processing
```
checkout.session.completed → Create subscription
checkout.session.expired → Log (cleanup if needed)
invoice.payment_failed → Retry 4x then downgrade
charge.refunded → Cancel subscription on full refund
```

### Payment Security
```
payment_intent.requires_action → User needs 3D Secure
payment_intent.succeeded → Payment confirmed
```

### Customer Management
```
customer.updated → Sync email changes bi-directionally
```

---

## 🔒 Security Verification

### Your Webhook Endpoint Validates:

1. ✅ **Signature Verification**
   ```typescript
   const signature = request.headers.get('stripe-signature');
   stripe.webhooks.constructEvent(payload, signature, WEBHOOK_SECRET);
   ```

2. ✅ **Event Deduplication**
   ```typescript
   if (await hasWebhookBeenProcessed(event.id)) {
     return { received: true };
   }
   ```

3. ✅ **Subscription Locking**
   ```typescript
   // Redis lock prevents concurrent processing
   redis.set(`subscription:lock:${subscription.id}`, event.id, { nx: true, ex: 30 });
   ```

---

## 🐛 Troubleshooting

### Issue: Webhooks Not Arriving

**Check**:
1. Is endpoint URL correct and accessible?
2. Is webhook endpoint live in Stripe dashboard?
3. Are events selected?
4. Check Stripe dashboard → Webhooks → Recent deliveries

**Solution**: Use Stripe CLI to test locally first

---

### Issue: Webhook Signature Verification Fails

**Check**:
1. Is `STRIPE_WEBHOOK_SECRET` set correctly?
2. Are you using the correct secret for test vs live mode?
3. Is secret starting with `whsec_`?

**Solution**: 
```bash
# Verify secret is loaded
node -e "console.log(process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10))"
```

---

### Issue: Events Processed Multiple Times

**Check**:
1. Are multiple webhook endpoints configured?
2. Is webhook being retried due to errors?

**Solution**: 
- Check `WebhookEvents` table for duplicates
- Ensure status 200 returned
- Check for thrown errors in webhook handler

---

## 📊 Monitoring

### Logs to Watch

```bash
# Successful processing
[stripe] Subscription sub_xxx created for user yyy

# Locking (normal)
[stripe] Subscription sub_xxx is locked by another webhook, skipping

# Warnings (investigate)
[stripe] Subscription sub_xxx missing org_id metadata, looking up in database
[stripe] Customer cus_xxx not found or invalid. Clearing from database.

# Errors (fix immediately)
[stripe] Failed to update org seat count from webhook
[stripe] Failed to process payment failure
```

### Metrics to Track

- Webhook processing time (should be < 1s)
- Lock conflicts (should be rare)
- Metadata fallbacks (should be zero for new subscriptions)
- Customer not found errors (should be zero)

---

## ✅ Verification Checklist

After configuring webhooks:

- [ ] All 16 events selected in Stripe dashboard
- [ ] Webhook signing secret added to env vars
- [ ] Test mode webhooks working (use Stripe CLI)
- [ ] Production webhooks configured
- [ ] Monitored first few events successfully
- [ ] Tested subscription creation → access granted
- [ ] Tested subscription cancellation → access revoked immediately
- [ ] Tested seat count update → pendingRemoval set correctly

---

## 🚀 Production Deployment

### Before Going Live

1. **Test in Stripe Test Mode**
   - Create test subscriptions
   - Cancel test subscriptions
   - Update seat counts
   - Verify all webhooks process correctly

2. **Configure Production Webhooks**
   - Use production Stripe dashboard
   - Same 16 events
   - Production endpoint URL
   - Production webhook secret

3. **Environment Variables**
   ```bash
   # Production
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_live_...
   
   # Test
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_test_...
   ```

4. **Monitor First 24 Hours**
   - Watch webhook delivery logs
   - Check for failed deliveries
   - Verify state updates correctly
   - Monitor error rates

---

## 📞 Support

### Webhook Not Processing?

1. Check Stripe dashboard → Webhooks → Endpoint → Recent deliveries
2. Look for HTTP errors (401, 500, etc.)
3. Check your server logs
4. Verify endpoint is accessible from internet
5. Use "Send test webhook" button in Stripe

### Need to Replay Events?

Stripe allows replaying recent events:
1. Go to Developers → Events
2. Find the event
3. Click "Send test webhook"
4. Select your endpoint

### Webhook Queue Backed Up?

If webhooks are failing and retrying:
1. Fix the underlying issue
2. Stripe will automatically retry failed webhooks
3. Use "Retry failed events" in Stripe dashboard
4. Or manually replay critical events

---

## 🎓 Best Practices

1. **Always Return 200** - Even if processing fails internally
2. **Process Async** - Don't timeout (< 30s)
3. **Handle Duplicates** - Use event.id for idempotency
4. **Log Everything** - Debug webhook issues from logs
5. **Test Locally** - Use Stripe CLI before production

---

## Summary

**Required Events**: 16  
**Estimated Setup Time**: 10 minutes  
**Testing Time**: 20 minutes  
**Difficulty**: Easy  

All webhook handlers are implemented and tested. Just need to configure in Stripe dashboard!

---

**Next**: Copy webhook secret → Add to env → Test with Stripe CLI → Deploy




















































