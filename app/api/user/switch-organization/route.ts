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

    const body = await request.json();
    const { orgId } = body;

    if (!orgId || typeof orgId !== 'string') {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 },
      );
    }

    // In a real multi-org system, you'd verify the user has access to this org
    // For now, we'll check if the org exists and update the user's current org
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

    // Check if user is already a member of this org
    const [currentUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.user.id));

    if (currentUser?.orgId !== orgId) {
      // In a multi-org system, you'd check membership table
      // For now, we prevent switching to orgs user doesn't belong to
      return NextResponse.json(
        { error: 'You are not a member of this organization' },
        { status: 403 },
      );
    }

    // Organization switch successful (no actual update needed in single-org model)
    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        plan: org.plan,
      },
    });
  } catch (error) {
    console.error('Error switching organization:', error);
    return NextResponse.json(
      { error: 'Failed to switch organization' },
      { status: 500 },
    );
  }
}

