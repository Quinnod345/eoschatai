import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  org as orgTable,
  user as userTable,
  orgMemberRole,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getOrCreateInviteCode } from '@/lib/organizations/invite-codes';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization if any
    const [userWithOrg] = await db
      .select({
        org: orgTable,
      })
      .from(userTable)
      .leftJoin(orgTable, eq(userTable.orgId, orgTable.id))
      .where(eq(userTable.id, session.user.id));

    return NextResponse.json({
      organization: userWithOrg?.org || null,
    });
  } catch (error) {
    console.error('[api/organizations] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    // Validate organization name
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      return NextResponse.json(
        { error: 'Organization name cannot be empty' },
        { status: 400 },
      );
    }

    if (trimmedName.length > 100) {
      return NextResponse.json(
        { error: 'Organization name must be 100 characters or less' },
        { status: 400 },
      );
    }

    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: 'Organization name must be at least 2 characters' },
        { status: 400 },
      );
    }

    // Use transaction to prevent race condition where user joins org while creating one
    const newOrg = await db.transaction(async (tx) => {
      // Re-check user doesn't have orgId
      const [existingUser] = await tx
        .select({ orgId: userTable.orgId })
        .from(userTable)
        .where(eq(userTable.id, session.user.id));

      if (existingUser?.orgId) {
        throw new Error('You already belong to an organization');
      }

      // Create the organization with the user as owner
      // Note: Organizations are created with 'free' plan by default.
      // Users are prompted in the UI to upgrade to Business for full team features.
      // Organizations can be upgraded later via the billing/checkout flow.
      const [createdOrg] = await tx
        .insert(orgTable)
        .values({
          name: trimmedName,
          plan: 'free', // Will be upgraded when they complete checkout
          ownerId: session.user.id,
        })
        .returning();

      // Update user to belong to this organization (atomically)
      await tx
        .update(userTable)
        .set({ orgId: createdOrg.id })
        .where(eq(userTable.id, session.user.id));

      // Create OrgMemberRole record for the owner
      await tx.insert(orgMemberRole).values({
        userId: session.user.id,
        orgId: createdOrg.id,
        role: 'owner',
      });

      return createdOrg;
    });

    // Generate an invite code for the organization
    const inviteCode = await getOrCreateInviteCode(
      newOrg.id,
      newOrg.name || 'Organization',
      session.user.id,
    );

    return NextResponse.json({
      organization: {
        id: newOrg.id,
        name: newOrg.name,
        inviteCode,
      },
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 },
    );
  }
}
