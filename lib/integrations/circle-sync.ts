import 'server-only';

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import CircleUpgradeEmail from '@/emails/CircleUpgradeEmail';
import CircleWelcomeEmail from '@/emails/CircleWelcomeEmail';
import { db } from '@/lib/db';
import {
  circleSyncLog,
  passwordResetToken,
  type PlanType,
  user,
  webhookEvent,
} from '@/lib/db/schema';
import { generateHashedPassword } from '@/lib/db/utils';
import { getFromAddress, getResendClient } from '@/lib/email/resend';
import { handlePlanChange, invalidateUserEntitlementsCache, broadcastEntitlementsUpdated, resetUserDailyUsageCounters } from '@/lib/entitlements';
import { updateUserPlan } from '@/lib/db/users';
import { buildAppUrl } from '@/lib/utils/app-url';
// Canonical tier mapping - imported here so all sync paths use the same logic
// (supports env var overrides and aliases like 'explorer' -> pro).
import { mapCircleTierToPlan, getTrialGroupIdMap } from '@/lib/integrations/circle';
// Re-export so callers who import mapCircleTierToPlan from this module continue to work.
export { mapCircleTierToPlan } from '@/lib/integrations/circle';

export const CIRCLE_TIER_TO_PLAN = {
  discover: 'free',
  strengthen: 'pro',
  mastery: 'business',
} as const satisfies Record<string, PlanType>;

const PLAN_RANK: Record<PlanType, number> = {
  free: 0,
  pro: 1,
  business: 2,
};

const circleWebhookPayloadSchema = z.object({}).passthrough();

const circleNativePayloadSchema = z.object({
  type: z.string(),
  data: z.object({
    community_id: z.number().optional(),
    community_member_id: z.number(),
    paywall_id: z.number(),
    paywall_price_id: z.number().optional(),
    currency_id: z.number().optional(),
  }),
});

type JsonRecord = Record<string, unknown>;
type CircleSyncSource = 'webhook' | 'nightly_reconciliation' | 'manual';

export type CircleSyncAction =
  | 'created_user'
  | 'updated_plan'
  | 'no_change'
  | 'user_not_found'
  | 'membership_missing'
  | 'error';

export type CircleSyncResult = {
  eventId: string;
  action: CircleSyncAction;
  userId: string | null;
  tierPurchased: string | null;
  mappedPlan: PlanType | null;
  errorMessage: string | null;
};

type ParsedCirclePaymentPayload = {
  email: string | null;
  name: string | null;
  circleMemberId: string | null;
  tierPurchased: string;
  mappedPlan: PlanType;
  isOnTrial?: boolean;
  forceUpgradeEmail?: boolean;
  amount: number | null;
  currency: string | null;
  occurredAt: Date;
  rawPayload: JsonRecord;
};

type CircleSyncLogInsert = {
  eventId: string;
  circleMemberId?: string | null;
  email?: string | null;
  tierPurchased?: string | null;
  mappedPlan?: PlanType | null;
  action: CircleSyncAction;
  userId?: string | null;
  payload?: JsonRecord;
  errorMessage?: string | null;
};

type CircleMember = {
  id: string | null;
  email: string | null;
  name: string | null;
  raw: JsonRecord;
};

type CircleAccessGroup = {
  id: string;
  name: string;
};

type CircleMembership = {
  tierPurchased: string;
  mappedPlan: PlanType;
  groupId: string;
  groupName: string;
  memberId: string | null;
  email: string | null;
  name: string | null;
  rawMember: JsonRecord;
};

export type CircleReconciliationReport = {
  startedAt: string;
  completedAt: string;
  groupsChecked: number;
  membersChecked: number;
  synced: number;
  errors: number;
  missingMemberships: number;
};

const EVENT_ID_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ['id'],
  ['eventId'],
  ['event_id'],
  ['workflow_event_id'],
  ['workflowEventId'],
  ['data', 'id'],
  ['data', 'event_id'],
  ['event', 'id'],
];

const EMAIL_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ['email'],
  ['member_email'],
  ['memberEmail'],
  ['member', 'email'],
  ['user', 'email'],
  ['customer', 'email'],
  ['data', 'email'],
  ['data', 'member_email'],
  ['data', 'member', 'email'],
  ['data', 'user', 'email'],
  ['payload', 'email'],
  ['payload', 'member', 'email'],
];

const NAME_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ['name'],
  ['member_name'],
  ['memberName'],
  ['member', 'name'],
  ['member', 'full_name'],
  ['user', 'name'],
  ['user', 'full_name'],
  ['data', 'name'],
  ['data', 'member_name'],
  ['data', 'member', 'name'],
  ['data', 'user', 'name'],
];

const MEMBER_ID_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ['member_id'],
  ['memberId'],
  ['member', 'id'],
  ['member', 'member_id'],
  ['user', 'id'],
  ['user_id'],
  // Native Circle event format (tag triggers, etc.)
  ['community_member_id'],
  ['data', 'member_id'],
  ['data', 'memberId'],
  ['data', 'member', 'id'],
  ['data', 'user_id'],
  ['data', 'community_member_id'],
];

const TIER_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ['tier'],
  ['tier_name'],
  ['tierName'],
  ['paywall'],
  ['paywall_name'],
  ['paywallName'],
  ['access_group'],
  ['access_group_name'],
  ['accessGroup'],
  ['accessGroupName'],
  ['price', 'name'],
  ['product', 'name'],
  // Tag-based workflow triggers (member tag added/changed)
  ['tag'],
  ['tag_name'],
  ['tagName'],
  ['data', 'tier'],
  ['data', 'tier_name'],
  ['data', 'paywall'],
  ['data', 'paywall_name'],
  ['data', 'access_group'],
  ['data', 'access_group_name'],
  ['data', 'price', 'name'],
  ['data', 'product', 'name'],
  ['data', 'tag'],
  ['data', 'tag_name'],
  ['data', 'tag', 'name'],
  ['data', 'tagName'],
];

