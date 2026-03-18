import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Circle.so API Client
 * Handles fetching course content from Circle.so for course assistant personas
 */

interface CircleLesson {
  id: string;
  title: string;
  content: string; // Content (may be HTML, plain text, or markdown)
  order: number;
  description?: string;
  isHtml?: boolean; // Flag to indicate if content is HTML and needs conversion
}

interface CircleCourse {
  id: string;
  name: string;
  description: string;
  lessons: CircleLesson[];
}

interface CircleAPIConfig {
  apiToken: string;
  headlessAuthToken: string;
  baseUrl: string;
  spaceId: string;
}

type CirclePlan = 'free' | 'pro' | 'business';

type GenericRecord = Record<string, unknown>;

export type CircleMemberLookup = {
  id: string | null;
  email: string | null;
  tierName: string;
  mappedPlan: CirclePlan | null;
  isOnTrial: boolean;
  /** True when the member exists in Circle but is not assigned to any paid tier group.
   * Callers should treat this as "membership status unknown" and fail-open (preserve
   * the current plan) rather than downgrading. This is distinct from a true 404 (null return). */
  foundButUntiered: boolean;
  raw: GenericRecord;
};

interface CircleAdminSearchConfig {
  adminToken: string;
  adminBaseUrl: string;
}

const CIRCLE_TIER_DEFAULTS = {
  free: 'discoverer',
  pro: 'explorer',
  business: 'mastery',
} as const satisfies Record<CirclePlan, string>;

const CIRCLE_TIER_ALIASES: Record<CirclePlan, string[]> = {
  free: ['discover', 'discoverer', 'starter'],
  pro: ['explorer', 'strengthen', 'pro', 'professional'],
  business: ['mastery', 'business', 'team'],
};

// Trial access group names that map to a specific plan.
// Keys are normalized tier name fragments; values are the plan they grant.
// Also supports CIRCLE_TRIAL_GROUP_IDS env var: comma-separated "groupId:plan" pairs
// e.g. CIRCLE_TRIAL_GROUP_IDS="abc123:business,def456:pro"
const CIRCLE_TRIAL_ALIASES: Record<string, CirclePlan> = {
  'mastery trial': 'business',
  'mastery bundle trial': 'business',
  'mastery free trial': 'business',
  'explorer trial': 'pro',
  'strengthen trial': 'pro',
  'pro trial': 'pro',
};

/**
 * Parses CIRCLE_TRIAL_GROUP_IDS env var into a map of groupId → plan.
 * Format: comma-separated "groupId:plan" pairs, e.g. "abc123:business,def456:pro"
 */
export const getTrialGroupIdMap = (): Map<string, CirclePlan> => {
  const map = new Map<string, CirclePlan>();
  const raw = process.env.CIRCLE_TRIAL_GROUP_IDS;
  if (!raw) return map;
  for (const entry of raw.split(',')) {
    const [groupId, plan] = entry.trim().split(':');
    if (groupId && (plan === 'free' || plan === 'pro' || plan === 'business')) {
      map.set(groupId.trim(), plan as CirclePlan);
    }
  }
  return map;
};

const isRecord = (value: unknown): value is GenericRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toStringValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const normalizeTier = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const DEFAULT_ADMIN_GROUP_MEMBER_SCAN_MAX_PAGES = 20;
const DEFAULT_ADMIN_COMMUNITY_SCAN_MAX_PAGES = 25;

const getOptionalPositiveInt = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};

const extractArrayCandidates = (value: unknown): GenericRecord[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  const candidateArrays = [
    value.records,
    value.members,
    value.community_members,
    value.results,
    value.data,
    isRecord(value.data) ? value.data.records : undefined,
    isRecord(value.data) ? value.data.members : undefined,
    isRecord(value.data) ? value.data.community_members : undefined,
    isRecord(value.data) ? value.data.results : undefined,
  ];

  for (const candidate of candidateArrays) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }

  return isRecord(value.member) ? [value.member] : [];
};

const getCircleAdminSearchConfig = (): CircleAdminSearchConfig | null => {
  const adminToken = process.env.CIRCLE_ADMIN_API_TOKEN;
  if (!adminToken) return null;
  return {
    adminToken,
    adminBaseUrl: (
      process.env.CIRCLE_ADMIN_API_BASE_URL || 'https://app.circle.so/api/admin/v2'
    ).replace(/\/$/, ''),
  };
};

