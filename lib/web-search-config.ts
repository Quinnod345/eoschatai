// Firecrawl Search Configuration for Nexus Deep Research Mode
// Based on https://docs.firecrawl.dev/features/search

export interface FirecrawlSearchConfig {
  limit: number;
  scrapeOptions: {
    formats: string[];
    timeout?: number;
    parsePDF?: boolean;
    proxy?: 'basic' | 'stealth';
    onlyMainContent?: boolean;
    waitFor?: number;
    headers?: Record<string, string>;
  };
  location?: string;
  tbs?: string; // Time-based search filtering
}

export interface SearchContext {
  type:
    | 'general'
    | 'technical'
    | 'recent'
    | 'academic'
    | 'news'
    | 'comprehensive';
  priority: 'speed' | 'quality' | 'comprehensive';
  location?: string;
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  depth?: 'shallow' | 'medium' | 'deep';
}

// Firecrawl time-based search (tbs) mappings
export const TIME_FILTERS = {
  hour: 'qdr:h',
  day: 'qdr:d',
  week: 'qdr:w',
  month: 'qdr:m',
  year: 'qdr:y',
  all: undefined, // No time filter
} as const;

// Optimized configurations for Nexus Deep Research Mode
export const SEARCH_CONFIGS = {
  // Initial exploration - comprehensive with full content
  DEEP_RESEARCH_INITIAL: {
    limit: 10,
    scrapeOptions: {
      formats: ['markdown', 'links', 'html'],
      timeout: 45000,
      parsePDF: true,
      proxy: 'stealth' as const, // Use stealth for better access
      onlyMainContent: false, // Get full page content
      waitFor: 3000, // Wait for dynamic content
    },
    tbs: TIME_FILTERS.year,
  },

  // Follow-up searches - balanced approach
  DEEP_RESEARCH_FOLLOWUP: {
    limit: 7,
    scrapeOptions: {
      formats: ['markdown', 'links'],
      timeout: 30000,
      parsePDF: false,
      proxy: 'basic' as const,
      onlyMainContent: true,
      waitFor: 2000,
    },
    tbs: TIME_FILTERS.year,
  },

  // Targeted search for specific information
  DEEP_RESEARCH_TARGETED: {
    limit: 5,
    scrapeOptions: {
      formats: ['markdown'],
      timeout: 25000,
      parsePDF: false,
      proxy: 'basic' as const,
      onlyMainContent: true,
      waitFor: 1500,
    },
    tbs: TIME_FILTERS.month,
  },

  // Latest information and trends
  DEEP_RESEARCH_RECENT: {
    limit: 8,
    scrapeOptions: {
      formats: ['markdown', 'links'],
      timeout: 30000,
      parsePDF: false,
      proxy: 'basic' as const,
      onlyMainContent: false,
      waitFor: 2000,
    },
    tbs: TIME_FILTERS.week,
  },

  // Technical documentation and code
  TECHNICAL_DEEP: {
    limit: 7,
    scrapeOptions: {
      formats: ['markdown', 'links', 'html'],
      timeout: 40000,
      parsePDF: true,
      proxy: 'stealth' as const,
      onlyMainContent: false,
      waitFor: 2500,
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    },
    tbs: TIME_FILTERS.year,
  },

  // Academic and research papers
  ACADEMIC_DEEP: {
    limit: 6,
    scrapeOptions: {
      formats: ['markdown', 'links', 'html'],
      timeout: 50000,
      parsePDF: true, // Critical for academic papers
      proxy: 'stealth' as const,
      onlyMainContent: false,
      waitFor: 3000,
    },
    tbs: TIME_FILTERS.all, // No time restriction for academic content
  },

  // Speed-optimized for quick overview
  QUICK_OVERVIEW: {
    limit: 3,
    scrapeOptions: {
      formats: ['markdown'],
      timeout: 15000,
      parsePDF: false,
      onlyMainContent: true,
      waitFor: 1000,
    },
    tbs: TIME_FILTERS.month,
  },
} as const;

/**
 * Generate optimal Firecrawl search configuration based on context
 */
export function getOptimalSearchConfig(
  context: SearchContext,
): FirecrawlSearchConfig {
  let baseConfig: FirecrawlSearchConfig;

  // Select configuration based on type and priority
  if (
    context.type === 'comprehensive' ||
    context.priority === 'comprehensive'
  ) {
    baseConfig = { ...SEARCH_CONFIGS.DEEP_RESEARCH_INITIAL };
  } else if (context.type === 'technical') {
    baseConfig = { ...SEARCH_CONFIGS.TECHNICAL_DEEP };
  } else if (context.type === 'academic') {
    baseConfig = { ...SEARCH_CONFIGS.ACADEMIC_DEEP };
  } else if (context.type === 'recent' || context.type === 'news') {
    baseConfig = { ...SEARCH_CONFIGS.DEEP_RESEARCH_RECENT };
  } else if (context.priority === 'speed') {
    baseConfig = { ...SEARCH_CONFIGS.QUICK_OVERVIEW };
  } else {
    // Default to follow-up configuration
    baseConfig = { ...SEARCH_CONFIGS.DEEP_RESEARCH_FOLLOWUP };
  }

  // Adjust based on depth preference
  if (context.depth === 'deep') {
    baseConfig.limit = Math.min(15, baseConfig.limit + 3);
    baseConfig.scrapeOptions.timeout =
      (baseConfig.scrapeOptions.timeout || 30000) + 10000;
    baseConfig.scrapeOptions.proxy = 'stealth';
    baseConfig.scrapeOptions.parsePDF = true;
  } else if (context.depth === 'shallow') {
    baseConfig.limit = Math.max(3, baseConfig.limit - 2);
    baseConfig.scrapeOptions.timeout = Math.max(
      15000,
      (baseConfig.scrapeOptions.timeout || 30000) - 10000,
    );
    baseConfig.scrapeOptions.onlyMainContent = true;
    baseConfig.scrapeOptions.parsePDF = false;
  }

  // Apply location if specified
  if (context.location) {
    baseConfig.location = context.location;
  }

  // Apply timeframe if specified
  if (context.timeframe && context.timeframe !== 'all') {
    baseConfig.tbs = TIME_FILTERS[context.timeframe];
  }

  return baseConfig;
}

