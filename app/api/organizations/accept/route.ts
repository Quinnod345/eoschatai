import { NextResponse } from 'next/server';
import { z } from 'zod/v3';
import { auth } from '@/app/(auth)/auth';
import { validateInviteCode } from '@/lib/organizations/invite-codes';
import { db } from '@/lib/db';
import {
  org as orgTable,
  user as userTable,
  orgInvitation,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { canAddUserToOrg } from '@/lib/organizations/seat-enforcement';

const paramsSchema = z.object({
  code: z.string().min(4),
  email: z.string().email().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      // Not logged in; send them to login with redirect back here
      const url = new URL(request.url);
      const redirect = new URL('/api/auth/signin', url.origin);
      redirect.searchParams.set('callbackUrl', url.toString());
      return NextResponse.redirect(redirect.toString());
    }

    const url = new URL(request.url);
    const parse = paramsSchema.safeParse({
      code: url.searchParams.get('code'),
      email: url.searchParams.get('email') ?? undefined,
    });
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid invitation link' },
        { status: 400 },
      );
    }
    const { code, email: targetEmail } = parse.data;

    // If invite targets a specific email but the logged-in account does not match,
    // send the user back to chat with a clear message and the ability to switch.
    if (targetEmail) {
      try {
        const [row] = await db
          .select({ email: userTable.email })
          .from(userTable)
          .where(eq(userTable.id, session.user.id));
        const currentEmail = row?.email;
        if (
          currentEmail &&
          currentEmail.toLowerCase() !== targetEmail.toLowerCase()
        ) {
          const back = new URL('/chat', url.origin);
          back.searchParams.set('invite', 'wrong_account');
          back.searchParams.set('targetEmail', targetEmail);
          back.searchParams.set('code', code);
          return NextResponse.redirect(back.toString());
        }
      } catch {}
    }

    // Check if user already belongs to an organization
    const [existingUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.user.id));
    if (existingUser?.orgId) {
      const back = new URL('/chat', url.origin);
      back.searchParams.set('invite', 'already_in_org');
      return NextResponse.redirect(back.toString());
    }

    // Validate invite code (consumes one use)
    const inviteData = await validateInviteCode(code, session.user.id);
    if (!inviteData) {
      return NextResponse.redirect(
        new URL('/chat?invite=invalid', url.origin).toString(),
      );
    }

    // Get organization
    const [organization] = await db
      .select()
      .from(orgTable)
      .where(eq(orgTable.id, inviteData.orgId));
    if (!organization) {
      return NextResponse.redirect(
        new URL('/chat?invite=org_missing', url.origin).toString(),
      );
    }

    // Use transaction to prevent race conditions during org join
    try {
      await db.transaction(async (tx) => {
        // Re-verify user still doesn't have orgId (prevent double-join)
        const [currentUser] = await tx
          .select({ orgId: userTable.orgId })
          .from(userTable)
          .where(eq(userTable.id, session.user.id));

        if (currentUser?.orgId) {
          throw new Error('You already belong to an organization');
        }

        // Re-verify organization still exists and has seats
        const [org] = await tx
          .select({
            id: orgTable.id,
            plan: orgTable.plan,
            seatCount: orgTable.seatCount,
            memberCount: sql<number>`(SELECT COUNT(*) FROM "User" WHERE "orgId" = ${orgTable.id})`,
          })
          .from(orgTable)
          .where(eq(orgTable.id, organization.id));

        if (!org) {
          throw new Error('Organization no longer exists');
        }

        if (Number(org.memberCount) >= org.seatCount) {
          throw new Error('Organization has reached its seat limit');
        }

        // Add user to org (atomically)
        await tx
          .update(userTable)
          .set({
            orgId: org.id,
            plan: org.plan, // Sync user plan to org plan
          })
          .where(eq(userTable.id, session.user.id));
      });
    } catch (error: any) {
      return NextResponse.redirect(
        new URL(
          `/chat?invite=denied&reason=${encodeURIComponent(error?.message || 'denied')}`,
          url.origin,
        ).toString(),
      );
    }

    // Mark invitation as accepted
    try {
      const userEmail = targetEmail || session.user.email;
      if (userEmail) {
        await db
          .update(orgInvitation)
          .set({
            status: 'accepted',
            acceptedAt: new Date(),
          })
          .where(
            and(
              eq(orgInvitation.orgId, organization.id),
              eq(orgInvitation.email, userEmail),
              eq(orgInvitation.inviteCode, code),
            ),
          );
      }
    } catch (error) {
      console.warn('[org:accept] Failed to update invitation status', error);
      // Don't fail the acceptance if we can't update the invitation
    }

    // Force recomputation and broadcast of entitlements with new org plan
    try {
      const {
        getUserEntitlements,
        invalidateUserEntitlementsCache,
        broadcastEntitlementsUpdated,
      } = await import('@/lib/entitlements');

      // CRITICAL: Invalidate cache FIRST to avoid serving stale data
      await invalidateUserEntitlementsCache(session.user.id);
      await getUserEntitlements(session.user.id);
      await broadcastEntitlementsUpdated(session.user.id);
    } catch (error) {
      console.warn('[org:accept] Failed to update entitlements:', error);
    }

    // Redirect to settings
    return NextResponse.redirect(
      new URL('/chat?invite=accepted', url.origin).toString(),
    );
  } catch (error) {
    console.error('[org:accept] Failed to accept invitation', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 },
    );
  }
}
