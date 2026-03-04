import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  user as userTable,
  org as orgTable,
  orgMemberRole,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  canManageUser,
  checkOrgPermission,
} from '@/lib/organizations/permissions';
import { validateUuidField } from '@/lib/api/validation';
import { resolveCirclePlanFromEmail } from '@/lib/integrations/circle-plan-resolver';

interface RouteParams {
  params: Promise<{
    orgId: string;
    userId: string;
  }>;
}

// Check if user is organization owner (first member)
async function isOrgOwner(userId: string, orgId: string): Promise<boolean> {
  // Get all org members ordered by when they joined
  // In production, you'd have a proper created_at field on the org membership
  const members = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.orgId, orgId))
    .orderBy(userTable.id); // Assuming UUIDs are time-ordered

  return members.length > 0 && members[0].id === userId;
}

// Remove a member from the organization
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, userId: targetUserId } = await params;
    const validatedOrgId = validateUuidField(orgId, 'orgId');
    if (!validatedOrgId.ok) {
      return NextResponse.json({ error: validatedOrgId.error }, { status: 400 });
    }
    const validatedTargetUserId = validateUuidField(targetUserId, 'userId');
    if (!validatedTargetUserId.ok) {
      return NextResponse.json(
        { error: validatedTargetUserId.error },
        { status: 400 },
      );
    }
    const orgIdValue = validatedOrgId.value;
    const targetUserIdValue = validatedTargetUserId.value;

    // Verify current user belongs to the organization
    const [currentUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.user.id));

    if (!currentUser || currentUser.orgId !== orgIdValue) {
      return NextResponse.json(
        { error: 'You are not a member of this organization' },
        { status: 403 },
      );
    }

    // Check if current user can remove the target user
    const canRemove = await canManageUser(
      session.user.id,
      targetUserIdValue,
      orgIdValue,
      'remove',
    );

    if (!canRemove) {
      return NextResponse.json(
        { error: 'You do not have permission to remove this member' },
        { status: 403 },
      );
    }

    // Verify target user exists and belongs to the org
    const [targetUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, targetUserIdValue));

    if (!targetUser || targetUser.orgId !== orgIdValue) {
      return NextResponse.json(
        { error: 'User not found in this organization' },
        { status: 404 },
      );
    }

    // Check if user has their own individual Stripe subscription
    const { getStripeClient } = await import('@/lib/stripe/client');
    const stripe = getStripeClient();
    const { getUserIndividualSubscriptionPlan } = await import(
      '@/lib/billing/subscription-utils'
    );

    const individualPlan = stripe
      ? await getUserIndividualSubscriptionPlan(
          targetUser.stripeCustomerId,
          stripe,
          targetUserIdValue,
        )
      : null;
    const newPlan =
      targetUser.subscriptionSource === 'circle'
        ? await resolveCirclePlanFromEmail(targetUser.email, 'remove-member', {
            fallbackOnLookupError: targetUser.plan,
            alternateEmail: targetUser.circleMemberEmail,
          })
        : individualPlan || 'free';

    // Remove user from organization and reset plan
    await db
      .update(userTable)
      .set({
        orgId: null,
        plan: newPlan,
      })
      .where(eq(userTable.id, targetUserIdValue));

    // Delete the OrgMemberRole record
    await db
      .delete(orgMemberRole)
      .where(
        and(
          eq(orgMemberRole.userId, targetUserIdValue),
          eq(orgMemberRole.orgId, orgIdValue),
        ),
      );

    // Clear and recompute entitlements for the removed user
    try {
      const {
        invalidateUserEntitlementsCache,
        broadcastEntitlementsUpdated,
        getUserEntitlements,
      } = await import('@/lib/entitlements');

      // Force recomputation of entitlements with the new plan
      // CRITICAL: Invalidate cache FIRST to avoid serving stale data
      await invalidateUserEntitlementsCache(targetUserIdValue);
      await getUserEntitlements(targetUserIdValue);
      await broadcastEntitlementsUpdated(targetUserIdValue);
    } catch (error) {
      console.warn('[remove-member] Failed to update entitlements:', error);
    }

    // Send notification to removed user
    try {
      const { notifyMemberRemoval } = await import(
        '@/lib/organizations/member-removal'
      );
      const [org] = await db
        .select({ name: orgTable.name })
        .from(orgTable)
        .where(eq(orgTable.id, orgIdValue));

      if (org) {
        await notifyMemberRemoval(
          targetUserIdValue,
          org.name || 'Organization',
          'admin',
        );
      }
    } catch (error) {
      console.warn('[remove-member] Failed to send notification:', error);
      // Don't fail the removal if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'User removed from organization',
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 },
    );
  }
}

// Update member role (for future implementation)
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, userId: targetUserId } = await params;
    const validatedOrgId = validateUuidField(orgId, 'orgId');
    if (!validatedOrgId.ok) {
      return NextResponse.json({ error: validatedOrgId.error }, { status: 400 });
    }
    const validatedTargetUserId = validateUuidField(targetUserId, 'userId');
    if (!validatedTargetUserId.ok) {
      return NextResponse.json(
        { error: validatedTargetUserId.error },
        { status: 400 },
      );
    }

    try {
      await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Check if current user has permission to edit member roles
    const hasPermission = await checkOrgPermission(
      session.user.id,
      validatedOrgId.value,
      'members.edit_role',
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to change member roles' },
        { status: 403 },
      );
    }

    // Role management would be implemented here
    // For now, we just have owner/member distinction based on who created the org

    return NextResponse.json({
      success: true,
      message: 'Role management not yet implemented',
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 },
    );
  }
}
