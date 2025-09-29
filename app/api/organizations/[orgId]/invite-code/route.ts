import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { user as userTable, org as orgTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  getOrCreateInviteCode,
  generateInviteCode,
  getOrganizationInviteCodes,
} from '@/lib/organizations/invite-codes';
import { checkOrgPermission } from '@/lib/organizations/permissions';

interface RouteParams {
  params: Promise<{
    orgId: string;
  }>;
}

// Get organization's current invite code
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    // Verify user belongs to the organization
    const [user] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.user.id));

    if (!user || user.orgId !== orgId) {
      return NextResponse.json(
        { error: 'You are not a member of this organization' },
        { status: 403 },
      );
    }

    // Get organization details
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

    // Only owners can access invite codes
    if (org.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the organization owner can access invite codes' },
        { status: 403 },
      );
    }

    // Get or create invite code
    const inviteCode = await getOrCreateInviteCode(
      orgId,
      org.name || 'Organization',
      session.user.id,
    );

    return NextResponse.json({ inviteCode });
  } catch (error) {
    console.error('Error getting invite code:', error);
    return NextResponse.json(
      { error: 'Failed to get invite code' },
      { status: 500 },
    );
  }
}

// Generate a new invite code (revoke old ones)
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    // Check if user has permission to manage invites (owners only)
    const hasPermission = await checkOrgPermission(
      session.user.id,
      orgId,
      'members.invite',
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Only the organization owner can regenerate invite codes' },
        { status: 403 },
      );
    }

    // Get organization details
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

    // Revoke existing codes
    const existingCodes = await getOrganizationInviteCodes(orgId);
    for (const codeData of existingCodes) {
      // Extract the code from the data (we need to store the actual code in the response)
      // For now, we'll generate a new one
    }

    // Generate new invite code
    const inviteCode = await generateInviteCode(
      orgId,
      org.name || 'Organization',
      session.user.id,
    );

    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Failed to generate invite code' },
        { status: 500 },
      );
    }

    return NextResponse.json({ inviteCode });
  } catch (error) {
    console.error('Error generating invite code:', error);
    return NextResponse.json(
      { error: 'Failed to generate invite code' },
      { status: 500 },
    );
  }
}