/**
 * Search for a Circle member by email using the admin v2 API.
 *
 * Flow:
 * 1. Use GET /community_members/search?email= — a dedicated single-member email lookup
 *    endpoint in the admin v2 API. Returns the member directly or 404.
 * 2. Build a memberIdToPlan map by fetching paid tier group member lists (small lists,
 *    only paid groups — free group has 25k+ members). Cross-reference the found member's
 *    ID against this map to determine their plan.
 * 3. If the member exists in Circle but is not in any paid group, treat as free.
 * 4. If not found at all, return null (404 from connect route).
 */

// In-memory cache for the tier group member map — avoids re-fetching ~4 group pages
// on every page load. TTL of 5 minutes is short enough to pick up new subscriptions
// quickly while preventing the 30-60s scan from running on every verify call.
let tierMapCache: { map: Map<string, CirclePlan>; groups: TierGroups; expiresAt: number } | null = null;
const TIER_MAP_TTL_MS = 5 * 60 * 1000; // 5 minutes

const buildTierMap = async (config: CircleAdminSearchConfig): Promise<{ memberIdToPlan: Map<string, CirclePlan>; tierGroups: TierGroups }> => {
  const now = Date.now();
  if (tierMapCache && now < tierMapCache.expiresAt) {
    return { memberIdToPlan: tierMapCache.map, tierGroups: tierMapCache.groups };
  }

  const tierGroups = await getAdminTierGroups(config);
  const paidPlans: CirclePlan[] = ['business', 'pro'];
  const memberIdToPlan = new Map<string, CirclePlan>();
  const maxGroupPages =
    getOptionalPositiveInt(process.env.CIRCLE_ADMIN_GROUP_MEMBER_SCAN_MAX_PAGES) ??
    DEFAULT_ADMIN_GROUP_MEMBER_SCAN_MAX_PAGES;

  for (const plan of paidPlans) {
    const groupIds = tierGroups[plan];
    if (!Array.isArray(groupIds)) continue;
    for (const groupId of groupIds) {
      if (!groupId) continue;
      let mPage = 1;
      while (true) {
        const res = await fetch(
          `${config.adminBaseUrl}/access_groups/${groupId}/community_members?per_page=200&page=${mPage}`,
          { headers: { Authorization: `Token ${config.adminToken}` }, cache: 'no-store' },
        );
        if (!res.ok) break;
        const data = (await res.json()) as GenericRecord;
        const records = Array.isArray(data.records) ? (data.records as GenericRecord[]) : [];
        for (const r of records) {
          const membId = toStringValue(r.community_member_id);
          if (membId) memberIdToPlan.set(membId, plan as CirclePlan);
        }
        if (!data.has_next_page) break;
        mPage++;
        if (mPage > maxGroupPages) {
          console.warn('[circle] admin search: reached configured group scan page limit', { plan, groupId, maxGroupPages });
          break;
        }
      }
    }
  }

  tierMapCache = { map: memberIdToPlan, groups: tierGroups, expiresAt: now + TIER_MAP_TTL_MS };
  return { memberIdToPlan, tierGroups };
};
const searchCircleMembersViaAdmin = async (
  email: string,
): Promise<CircleMemberLookup | null> => {
  const config = getCircleAdminSearchConfig();
  if (!config) return null;

  const normalizedEmail = normalizeEmail(email);

  // Step 1: Look up the member directly by email — single request, exact match.
  // GET /api/admin/v2/community_members/search?email= returns one member or 404.
  const searchRes = await fetch(
    `${config.adminBaseUrl}/community_members/search?email=${encodeURIComponent(normalizedEmail)}`,
    { headers: { Authorization: `Token ${config.adminToken}` }, cache: 'no-store' },
  );

  if (!searchRes.ok) {
    if (searchRes.status === 404) {
      console.warn('[circle] admin search: member not found by email', { email: normalizedEmail });
    } else {
      console.error('[circle] admin search: unexpected error from search endpoint', {
        email: normalizedEmail,
        status: searchRes.status,
      });
    }
    return null;
  }

  const memberData = (await searchRes.json()) as GenericRecord;
  const memberId = toStringValue(memberData.id);

  if (!memberId) {
    console.warn('[circle] admin search: member not found by email', { email: normalizedEmail });
    return null;
  }

  // Step 2: Get the cached tier map (or build it if stale/missing).
  // The cache TTL is 5 minutes — fast for repeat page loads, fresh enough for new subscriptions.
  const { memberIdToPlan, tierGroups } = await buildTierMap(config);

  // Step 3: Cross-reference the found member against the plan map.
  const plan = memberIdToPlan.get(memberId) ?? 'free';
  const foundButUntiered = plan === 'free';
  const tierName =
    plan !== 'free'
      ? (tierGroups._names[plan] ?? plan)
      : (process.env.CIRCLE_TIER_FREE || CIRCLE_TIER_DEFAULTS.free);

  console.log('[circle] admin search: found member', {
    email: normalizedEmail,
    plan,
    tierName,
    memberId,
    foundButUntiered,
  });

  return {
    id: memberId,
    email: normalizedEmail,
    tierName,
    mappedPlan: plan,
    foundButUntiered,
    isOnTrial: false,
    raw: memberData,
  };
};

