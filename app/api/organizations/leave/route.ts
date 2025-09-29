import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { user as userTable, org as orgTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization
    const [user] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.user.id));

    if (!user || !user.orgId) {
      return NextResponse.json(
        { error: 'You are not part of any organization' },
        { status: 400 },
      );
    }

    // Check if user is the owner
    const [organization] = await db
      .select({ ownerId: orgTable.ownerId })
      .from(orgTable)
      .where(eq(orgTable.id, user.orgId));

    if (organization?.ownerId === session.user.id) {
      // Check if there are other members
      const memberCount = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.orgId, user.orgId));

      if (memberCount.length > 1) {
        return NextResponse.json(
          { 
            error: 'As the owner, you must transfer ownership before leaving the organization' 
          },
          { status: 400 },
        );
      }
      // If owner is the last member, they can leave (org will be orphaned)
    }

    // Remove user from organization
    await db
      .update(userTable)
      .set({ orgId: null })
      .where(eq(userTable.id, session.user.id));

    // Clear entitlements cache
    try {
      const { invalidateUserEntitlementsCache } = await import('@/lib/entitlements');
      await invalidateUserEntitlementsCache(session.user.id);
    } catch (error) {
      console.warn('[leave-org] Failed to clear entitlements cache:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully left the organization',
    });
  } catch (error) {
    console.error('Error leaving organization:', error);
    return NextResponse.json(
      { error: 'Failed to leave organization' },
      { status: 500 },
    );
  }
}