/**
 * Get adaptive search configuration for Nexus mode based on search phase
 */
export function getNexusSearchConfig(
  searchIndex: number,
  totalSearches: number,
): FirecrawlSearchConfig {
  const searchPhase = getSearchPhase(searchIndex, totalSearches);

  switch (searchPhase) {
    case 'initial':
      // First searches: comprehensive with full content extraction
      return {
        ...SEARCH_CONFIGS.DEEP_RESEARCH_INITIAL,
        limit: 10,
        scrapeOptions: {
          ...SEARCH_CONFIGS.DEEP_RESEARCH_INITIAL.scrapeOptions,
          formats: ['markdown', 'links', 'html', 'screenshot'],
        },
      };

    case 'exploration':
      // Middle searches: balanced depth and breadth
      return {
        ...SEARCH_CONFIGS.DEEP_RESEARCH_FOLLOWUP,
        limit: 7,
      };

    case 'targeted':
      // Late searches: focused on specific gaps
      return {
        ...SEARCH_CONFIGS.DEEP_RESEARCH_TARGETED,
        limit: 5,
      };

    case 'final':
      // Final searches: recent updates and verification
      return {
        ...SEARCH_CONFIGS.DEEP_RESEARCH_RECENT,
        limit: 5,
        scrapeOptions: {
          ...SEARCH_CONFIGS.DEEP_RESEARCH_RECENT.scrapeOptions,
          timeout: 20000, // Faster for final searches
        },
      };

    default:
      return SEARCH_CONFIGS.DEEP_RESEARCH_FOLLOWUP;
  }
}

/**
 * Determine search phase based on index and total
 */
function getSearchPhase(
  searchIndex: number,
  totalSearches: number,
): 'initial' | 'exploration' | 'targeted' | 'final' {
  const progress = searchIndex / totalSearches;

  if (searchIndex < 2) {
    return 'initial';
  } else if (progress < 0.5) {
    return 'exploration';
  } else if (progress < 0.8) {
    return 'targeted';
  } else {
    return 'final';
  }
}

/**
 * Estimate API costs based on configuration
 * Based on Firecrawl pricing: https://docs.firecrawl.dev/features/search#cost-implications
 */
export function estimateSearchCost(config: FirecrawlSearchConfig): {
  baseCredits: number;
  additionalCredits: number;
  totalEstimate: number;
  costFactors: string[];
} {
  const baseCredits = config.limit; // 1 credit per search result
  let additionalCredits = 0;
  const costFactors: string[] = [];

  // Scraping costs (1 credit per page scraped)
  if (config.scrapeOptions) {
    additionalCredits += config.limit; // Each result gets scraped
    costFactors.push(`Scraping: +${config.limit} credits`);
  }

  // PDF parsing costs (1 credit per PDF page - estimated 5 pages average)
  if (config.scrapeOptions?.parsePDF) {
    const estimatedPdfCredits = Math.floor(config.limit * 0.3 * 5); // Assume 30% are PDFs with 5 pages
    additionalCredits += estimatedPdfCredits;
    costFactors.push(`PDF parsing: +${estimatedPdfCredits} credits (est.)`);
  }

  // Stealth proxy costs (+4 credits per result)
  if (config.scrapeOptions?.proxy === 'stealth') {
    const stealthCredits = config.limit * 4;
    additionalCredits += stealthCredits;
    costFactors.push(`Stealth proxy: +${stealthCredits} credits`);
  }

  // Basic proxy costs (minimal additional cost)
  if (config.scrapeOptions?.proxy === 'basic') {
    costFactors.push('Basic proxy: minimal additional cost');
  }

  // Screenshot costs (if requested)
  if (config.scrapeOptions?.formats?.includes('screenshot')) {
    const screenshotCredits = config.limit * 2;
    additionalCredits += screenshotCredits;
    costFactors.push(`Screenshots: +${screenshotCredits} credits`);
  }

  return {
    baseCredits,
    additionalCredits,
    totalEstimate: baseCredits + additionalCredits,
    costFactors,
  };
}

/**
 * Get configuration presets for different research depths
 */
export const RESEARCH_DEPTH_PRESETS = {
  QUICK: {
    maxSearches: 3,
    maxResultsPerSearch: 3,
    scrapeDepth: 'shallow',
    estimatedTime: '30 seconds',
    estimatedCredits: 15,
  },
  STANDARD: {
    maxSearches: 5,
    maxResultsPerSearch: 5,
    scrapeDepth: 'medium',
    estimatedTime: '1-2 minutes',
    estimatedCredits: 50,
  },
  DEEP: {
    maxSearches: 8,
    maxResultsPerSearch: 7,
    scrapeDepth: 'deep',
    estimatedTime: '2-3 minutes',
    estimatedCredits: 120,
  },
  COMPREHENSIVE: {
    maxSearches: 12,
    maxResultsPerSearch: 10,
    scrapeDepth: 'deep',
    estimatedTime: '3-5 minutes',
    estimatedCredits: 200,
  },
} as const;
