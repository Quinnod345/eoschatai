/**
 * Centralized Content Parsers for Composer Types
 *
 * Provides unified parsing and validation for VTO, Chart, and Accountability Chart content.
 * Handles both marker-wrapped content (e.g., VTO_DATA_BEGIN...VTO_DATA_END) and raw JSON.
 */

// ============================================================================
// Common Types and Utilities
// ============================================================================

export interface ParseResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

/**
 * Extract JSON content from marker-wrapped string or raw JSON.
 * @param content The content string to parse
 * @param beginMarker Start marker (e.g., 'VTO_DATA_BEGIN')
 * @param endMarker End marker (e.g., 'VTO_DATA_END')
 */
function extractJsonFromContent(
  content: string,
  beginMarker: string,
  endMarker: string,
): string {
  const hasBegin = content.includes(beginMarker);
  const hasEnd = content.includes(endMarker);

  if (hasBegin && hasEnd) {
    const start = content.indexOf(beginMarker) + beginMarker.length;
    const end = content.indexOf(endMarker);
    if (start >= 0 && end > start) {
      return content.substring(start, end).trim();
    }
  }

  // Fallback: try to extract raw JSON
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}') + 1;
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return content.substring(jsonStart, jsonEnd);
    }
  }

  // Return original content if no markers found
  return content;
}

/**
 * Wrap content with markers for storage
 */
export function wrapWithMarkers(
  content: string,
  beginMarker: string,
  endMarker: string,
): string {
  return `${beginMarker}\n${content}\n${endMarker}`;
}

// ============================================================================
// VTO (Vision/Traction Organizer) Types and Parsing
// ============================================================================

export interface VtoRock {
  title: string;
  metric: string;
  owner: string;
  dueDate: string;
}

export interface VtoData {
  coreValues: string[];
  coreFocus: { purpose: string; niche: string };
  tenYearTarget: string;
  marketingStrategy: {
    targetMarket: string;
    threeUniques: string[];
    provenProcess: string;
    guarantee: string;
  };
  threeYearPicture: {
    futureDate: string;
    revenue: string;
    profit: string;
    bullets: string[];
  };
  oneYearPlan: {
    futureDate: string;
    revenue: string;
    profit: string;
    goals: string[];
  };
  rocks: {
    futureDate: string;
    revenue?: string;
    profit?: string;
    rocks: Array<string | VtoRock>;
  };
  issuesList: string[];
}

const VTO_BEGIN_MARKER = 'VTO_DATA_BEGIN';
const VTO_END_MARKER = 'VTO_DATA_END';

/**
 * Create a default/empty VTO structure
 */
export function createDefaultVto(): VtoData {
  return {
    coreValues: ['', '', ''],
    coreFocus: { purpose: '', niche: '' },
    tenYearTarget: '',
    marketingStrategy: {
      targetMarket: '',
      threeUniques: ['', '', ''],
      provenProcess: '',
      guarantee: '',
    },
    threeYearPicture: {
      futureDate: '',
      revenue: '',
      profit: '',
      bullets: ['', '', '', '', '', '', '', ''],
    },
    oneYearPlan: {
      futureDate: '',
      revenue: '',
      profit: '',
      goals: ['', '', '', '', ''],
    },
    rocks: {
      futureDate: '',
      revenue: '',
      profit: '',
      rocks: ['', '', '', '', ''],
    },
    issuesList: ['', '', '', '', ''],
  };
}

/**
 * Parse VTO content from a string
 */
export function parseVtoContent(
  content: string | null | undefined,
): ParseResult<VtoData> {
  if (!content) {
    return { success: false, data: null, error: 'No content provided' };
  }

  try {
    const jsonStr = extractJsonFromContent(
      content,
      VTO_BEGIN_MARKER,
      VTO_END_MARKER,
    );
    const parsed = JSON.parse(jsonStr) as VtoData;

    // Validate required fields
    if (!parsed || !parsed.coreValues || !parsed.coreFocus) {
      return {
        success: false,
        data: null,
        error: 'Invalid VTO structure: missing coreValues or coreFocus',
      };
    }

    return { success: true, data: parsed };
  } catch (e) {
    return {
      success: false,
      data: null,
      error: e instanceof Error ? e.message : 'Failed to parse VTO content',
    };
  }
}

/**
 * Validate VTO content without full parsing
 */
export function isValidVtoContent(
  content: string | null | undefined,
): boolean {
  return parseVtoContent(content).success;
}

/**
 * Serialize VTO data to wrapped string format
 */
export function serializeVtoContent(data: VtoData): string {
  const json = JSON.stringify(data, null, 2);
  return wrapWithMarkers(json, VTO_BEGIN_MARKER, VTO_END_MARKER);
}

/**
 * Check if VTO has meaningful content (not just defaults)
 */