type TierGroups = Record<CirclePlan, string[]> & { _names: Record<CirclePlan, string> };

const getAdminTierGroups = async (config: CircleAdminSearchConfig): Promise<TierGroups> => {
  // If explicit group IDs are set in env, use them.
  // Supports comma-separated IDs per plan, e.g. CIRCLE_TIER_BUSINESS_GROUP_ID="87672,87669"
  const explicitMastery = process.env.CIRCLE_TIER_BUSINESS_GROUP_ID;
  const explicitStrengthen = process.env.CIRCLE_TIER_PRO_GROUP_ID;
  const explicitDiscover = process.env.CIRCLE_TIER_FREE_GROUP_ID;

  const splitIds = (val: string | undefined): string[] =>
    val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];

  if (explicitMastery && explicitStrengthen) {
    return {
      business: splitIds(explicitMastery),
      pro: splitIds(explicitStrengthen),
      free: splitIds(explicitDiscover),
      _names: {
        business: process.env.CIRCLE_TIER_BUSINESS || CIRCLE_TIER_DEFAULTS.business,
        pro: process.env.CIRCLE_TIER_PRO || CIRCLE_TIER_DEFAULTS.pro,
        free: process.env.CIRCLE_TIER_FREE || CIRCLE_TIER_DEFAULTS.free,
      },
    };
  }

  // Auto-discover tier groups from the access groups list
  const res = await fetch(
    `${config.adminBaseUrl}/access_groups?per_page=100`,
    { headers: { Authorization: `Token ${config.adminToken}` }, cache: 'no-store' },
  );
  if (!res.ok) return { business: [], pro: [], free: [], _names: { business: 'mastery', pro: 'strengthen', free: 'discover' } };

  const data = (await res.json()) as GenericRecord;
  const groups = Array.isArray(data.records) ? (data.records as GenericRecord[]) : [];

  const result: TierGroups = {
    business: [],
    pro: [],
    free: [],
    _names: {
      business: process.env.CIRCLE_TIER_BUSINESS || CIRCLE_TIER_DEFAULTS.business,
      pro: process.env.CIRCLE_TIER_PRO || CIRCLE_TIER_DEFAULTS.pro,
      free: process.env.CIRCLE_TIER_FREE || CIRCLE_TIER_DEFAULTS.free,
    },
  };

  for (const group of groups) {
    const name = toStringValue(group.name);
    if (!name) continue;
    const plan = mapCircleTierToPlan(name);
    if (plan && plan !== 'free') {
      result[plan].push(toStringValue(group.id) ?? '');
      result._names[plan] = name;
    }
  }

  return result;
};

const extractMemberId = (member: GenericRecord): string | null =>
  toStringValue(
    member.id ??
      member.member_id ??
      member.community_member_id ??
      member.memberId ??
      (isRecord(member.member) ? member.member.id : undefined),
  );

const extractMemberEmail = (member: GenericRecord): string | null => {
  const email = toStringValue(
    member.email ??
      member.member_email ??
      member.memberEmail ??
      (isRecord(member.member) ? member.member.email : undefined) ??
      (isRecord(member.user) ? member.user.email : undefined),
  );

  return email ? normalizeEmail(email) : null;
};

