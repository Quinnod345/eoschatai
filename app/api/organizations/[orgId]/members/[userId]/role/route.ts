import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { z } from 'zod/v3';
import { db } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { validateUuidField } from '@/lib/api/validation';
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

    const [targetUser] = await db
      .select({ orgId: userTable.orgId })
      .from(userTable)
      .where(eq(userTable.id, targetUserIdValue))
      .limit(1);

    if (!targetUser || targetUser.orgId !== orgIdValue) {
      return NextResponse.json(
        { error: 'User not found in this organization' },
        { status: 404 },
      );
    }

    // Check if user has permission to change roles
    const hasPermission = await checkOrgPermission(
      session.user.id,
      orgIdValue,
      'members.edit_role',
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to change member roles' },
        { status: 403 },
      );
    }

    // Parse and validate the request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parse = roleSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid role. Must be owner, admin, or member.' },
        { status: 400 },
      );
    }

    const { role } = parse.data;

    if (role === 'owner') {
      return NextResponse.json(
        {
          error:
            'Ownership transfer requires the dedicated transfer-ownership flow.',
        },
        { status: 400 },
      );
    }

    // Cannot change your own role
    if (targetUserIdValue === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 },
      );
    }

    // Change the user's role
    const success = await changeUserRole(
      targetUserIdValue,
      orgIdValue,
      role as OrgRole,
    );

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

      await invalidateUserEntitlementsCache(targetUserIdValue);
      await getUserEntitlements(targetUserIdValue);
      await broadcastEntitlementsUpdated(targetUserIdValue);
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

