import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  orgInvitation,
  user as userTable,
  userSettings,
} from '@/lib/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { checkOrgPermission } from '@/lib/organizations/permissions';
import { validateUuidField } from '@/lib/api/validation';

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
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

    // Check if user has permission to view invitations
    const allowed = await checkOrgPermission(
      session.user.id,
      orgIdValue,
      'members.view',
    );
    if (!allowed) {
      return NextResponse.json(
        { error: 'You do not have permission to view invitations' },
        { status: 403 },
      );
    }

    // Fetch all pending invitations (not accepted, failed, or bounced)
    const pendingInvitations = await db
      .select({
        id: orgInvitation.id,
        email: orgInvitation.email,
        status: orgInvitation.status,
        sentAt: orgInvitation.sentAt,
        deliveredAt: orgInvitation.deliveredAt,
        openedAt: orgInvitation.openedAt,
        clickedAt: orgInvitation.clickedAt,
        expiresAt: orgInvitation.expiresAt,
        invitedBy: {
          id: userTable.id,
          email: userTable.email,
          displayName: userSettings.displayName,
        },
      })
      .from(orgInvitation)
      .leftJoin(userTable, eq(orgInvitation.invitedByUserId, userTable.id))
      .leftJoin(userSettings, eq(userSettings.userId, userTable.id))
      .where(
        and(
          eq(orgInvitation.orgId, orgIdValue),
          // Show all non-accepted invitations
          isNull(orgInvitation.acceptedAt),
        ),
      )
      .orderBy(desc(orgInvitation.sentAt));

    // Transform the data to a cleaner format
    const invitations = pendingInvitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      status: inv.status,
      sentAt: inv.sentAt,
      deliveredAt: inv.deliveredAt,
      openedAt: inv.openedAt,
      clickedAt: inv.clickedAt,
      expiresAt: inv.expiresAt,
      isExpired: inv.expiresAt < new Date(),
      invitedBy: inv.invitedBy,
    }));

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('[org:invitations] Failed to fetch invitations', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 },
    );
  }
}

// DELETE endpoint to cancel/revoke an invitation
export async function DELETE(request: Request, { params }: RouteParams) {
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
    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('id');
    const validatedInvitationId = validateUuidField(invitationId, 'invitationId');
    if (!validatedInvitationId.ok) {
      return NextResponse.json(
        { error: validatedInvitationId.error },
        { status: 400 },
      );
    }

    // Check if user has permission to manage invitations
    const allowed = await checkOrgPermission(
      session.user.id,
      orgIdValue,
      'members.invite',
    );
    if (!allowed) {
      return NextResponse.json(
        { error: 'You do not have permission to manage invitations' },
        { status: 403 },
      );
    }

    // Delete the invitation
    const deleted = await db
      .delete(orgInvitation)
      .where(
        and(
          eq(orgInvitation.id, validatedInvitationId.value),
          eq(orgInvitation.orgId, orgIdValue),
        ),
      )
      .returning({ id: orgInvitation.id });

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[org:invitations] Failed to delete invitation', error);
    return NextResponse.json(
      { error: 'Failed to delete invitation' },
      { status: 500 },
    );
  }
}
