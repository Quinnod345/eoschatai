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
 * Design principle — verify is upgrade-only:
 * - If Circle confirms a paid tier → update DB to match (handles upgrades/tier changes).
 * - If Circle finds the member but they appear untiered → fail-open, preserve current plan.
 *   This covers transient group-membership propagation lag in Circle's API.
 * - If Circle API errors → fail-open, preserve current plan.
 * - Downgrades (removing paid access) ONLY happen via the Circle webhook, never here.
 *   The one exception: if the member is completely absent from Circle (true 404) AND
 *   their subscriptionSource is 'circle', we reset to free — but only after the webhook
 *   has had a chance to fire. This case means the account was manually deleted in Circle.
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
      circleMemberIsOnTrial: user.circleMemberIsOnTrial,
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
      if (member) break;
    } catch (err) {
      lookupHadError = true;
      console.warn('[circle.verify] Circle API lookup failed for candidate email', {
        userId: currentUser.id,
        lookupEmail,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Circle API error — fail-open, always preserve current plan.
  if (!member && lookupHadError) {
    return NextResponse.json({
      verified: true,
      changed: false,
      code: 'CIRCLE_VERIFY_TEMPORARY_FAILURE',
      message: 'We could not verify Circle right now. Your current plan was preserved.',
      plan: currentUser.plan,
      reason: 'circle_api_error_preserved',
    });
  }

  // Member not found in Circle at all (true 404).
  // Only downgrade if they're currently on a paid plan sourced from Circle.
  // Free users just get their subscriptionSource cleaned up.
  if (!member) {
    const wasOnPaidPlan = currentUser.plan !== 'free';

    await db
      .update(user)
      .set({ plan: 'free', subscriptionSource: 'stripe' })
      .where(eq(user.id, currentUser.id));

    await invalidateUserEntitlementsCache(currentUser.id);
    await getUserEntitlements(currentUser.id);
    await broadcastEntitlementsUpdated(currentUser.id);

    console.log('[circle.verify] Member not found in Circle, reset to free', {
      userId: currentUser.id,
      lookupCandidates,
      previousPlan: currentUser.plan,
      wasOnPaidPlan,
    });

    return NextResponse.json({
      verified: true,
      changed: wasOnPaidPlan,
      code: 'CIRCLE_MEMBERSHIP_NOT_FOUND',
      message: 'We could not find an active Circle membership for your account. Your plan was set to Free.',
      action: 'open_circle_connect_flow',
      plan: 'free',
      subscriptionSource: 'stripe',
      reason: 'member_not_found_in_circle',
    });
  }

  // Member exists in Circle but is not assigned to any paid tier group.
  // This is a fail-open case — NEVER downgrade based on this signal.
  // Causes: transient Circle group propagation lag, or genuinely free Circle member
  // whose paid access should only be removed by a webhook cancel event.
  if (member.foundButUntiered && currentUser.plan !== 'free') {
    console.warn('[circle.verify] Member found but untiered — preserving paid plan (fail-open)', {
      userId: currentUser.id,
      currentPlan: currentUser.plan,
      memberId: member.id,
    });
    return NextResponse.json({
      verified: true,
      changed: false,
      code: 'CIRCLE_PLAN_VERIFIED',
      message: 'Your Circle plan is already up to date.',
      plan: currentUser.plan,
      reason: 'untiered_preserved_paid',
    });
  }

  const mappedPlan = member.mappedPlan ?? mapCircleTierToPlan(member.tierName);

  // Unknown tier — fail-open, preserve current plan.
  if (!mappedPlan) {
    console.warn('[circle.verify] Unknown Circle tier, preserving current plan', {
      userId: currentUser.id,
      tierName: member.tierName,
    });
    return NextResponse.json({
      verified: true,
      changed: false,
      code: 'CIRCLE_TIER_UNMAPPED',
      message: 'Your Circle tier is not mapped yet. Your current plan was preserved.',
      plan: currentUser.plan,
      reason: 'unknown_tier_preserved',
      tierName: member.tierName,
    });
  }

  // Verify is upgrade-only: if Circle resolves to a lower plan than what's in the DB,
  // preserve the DB value. Downgrades are the webhook's job exclusively.
  const planHierarchy: Record<string, number> = { free: 0, pro: 1, business: 2 };
  const currentPlanRank = planHierarchy[currentUser.plan] ?? 0;
  const newPlanRank = planHierarchy[mappedPlan] ?? 0;

  if (newPlanRank < currentPlanRank) {
    console.warn('[circle.verify] Circle returned lower plan than DB — preserving DB plan (downgrade via webhook only)', {
      userId: currentUser.id,
      dbPlan: currentUser.plan,
      circlePlan: mappedPlan,
      tierName: member.tierName,
    });
    return NextResponse.json({
      verified: true,
      changed: false,
      code: 'CIRCLE_PLAN_VERIFIED',
      message: 'Your Circle plan is already up to date.',
      plan: currentUser.plan,
      reason: 'downgrade_blocked_use_webhook',
    });
  }

  // Plan matches or is an upgrade — write to DB only if something actually changed.
  const planChanged = mappedPlan !== currentUser.plan;
  const trialChanged = member.isOnTrial !== (currentUser.circleMemberIsOnTrial ?? false);

  if (planChanged || trialChanged) {
    await db
      .update(user)
      .set({
        plan: mappedPlan,
        circleId: member.id ?? undefined,
        circleMemberId: member.id ?? undefined,
        circleMemberEmail: member.email ?? lookupCandidates[0],
        circleMemberIsOnTrial: member.isOnTrial,
      })
      .where(eq(user.id, currentUser.id));

    await invalidateUserEntitlementsCache(currentUser.id);
    await getUserEntitlements(currentUser.id);
    await broadcastEntitlementsUpdated(currentUser.id);

    console.log('[circle.verify] Plan updated (upgrade)', {
      userId: currentUser.id,
      from: currentUser.plan,
      to: mappedPlan,
      tierName: member.tierName,
      isOnTrial: member.isOnTrial,
    });

    return NextResponse.json({
      verified: true,
      changed: true,
      code: 'CIRCLE_PLAN_UPDATED',
      message: `Your Circle plan was refreshed to ${mappedPlan}.`,
      plan: mappedPlan,
      isOnTrial: member.isOnTrial,
      tierName: member.tierName,
    });
  }

  return NextResponse.json({
    verified: true,
    changed: false,
    code: 'CIRCLE_PLAN_VERIFIED',
    message: 'Your Circle plan is already up to date.',
    plan: currentUser.plan,
    isOnTrial: member.isOnTrial,
    tierName: member.tierName,
  });
}