const AMOUNT_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ['amount'],
  ['amount_cents'],
  ['total'],
  ['total_amount'],
  ['payment', 'amount'],
  ['payment', 'amount_cents'],
  ['data', 'amount'],
  ['data', 'amount_cents'],
  ['data', 'payment', 'amount'],
];

const CURRENCY_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ['currency'],
  ['payment', 'currency'],
  ['data', 'currency'],
  ['data', 'payment', 'currency'],
];

const TIMESTAMP_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ['timestamp'],
  ['createdAt'],
  ['created_at'],
  ['occurred_at'],
  ['event_time'],
  ['payment', 'created_at'],
  ['data', 'timestamp'],
  ['data', 'createdAt'],
  ['data', 'created_at'],
  ['data', 'event_time'],
];

const safeTrim = (value: string) => value.trim();

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readPath = (source: JsonRecord, path: ReadonlyArray<string>): unknown => {
  let current: unknown = source;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return current;
};

const readFirst = (
  source: JsonRecord,
  paths: ReadonlyArray<ReadonlyArray<string>>,
): unknown => {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
};

const toStringValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = safeTrim(value);
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const toNumberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
};

const toDateValue = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const normalizeEmail = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return normalized.includes('@') ? normalized : null;
};


const getCircleAdminSyncConfig = () => {
  const apiToken =
    process.env.CIRCLE_ADMIN_API_TOKEN || process.env.CIRCLE_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      'Neither CIRCLE_ADMIN_API_TOKEN nor CIRCLE_API_TOKEN is configured',
    );
  }

  const baseUrl = process.env.CIRCLE_ADMIN_API_TOKEN
    ? (
        process.env.CIRCLE_ADMIN_API_BASE_URL ||
        'https://app.circle.so/api/admin/v2'
      ).replace(/\/$/, '')
    : (
        process.env.CIRCLE_API_BASE_URL || 'https://app.circle.so/api/v1'
      ).replace(/\/$/, '');

  return { apiToken, baseUrl };
};

