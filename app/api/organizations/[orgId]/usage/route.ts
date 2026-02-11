import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import {
  org as orgTable,
  orgMemberRole,
  user as userTable,
  userSettings,
} from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { validateUuidField } from '@/lib/api/validation';
import { checkOrgPermission } from '@/lib/organizations/permissions';
import { ensureUsageCounters } from '@/lib/entitlements';
import type { UsageCounters } from '@/lib/entitlements/types';

interface RouteParams {
  params: Promise<{
    orgId: string;
  }>;
}

const usageKeys: Array<keyof UsageCounters> = [
  'uploads_total',
  'chats_today',
  'asr_minutes_month',
  'exports_month',
  'deep_runs_day',
  'personas_created',
  'memories_stored',
  'concurrent_sessions_active',
  'storage_used_mb',
];

export async function GET(_request: Request, { params }: RouteParams) {
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

    const hasPermission = await checkOrgPermission(
      session.user.id,
      validatedOrgId.value,
      'members.view',
    );
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [organization] = await db
      .select({
        id: orgTable.id,
        name: orgTable.name,
        ownerId: orgTable.ownerId,
        plan: orgTable.plan,
        seatCount: orgTable.seatCount,
      })
      .from(orgTable)
      .where(eq(orgTable.id, validatedOrgId.value))
      .limit(1);

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const memberRows = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        plan: userTable.plan,
        usageCounters: userTable.usageCounters,
        storageUsed: userTable.storageUsed,
        displayName: userSettings.displayName,
        role: orgMemberRole.role,
      })
      .from(userTable)
      .leftJoin(userSettings, eq(userSettings.userId, userTable.id))
      .leftJoin(
        orgMemberRole,
        and(
          eq(orgMemberRole.userId, userTable.id),
          eq(orgMemberRole.orgId, validatedOrgId.value),
        ),
      )
      .where(eq(userTable.orgId, validatedOrgId.value));

    const totals: UsageCounters = ensureUsageCounters({});
    const members = memberRows.map((member) => {
      const usageCounters = ensureUsageCounters(member.usageCounters);
      for (const key of usageKeys) {
        totals[key] += usageCounters[key];
      }

      const role =
        member.role || (organization.ownerId === member.id ? 'owner' : 'member');

      return {
        id: member.id,
        email: member.email,
        displayName: member.displayName,
        role,
        plan: member.plan,
        storageUsedBytes: member.storageUsed || 0,
        usageCounters,
      };
    });

    return NextResponse.json({
      org: {
        id: organization.id,
        name: organization.name,
        plan: organization.plan,
        seatCount: organization.seatCount,
        memberCount: members.length,
      },
      generatedAt: new Date().toISOString(),
      totals,
      members,
    });
  } catch (error) {
    console.error('Error fetching organization usage dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization usage dashboard' },
      { status: 500 },
    );
  }
}
