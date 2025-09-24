import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { getUserWithOrg } from '@/lib/db/users';
import { trackClientEvent } from '@/lib/analytics';
import type { AnalyticsEventName, AnalyticsEventPropertiesMap } from '@/types/analytics';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      event?: AnalyticsEventName;
      properties?: AnalyticsEventPropertiesMap[AnalyticsEventName];
    };

    if (!body?.event) {
      return NextResponse.json({ error: 'Missing event' }, { status: 400 });
    }

    const session = await auth();
    const userId = session?.user?.id ?? null;
    let orgId: string | null = null;
    let plan: string | null = null;

    if (userId) {
      const record = await getUserWithOrg(userId);
      if (record) {
        orgId = record.org?.id ?? null;
        plan = record.org?.plan ?? record.user.plan;
      }
    }

    const event = body.event as AnalyticsEventName;
    const properties = { ...(body.properties ?? {}) } as Record<string, unknown>;
    if (plan && typeof plan === 'string' && !('plan' in properties)) {
      properties.plan = plan;
    }

    await trackClientEvent({
      event,
      properties: properties as AnalyticsEventPropertiesMap[AnalyticsEventName],
      userId,
      orgId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[analytics] Failed to ingest client event', error);
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }
}