const circleSyncRequest = async <T = unknown>(path: string): Promise<T> => {
  const { apiToken, baseUrl } = getCircleAdminSyncConfig();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  console.log(`[circle-sync] API request: ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Token ${apiToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `[circle-sync] Circle API error (${response.status}) ${errorBody.slice(0, 300)}`,
    );
  }

  return response.json() as Promise<T>;
};

type CircleMemberInfo = {
  id: number;
  email: string;
  name: string | null;
};

type CirclePaywallInfo = {
  id: number;
  name: string;
};

const fetchCircleMemberById = async (
  communityMemberId: number,
  communityId?: number,
): Promise<CircleMemberInfo> => {
  const result = await circleSyncRequest<JsonRecord>(
    `/community_members/${communityMemberId}`,
  );

  const email = toStringValue(result.email);
  if (!email) {
    throw new Error(
      `Circle member ${communityMemberId} has no email in API response`,
    );
  }

  return {
    id: communityMemberId,
    email,
    name:
      toStringValue(
        result.name ?? result.full_name ?? result.first_name,
      ) ?? null,
  };
};

const PAYWALL_ID_TO_TIER: Record<number, string> = (() => {
  const envMapping = process.env.CIRCLE_PAYWALL_ID_MAP;
  if (!envMapping) return {};
  try {
    const parsed = JSON.parse(envMapping);
    if (typeof parsed === 'object' && parsed !== null) {
      const mapping: Record<number, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        const numericKey = Number(key);
        if (Number.isFinite(numericKey) && typeof value === 'string') {
          mapping[numericKey] = value;
        }
      }
      return mapping;
    }
  } catch {
    console.warn('[circle-sync] Failed to parse CIRCLE_PAYWALL_ID_MAP env var');
  }
  return {};
})();

// Paywalls live on the v1 API, not admin v2 — use a dedicated request helper.
const circleV1Request = async <T = unknown>(path: string): Promise<T> => {
  const apiToken = process.env.CIRCLE_API_TOKEN;
  if (!apiToken) throw new Error('CIRCLE_API_TOKEN is not configured');
  const baseUrl = (process.env.CIRCLE_API_BASE_URL || 'https://app.circle.so/api/v1').replace(/\/$/, '');
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  console.log(`[circle-sync] v1 API request: ${url}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Token ${apiToken}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Circle v1 API ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<T>;
};

const fetchCirclePaywallById = async (
  paywallId: number,
  _communityId?: number,
): Promise<CirclePaywallInfo> => {
  const envName = PAYWALL_ID_TO_TIER[paywallId];
  if (envName) {
    console.log(
      `[circle-sync] Resolved paywall ${paywallId} from CIRCLE_PAYWALL_ID_MAP: ${envName}`,
    );
    return { id: paywallId, name: envName };
  }

  // Try v1 API for single paywall lookup
  try {
    const result = await circleV1Request<JsonRecord>(`/paywalls/${paywallId}`);
    const name = toStringValue(result.name ?? result.title ?? result.paywall_name);
    if (name) {
      console.log(`[circle-sync] Resolved paywall ${paywallId} name via v1 API: ${name}`);
      return { id: paywallId, name };
    }
  } catch (error) {
    console.warn(
      `[circle-sync] Failed to fetch paywall ${paywallId} from v1 API, trying paywalls list`,
      error instanceof Error ? error.message : error,
    );
  }

  try {
    const list = await circleV1Request<JsonRecord[] | JsonRecord>('/paywalls');
    const paywalls = Array.isArray(list) ? list : [];
    for (const pw of paywalls) {
      if (!isRecord(pw)) continue;
      const pwId = toNumberValue(pw.id);
      const pwName = toStringValue(pw.name ?? pw.title);
      if (pwId === paywallId && pwName) {
        return { id: paywallId, name: pwName };
      }
    }
  } catch (listError) {
    console.warn(
      `[circle-sync] Failed to fetch paywalls list`,
      listError instanceof Error ? listError.message : listError,
    );
  }

  // Log the exact env var update needed so it's easy to fix
  const currentMap = process.env.CIRCLE_PAYWALL_ID_MAP ?? '{}';
  console.error(
    `[circle-sync] Unknown paywall_id ${paywallId}. To fix, update CIRCLE_PAYWALL_ID_MAP in Vercel env vars to include this ID. ` +
    `Current value: ${currentMap}. ` +
    `Example fix: add "${paywallId}":"Mastery" to the map.`,
  );
  throw new Error(
    `Could not resolve paywall name for paywall_id ${paywallId}. Add "${paywallId}":"<TierName>" to CIRCLE_PAYWALL_ID_MAP in Vercel environment variables.`,
  );
};

const isCircleNativePayload = (payload: unknown): boolean => {
  const result = circleNativePayloadSchema.safeParse(payload);
  return result.success;
};

const parseCircleNativePayload = async (
  payload: unknown,
): Promise<ParsedCirclePaymentPayload> => {
  const parsed = circleNativePayloadSchema.parse(payload);
  const rawPayload = payload as JsonRecord;

  const memberInfo = await fetchCircleMemberById(
    parsed.data.community_member_id,
    parsed.data.community_id,
  );

  const paywallInfo = await fetchCirclePaywallById(
    parsed.data.paywall_id,
    parsed.data.community_id,
  );

  const mappedPlan = mapCircleTierToPlan(paywallInfo.name);
  if (!mappedPlan) {
    throw new Error(
      `Unsupported Circle tier from paywall "${paywallInfo.name}" (paywall_id=${parsed.data.paywall_id})`,
    );
  }

  const memberId = String(parsed.data.community_member_id);

  return {
    email: normalizeEmail(memberInfo.email),
    name: memberInfo.name,
    circleMemberId: memberId,
    tierPurchased: paywallInfo.name,
    mappedPlan,
    isOnTrial: false,
    amount: null,
    currency: null,
    occurredAt: new Date(),
    rawPayload,
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Tag name that forces the upgrade email to be sent even when the user's plan
// hasn't changed. Configurable via env var so it can be adjusted without a deploy.
const UPGRADE_EMAIL_TAG = (
  process.env.CIRCLE_UPGRADE_EMAIL_TAG || 'send-upgrade-email'
).toLowerCase();

// Circle tag events send only a numeric member_tag_id with no tag name.
// Resolve the member's tier by looking up their access groups instead.
// Retries up to 3 times with 2-second delays to handle the race condition
// where Circle fires the webhook before updating the member's access group.
const parseCircleTagEventPayload = async (
  payload: JsonRecord,
): Promise<ParsedCirclePaymentPayload | null> => {
  const eventType = toStringValue(payload.type);
  if (!eventType?.includes('tag')) return null;

  const data = isRecord(payload.data) ? payload.data : payload;
  const memberId = toNumberValue(data.community_member_id);
  if (!memberId) return null;

  // Check if the tag name matches the upgrade-email trigger tag.
  const tagName = toStringValue(
    data.tag_name ?? data.tagName ?? (isRecord(data.tag) ? data.tag.name : data.tag),
  );
  const isUpgradeEmailTag = tagName?.toLowerCase() === UPGRADE_EMAIL_TAG;

  console.log(`[circle-sync] Detected tag event (${eventType}), looking up member ${memberId} via access groups${isUpgradeEmailTag ? ' [force-upgrade-email]' : ''}`);

  const memberInfo = await fetchCircleMemberById(memberId);
  const { getMemberByEmail } = await import('@/lib/integrations/circle');

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  let circleData = await getMemberByEmail(memberInfo.email);

  for (let attempt = 1; attempt < MAX_RETRIES && !circleData?.mappedPlan; attempt++) {
    console.log(
      `[circle-sync] Member ${memberInfo.email} not yet in a recognized tier (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`,
    );
    await sleep(RETRY_DELAY_MS);
    circleData = await getMemberByEmail(memberInfo.email);
  }

  if (!circleData?.mappedPlan) {
    throw new Error(
      `Circle member ${memberId} (${memberInfo.email}) has no recognized tier in their access groups after ${MAX_RETRIES} attempts. Ensure they belong to a Mastery or Strengthen access group.`,
    );
  }

  console.log(`[circle-sync] Tag event resolved: member=${memberInfo.email} tier=${circleData.tierName} plan=${circleData.mappedPlan}`);

  return {
    email: memberInfo.email,
    name: memberInfo.name,
    circleMemberId: String(memberId),
    tierPurchased: circleData.tierName,
    mappedPlan: circleData.mappedPlan,
    isOnTrial: circleData.isOnTrial,
    forceUpgradeEmail: isUpgradeEmailTag,
    amount: null,
    currency: null,
    occurredAt: new Date(),
    rawPayload: payload,
  };
};

export const parseCircleWebhookPayload = async (
  payload: unknown,
): Promise<ParsedCirclePaymentPayload> => {
  if (isRecord(payload)) {
    const tagResult = await parseCircleTagEventPayload(payload).catch((err) => {
      console.warn('[circle-sync] Tag event parsing failed', err instanceof Error ? err.message : err);
      return null;
    });
    if (tagResult) return tagResult;
  }

  if (isCircleNativePayload(payload)) {
    console.log(
      '[circle-sync] Detected Circle native payload format, resolving IDs via API',
    );
    return parseCircleNativePayload(payload);
  }

  console.log(
    '[circle-sync] Using generic payload parsing (non-native format)',
  );

  const parsed = circleWebhookPayloadSchema.parse(payload);
  const rawPayload = parsed as JsonRecord;

  const tierPurchased = toStringValue(readFirst(rawPayload, TIER_PATHS));
  if (!tierPurchased) {
    throw new Error(
      'Missing tier/paywall name in Circle webhook payload. ' +
        'If Circle sends numeric paywall_id, ensure CIRCLE_API_TOKEN is set so the system can resolve the paywall name.',
    );
  }

  const mappedPlan = mapCircleTierToPlan(tierPurchased);
  if (!mappedPlan) {
    throw new Error(`Unsupported Circle tier: ${tierPurchased}`);
  }

  let email = normalizeEmail(toStringValue(readFirst(rawPayload, EMAIL_PATHS)));
  let name = toStringValue(readFirst(rawPayload, NAME_PATHS));
  const circleMemberId = toStringValue(readFirst(rawPayload, MEMBER_ID_PATHS));
  const amount = toNumberValue(readFirst(rawPayload, AMOUNT_PATHS));
  const currency = toStringValue(readFirst(rawPayload, CURRENCY_PATHS));
  const occurredAt =
    toDateValue(readFirst(rawPayload, TIMESTAMP_PATHS)) ?? new Date();

  // If no email in payload but we have a Circle member ID, look up the member
  // via the admin API to get their email. This handles tag-based workflow triggers
  // where Circle only sends community_member_id without inline email data.
  if (!email && circleMemberId) {
    try {
      const memberId = Number(circleMemberId);
      if (!Number.isNaN(memberId)) {
        const communityId = toNumberValue(readFirst(rawPayload, [['community_id'], ['data', 'community_id']]));
        const memberInfo = await fetchCircleMemberById(memberId, communityId ?? undefined);
        email = normalizeEmail(memberInfo.email);
        name = name ?? memberInfo.name;
        console.log('[circle-sync] Resolved member email via admin API lookup', { circleMemberId, email });
      }
    } catch (lookupErr) {
      console.warn('[circle-sync] Failed to look up member by ID, continuing without email', {
        circleMemberId,
        error: lookupErr instanceof Error ? lookupErr.message : lookupErr,
      });
    }
  }

  return {
    email,
    name,
    circleMemberId,
    tierPurchased,
    mappedPlan,
    amount,
    currency,
    occurredAt,
    rawPayload,
  };
};

export const deriveCircleEventId = ({
  payload,
  rawBody,
  headers,
}: {
  payload: unknown;
  rawBody: string;
  headers: Headers;
}): string => {
  const headerEventId =
    headers.get('x-circle-event-id') ||
    headers.get('x-circle-workflow-event-id') ||
    headers.get('x-workflow-event-id') ||
    headers.get('x-request-id');

  if (headerEventId && headerEventId.trim().length > 0) {
    return `circle:${headerEventId.trim()}`;
  }

  if (isRecord(payload)) {
    const payloadEventId = toStringValue(readFirst(payload, EVENT_ID_PATHS));
    if (payloadEventId) {
      return `circle:${payloadEventId}`;
    }
  }

  const digest = createHash('sha256').update(rawBody).digest('hex');
  return `circle:hash:${digest}`;
};

export const hasCircleWebhookBeenProcessed = async (
  eventId: string,
): Promise<boolean> => {
  const [record] = await db
    .select({ id: webhookEvent.id })
    .from(webhookEvent)
    .where(eq(webhookEvent.eventId, eventId))
    .limit(1);

  return Boolean(record);
};

export const markCircleWebhookProcessed = async (eventId: string) => {
  await db
    .insert(webhookEvent)
    .values({ eventId, processedAt: new Date() })
    .onConflictDoNothing({ target: webhookEvent.eventId });
};

/**
 * Atomically claim a webhook event for processing.
 * Returns true if this call successfully claimed the event (first to process it).
 * Returns false if the event was already claimed/processed by a prior call.
 * This prevents duplicate processing in concurrent retry scenarios.
 */
export const claimCircleWebhookEvent = async (
  eventId: string,
): Promise<boolean> => {
  const result = await db
    .insert(webhookEvent)
    .values({ eventId, processedAt: new Date() })
    .onConflictDoNothing({ target: webhookEvent.eventId })
    .returning({ id: webhookEvent.id });
  return result.length > 0;
};

/**
 * Releases a previously claimed webhook event when processing fails transiently.
 * This allows upstream webhook retries to be processed instead of being deduplicated.
 */
export const releaseCircleWebhookEventClaim = async (eventId: string) => {
  await db.delete(webhookEvent).where(eq(webhookEvent.eventId, eventId));
};

const writeCircleSyncLog = async (entry: CircleSyncLogInsert) => {
  await db.insert(circleSyncLog).values({
    eventId: entry.eventId,
    circleMemberId: entry.circleMemberId ?? null,
    email: entry.email ?? null,
    tierPurchased: entry.tierPurchased ?? null,
    mappedPlan: entry.mappedPlan ?? null,
    action: entry.action,
    userId: entry.userId ?? null,
    payload: entry.payload ?? {},
    errorMessage: entry.errorMessage ?? null,
    createdAt: new Date(),
  });
};

export const logCircleSyncError = async ({
  eventId,
  payload,
  errorMessage,
  circleMemberId,
  email,
  tierPurchased,
}: {
  eventId: string;
  payload: JsonRecord;
  errorMessage: string;
  circleMemberId?: string | null;
  email?: string | null;
  tierPurchased?: string | null;
}) => {
  await writeCircleSyncLog({
    eventId,
    circleMemberId: circleMemberId ?? null,
    email: email ?? null,
    tierPurchased: tierPurchased ?? null,
    mappedPlan: null,
    action: 'error',
    payload,
    errorMessage,
  });
};

type MinimalUser = {
  id: string;
  email: string;
  plan: PlanType;
  circleMemberId: string | null;
};

const findUserByCircleMemberId = async (
  circleMemberId: string,
): Promise<MinimalUser | null> => {
  const [record] = await db
    .select({
      id: user.id,
      email: user.email,
      plan: user.plan,
      circleMemberId: user.circleMemberId,
    })
    .from(user)
    .where(eq(user.circleMemberId, circleMemberId))
    .limit(1);

  return record ?? null;
};

const findUserByEmail = async (email: string): Promise<MinimalUser | null> => {
  const [record] = await db
    .select({
      id: user.id,
      email: user.email,
      plan: user.plan,
      circleMemberId: user.circleMemberId,
    })
    .from(user)
    .where(sql`lower(${user.email}) = lower(${email})`)
    .limit(1);

  return record ?? null;
};

const upsertCircleMemberIdentity = async (
  userId: string,
  circleMemberId: string | null,
  circleMemberEmail: string | null,
  isOnTrial?: boolean,
): Promise<void> => {
  if (!circleMemberId && !circleMemberEmail) return;
  await db
    .update(user)
    .set({
      circleMemberId: circleMemberId ?? undefined,
      circleId: circleMemberId ?? undefined,
      circleMemberEmail: circleMemberEmail ?? undefined,
      subscriptionSource: 'circle',
      ...(isOnTrial !== undefined && { circleMemberIsOnTrial: isOnTrial }),
    })
    .where(eq(user.id, userId));
};

const createSetupPasswordToken = async (userId: string): Promise<string> => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await db.delete(passwordResetToken).where(eq(passwordResetToken.userId, userId));
  await db.insert(passwordResetToken).values({
    userId,
    token,
    expiresAt,
  });

  return token;
};

const sendCircleProvisioningEmail = async ({
  toEmail,
  memberName,
  tierName,
  setupLink,
}: {
  toEmail: string;
  memberName: string | null;
  tierName: string;
  setupLink: string;
}): Promise<{ success: boolean; errorMessage: string | null }> => {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, errorMessage: 'Resend client not configured' };
  }

  const from = getFromAddress();
  const { error } = await resend.emails.send({
    from,
    to: toEmail,
    subject: 'Welcome to EOS AI - set your password',
    react: CircleWelcomeEmail({
      toEmail,
      memberName,
      tierName,
      setupLink,
    }),
    tags: [
      { name: 'source', value: 'circle_sync' },
      { name: 'tier', value: tierName.toLowerCase() },
    ],
  });

  if (error) {
    return { success: false, errorMessage: error.message };
  }

  return { success: true, errorMessage: null };
};

