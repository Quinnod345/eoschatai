export type FeatureEntitlements = {
  export: boolean;
  calendar_connect: boolean;
  recordings: {
    enabled: boolean;
    minutes_month: number;
  };
  deep_research: {
    enabled: boolean;
    lookups_per_run: number;
  };
  chats_per_day: number;
  context_uploads_total: number;
};

export type NormalizedEntitlements = {
  features: FeatureEntitlements;
  plan_version: string;
  source: string;
};

export type UsageCounters = {
  uploads_total: number;
  chats_today: number;
  asr_minutes_month: number;
  exports_month: number;
  deep_runs_day: number;
};

export type UsageCounterKey = keyof UsageCounters;
