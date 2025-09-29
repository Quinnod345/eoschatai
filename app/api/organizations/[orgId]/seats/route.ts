import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { org as orgTable } from '@/lib/db/schema';
import { checkOrgPermission } from '@/lib/organizations/permissions';
import {
  getOrgSeatUsage,
  updateOrgSeatCount,
} from '@/lib/organizations/seat-enforcement';
import { getStripeClient } from '@/lib/stripe/client';
import { STRIPE_CONFIG } from '@/lib/server-constants';

interface RouteParams {
  params: Promise<{
    orgId: string;
  }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    // Permissions: only owners (billing.manage) can change seat count
    const canManage = await checkOrgPermission(
      session.user.id,
      orgId,
      'billing.manage',
    );
    if (!canManage) {
      return NextResponse.json(
        { error: 'Only the organization owner can change seats' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const desiredSeatCount = Number(body?.seatCount);

    if (!Number.isInteger(desiredSeatCount) || desiredSeatCount < 1) {
      return NextResponse.json(
        { error: 'seatCount must be a positive integer' },
        { status: 400 },
      );
    }

    // Ensure org exists
    const [org] = await db
      .select()
      .from(orgTable)
      .where(eq(orgTable.id, orgId));
    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    // Prevent reducing seats below current usage
    const usage = await getOrgSeatUsage(orgId);
    if (desiredSeatCount < usage.used) {
      return NextResponse.json(
        {
          error: `Cannot reduce seats below current usage (${usage.used}).`,
          used: usage.used,
        },
        { status: 400 },
      );
    }

    // If Stripe subscription exists, update quantity there first
    if (org.stripeSubscriptionId) {
      try {
        const stripe = getStripeClient();
        if (!stripe) {
          throw new Error('Stripe client not available');
        }
        const sub = await stripe.subscriptions.retrieve(
          org.stripeSubscriptionId,
        );

        // Find the business seat price item (monthly or annual)
        const item =
          sub.items.data.find((it) =>
            [
              STRIPE_CONFIG.priceIds.businessSeatMonthly,
              STRIPE_CONFIG.priceIds.businessSeatAnnual,
            ].includes(it.price.id as string),
          ) || sub.items.data[0];

        if (!item) {
          throw new Error('No subscription item found to update');
        }

        await stripe.subscriptions.update(org.stripeSubscriptionId, {
          items: [
            {
              id: item.id,
              quantity: desiredSeatCount,
            },
          ],
          proration_behavior: 'create_prorations',
        });
      } catch (e) {
        console.error(
          '[org:seats] Stripe update failed, falling back to DB',
          e,
        );
      }
    }

    // Always reflect the new desired seat count in our DB
    await updateOrgSeatCount(orgId, desiredSeatCount);

    const updated = await getOrgSeatUsage(orgId);

    return NextResponse.json({
      success: true,
      seatCount: desiredSeatCount,
      usage: updated,
    });
  } catch (error) {
    console.error('[org:seats] Failed to update seat count', error);
    return NextResponse.json(
      { error: 'Failed to update seat count' },
      { status: 500 },
    );
  }
}
