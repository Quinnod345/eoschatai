import { NextResponse } from 'next/server';
import { z } from 'zod/v3';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  org as orgTable,
  user as userTable,
  orgInvitation,
} from '@/lib/db/schema';
import { eq, and, notInArray } from 'drizzle-orm';
import { checkOrgPermission } from '@/lib/organizations/permissions';
import { getOrCreateInviteCode } from '@/lib/organizations/invite-codes';
import { getResendClient, getFromAddress } from '@/lib/email/resend';
import OrgInviteEmail from '@/emails/OrgInviteEmail';
import { buildAppUrl } from '@/lib/utils/app-url';

const bodySchema = z.object({
  email: z.string().email(),
});

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const json = await request.json();
    const parse = bodySchema.safeParse(json);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const { email } = parse.data;

    // Ensure inviter is a member and has permission
    const [inviter] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.user.id));
    if (!inviter || inviter.orgId !== orgId) {
      return NextResponse.json(
        { error: 'You are not a member of this organization' },
        { status: 403 },
      );
    }

    const allowed = await checkOrgPermission(
      session.user.id,
      orgId,
      'members.invite',
    );
    if (!allowed) {
      return NextResponse.json(
        { error: 'You do not have permission to invite members' },
        { status: 403 },
      );
    }

    // Get org
    const [org] = await db
      .select()
      .from(orgTable)
      .where(eq(orgTable.id, orgId));
    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    // Check for existing active invitation
    const [existingInvite] = await db
      .select()
      .from(orgInvitation)
      .where(
        and(
          eq(orgInvitation.orgId, orgId),
          eq(orgInvitation.email, email),
          notInArray(orgInvitation.status, ['accepted', 'failed', 'bounced']),
        ),
      );

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 400 },
      );
    }

    // Create or reuse an invite code
    const code = await getOrCreateInviteCode(
      org.id,
      org.name || 'Organization',
      inviter.id,
    );
    if (!code) {
      return NextResponse.json(
        { error: 'Unable to create invite code' },
        { status: 500 },
      );
    }

    // Build accept invite link
    const acceptUrl = buildAppUrl('/invite/accept', {
      code,
      email,
    });

    // Send email via Resend
    const resend = getResendClient();
    if (!resend) {
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 },
      );
    }

    const from = getFromAddress();
    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject: `Invitation to join ${org.name || 'Organization'}`,
      react: OrgInviteEmail({
        toEmail: email,
        orgName: org.name || 'Organization',
        inviteLink: acceptUrl,
        invitedByName: inviter.email,
      }),
    });

    if (error) {
      console.error('[org:invite-email] Resend error', error);
      return NextResponse.json(
        { error: error?.message || 'Email service error' },
        { status: 502 },
      );
    }

    // Create invitation tracking record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    await db.insert(orgInvitation).values({
      orgId,
      invitedByUserId: session.user.id,
      email,
      inviteCode: code,
      resendId: data?.id,
      status: 'sent',
      expiresAt,
      metadata: {
        inviterEmail: inviter.email,
        inviterName: inviter.email,
        orgName: org.name,
      },
    });

    return NextResponse.json({
      success: true,
      id: data?.id,
      status: 'sent',
    });
  } catch (error) {
    console.error('[org:invite-email] Failed to send invite', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 },
    );
  }
}