const extractMemberTierName = (member: GenericRecord): string | null => {
  const directTier = toStringValue(
    member.tier ??
      member.tier_name ??
      member.tierName ??
      member.paywall ??
      member.paywall_name ??
      member.paywallName ??
      member.membership_level ??
      member.membershipLevel ??
      member.access_group_name ??
      member.accessGroupName,
  );

  if (directTier) {
    return directTier;
  }

  const nestedName = toStringValue(
    (isRecord(member.access_group) ? member.access_group.name : undefined) ??
      (isRecord(member.paywall) ? member.paywall.name : undefined) ??
      (isRecord(member.tier) ? member.tier.name : undefined),
  );

  if (nestedName) {
    return nestedName;
  }

  const groups = member.access_groups;
  if (Array.isArray(groups)) {
    for (const group of groups) {
      if (!isRecord(group)) continue;
      const name = toStringValue(group.name ?? group.title);
      if (name) return name;
    }
  }

  return null;
};

export const mapCircleTierToPlan = (tierName: string): CirclePlan | null => {
  const normalizedTier = normalizeTier(tierName);
  if (!normalizedTier) return null;

  const envMap: Record<CirclePlan, string> = {
    free: process.env.CIRCLE_TIER_FREE || CIRCLE_TIER_DEFAULTS.free,
    pro: process.env.CIRCLE_TIER_PRO || CIRCLE_TIER_DEFAULTS.pro,
    business: process.env.CIRCLE_TIER_BUSINESS || CIRCLE_TIER_DEFAULTS.business,
  };

  for (const [plan, tier] of Object.entries(envMap) as Array<
    [CirclePlan, string]
  >) {
    if (normalizeTier(tier) === normalizedTier) {
      return plan;
    }
  }

  for (const [plan, aliases] of Object.entries(CIRCLE_TIER_ALIASES) as Array<
    [CirclePlan, string[]]
  >) {
    if (aliases.some((alias) => normalizedTier.includes(normalizeTier(alias)))) {
      return plan;
    }
  }

  // Check trial tier aliases — exact substring match on normalized tier name
  for (const [trialAlias, plan] of Object.entries(CIRCLE_TRIAL_ALIASES)) {
    if (normalizedTier.includes(normalizeTier(trialAlias))) {
      return plan;
    }
  }

  // Generic trial detection: if the tier name contains a known plan keyword
  // AND "trial", map it to that plan (e.g. "Mastery Bundle - Trial" → business)
  if (normalizedTier.includes('trial') || normalizedTier.includes('free trial')) {
    for (const [plan, aliases] of Object.entries(CIRCLE_TIER_ALIASES) as Array<
      [CirclePlan, string[]]
    >) {
      if (aliases.some((alias) => normalizedTier.includes(normalizeTier(alias)))) {
        return plan;
      }
    }
  }

  return null;
};

export const getMemberByEmail = async (
  email: string,
): Promise<CircleMemberLookup | null> => {
  if (!email || !email.includes('@')) {
    throw new Error('A valid email address is required');
  }

  return searchCircleMembersViaAdmin(email);
};

const parseWebhookSignature = (signature: string): string | null => {
  const trimmed = signature.trim();
  if (!trimmed) return null;

  if (trimmed.includes('v1=')) {
    const match = trimmed.match(/v1=([a-fA-F0-9]+)/);
    return match?.[1]?.toLowerCase() || null;
  }

  if (trimmed.includes('=')) {
    const [, value] = trimmed.split('=', 2);
    return value?.trim().toLowerCase() || null;
  }

  return trimmed.toLowerCase();
};

const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const verifyWebhookSignature = (
  payload: string,
  signature: string | null | undefined,
  secret = process.env.CIRCLE_WEBHOOK_SECRET,
): boolean => {
  if (!secret || !signature) {
    return false;
  }

  const normalizedSignature = parseWebhookSignature(signature);
  if (!normalizedSignature) {
    return false;
  }

  const expectedHex = createHmac('sha256', secret).update(payload).digest('hex');
  if (safeCompare(expectedHex, normalizedSignature)) {
    return true;
  }

  const expectedBase64 = createHmac('sha256', secret)
    .update(payload)
    .digest('base64');
  return safeCompare(expectedBase64, normalizedSignature);
};

/**
 * Get Circle.so API configuration from environment variables
 */
