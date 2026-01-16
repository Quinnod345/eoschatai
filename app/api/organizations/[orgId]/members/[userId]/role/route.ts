import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { z } from 'zod/v3';
import {
  checkOrgPermission,
  changeUserRole,
  type OrgRole,
} from '@/lib/organizations/permissions';

const roleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, userId: targetUserId } = await params;

    // Check if user has permission to change roles
    const hasPermission = await checkOrgPermission(
      session.user.id,
      orgId,
      'members.edit_role',
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to change member roles' },
        { status: 403 },
      );
    }

    // Parse and validate the request body
    const body = await request.json();
    const parse = roleSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid role. Must be owner, admin, or member.' },
        { status: 400 },
      );
    }

    const { role } = parse.data;

    // Cannot change your own role
    if (targetUserId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 },
      );
    }

    // Change the user's role
    const success = await changeUserRole(targetUserId, orgId, role as OrgRole);

    if (!success) {
      return NextResponse.json(
        {
          error:
            'Failed to change user role. There must be at least one owner.',
        },
        { status: 400 },
      );
    }

    // Invalidate and recompute entitlements for the target user
    // This ensures any role-based feature access is updated
    try {
      const {
        invalidateUserEntitlementsCache,
        broadcastEntitlementsUpdated,
        getUserEntitlements,
      } = await import('@/lib/entitlements');

      await invalidateUserEntitlementsCache(targetUserId);
      await getUserEntitlements(targetUserId);
      await broadcastEntitlementsUpdated(targetUserId);
    } catch (error) {
      console.warn('[org:members:role] Failed to update entitlements:', error);
      // Don't fail the role change if entitlements update fails
    }

    return NextResponse.json({ success: true, role });
  } catch (error) {
    console.error('[org:members:role] Error changing member role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

