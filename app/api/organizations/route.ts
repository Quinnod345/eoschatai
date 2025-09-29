import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { org as orgTable, user as userTable } from '@/lib/db/schema';
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

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Organization name is required' },
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

    // Create the organization with the user as owner
    const [newOrg] = await db
      .insert(orgTable)
      .values({
        name: name.trim(),
        plan: 'free', // Will be upgraded when they complete checkout
        ownerId: session.user.id,
      })
      .returning();

    // Update user to belong to this organization
    await db
      .update(userTable)
      .set({ orgId: newOrg.id })
      .where(eq(userTable.id, session.user.id));

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
