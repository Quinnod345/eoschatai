'use client';

import type { AnalyticsEventName, AnalyticsEventPropertiesMap } from '@/lib/analytics';

type ClientPayload<N extends AnalyticsEventName> = {
  event: N;
  properties: AnalyticsEventPropertiesMap[N];
};

const endpoint = '/api/analytics/events';

export const trackClientEvent = async <N extends AnalyticsEventName>(
  payload: ClientPayload<N>,
) => {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
      return;
    }

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (error) {
    console.warn('[analytics] Failed to send client event', payload.event, error);
  }
};