export const sendCircleUpgradeEmail = async ({
  toEmail,
  memberName,
  tierName,
}: {
  toEmail: string;
  memberName: string | null;
  tierName: string;
}): Promise<{ success: boolean; errorMessage: string | null }> => {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, errorMessage: 'Resend client not configured' };
  }

  const from = getFromAddress();
  const appLink = buildAppUrl('/');
  const { error } = await resend.emails.send({
    from,
    to: toEmail,
    subject: 'Your EOS AI plan has been upgraded',
    react: CircleUpgradeEmail({
      toEmail,
      memberName,
      tierName,
      appLink,
    }),
    tags: [
      { name: 'source', value: 'circle_sync' },
      { name: 'type', value: 'upgrade' },
      { name: 'tier', value: tierName.toLowerCase() },
    ],
  });

  if (error) {
    return { success: false, errorMessage: error.message };
  }

  return { success: true, errorMessage: null };
};

/**
 * Resends a Circle welcome / password-setup email to an existing EOS AI user.
 * Invalidates any prior token and generates a fresh 30-day link.
 */
export const resendCircleWelcomeEmail = async (
  userId: string,
  userEmail: string,
  memberName: string | null,
  tierName: string,
): Promise<{ success: boolean; errorMessage: string | null }> => {
  const resetToken = await createSetupPasswordToken(userId);
  const setupLink = buildAppUrl('/reset-password', { token: resetToken });
  return sendCircleProvisioningEmail({
    toEmail: userEmail,
    memberName,
    tierName,
    setupLink,
  });
};

