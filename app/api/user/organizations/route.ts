import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { user as userTable, org as orgTable } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization
    const [currentUser] = await db
      .select({
        currentOrgId: userTable.orgId,
      })
      .from(userTable)
      .where(eq(userTable.id, session.user.id));

    // In a real multi-org system, you'd have a many-to-many relationship
    // For now, we'll just return the single organization the user belongs to
    const organizations = [];

    if (currentUser?.currentOrgId) {
      const [org] = await db
        .select({
          id: orgTable.id,
          name: orgTable.name,
          plan: orgTable.plan,
          memberCount: sql<number>`
            (SELECT COUNT(*) FROM "User" WHERE "orgId" = ${orgTable.id})
          `,
        })
        .from(orgTable)
        .where(eq(orgTable.id, currentUser.currentOrgId));

      if (org) {
        organizations.push({
          id: org.id,
          name: org.name || 'Unnamed Organization',
          plan: org.plan,
          memberCount: Number(org.memberCount),
        });
      }
    }

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('Error fetching user organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 },
    );
  }
}

