export type FeatureEntitlements = {
  export: boolean;
  calendar_connect: boolean;
  recordings: {
    enabled: boolean;
    minutes_month: number;
    transcription: boolean;
    speaker_diarization: boolean;
    ai_summaries: boolean;
  };
  deep_research: {
    enabled: boolean;
    lookups_per_run: number;
  };
  personas: {
    custom: boolean;
    max_count: number; // -1 for unlimited
    shared: boolean; // Org-level shared personas
  };
  composer: {
    advanced: boolean;
    types: string[]; // ['text', 'code', 'chart', 'sheet', 'vto', 'accountability']
  };
  memory: {
    enabled: boolean;
    max_memories: number; // -1 for unlimited
    embeddings: boolean;
  };
  version_history: {
    enabled: boolean;
    versions_kept: number; // -1 for unlimited
  };
  message_features: {
    pin: boolean;
    bookmark: boolean;
    edit_history: boolean;
  };
  search: {
    advanced: boolean;
    cross_chat: boolean;
    semantic: boolean;
  };
  analytics: {
    enabled: boolean;
    team_analytics: boolean;
  };
  l10_meetings: {
    enabled: boolean;
  };
  organization: {
    enabled: boolean;
    max_members: number;
  };
  chats_per_day: number;
  context_uploads_total: number;
  concurrent_sessions: number;
  storage_quota_mb: number; // Storage quota in megabytes
  api_access: boolean;
  priority_support: boolean;
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
  personas_created: number;
  memories_stored: number;
  concurrent_sessions_active: number;
  storage_used_mb: number; // Storage used in megabytes
};

export type UsageCounterKey = keyof UsageCounters;