function getCircleConfig(): CircleAPIConfig {
  const apiToken = process.env.CIRCLE_API_TOKEN;
  const headlessAuthToken = process.env.CIRCLE_HEADLESS_AUTH_TOKEN;
  const baseUrl =
    process.env.CIRCLE_API_BASE_URL || 'https://app.circle.so/api/v1';
  const spaceId = process.env.CIRCLE_SPACE_ID || '';

  if (!apiToken) {
    throw new Error('CIRCLE_API_TOKEN environment variable is not set');
  }

  if (!headlessAuthToken) {
    throw new Error(
      'CIRCLE_HEADLESS_AUTH_TOKEN environment variable is not set',
    );
  }

  return {
    apiToken,
    headlessAuthToken,
    baseUrl,
    spaceId,
  };
}

/**
 * Make authenticated request to Circle.so API
 */
async function circleRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const config = getCircleConfig();

  const url = `${config.baseUrl}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${config.apiToken}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  console.log(`[Circle API] Requesting: ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Circle API] Error response:`, errorText);
      throw new Error(
        `Circle.so API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error(`[Circle API] Request failed:`, error);
    throw error;
  }
}

/**
 * Convert HTML content to plain text for embedding
 * Strips HTML tags and normalizes whitespace
 */
function htmlToPlainText(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') return '';

  // Remove script and style tags and their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Replace common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Replace <br> and </p> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Normalize whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');

  // Trim each line
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  return text.trim();
}

/**
 * Fetch course details from Circle.so
 * Note: Circle.so may call these "Courses" or "Space Groups" depending on the product
 */
export async function fetchCourseDetails(
  spaceId: string,
  courseId: string,
): Promise<{ name: string; description: string }> {
  try {
    console.log(
      `[Circle API] Fetching course details for courseId: ${courseId}`,
    );

    // Try fetching as a space group (Circle.so's course/learning module structure)
    const response = await circleRequest<{
      id: number;
      name: string;
      body?: string;
      description?: string;
      space_group?: {
        name: string;
        description?: string;
      };
    }>(`/space_groups/${courseId}`);

    return {
      name: response.space_group?.name || response.name || 'Untitled Course',
      description:
        response.space_group?.description ||
        response.description ||
        response.body ||
        '',
    };
  } catch (error) {
    console.error('[Circle API] Error fetching course details:', error);
    throw new Error(`Failed to fetch course details: ${error}`);
  }
}

/**
 * Generate a member authentication token for Headless API access
 * This uses the Headless Auth token to create a member token
 */
async function getMemberAuthToken(): Promise<string> {
  const config = getCircleConfig();

  try {
    // First, get the current admin user's email
    console.log('[Circle API] Fetching admin user email...');
    const meResponse = await circleRequest<{ email: string }>('/me');
    console.log(`[Circle API] Admin email: ${meResponse.email}`);

    // Generate a member access token using the Headless Auth token
    console.log('[Circle API] Generating member access token...');
    const response = await fetch(`${config.baseUrl}/headless/auth_token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.headlessAuthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: meResponse.email,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Circle API] Headless auth error (${response.status}):`,
        errorText,
      );
      throw new Error(
        `Failed to generate member token: ${response.status} - ${errorText}`,
      );
    }

    const authResponse = await response.json();
    console.log(
      `[Circle API] Successfully generated member token (expires: ${authResponse.access_token_expires_at})`,
    );
    return authResponse.access_token;
  } catch (error) {
    console.error('[Circle API] Error generating member auth token:', error);
    throw error;
  }
}

/**
 * Fetch all spaces within a space group
 */
async function fetchSpacesInGroup(spaceGroupId: string): Promise<number[]> {
  try {
    const response = await circleRequest<{
      space_order_array: number[];
    }>(`/space_groups/${spaceGroupId}`);

    return response.space_order_array || [];
  } catch (error) {
    console.error('[Circle API] Error fetching spaces in group:', error);
    return [];
  }
}

/**
 * Fetch lessons from a course-type space using Headless API
 */
