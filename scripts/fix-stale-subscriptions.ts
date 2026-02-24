#!/usr/bin/env tsx

/**
 * Fix stale subscription IDs
 *
 * This script identifies and cleans up subscription IDs stored in the database
 * that no longer exist in Stripe. This can happen when:
 * 1. Subscriptions are deleted directly in Stripe dashboard
 * 2. Subscriptions expire and get auto-deleted
 * 3. Webhooks fail to process
 *
 * Run with: npx tsx scripts/fix-stale-subscriptions.ts [--dry-run] [--fix]
 */

import { config } from 'dotenv';

// Load environment variables first
config({ path: '.env.local' });

import { db } from "../lib/db";
import { user as userTable, org as orgTable } from "../lib/db/schema";
import { eq, isNotNull, } from "drizzle-orm";
import Stripe from "stripe";

const isDryRun = process.argv.includes("--dry-run");

const shouldFix = process.argv.includes('--fix');

if (!isDryRun && !shouldFix) {
  console.error('❌ Error: Must specify either --dry-run or --fix');
  console.log(
    'Usage: npx tsx scripts/fix-stale-subscriptions.ts [--dry-run|--fix]',
  );
  process.exit(1);
}

async function main() {
  console.log('🔍 Checking for stale subscription IDs...\n');
  console.log(
    `Mode: ${isDryRun ? '🔍 DRY RUN (no changes)' : '🔧 FIX MODE (will update database)'}\n`,
  );

  // Initialize Stripe
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('❌ STRIPE_SECRET_KEY not found in environment');
    process.exit(1);
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2025-08-27.basil',
  });

  let fixedUsers = 0;
  let fixedOrgs = 0;

  let errorsEncountered = 0;

  // Check users with Stripe customer IDs
  console.log('📋 Checking user subscriptions...');
  const users = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      stripeCustomerId: userTable.stripeCustomerId,
      plan: userTable.plan,
    })
    .from(userTable)
    .where(isNotNull(userTable.stripeCustomerId));

  console.log(`Found ${users.length} users with Stripe customer IDs\n`);

  for (const user of users) {
    if (!user.stripeCustomerId) continue;

    try {
      // Get active subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active',
        limit: 10,
      });

      // If user has no active subscriptions but has a paid plan, they might have stale data
      if (
        subscriptions.data.length === 0 &&
        (user.plan === 'pro' || user.plan === 'business')
      ) {
        console.log(`⚠️  User ${user.email} (${user.id})`);
        console.log(`   Plan: ${user.plan}, Active subscriptions: 0`);
        console.log(`   Stripe Customer: ${user.stripeCustomerId}`);

        if (shouldFix) {
          // Reset to free plan
          await db
            .update(userTable)
            .set({ plan: 'free' })
            .where(eq(userTable.id, user.id));

          console.log(`   ✅ Reset to free plan`);
          fixedUsers++;
        } else {
          console.log(`   📝 Would reset to free plan (use --fix to apply)`);
        }
        console.log();
      }
    } catch (error) {
      if (
        error instanceof Stripe.errors.StripeError &&
        error.code === 'resource_missing'
      ) {
        console.log(`⚠️  User ${user.email} (${user.id})`);
        console.log(`   Stripe customer ${user.stripeCustomerId} not found`);

        if (shouldFix) {
          await db
            .update(userTable)
            .set({
              plan: 'free',
              stripeCustomerId: null,
            })
            .where(eq(userTable.id, user.id));

          console.log(`   ✅ Reset to free plan and cleared customer ID`);
          fixedUsers++;
        } else {
          console.log(`   📝 Would reset to free plan (use --fix to apply)`);
        }
        console.log();
      } else {
        console.error(`❌ Error checking user ${user.email}:`, error);
        errorsEncountered++;
      }
    }
  }

  // Check organizations with subscription IDs
  console.log('\n📋 Checking organization subscriptions...');
  const orgs = await db
    .select({
      id: orgTable.id,
      name: orgTable.name,
      stripeSubscriptionId: orgTable.stripeSubscriptionId,
      plan: orgTable.plan,
      seatCount: orgTable.seatCount,
    })
    .from(orgTable)
    .where(isNotNull(orgTable.stripeSubscriptionId));

  console.log(`Found ${orgs.length} organizations with subscription IDs\n`);

  for (const org of orgs) {
    if (!org.stripeSubscriptionId) continue;

    try {
      // Try to retrieve the subscription
      await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
      // Subscription exists, all good
    } catch (error) {
      if (
        error instanceof Stripe.errors.StripeError &&
        error.code === 'resource_missing'
      ) {
        console.log(`⚠️  Organization ${org.name || org.id}`);
        console.log(
          `   Subscription ID: ${org.stripeSubscriptionId} not found in Stripe`,
        );
        console.log(`   Plan: ${org.plan}, Seats: ${org.seatCount}`);

        if (shouldFix) {
          // Clear subscription ID and downgrade to free
          await db
            .update(orgTable)
            .set({
              stripeSubscriptionId: null,
              plan: 'free',
              seatCount: 1,
            })
            .where(eq(orgTable.id, org.id));

          // Reset all members to free plan
          await db
            .update(userTable)
            .set({ plan: 'free' })
            .where(eq(userTable.orgId, org.id));

          console.log(
            `   ✅ Cleared subscription ID, downgraded org and members to free`,
          );
          fixedOrgs++;
        } else {
          console.log(
            `   📝 Would clear subscription ID and downgrade (use --fix to apply)`,
          );
        }
        console.log();
      } else {
        console.error(`❌ Error checking org ${org.name || org.id}:`, error);
        errorsEncountered++;
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Summary');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log(`Would fix ${fixedUsers} users`);
    console.log(`Would fix ${fixedOrgs} organizations`);
    console.log(`\nRun with --fix to apply changes`);
  } else {
    console.log(`✅ Fixed ${fixedUsers} users`);
    console.log(`✅ Fixed ${fixedOrgs} organizations`);

    if (errorsEncountered > 0) {
      console.log(`⚠️  Encountered ${errorsEncountered} errors (see above)`);
    }
  }

  console.log(`${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
