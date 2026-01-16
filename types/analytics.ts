export type PlanName = 'free' | 'pro' | 'business';

export type GateImpressionEvent = {
  feature: 'export' | 'calendar_connect' | 'recordings' | 'deep_research';
  plan: PlanName;
  placement: string;
  mode?: 'hard' | 'soft';
};

export type GateClickUpgradeEvent = {
  feature: 'export' | 'calendar_connect' | 'recordings' | 'deep_research';
  plan: PlanName;
  placement: string;
  billing_choice?: 'monthly' | 'annual' | 'seat' | 'unknown';
};

export type CheckoutStartedEvent = {
  price_id: string;
  plan: 'pro' | 'business';
  billing: 'monthly' | 'annual';
  seats?: number;
};

export type SubscriptionActivatedEvent = {
  plan: 'pro' | 'business';
  seats?: number;
  user_id?: string;
  org_id?: string;
};

export type BlockedActionEvent = {
  feature:
    | 'export'
    | 'calendar_connect'
    | 'recordings'
    | 'deep_research'
    | 'context_uploads_total';
  reason: 'not_enabled' | 'limit_exceeded' | 'rate_limited';
  user_id: string;
  org_id?: string | null;
  status?: number;
};

export type EntitlementsUpdatedEvent = {
  user_id: string;
  org_id?: string | null;
  from: unknown;
  to: unknown;
};

export type OwnershipTransferredEvent = {
  previousOwnerId: string;
  newOwnerId: string;
  timestamp: string;
};

export type MemberRemovedFromOrgEvent = {
  orgName: string;
  reason: string;
  timestamp: string;
};

export type PendingRemovalsNotificationSentEvent = {
  orgName: string;
  pendingRemovalCount: number;
  timestamp: string;
};

export type PremiumModalOpenedEvent = {
  plan: PlanName;
  source: string;
  feature?: string;
};

export type PremiumCheckoutInitiatedEvent = {
  plan: PlanName;
  billing_cycle: 'monthly' | 'annual';
  source: string;
};

export type AnalyticsEventName =
  | 'gate_impression'
  | 'gate_click_upgrade'
  | 'checkout_started'
  | 'subscription_activated'
  | 'blocked_action'
  | 'entitlements_updated'
  | 'ownership_transferred'
  | 'member_removed_from_org'
  | 'pending_removals_notification_sent'
  | 'premium_modal_opened'
  | 'premium_checkout_initiated';

export type AnalyticsEventPropertiesMap = {
  gate_impression: GateImpressionEvent;
  gate_click_upgrade: GateClickUpgradeEvent;
  checkout_started: CheckoutStartedEvent;
  subscription_activated: SubscriptionActivatedEvent;
  blocked_action: BlockedActionEvent;
  entitlements_updated: EntitlementsUpdatedEvent;
  ownership_transferred: OwnershipTransferredEvent;
  member_removed_from_org: MemberRemovedFromOrgEvent;
  pending_removals_notification_sent: PendingRemovalsNotificationSentEvent;
  premium_modal_opened: PremiumModalOpenedEvent;
  premium_checkout_initiated: PremiumCheckoutInitiatedEvent;
};

export type AnalyticsEventPayload<
  N extends AnalyticsEventName = AnalyticsEventName,
> = {
  event: N;
  properties: AnalyticsEventPropertiesMap[N];
};
