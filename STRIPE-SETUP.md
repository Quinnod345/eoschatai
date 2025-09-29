# Stripe Setup Guide

## Prerequisites

1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Stripe Dashboard

## Environment Variables

Add the following to your `.env.local` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY="sk_test_your-stripe-secret-key"
STRIPE_PUBLISHABLE_KEY="pk_test_your-stripe-publishable-key"
STRIPE_WEBHOOK_SECRET="whsec_your-webhook-secret"

# Stripe Price IDs (create these in your Stripe dashboard)
PRO_MONTHLY_PRICE_ID="price_your-pro-monthly-price-id"
PRO_ANNUAL_PRICE_ID="price_your-pro-annual-price-id"
BUSINESS_SEAT_MONTHLY_PRICE_ID="price_your-business-monthly-price-id"
BUSINESS_SEAT_ANNUAL_PRICE_ID="price_your-business-annual-price-id"
```

## Setting up Products and Prices in Stripe

1. Go to your Stripe Dashboard > Products
2. Create two products:
   - **EOS AI Pro** - For individual users
   - **EOS AI Business** - For teams

3. For each product, create prices:
   - Pro Monthly: $49/month
   - Pro Annual: $499/year
   - Business Monthly: $99/seat/month
   - Business Annual: $999/seat/year

4. Copy the price IDs and add them to your environment variables

## Setting up Webhooks

1. In Stripe Dashboard, go to Developers > Webhooks
2. Add endpoint:
   - Endpoint URL: `https://your-domain.com/api/billing/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`

3. Copy the webhook signing secret and add it as `STRIPE_WEBHOOK_SECRET`

## Local Development

For local testing with Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/billing/webhook

# The CLI will show you a webhook signing secret to use locally
```

## Testing Payments

Use these test card numbers:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

## Database Migrations

Make sure to run the migrations to set up the required tables:

```bash
# Run all migrations
pnpm db:push

# Or run specific migration
psql $DATABASE_URL -f drizzle/0017_plan_and_entitlements.sql
psql $DATABASE_URL -f drizzle/0018_analytics_event.sql
```

## Verifying Setup

1. Check that prices load: `curl http://localhost:3000/api/billing/prices`
2. Test checkout creation: Check the browser console when clicking upgrade
3. Monitor webhook events in Stripe Dashboard > Developers > Webhooks

