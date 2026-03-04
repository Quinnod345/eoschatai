import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import {
  getMemberByEmail,
  mapCircleTierToPlan,
} from '@/lib/integrations/circle';
import {
  broadcastEntitlementsUpdated,
  getUserEntitlements,
  invalidateUserEntitlementsCache,
} from '@/lib/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Silently re-validates the authenticated user's Circle subscription tier.
 * Called in the background when the app loads for Circle-sourced users.
 *
 * - If the user is still an active member, their plan is updated to match current tier.
 * - If they are no longer found in Circle, they are downgraded to free.
 * - If Circle API is unavailable, the current plan is preserved (fail-open).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [currentUser] = await db
    .select({
      id: user.id,
      email: user.email,
      circleMemberEmail: user.circleMemberEmail,
      plan: user.plan,
      subscriptionSource: user.subscriptionSource,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Only verify Circle-sourced subscriptions
  if (currentUser.subscriptionSource !== 'circle') {
    return NextResponse.json({
      verified: false,
      code: 'NOT_CIRCLE_SUBSCRIBER',
      message: 'Your subscription is not currently managed by Circle.',
      reason: 'not_circle_subscriber',
      plan: currentUser.plan,
    });
  }

  const lookupCandidates = Array.from(
    new Set(
      [currentUser.email, currentUser.circleMemberEmail]
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value?.includes('@'))),
    ),
  );
  if (lookupCandidates.length === 0) {
    console.warn(
      '[circle.verify] Current user has invalid email, cannot verify Circle subscription',
      {
        userId: currentUser.id,
        email: currentUser.email,
        circleMemberEmail: currentUser.circleMemberEmail,
      },
    );
    return NextResponse.json(
      {
        verified: false,
        changed: false,
        code: 'INVALID_USER_EMAIL',
        message:
          'Your account email is invalid. Update your profile email to verify Circle access.',
        action: 'open_settings_profile',
        plan: currentUser.plan,
        reason: 'invalid_user_email',
      },
      { status: 400 },
    );
  }

  let member: Awaited<ReturnType<typeof getMemberByEmail>> | null = null;
  let lookupHadError = false;
  for (const lookupEmail of lookupCandidates) {
    try {
      member = await getMemberByEmail(lookupEmail);
      if (member) {
        break;
      }
    } catch (err) {
      lookupHadError = true;
      console.warn('[circle.verify] Circle API lookup failed for candidate email', {
        userId: currentUser.id,
        lookupEmail,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!member && lookupHadError) {
    // Circle API unreachable for one or more candidates — fail-open: keep current plan
    return NextResponse.json({
      verified: true,
      changed: false,
      code: 'CIRCLE_VERIFY_TEMPORARY_FAILURE',
      message:
        'We could not verify Circle right now. Your current plan was preserved.',
      plan: currentUser.plan,
      reason: 'circle_api_error_preserved',
    });
  }

  if (!member) {
    // Member no longer found in Circle — downgrade to free
    await db
      .update(user)
      .set({ plan: 'free', subscriptionSource: 'stripe' })
      .where(eq(user.id, currentUser.id));

    await invalidateUserEntitlementsCache(currentUser.id);
    await getUserEntitlements(currentUser.id);
    await broadcastEntitlementsUpdated(currentUser.id);

    console.log('[circle.verify] Member no longer in Circle, downgraded to free', {
      userId: currentUser.id,
      lookupCandidates,
      previousPlan: currentUser.plan,
      previousSource: currentUser.subscriptionSource,
    });

    return NextResponse.json({
      verified: true,
      changed: true,
      code: 'CIRCLE_MEMBERSHIP_NOT_FOUND',
      message:
        'We could not find an active Circle membership for your account. Your plan was set to Free.',
      action: 'open_circle_connect_flow',
      plan: 'free',
      subscriptionSource: 'stripe',
      reason: 'member_not_found_in_circle',
    });
  }

  const mappedPlan = member.mappedPlan ?? mapCircleTierToPlan(member.tierName);

  if (!mappedPlan) {
    // Tier exists but is unmapped — fail-open: preserve current plan
    console.warn('[circle.verify] Unknown Circle tier, preserving current plan', {
      userId: currentUser.id,
      tierName: member.tierName,
    });
    return NextResponse.json({
      verified: true,
      changed: false,
      code: 'CIRCLE_TIER_UNMAPPED',
      message:
        'Your Circle tier is not mapped yet. Your current plan was preserved.',
      plan: currentUser.plan,
      reason: 'unknown_tier_preserved',
      tierName: member.tierName,
    });
  }

  if (mappedPlan !== currentUser.plan) {
    await db
      .update(user)
      .set({
        plan: mappedPlan,
        circleId: member.id ?? undefined,
        circleMemberId: member.id ?? undefined,
        circleMemberEmail: member.email ?? lookupCandidates[0],
      })
      .where(eq(user.id, currentUser.id));

    await invalidateUserEntitlementsCache(currentUser.id);
    await getUserEntitlements(currentUser.id);
    await broadcastEntitlementsUpdated(currentUser.id);

    console.log('[circle.verify] Plan updated', {
      userId: currentUser.id,
      from: currentUser.plan,
      to: mappedPlan,
      tierName: member.tierName,
    });

    return NextResponse.json({
      verified: true,
      changed: true,
      code: 'CIRCLE_PLAN_UPDATED',
      message: `Your Circle plan was refreshed to ${mappedPlan}.`,
      plan: mappedPlan,
      tierName: member.tierName,
    });
  }

  return NextResponse.json({
    verified: true,
    changed: false,
    code: 'CIRCLE_PLAN_VERIFIED',
    message: 'Your Circle plan is already up to date.',
    plan: currentUser.plan,
    tierName: member.tierName,
  });
}
