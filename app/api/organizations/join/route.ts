import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { org as orgTable, user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { validateInviteCode } from '@/lib/organizations/invite-codes';
import { canAddUserToOrg } from '@/lib/organizations/seat-enforcement';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { inviteCode } = body;

    if (!inviteCode || typeof inviteCode !== 'string') {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 },
      );
    }

    // Check if user already belongs to an organization
    const [existingUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.user.id));

    if (existingUser?.orgId) {
      return NextResponse.json(
        { error: 'You already belong to an organization' },
        { status: 400 },
      );
    }

    // Validate invite code from Redis
    const inviteData = await validateInviteCode(inviteCode, session.user.id);

    if (!inviteData) {
      return NextResponse.json(
        { error: 'Invalid or expired invite code' },
        { status: 400 },
      );
    }

    // Get the organization from database
    const [organization] = await db
      .select()
      .from(orgTable)
      .where(eq(orgTable.id, inviteData.orgId));

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    // Check if user can be added to the organization
    const canAdd = await canAddUserToOrg(session.user.id, organization.id);

    if (!canAdd.allowed) {
      return NextResponse.json(
        { error: canAdd.reason || 'Cannot join organization' },
        { status: 400 },
      );
    }

    // Update user to belong to this organization
    await db
      .update(userTable)
      .set({ orgId: organization.id })
      .where(eq(userTable.id, session.user.id));

    // Clear entitlements cache to force refresh with new org plan
    try {
      const { invalidateUserEntitlementsCache } = await import(
        '@/lib/entitlements'
      );
      await invalidateUserEntitlementsCache(session.user.id);
    } catch (error) {
      console.warn('[join-org] Failed to clear entitlements cache:', error);
    }

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        plan: organization.plan,
      },
    });
  } catch (error) {
    console.error('Error joining organization:', error);
    return NextResponse.json(
      { error: 'Failed to join organization' },
      { status: 500 },
    );
  }
}
