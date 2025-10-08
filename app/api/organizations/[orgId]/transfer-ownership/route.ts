import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { org as orgTable, user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{
    orgId: string;
  }>;
}

/**
 * Transfer organization ownership to another member
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const body = await request.json();
    const { newOwnerId } = body;

    if (!newOwnerId || typeof newOwnerId !== 'string') {
      return NextResponse.json(
        { error: 'newOwnerId is required' },
        { status: 400 },
      );
    }

    // Get organization and verify current user is owner
    const [organization] = await db
      .select()
      .from(orgTable)
      .where(eq(orgTable.id, orgId));

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    if (organization.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the current owner can transfer ownership' },
        { status: 403 },
      );
    }

    // Verify new owner is a member of the organization
    const [newOwner] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, newOwnerId));

    if (!newOwner) {
      return NextResponse.json(
        { error: 'New owner user not found' },
        { status: 404 },
      );
    }

    if (newOwner.orgId !== orgId) {
      return NextResponse.json(
        { error: 'New owner must be a member of this organization' },
        { status: 400 },
      );
    }

    // Can't transfer to yourself
    if (newOwnerId === session.user.id) {
      return NextResponse.json(
        { error: 'You are already the owner' },
        { status: 400 },
      );
    }

    // Transfer ownership
    await db
      .update(orgTable)
      .set({ ownerId: newOwnerId })
      .where(eq(orgTable.id, orgId));

    console.log(
      `[transfer-ownership] Transferred ownership of org ${orgId} from ${session.user.id} to ${newOwnerId}`,
    );

    // Track analytics event
    try {
      const { trackServerEvent } = await import('@/lib/analytics');
      await trackServerEvent({
        event: 'ownership_transferred',
        userId: session.user.id,
        orgId,
        properties: {
          previousOwnerId: session.user.id,
          newOwnerId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn('[transfer-ownership] Failed to track event:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Ownership transferred successfully',
      newOwnerId,
    });
  } catch (error) {
    console.error('[transfer-ownership] Error:', error);
    return NextResponse.json(
      { error: 'Failed to transfer ownership' },
      { status: 500 },
    );
  }
}
