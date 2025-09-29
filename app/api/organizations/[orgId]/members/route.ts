import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  user as userTable,
  userSettings,
  org as orgTable,
  orgMemberRole,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{
    orgId: string;
  }>;
}

// Get organization members
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    // Verify user belongs to the organization
    const [currentUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.user.id));

    if (!currentUser || currentUser.orgId !== orgId) {
      return NextResponse.json(
        { error: 'You are not a member of this organization' },
        { status: 403 },
      );
    }

    // Get organization details including the owner
    const [org] = await db
      .select({
        id: orgTable.id,
        name: orgTable.name,
        ownerId: orgTable.ownerId,
      })
      .from(orgTable)
      .where(eq(orgTable.id, orgId));

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    // Get all members with their settings and roles
    const members = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        settings: {
          displayName: userSettings.displayName,
          profilePicture: userSettings.profilePicture,
        },
        role: orgMemberRole.role,
      })
      .from(userTable)
      .leftJoin(userSettings, eq(userTable.id, userSettings.userId))
      .leftJoin(
        orgMemberRole,
        and(
          eq(userTable.id, orgMemberRole.userId),
          eq(orgMemberRole.orgId, orgId),
        ),
      )
      .where(eq(userTable.orgId, orgId));

    const formattedMembers = members.map((member) => ({
      id: member.id,
      email: member.email,
      displayName: member.settings?.displayName || null,
      profilePicture: member.settings?.profilePicture || null,
      role: member.role || (member.id === org.ownerId ? 'owner' : 'member'), // Use role from table, fallback to owner check
      joinedAt: new Date().toISOString(), // You'd store this properly in production
    }));

    return NextResponse.json({ members: formattedMembers });
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 },
    );
  }
}
