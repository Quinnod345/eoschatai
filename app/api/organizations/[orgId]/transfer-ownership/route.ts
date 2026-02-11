import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  org as orgTable,
  user as userTable,
  orgMemberRole,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateUuidField } from '@/lib/api/validation';

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
    const validatedOrgId = validateUuidField(orgId, 'orgId');
    if (!validatedOrgId.ok) {
      return NextResponse.json({ error: validatedOrgId.error }, { status: 400 });
    }
    const orgIdValue = validatedOrgId.value;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { newOwnerId } = body as { newOwnerId?: string };

    if (!newOwnerId || typeof newOwnerId !== 'string') {
      return NextResponse.json(
        { error: 'newOwnerId is required' },
        { status: 400 },
      );
    }
    const validatedNewOwnerId = validateUuidField(newOwnerId, 'newOwnerId');
    if (!validatedNewOwnerId.ok) {
      return NextResponse.json(
        { error: validatedNewOwnerId.error },
        { status: 400 },
      );
    }
    const newOwnerIdValue = validatedNewOwnerId.value;

    // Get organization and verify current user is owner
    const [organization] = await db
      .select()
      .from(orgTable)
      .where(eq(orgTable.id, orgIdValue));

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
      .where(eq(userTable.id, newOwnerIdValue));

    if (!newOwner) {
      return NextResponse.json(
        { error: 'New owner user not found' },
        { status: 404 },
      );
    }

    if (newOwner.orgId !== orgIdValue) {
      return NextResponse.json(
        { error: 'New owner must be a member of this organization' },
        { status: 400 },
      );
    }

    // Can't transfer to yourself
    if (newOwnerIdValue === session.user.id) {
      return NextResponse.json(
        { error: 'You are already the owner' },
        { status: 400 },
      );
    }

    // Transfer ownership using transaction to ensure consistency
    await db.transaction(async (tx) => {
      // Update org owner
      await tx
        .update(orgTable)
        .set({ ownerId: newOwnerIdValue })
        .where(eq(orgTable.id, orgIdValue));

      // Update old owner's role to 'member'
      await tx
        .update(orgMemberRole)
        .set({ role: 'member', updatedAt: new Date() })
        .where(
          and(
            eq(orgMemberRole.userId, session.user.id),
            eq(orgMemberRole.orgId, orgIdValue),
          ),
        );

      // Update new owner's role to 'owner' (upsert to handle legacy data)
      await tx
        .insert(orgMemberRole)
        .values({
          userId: newOwnerIdValue,
          orgId: orgIdValue,
          role: 'owner',
        })
        .onConflictDoUpdate({
          target: [orgMemberRole.userId, orgMemberRole.orgId],
          set: { role: 'owner', updatedAt: new Date() },
        });
    });

    console.log(
      `[transfer-ownership] Transferred ownership of org ${orgIdValue} from ${session.user.id} to ${newOwnerIdValue}`,
    );

    // Track analytics event
    try {
      const { trackServerEvent } = await import('@/lib/analytics');
      await trackServerEvent({
        event: 'ownership_transferred',
        userId: session.user.id,
        orgId: orgIdValue,
        properties: {
          previousOwnerId: session.user.id,
          newOwnerId: newOwnerIdValue,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn('[transfer-ownership] Failed to track event:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Ownership transferred successfully',
      newOwnerId: newOwnerIdValue,
    });
  } catch (error) {
    console.error('[transfer-ownership] Error:', error);
    return NextResponse.json(
      { error: 'Failed to transfer ownership' },
      { status: 500 },
    );
  }
}