type ApplyCirclePlanAssignmentInput = {
  eventId: string;
  source: CircleSyncSource;
  email: string | null;
  name: string | null;
  circleMemberId: string | null;
  tierPurchased: string;
  mappedPlan: PlanType;
  isOnTrial?: boolean;
  forceUpgradeEmail?: boolean;
  amount: number | null;
  currency: string | null;
  occurredAt: Date;
  rawPayload: JsonRecord;
};

const applyCirclePlanAssignment = async (
  input: ApplyCirclePlanAssignmentInput,
): Promise<CircleSyncResult> => {
  const payloadWithContext: JsonRecord = {
    ...input.rawPayload,
    _syncContext: {
      source: input.source,
      amount: input.amount,
      currency: input.currency,
      occurredAt: input.occurredAt.toISOString(),
    },
  };

  let existingUser: MinimalUser | null = null;

  if (input.circleMemberId) {
    existingUser = await findUserByCircleMemberId(input.circleMemberId);
  }

  if (!existingUser && input.email) {
    existingUser = await findUserByEmail(input.email);
  }

  if (existingUser) {
    const currentRank = PLAN_RANK[existingUser.plan];
    const incomingRank = PLAN_RANK[input.mappedPlan];

    await upsertCircleMemberIdentity(
      existingUser.id,
      input.circleMemberId,
      input.email,
      input.isOnTrial,
    );

    if (currentRank >= incomingRank) {
      // If the tag specifically requested the upgrade email, send it even
      // though the plan didn't change (e.g. the plan was already updated
      // by a prior payment webhook but the email hadn't been sent yet).
      let upgradeEmailError: string | null = null;
      if (input.forceUpgradeEmail) {
        console.log(
          `[circle-sync] Force-sending upgrade email to ${input.email ?? existingUser.email} (plan already ${existingUser.plan})`,
        );
        const emailResult = await sendCircleUpgradeEmail({
          toEmail: input.email ?? existingUser.email,
          memberName: input.name,
          tierName: input.tierPurchased,
        });
        upgradeEmailError = emailResult.errorMessage;
      }

      await writeCircleSyncLog({
        eventId: input.eventId,
        circleMemberId: input.circleMemberId,
        email: input.email ?? existingUser.email,
        tierPurchased: input.tierPurchased,
        mappedPlan: input.mappedPlan,
        action: 'no_change',
        userId: existingUser.id,
        payload: payloadWithContext,
        errorMessage: upgradeEmailError,
      });

      return {
        eventId: input.eventId,
        action: 'no_change',
        userId: existingUser.id,
        tierPurchased: input.tierPurchased,
        mappedPlan: input.mappedPlan,
        errorMessage: upgradeEmailError,
      };
    }

    await updateUserPlan(existingUser.id, input.mappedPlan, undefined, 'circle');
    await handlePlanChange(existingUser.id);
    await resetUserDailyUsageCounters(existingUser.id);

    const upgradeEmailResult = await sendCircleUpgradeEmail({
      toEmail: input.email ?? existingUser.email,
      memberName: input.name,
      tierName: input.tierPurchased,
    });

    await writeCircleSyncLog({
      eventId: input.eventId,
      circleMemberId: input.circleMemberId,
      email: input.email ?? existingUser.email,
      tierPurchased: input.tierPurchased,
      mappedPlan: input.mappedPlan,
      action: 'updated_plan',
      userId: existingUser.id,
      payload: payloadWithContext,
      errorMessage: upgradeEmailResult.errorMessage,
    });

    return {
      eventId: input.eventId,
      action: 'updated_plan',
      userId: existingUser.id,
      tierPurchased: input.tierPurchased,
      mappedPlan: input.mappedPlan,
      errorMessage: upgradeEmailResult.errorMessage,
    };
  }

  if (!input.email) {
    const errorMessage =
      'Unable to match or create user without email in Circle payload.';
    await writeCircleSyncLog({
      eventId: input.eventId,
      circleMemberId: input.circleMemberId,
      tierPurchased: input.tierPurchased,
      mappedPlan: input.mappedPlan,
      action: 'user_not_found',
      payload: payloadWithContext,
      errorMessage,
    });

    return {
      eventId: input.eventId,
      action: 'user_not_found',
      userId: null,
      tierPurchased: input.tierPurchased,
      mappedPlan: input.mappedPlan,
      errorMessage,
    };
  }

  const generatedPassword = randomBytes(32).toString('hex');
  const hashedPassword = generateHashedPassword(generatedPassword);
  const [createdUser] = await db
    .insert(user)
    .values({
      email: input.email,
      password: hashedPassword,
      plan: input.mappedPlan,
      circleMemberId: input.circleMemberId ?? null,
      circleId: input.circleMemberId ?? null,
      circleMemberEmail: input.email,
      subscriptionSource: 'circle',
    })
    .returning({
      id: user.id,
      email: user.email,
      plan: user.plan,
      circleMemberId: user.circleMemberId,
    });

  await handlePlanChange(createdUser.id);
  if (input.mappedPlan !== 'free') {
    await resetUserDailyUsageCounters(createdUser.id);
  }

  const resetToken = await createSetupPasswordToken(createdUser.id);
  const setupLink = buildAppUrl('/reset-password', { token: resetToken });
  const emailResult = await sendCircleProvisioningEmail({
    toEmail: createdUser.email,
    memberName: input.name,
    tierName: input.tierPurchased,
    setupLink,
  });

  await writeCircleSyncLog({
    eventId: input.eventId,
    circleMemberId: input.circleMemberId,
    email: createdUser.email,
    tierPurchased: input.tierPurchased,
    mappedPlan: input.mappedPlan,
    action: 'created_user',
    userId: createdUser.id,
    payload: payloadWithContext,
    errorMessage: emailResult.errorMessage,
  });

  return {
    eventId: input.eventId,
    action: 'created_user',
    userId: createdUser.id,
    tierPurchased: input.tierPurchased,
    mappedPlan: input.mappedPlan,
    errorMessage: emailResult.errorMessage,
  };
};