export function isMeaningfulVto(vto: VtoData | null | undefined): boolean {
  if (!vto) return false;

  const isNonEmpty = (val: unknown): boolean => {
    if (val == null) return false;
    if (typeof val === 'object' && val !== null && 'title' in val) {
      return String((val as { title: string }).title || '').trim().length > 0;
    }
    return String(val).trim().length > 0;
  };

  const hasCoreValues = Array.isArray(vto.coreValues)
    ? vto.coreValues.some(isNonEmpty)
    : false;
  const hasCoreFocus =
    isNonEmpty(vto.coreFocus?.purpose) || isNonEmpty(vto.coreFocus?.niche);
  const hasTenYear = isNonEmpty(vto.tenYearTarget);
  const hasMarketing =
    isNonEmpty(vto.marketingStrategy?.targetMarket) ||
    (vto.marketingStrategy?.threeUniques ?? []).some(isNonEmpty) ||
    isNonEmpty(vto.marketingStrategy?.provenProcess) ||
    isNonEmpty(vto.marketingStrategy?.guarantee);
  const hasThreeYear =
    isNonEmpty(vto.threeYearPicture?.futureDate) ||
    isNonEmpty(vto.threeYearPicture?.revenue) ||
    (vto.threeYearPicture?.bullets ?? []).some(isNonEmpty);
  const hasOneYear =
    isNonEmpty(vto.oneYearPlan?.futureDate) ||
    isNonEmpty(vto.oneYearPlan?.revenue) ||
    (vto.oneYearPlan?.goals ?? []).some(isNonEmpty);
  const hasRocks = (vto.rocks?.rocks ?? []).some(isNonEmpty);
  const hasIssues = (vto.issuesList ?? []).some(isNonEmpty);

  return (
    hasCoreValues ||
    hasCoreFocus ||
    hasTenYear ||
    hasMarketing ||
    hasThreeYear ||
    hasOneYear ||
    hasRocks ||
    hasIssues
  );
}

// ============================================================================
// Chart Types and Parsing
// ============================================================================

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'area' | 'radar';
  title?: string;
  data: {
    labels: string[];
    datasets: ChartDataset[];
  };
  options?: {
    responsive?: boolean;
    plugins?: Record<string, unknown>;
    scales?: Record<string, unknown>;
  };
}

const CHART_BEGIN_MARKER = 'CHART_DATA_BEGIN';
const CHART_END_MARKER = 'CHART_DATA_END';

/**
 * Create a default/empty chart structure
 */
export function createDefaultChart(): ChartData {
  return {
    type: 'bar',
    title: 'New Chart',
    data: {
      labels: ['Category 1', 'Category 2', 'Category 3'],
      datasets: [
        {
          label: 'Dataset 1',
          data: [10, 20, 30],
          backgroundColor: ['#4F46E5', '#10B981', '#F59E0B'],
        },
      ],
    },
  };
}

/**
 * Parse Chart content from a string
 */
export function parseChartContent(
  content: string | null | undefined,
): ParseResult<ChartData> {
  if (!content) {
    return { success: false, data: null, error: 'No content provided' };
  }

  try {
    const jsonStr = extractJsonFromContent(
      content,
      CHART_BEGIN_MARKER,
      CHART_END_MARKER,
    );
    const parsed = JSON.parse(jsonStr) as ChartData;

    // Validate required fields
    if (!parsed || !parsed.type || !parsed.data) {
      return {
        success: false,
        data: null,
        error: 'Invalid chart structure: missing type or data',
      };
    }

    return { success: true, data: parsed };
  } catch (e) {
    return {
      success: false,
      data: null,
      error: e instanceof Error ? e.message : 'Failed to parse chart content',
    };
  }
}

/**
 * Validate Chart content without full parsing
 */
export function isValidChartContent(
  content: string | null | undefined,
): boolean {
  return parseChartContent(content).success;
}

/**
 * Serialize Chart data to wrapped string format
 */
export function serializeChartContent(data: ChartData): string {
  const json = JSON.stringify(data, null, 2);
  return wrapWithMarkers(json, CHART_BEGIN_MARKER, CHART_END_MARKER);
}

// ============================================================================
// Accountability Chart Types and Parsing
// ============================================================================

export interface SeatNode {
  id: string;
  name: string;
  holder: string;
  roles: string[];
  children: SeatNode[];
  accent?: string;
  eos?: {
    gwc?: { getsIt?: boolean; wantsIt?: boolean; capacity?: boolean };
    coreValues?: Array<{ name: string; rating?: number }>;
    rocks?: Array<{
      id: string;
      title: string;
      quarter: string;
      status: 'onTrack' | 'offTrack' | 'done';
      dueDate?: string;
    }>;
    measurables?: Array<{
      id: string;
      name: string;
      target: string;
      unit?: string;
      owner?: string;
    }>;
    issuesCount?: number;
    processes?: Array<{ id: string; name: string; url?: string; docId?: string }>;
    issues?: Array<{ id: string; title: string; status: 'open' | 'solved' }>;
    notes?: string;
  };
}