async function fetchCourseLessonsFromSpace(
  spaceIdNum: number,
  memberToken: string,
): Promise<CircleLesson[]> {
  const lessons: CircleLesson[] = [];

  try {
    console.log(
      `[Circle API] Fetching course sections from space ${spaceIdNum}`,
    );

    // Fetch sections in the course
    const sectionsUrl = `https://app.circle.so/api/headless/v1/courses/${spaceIdNum}/sections`;
    console.log(`[Circle API] Requesting sections from: ${sectionsUrl}`);

    const sectionsResponse = await fetch(sectionsUrl, {
      headers: {
        Authorization: `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!sectionsResponse.ok) {
      const errorText = await sectionsResponse.text();
      console.error(
        `[Circle API] Failed to fetch sections (${sectionsResponse.status}):`,
        errorText.substring(0, 200),
      );
      return lessons;
    }

    const sectionsData = await sectionsResponse.json();
    console.log(
      `[Circle API] Full sections response for space ${spaceIdNum}:`,
      JSON.stringify(sectionsData, null, 2),
    );

    // Handle both response formats
    let sections = [];
    if (Array.isArray(sectionsData)) {
      sections = sectionsData;
    } else if (sectionsData.sections && Array.isArray(sectionsData.sections)) {
      sections = sectionsData.sections;
    } else {
      console.error('[Circle API] Unexpected sections response format:', sectionsData);
    }

    console.log(
      `[Circle API] Found ${sections.length} sections in course ${spaceIdNum}`,
    );

    // Fetch lessons from each section
    for (const section of sections) {
      console.log(
        `[Circle API] Processing section: ${section.name} (ID: ${section.id})`,
      );
      const sectionLessons = section.lessons || [];
      console.log(`[Circle API] Section has ${sectionLessons.length} lessons`);

      for (const lesson of sectionLessons) {
        // Fetch full lesson details
        try {
          const lessonUrl = `https://app.circle.so/api/headless/v1/courses/${spaceIdNum}/lessons/${lesson.id}`;
          console.log(`[Circle API] Fetching lesson from: ${lessonUrl}`);

          const lessonResponse = await fetch(lessonUrl, {
            headers: {
              Authorization: `Bearer ${memberToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (lessonResponse.ok) {
            const lessonData = await lessonResponse.json();
            const lessonObj = lessonData.lesson || lessonData;

            // Circle.so uses rich_text_body for lesson content
            // Get ALL content sources and combine them (don't truncate!)
            let content = '';
            let isHtml = false; // Track if content is HTML
            
            // Priority 1: Full rich text body (most complete - ALREADY PLAIN TEXT!)
            // Check if it exists AND has actual content (length > 0)
            if (lessonObj.rich_text_body?.body && 
                typeof lessonObj.rich_text_body.body === 'string' && 
                lessonObj.rich_text_body.body.trim().length > 0) {
              content = lessonObj.rich_text_body.body;
              isHtml = false; // rich_text_body.body is already plain text
            } 
            // Priority 2: Fallback text (PLAIN TEXT - often has the actual content!)
            else if (lessonObj.rich_text_body?.circle_ios_fallback_text &&
                     lessonObj.rich_text_body.circle_ios_fallback_text.trim().length > 0) {
              content = lessonObj.rich_text_body.circle_ios_fallback_text;
              isHtml = false; // Fallback text is already plain text
            }
            // Priority 3: Plain body field (THIS might be HTML)
            else if (lessonObj.body && lessonObj.body.trim().length > 0) {
              content = lessonObj.body;
              isHtml = true; // body field might contain HTML
            }
            
            // Also include description if available (prepend to content)
            let fullContent = content;
            if (lessonObj.description?.trim()) {
              fullContent = `${lessonObj.description}\n\n${content}`;
            }

            lessons.push({
              id: lessonObj.id?.toString() || lesson.id.toString(),
              title: lessonObj.name || lesson.name || 'Untitled Lesson',
              content: fullContent,
              order: lessons.length,
              description: lessonObj.description || '',
              isHtml, // Flag whether content needs HTML conversion
            });

            console.log(
              `[Circle API] ✅ Fetched lesson: ${lessonObj.name} (${fullContent.length} chars total, ${content.length} body, ${(lessonObj.description || '').length} desc)`,
            );
          } else {
            const errorText = await lessonResponse.text();
            console.error(
              `[Circle API] Failed to fetch lesson ${lesson.id}: ${lessonResponse.status}`,
              errorText.substring(0, 200),
            );
          }
        } catch (lessonError) {
          console.error(
            `[Circle API] Error fetching lesson ${lesson.id}:`,
            lessonError,
          );
        }
      }
    }
  } catch (error) {
    console.error(`[Circle API] Error fetching course sections:`, error);
  }

  return lessons;
}

/**
 * Fetch posts from a regular space using Headless API
 */
async function fetchPostsFromSpace(
  spaceIdNum: number,
  memberToken: string,
): Promise<CircleLesson[]> {
  const posts: CircleLesson[] = [];

  try {
    console.log(`[Circle API] Fetching posts from space ${spaceIdNum}`);

    let page = 1;
    let hasMore = true;
    let totalFetched = 0;

    // Paginate through ALL posts (not just first 100)
    while (hasMore) {
    const response = await fetch(
        `https://app.circle.so/api/headless/v1/spaces/${spaceIdNum}/posts?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      console.error(
          `[Circle API] Failed to fetch posts page ${page}: ${response.status}`,
      );
        break;
    }

    const data = await response.json();
    const postRecords = data.posts || data.records || [];

      if (postRecords.length === 0) {
        hasMore = false;
        break;
      }

      totalFetched += postRecords.length;
    console.log(
        `[Circle API] Fetched page ${page}: ${postRecords.length} posts (${totalFetched} total)`,
    );

    for (const post of postRecords) {
        // Extract FULL content from rich_text_body (not truncated fallback!)
        let content = '';
        let isHtml = false;
        
        // Priority 1: Full rich text body (PLAIN TEXT)
        // Check for actual content, not just existence
        if (post.rich_text_body?.body && 
            typeof post.rich_text_body.body === 'string' &&
            post.rich_text_body.body.trim().length > 0) {
          content = post.rich_text_body.body;
          isHtml = false; // Already plain text
        }
        // Priority 2: Fallback text (PLAIN TEXT - often has actual content!)
        else if (post.rich_text_body?.circle_ios_fallback_text &&
                 post.rich_text_body.circle_ios_fallback_text.trim().length > 0) {
          content = post.rich_text_body.circle_ios_fallback_text;
          isHtml = false; // Already plain text
        }
        // Priority 3: Plain body (might be HTML)
        else if (post.body && typeof post.body === 'string' && post.body.trim().length > 0) {
          content = post.body;
          isHtml = true; // Might be HTML
        }

        // Include description/excerpt if available
        let fullContent = content;
        if (post.excerpt && typeof post.excerpt === 'string' && post.excerpt.trim().length > 0) {
          fullContent = `${post.excerpt}\n\n${content}`;
        }

      posts.push({
        id: post.id.toString(),
        title: post.name || 'Untitled Post',
          content: fullContent,
        order: post.is_pinned ? -1 : posts.length,
          description: post.slug || post.excerpt || '',
          isHtml, // Flag for HTML conversion
      });
    }

      // Check if there are more pages
      if (postRecords.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(
      `[Circle API] ✅ Total posts fetched from space ${spaceIdNum}: ${posts.length}`,
    );
  } catch (error) {
    console.error(`[Circle API] Error fetching posts:`, error);
  }

  return posts;
}

/**
 * Fetch all lessons/posts for a course from Circle.so
 * Uses Headless Member API to fetch actual content
 */
export async function fetchCourseLessons(
  spaceId: string,
  courseId: string,
): Promise<CircleLesson[]> {
  try {
    console.log(`[Circle API] Fetching lessons for courseId: ${courseId}`);

    // Get member auth token for Headless API
    const memberToken = await getMemberAuthToken();
    console.log('[Circle API] Got member auth token');

    // Get all spaces in this space group
    const spaceIds = await fetchSpacesInGroup(courseId);
    console.log(
      `[Circle API] Found ${spaceIds.length} spaces in space group ${courseId}`,
    );

    if (spaceIds.length === 0) {
      console.log('[Circle API] No spaces found in space group');
      return [];
    }

    const allLessons: CircleLesson[] = [];

    // Fetch content from each space
    for (const spaceIdNum of spaceIds) {
      try {
        // Get space details to check if it's a course-type space
        const spaceDetailsResponse = await circleRequest<{
          space_type?: string;
          display_view?: string;
        }>(`/spaces/${spaceIdNum}`);

        console.log(
          `[Circle API] Space ${spaceIdNum} type: ${spaceDetailsResponse.space_type || 'regular'}`,
        );

        // Check if it's a course-type space (has lessons) or regular space (has posts)
        if (spaceDetailsResponse.space_type === 'course') {
          // Fetch lessons from course
          const courseLessons = await fetchCourseLessonsFromSpace(
            spaceIdNum,
            memberToken,
          );
          allLessons.push(...courseLessons);
        } else {
          // Fetch posts from regular space
          const spacePosts = await fetchPostsFromSpace(spaceIdNum, memberToken);
          allLessons.push(...spacePosts);
        }
      } catch (spaceError) {
        console.error(
          `[Circle API] Error fetching content from space ${spaceIdNum}:`,
          spaceError,
        );
        continue;
      }
    }

    // Sort by order (pinned first, then by index)
    allLessons.sort((a, b) => {
      if (a.order === -1 && b.order === -1) return 0;
      if (a.order === -1) return -1;
      if (b.order === -1) return 1;
      return a.order - b.order;
    });

    console.log(
      `[Circle API] Total lessons fetched: ${allLessons.length} from ${spaceIds.length} spaces`,
    );
    return allLessons;
  } catch (error) {
    console.error('[Circle API] Error fetching course lessons:', error);
    throw new Error(`Failed to fetch course lessons: ${error}`);
  }
}

/**
 * Fetch complete course content including all lessons
 */
export async function fetchCourseContent(
  spaceId: string,
  courseId: string,
): Promise<CircleCourse> {
  try {
    console.log(
      `[Circle API] Fetching complete course content for courseId: ${courseId}`,
    );

    // Fetch course details and lessons in parallel
    const [courseDetails, lessons] = await Promise.all([
      fetchCourseDetails(spaceId, courseId),
      fetchCourseLessons(spaceId, courseId),
    ]);

    return {
      id: courseId,
      name: courseDetails.name,
      description: courseDetails.description,
      lessons,
    };
  } catch (error) {
    console.error('[Circle API] Error fetching course content:', error);
    throw error;
  }
}

/**
 * Convert course content to structured text documents for RAG processing
 * Returns an array of documents (one per lesson + course overview)
 */
export function courseToDocuments(course: CircleCourse): Array<{
  title: string;
  content: string;
  metadata: {
    lessonId?: string;
    order?: number;
    type: 'overview' | 'lesson';
  };
}> {
  const documents = [];

  // Create overview document
  documents.push({
    title: `${course.name} - Overview`,
    content: `# ${course.name}\n\n${htmlToPlainText(course.description)}`,
    metadata: {
      type: 'overview' as const,
    },
  });

  // Create a document for each lesson (skip empty lessons)
  for (const lesson of course.lessons) {
    // ONLY convert HTML to plain text if content is actually HTML!
    // rich_text_body.body is already plain text and doesn't need conversion
    const lessonContent = lesson.isHtml 
      ? htmlToPlainText(lesson.content) 
      : lesson.content; // Already plain text - use as is!
      
    const description = lesson.description
      ? htmlToPlainText(lesson.description) // Descriptions might still be HTML
      : '';

    let content = `# ${lesson.title}\n\n`;
    if (description) {
      content += `${description}\n\n`;
    }
    content += lessonContent;

    // Only skip if completely empty (just the title header)
    // Even short lessons might have valuable info (links, references, etc.)
    const contentWithoutTitle = content.replace(`# ${lesson.title}\n\n`, '').trim();
    
    if (contentWithoutTitle.length === 0) {
      console.log(
        `[Circle API] Skipping truly empty lesson: ${lesson.title} (no content beyond title)`,
      );
      continue;
    }
    
    // Log if content is short (for monitoring, but still include it)
    if (content.trim().length < 100) {
      console.log(
        `[Circle API] ⚠️  Short content: ${lesson.title} (${content.length} chars) - including anyway`,
      );
    }

    documents.push({
      title: `${course.name} - Lesson ${lesson.order + 1}: ${lesson.title}`,
      content,
      metadata: {
        lessonId: lesson.id,
        order: lesson.order,
        type: 'lesson' as const,
      },
    });
  }

  console.log(`[Circle API] Converted course to ${documents.length} documents`);
  return documents;
}

/**
 * Test Circle.so API connectivity
 */
export async function testCircleConnection(): Promise<boolean> {
  try {
    const config = getCircleConfig();
    console.log('[Circle API] Testing connection...');

    // Test with a simple endpoint - fetch current community info
    await circleRequest('/me');

    console.log('[Circle API] Connection test successful');
    return true;
  } catch (error) {
    console.error('[Circle API] Connection test failed:', error);
    return false;
  }
}
