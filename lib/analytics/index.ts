import 'server-only';

import { db } from '@/lib/db';
import { analyticsEvent } from '@/lib/db/schema';
import type {
  AnalyticsEventName,
  AnalyticsEventPayload,
  AnalyticsEventPropertiesMap,
  BlockedActionEvent,
  SubscriptionActivatedEvent,
  EntitlementsUpdatedEvent,
} from '@/types/analytics';

const toJson = (value: unknown) => {
  if (value === undefined) return {};
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return { value };
};

const record = async <N extends AnalyticsEventName>(
  payload: AnalyticsEventPayload<N> & {
    source: 'client' | 'server';
    userId?: string | null;
    orgId?: string | null;
  },
) => {
  try {
    await db.insert(analyticsEvent).values({
      eventName: payload.event,
      source: payload.source,
      userId: payload.userId ?? null,
      orgId: payload.orgId ?? null,
      properties: toJson(payload.properties),
    });
  } catch (error) {
    console.warn('[analytics] Failed to record event', payload.event, error);
  }
};

export const trackClientEvent = async <N extends AnalyticsEventName>(
  payload: AnalyticsEventPayload<N> & { userId?: string | null; orgId?: string | null },
) => {
  await record({ ...payload, source: 'client' });
};

export const trackServerEvent = async <N extends AnalyticsEventName>(
  payload: AnalyticsEventPayload<N> & { userId?: string | null; orgId?: string | null },
) => {
  await record({ ...payload, source: 'server' });
};

export const trackSubscriptionActivated = async (
  properties: SubscriptionActivatedEvent,
) => {
  await trackServerEvent({
    event: 'subscription_activated',
    properties,
    userId: properties.user_id,
    orgId: properties.org_id,
  });
};

export const trackBlockedAction = async (properties: BlockedActionEvent) => {
  await trackServerEvent({
    event: 'blocked_action',
    properties,
    userId: properties.user_id,
    orgId: properties.org_id ?? null,
  });
};

export const trackEntitlementsUpdated = async (
  properties: EntitlementsUpdatedEvent,
) => {
  await trackServerEvent({
    event: 'entitlements_updated',
    properties,
    userId: properties.user_id,
    orgId: properties.org_id ?? null,
  });
};

export type { AnalyticsEventName, AnalyticsEventPropertiesMap };