export interface AccountabilityChartData {
  version: number;
  title?: string;
  root: SeatNode;
}

const AC_BEGIN_MARKER = 'AC_DATA_BEGIN';
const AC_END_MARKER = 'AC_DATA_END';

/**
 * Create a default seat node
 */
export function createDefaultSeat(id?: string): SeatNode {
  return {
    id: id || `seat-${Date.now()}`,
    name: '',
    holder: '',
    roles: [],
    children: [],
  };
}

/**
 * Create a default/empty accountability chart structure
 */
export function createDefaultAccountabilityChart(): AccountabilityChartData {
  return {
    version: 1,
    title: 'Accountability Chart',
    root: {
      id: 'root',
      name: 'Visionary',
      holder: '',
      roles: ['Sets Vision', 'Creative Problem Solver', 'Big Picture'],
      children: [
        {
          id: 'integrator',
          name: 'Integrator',
          holder: '',
          roles: ['Runs Business', 'P&L', 'Leadership Team'],
          children: [],
        },
      ],
    },
  };
}

/**
 * Parse Accountability Chart content from a string
 */
export function parseAccountabilityContent(
  content: string | null | undefined,
): ParseResult<AccountabilityChartData> {
  if (!content) {
    return { success: false, data: null, error: 'No content provided' };
  }

  try {
    const jsonStr = extractJsonFromContent(
      content,
      AC_BEGIN_MARKER,
      AC_END_MARKER,
    );
    const parsed = JSON.parse(jsonStr) as AccountabilityChartData;

    // Validate required fields
    if (!parsed || !parsed.root) {
      return {
        success: false,
        data: null,
        error: 'Invalid accountability chart structure: missing root',
      };
    }

    // Normalize defaults
    if (typeof parsed.version !== 'number') {
      parsed.version = 1;
    }

    return { success: true, data: parsed };
  } catch (e) {
    return {
      success: false,
      data: null,
      error:
        e instanceof Error
          ? e.message
          : 'Failed to parse accountability chart content',
    };
  }
}

/**
 * Validate Accountability Chart content without full parsing
 */
export function isValidAccountabilityContent(
  content: string | null | undefined,
): boolean {
  return parseAccountabilityContent(content).success;
}

/**
 * Serialize Accountability Chart data to wrapped string format
 */
export function serializeAccountabilityContent(
  data: AccountabilityChartData,
): string {
  const json = JSON.stringify(data, null, 2);
  return wrapWithMarkers(json, AC_BEGIN_MARKER, AC_END_MARKER);
}

/**
 * Count total seats in an accountability chart
 */
export function countSeats(node: SeatNode | null | undefined): number {
  if (!node) return 0;
  let count = 1;
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countSeats(child);
    }
  }
  return count;
}

/**
 * Count filled positions (seats with a holder) in an accountability chart
 */
export function countFilledPositions(
  node: SeatNode | null | undefined,
): number {
  if (!node) return 0;
  let count = node.holder?.trim() ? 1 : 0;
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countFilledPositions(child);
    }
  }
  return count;
}

// ============================================================================
// Generic Composer Content Detection
// ============================================================================

export type ComposerContentType = 'vto' | 'chart' | 'accountability' | 'unknown';

/**
 * Detect the type of composer content from a string
 */
export function detectContentType(
  content: string | null | undefined,
): ComposerContentType {
  if (!content) return 'unknown';

  if (
    content.includes(VTO_BEGIN_MARKER) ||
    (content.includes('"coreValues"') && content.includes('"coreFocus"'))
  ) {
    return 'vto';
  }

  if (
    content.includes(CHART_BEGIN_MARKER) ||
    (content.includes('"type"') &&
      content.includes('"data"') &&
      content.includes('"labels"'))
  ) {
    return 'chart';
  }

  if (
    content.includes(AC_BEGIN_MARKER) ||
    (content.includes('"root"') && content.includes('"children"'))
  ) {
    return 'accountability';
  }

  return 'unknown';
}

/**
 * Parse content based on detected type
 */
export function parseComposerContent(
  content: string | null | undefined,
): ParseResult<VtoData | ChartData | AccountabilityChartData> {
  const type = detectContentType(content);

  switch (type) {
    case 'vto':
      return parseVtoContent(content);
    case 'chart':
      return parseChartContent(content);
    case 'accountability':
      return parseAccountabilityContent(content);
    default:
      return { success: false, data: null, error: 'Unknown content type' };
  }
}
