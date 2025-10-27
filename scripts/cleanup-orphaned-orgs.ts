#!/usr/bin/env tsx

/**
 * Cleanup script for orphaned organizations
 *
 * Finds and handles organizations with:
 * - No owner (ownerId = NULL)
 * - No members
 * - Active Stripe subscriptions that need canceling
 *
 * Run with: npx tsx scripts/cleanup-orphaned-orgs.ts
 */

import { db } from '@/lib/db';
import {
  org as orgTable,
  user as userTable,
  orgInvitation,
} from '@/lib/db/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import { getStripeClient } from '@/lib/stripe/client';

async function findOrphanedOrgs() {
  console.log('🔍 Searching for orphaned organizations...\n');

  const orphanedOrgs = await db
    .select({
      id: orgTable.id,
      name: orgTable.name,
      plan: orgTable.plan,
      stripeSubscriptionId: orgTable.stripeSubscriptionId,
      seatCount: orgTable.seatCount,
      ownerId: orgTable.ownerId,
      memberCount: sql<number>`(SELECT COUNT(*) FROM "User" WHERE "orgId" = ${orgTable.id})`,
    })
    .from(orgTable)
    .where(isNull(orgTable.ownerId));

  return orphanedOrgs;
}

async function cleanupOrphanedOrg(org: any, dryRun: boolean) {
  const memberCount = Number(org.memberCount);

  console.log(`\n📋 Processing: ${org.name || 'Unnamed Org'}`);
  console.log(`   ID: ${org.id}`);
  console.log(`   Plan: ${org.plan}`);
  console.log(`   Members: ${memberCount}`);
  console.log(`   Subscription: ${org.stripeSubscriptionId || 'None'}`);

  if (memberCount === 0) {
    // No members - safe to delete completely
    console.log('   ✅ No members found - SAFE TO DELETE');

    if (!dryRun) {
      // Cancel Stripe subscription if exists
      if (org.stripeSubscriptionId) {
        const stripe = getStripeClient();
        if (stripe) {
          try {
            await stripe.subscriptions.cancel(org.stripeSubscriptionId, {
              cancellation_details: {
                comment: 'Orphaned organization cleanup',
              },
            });
            console.log(
              `   ✅ Cancelled subscription ${org.stripeSubscriptionId}`,
            );
          } catch (error) {
            console.error(`   ❌ Failed to cancel subscription:`, error);
          }
        }
      }

      // Delete pending invitations
      try {
        const deleted = await db
          .delete(orgInvitation)
          .where(eq(orgInvitation.orgId, org.id));
        console.log(`   ✅ Deleted pending invitations`);
      } catch (error) {
        console.error(`   ❌ Failed to delete invitations:`, error);
      }

      // Delete organization
      try {
        await db.delete(orgTable).where(eq(orgTable.id, org.id));
        console.log(`   ✅ Deleted organization ${org.id}`);
      } catch (error) {
        console.error(`   ❌ Failed to delete org:`, error);
      }
    } else {
      console.log('   🔧 DRY RUN - Would delete this org');
    }
  } else {
    // Has members but no owner - assign first member as owner
    console.log(`   ⚠️  Has ${memberCount} members but no owner`);

    const [firstMember] = await db
      .select({ id: userTable.id, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.orgId, org.id))
      .orderBy(userTable.id)
      .limit(1);

    if (firstMember) {
      console.log(
        `   ℹ️  First member: ${firstMember.email} (${firstMember.id})`,
      );

      if (!dryRun) {
        try {
          await db
            .update(orgTable)
            .set({ ownerId: firstMember.id })
            .where(eq(orgTable.id, org.id));
          console.log(`   ✅ Assigned ${firstMember.email} as new owner`);
        } catch (error) {
          console.error(`   ❌ Failed to assign owner:`, error);
        }
      } else {
        console.log(
          `   🔧 DRY RUN - Would assign ${firstMember.email} as owner`,
        );
      }
    }
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('🔧 DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('⚠️  LIVE MODE - Changes will be made to database and Stripe\n');
    console.log('Run with --dry-run to preview changes first\n');
  }

  const orphanedOrgs = await findOrphanedOrgs();

  if (orphanedOrgs.length === 0) {
    console.log('✅ No orphaned organizations found!\n');
    return;
  }

  console.log(`⚠️  Found ${orphanedOrgs.length} orphaned organizations:\n`);

  for (const org of orphanedOrgs) {
    await cleanupOrphanedOrg(org, dryRun);
  }

  console.log('\n✅ Cleanup complete!\n');

  if (dryRun) {
    console.log(
      'To apply changes, run: npx tsx scripts/cleanup-orphaned-orgs.ts\n',
    );
  }
}

main()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });




















