export const processCirclePaymentEvent = async ({
  eventId,
  payload,
  source = 'webhook',
}: {
  eventId: string;
  payload: unknown;
  source?: CircleSyncSource;
}): Promise<CircleSyncResult> => {
  const parsed = await parseCircleWebhookPayload(payload);
  return applyCirclePlanAssignment({
    eventId,
    source,
    ...parsed,
  });
};

const getCircleAdminConfig = () => {
  const apiToken = process.env.CIRCLE_ADMIN_API_TOKEN;
  if (!apiToken) {
    throw new Error('CIRCLE_ADMIN_API_TOKEN is not configured');
  }

  const baseUrl = (
    process.env.CIRCLE_ADMIN_API_BASE_URL ||
    'https://app.circle.so/api/admin/v2'
  ).replace(/\/$/, '');

  return { apiToken, baseUrl };
};

const circleAdminRequest = async (path: string): Promise<unknown> => {
  const { apiToken, baseUrl } = getCircleAdminConfig();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  console.log(`[circle-sync] Admin API request: ${url}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Token ${apiToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `[circle-sync] Circle Admin API error (${response.status}) ${errorBody.slice(0, 300)}`,
    );
  }

  return response.json();
};

const readArrayFromResponse = (response: unknown): JsonRecord[] => {
  if (Array.isArray(response)) {
    return response.filter(isRecord);
  }

  if (!isRecord(response)) return [];

  const arrayKeys = [
    'data',
    'items',
    'results',
    'access_groups',
    'accessGroups',
    'members',
    'community_members',
    'communityMembers',
  ];

  for (const key of arrayKeys) {
    const value = response[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  if (isRecord(response.data)) {
    for (const key of arrayKeys) {
      const value = response.data[key];
      if (Array.isArray(value)) {
        return value.filter(isRecord);
      }
    }
  }

  return [];
};

const toCircleAccessGroup = (raw: JsonRecord): CircleAccessGroup | null => {
  const id = toStringValue(
    raw.id ?? raw.access_group_id ?? raw.accessGroupId ?? raw.group_id,
  );
  const name = toStringValue(raw.name ?? raw.title ?? raw.group_name);

  if (!id || !name) return null;
  return { id, name };
};

const listCircleAccessGroups = async (): Promise<CircleAccessGroup[]> => {
  const response = await circleAdminRequest('/access_groups');
  const groups = readArrayFromResponse(response)
    .map(toCircleAccessGroup)
    .filter((group): group is CircleAccessGroup => Boolean(group));

  return groups;
};

const toCircleMember = (raw: JsonRecord): CircleMember => {
  const id = toStringValue(
    raw.id ?? raw.member_id ?? raw.memberId ?? readPath(raw, ['member', 'id']),
  );
  const email = normalizeEmail(
    toStringValue(
      raw.email ??
        raw.member_email ??
        raw.memberEmail ??
        readPath(raw, ['member', 'email']) ??
        readPath(raw, ['user', 'email']),
    ),
  );
  const name = toStringValue(
    raw.name ??
      raw.full_name ??
      raw.member_name ??
      readPath(raw, ['member', 'name']) ??
      readPath(raw, ['user', 'name']),
  );

  return { id, email, name, raw };
};

const listCircleAccessGroupMembers = async (
  accessGroupId: string,
): Promise<CircleMember[]> => {
  const response = await circleAdminRequest(`/access_groups/${accessGroupId}/members`);
  return readArrayFromResponse(response).map(toCircleMember);
};

const identityKeyForMembership = (membership: CircleMembership): string | null => {
  if (membership.memberId) return `member:${membership.memberId}`;
  if (membership.email) return `email:${membership.email}`;
  return null;
};

const pickHigherMembership = (
  current: CircleMembership,
  candidate: CircleMembership,
): CircleMembership => {
  const currentRank = PLAN_RANK[current.mappedPlan];
  const incomingRank = PLAN_RANK[candidate.mappedPlan];
  return incomingRank > currentRank ? candidate : current;
};

const fetchTierMemberships = async (): Promise<{
  groupsChecked: number;
  memberships: CircleMembership[];
}> => {
  const groups = await listCircleAccessGroups();
  const trialGroupIdMap = getTrialGroupIdMap();

  const tierGroups = groups
    .map((group) => {
      // Check explicit trial group ID map first (env var override)
      const trialPlan = trialGroupIdMap.get(group.id);
      const mappedPlan = trialPlan ?? mapCircleTierToPlan(group.name);
      if (!mappedPlan) return null;
      return {
        ...group,
        mappedPlan,
      };
    })
    .filter((group): group is CircleAccessGroup & { mappedPlan: PlanType } =>
      Boolean(group),
    );

  const memberships: CircleMembership[] = [];

  for (const group of tierGroups) {
    const members = await listCircleAccessGroupMembers(group.id);
    for (const member of members) {
      memberships.push({
        tierPurchased: group.name,
        mappedPlan: group.mappedPlan,
        groupId: group.id,
        groupName: group.name,
        memberId: member.id,
        email: member.email,
        name: member.name,
        rawMember: member.raw,
      });
    }
  }

  return { groupsChecked: tierGroups.length, memberships };
};

export const reconcileCircleTierMemberships =
  async (): Promise<CircleReconciliationReport> => {
    const startedAt = new Date();
    const dedupedMemberships = new Map<string, CircleMembership>();
    let groupsChecked = 0;

    const { groupsChecked: fetchedGroups, memberships } =
      await fetchTierMemberships();
    groupsChecked = fetchedGroups;

    for (const membership of memberships) {
      const identityKey = identityKeyForMembership(membership);
      if (!identityKey) continue;

      const existingMembership = dedupedMemberships.get(identityKey);
      if (!existingMembership) {
        dedupedMemberships.set(identityKey, membership);
      } else {
        dedupedMemberships.set(
          identityKey,
          pickHigherMembership(existingMembership, membership),
        );
      }
    }

    let synced = 0;
    let errors = 0;

    for (const membership of dedupedMemberships.values()) {
      const eventId = `circle:reconcile:${startedAt.getTime()}:${membership.groupId}:${membership.memberId ?? membership.email ?? randomUUID()}`;
      const payload: JsonRecord = {
        source: 'nightly_reconciliation',
        accessGroupId: membership.groupId,
        accessGroupName: membership.groupName,
        member: membership.rawMember,
      };

      try {
        const result = await applyCirclePlanAssignment({
          eventId,
          source: 'nightly_reconciliation',
          email: membership.email,
          name: membership.name,
          circleMemberId: membership.memberId,
          tierPurchased: membership.tierPurchased,
          mappedPlan: membership.mappedPlan,
          amount: null,
          currency: null,
          occurredAt: new Date(),
          rawPayload: payload,
        });

        if (result.action === 'error') {
          errors += 1;
        } else {
          synced += 1;
        }
      } catch (error) {
        errors += 1;
        await logCircleSyncError({
          eventId,
          payload,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown reconciliation error',
          circleMemberId: membership.memberId,
          email: membership.email,
          tierPurchased: membership.tierPurchased,
        });
      }
    }

    const activeMemberIds = new Set<string>();
    for (const membership of dedupedMemberships.values()) {
      if (membership.memberId) {
        activeMemberIds.add(membership.memberId);
      }
    }

    const trackedUsers = await db
      .select({
        id: user.id,
        email: user.email,
        circleMemberId: user.circleMemberId,
        subscriptionSource: user.subscriptionSource,
      })
      .from(user)
      .where(isNotNull(user.circleMemberId));

    let missingMemberships = 0;
    for (const trackedUser of trackedUsers) {
      if (!trackedUser.circleMemberId) continue;
      if (activeMemberIds.has(trackedUser.circleMemberId)) continue;

      missingMemberships += 1;

      // Only downgrade users whose subscription is Circle-managed.
      // Stripe-sourced users who happen to have a circleMemberId set are left alone.
      if (trackedUser.subscriptionSource === 'circle') {
        try {
          await updateUserPlan(trackedUser.id, 'free', undefined, 'circle');
          await handlePlanChange(trackedUser.id);
          await invalidateUserEntitlementsCache(trackedUser.id);
          await broadcastEntitlementsUpdated(trackedUser.id);

          await writeCircleSyncLog({
            eventId: `circle:reconcile:missing:${startedAt.getTime()}:${trackedUser.id}`,
            circleMemberId: trackedUser.circleMemberId,
            email: trackedUser.email,
            tierPurchased: null,
            mappedPlan: 'free',
            action: 'membership_missing',
            userId: trackedUser.id,
            payload: {
              source: 'nightly_reconciliation',
              reason: 'member_not_present_in_circle_tier_groups',
              action_taken: 'downgraded_to_free',
            },
            errorMessage: null,
          });
        } catch (downgradeError) {
          await writeCircleSyncLog({
            eventId: `circle:reconcile:missing:${startedAt.getTime()}:${trackedUser.id}`,
            circleMemberId: trackedUser.circleMemberId,
            email: trackedUser.email,
            tierPurchased: null,
            mappedPlan: null,
            action: 'membership_missing',
            userId: trackedUser.id,
            payload: {
              source: 'nightly_reconciliation',
              reason: 'member_not_present_in_circle_tier_groups',
              action_taken: 'downgrade_failed',
            },
            errorMessage:
              downgradeError instanceof Error
                ? downgradeError.message
                : 'Unknown downgrade error',
          });
        }
      } else {
        // Non-circle-sourced user: log missing membership but do not change plan.
        await writeCircleSyncLog({
          eventId: `circle:reconcile:missing:${startedAt.getTime()}:${trackedUser.id}`,
          circleMemberId: trackedUser.circleMemberId,
          email: trackedUser.email,
          tierPurchased: null,
          mappedPlan: null,
          action: 'membership_missing',
          userId: trackedUser.id,
          payload: {
            source: 'nightly_reconciliation',
            reason: 'member_not_present_in_circle_tier_groups',
            action_taken: 'skipped_non_circle_source',
          },
          errorMessage:
            'Member is no longer present in Circle tier access groups. Plan not changed because subscriptionSource is not circle.',
        });
      }
    }

    return {
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      groupsChecked,
      membersChecked: dedupedMemberships.size,
      synced,
      errors,
      missingMemberships,
    };
  };

export const getRecentCircleSyncLogs = async (limit = 50) => {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  return db
    .select()
    .from(circleSyncLog)
    .orderBy(desc(circleSyncLog.createdAt))
    .limit(safeLimit);
};

export const findCircleSyncLogByEventId = async (eventId: string) => {
  const [record] = await db
    .select()
    .from(circleSyncLog)
    .where(eq(circleSyncLog.eventId, eventId))
    .limit(1);
  return record ?? null;
};

export const countCircleSyncErrors = async (since?: Date): Promise<number> => {
  const conditions = [eq(circleSyncLog.action, 'error')];
  if (since) {
    conditions.push(sql`${circleSyncLog.createdAt} >= ${since}`);
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(circleSyncLog)
    .where(whereClause);

  return row?.count ?? 0;
};
