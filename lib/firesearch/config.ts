/**
 * Firesearch Configuration
 * Central configuration for Firesearch integration
 */

import type { FiresearchConfig } from './types';

/**
 * Get Firesearch configuration from environment
 */
export function getFiresearchConfig(): FiresearchConfig {
  const config: FiresearchConfig = {
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    maxDepth: Number.parseInt(process.env.FIRESEARCH_MAX_DEPTH || '3'),
    maxSources: Number.parseInt(process.env.FIRESEARCH_MAX_SOURCES || '20'),
    timeout: Number.parseInt(process.env.FIRESEARCH_TIMEOUT || '120000'), // 2 minutes
    followUpQuestions: process.env.FIRESEARCH_FOLLOWUP !== 'false',
    streaming: process.env.FIRESEARCH_STREAMING !== 'false',
  };

  // Validate required configuration
  if (!config.firecrawlApiKey) {
    throw new Error('FIRECRAWL_API_KEY is required for Firesearch');
  }

  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for Firesearch');
  }

  return config;
}

/**
 * Research depth presets
 */
export const RESEARCH_DEPTH_PRESETS = {
  quick: {
    maxDepth: 1,
    maxSources: 5,
    searchQueries: 2,
    timeout: 30000,
  },
  standard: {
    maxDepth: 2,
    maxSources: 15,
    searchQueries: 6,
    timeout: 60000,
  },
  deep: {
    maxDepth: 4,
    maxSources: 50,
    searchQueries: 15,
    timeout: 180000,
  },
  comprehensive: {
    maxDepth: 6,
    maxSources: 100,
    searchQueries: 25,
    timeout: 300000,
  },
} as const;

/**
 * Cost estimation for research depths
 */
export const RESEARCH_COST_ESTIMATES = {
  quick: {
    credits: 100,
    duration: '30 seconds',
  },
  standard: {
    credits: 200,
    duration: '1-2 minutes',
  },
  deep: {
    credits: 400,
    duration: '2-3 minutes',
  },
  comprehensive: {
    credits: 600,
    duration: '3-5 minutes',
  },
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  // Searches per hour per user
  searchesPerHour: Number.parseInt(process.env.FIRESEARCH_RATE_LIMIT || '10'),
  // Concurrent searches per user
  concurrentSearches: Number.parseInt(process.env.FIRESEARCH_CONCURRENT || '1'),
  // Cache TTL in seconds
  cacheTTL: Number.parseInt(process.env.FIRESEARCH_CACHE_TTL || '3600'), // 1 hour
} as const;
