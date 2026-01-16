'use client';

import { useState, useCallback, useRef } from 'react';
import type {
  NexusSearchEvent,
  NexusResearchPlanData,
  NexusCitation,
  NexusSearchState,
} from './types';

/**
 * Custom hook for managing Nexus search state and events
 */
export function useNexusSearch() {
  const [searchData, setSearchData] = useState<NexusSearchEvent | null>(null);
  const [researchPlan, setResearchPlan] =
    useState<NexusResearchPlanData | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [searchEvents, setSearchEvents] = useState<NexusSearchEvent[]>([]);
  const [citations, setCitations] = useState<NexusCitation[]>([]);
  const [nexusStreamId, setNexusStreamId] = useState<string | null>(null);

  // Track processed events to avoid duplicates
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  /**
   * Process a Nexus search event from the data stream
   */
  const processNexusEvent = useCallback((data: NexusSearchEvent) => {
    // Create a unique ID for this event to prevent duplicates
    const eventId = JSON.stringify({
      type: data.type,
      query: data.query,
      resultsCount: data.results?.length,
    });

    // Skip if we've already processed this event
    if (processedEventIdsRef.current.has(eventId)) {
      return;
    }
    processedEventIdsRef.current.add(eventId);

    // Handle different event types
    switch (data.type) {
      case 'nexus-plan':
        if (data.plan) {
          setResearchPlan(data.plan);
        }
        break;

      case 'nexus-search-start':
      case 'nexus-search-result':
        setSearchData(data);
        setSearchEvents((prev) => [...prev, data]);
        break;

      case 'nexus-follow-up':
        if (data.followUpQuestions) {
          setFollowUpQuestions(data.followUpQuestions);
        }
        break;

      case 'nexus-citations':
        if (data.citations) {
          setCitations(data.citations);
        }
        break;

      case 'nexus-complete':
        // Final event - research complete
        if (data.followUpQuestions) {
          setFollowUpQuestions(data.followUpQuestions);
        }
        if (data.citations) {
          setCitations(data.citations);
        }
        break;
    }
  }, []);

  /**
   * Clear all Nexus search state
   */
  const clearNexusState = useCallback(() => {
    setSearchData(null);
    setResearchPlan(null);
    setFollowUpQuestions([]);
    setSearchEvents([]);
    setCitations([]);
    setNexusStreamId(null);
    processedEventIdsRef.current.clear();
  }, []);

  /**
   * Get current state snapshot
   */
  const getState = useCallback(
    (): NexusSearchState => ({
      searchData,
      researchPlan,
      followUpQuestions,
      searchEvents,
      citations,
    }),
    [searchData, researchPlan, followUpQuestions, searchEvents, citations],
  );

  return {
    // State
    searchData,
    researchPlan,
    followUpQuestions,
    searchEvents,
    citations,
    nexusStreamId,

    // Setters
    setSearchData,
    setResearchPlan,
    setFollowUpQuestions,
    setSearchEvents,
    setCitations,
    setNexusStreamId,

    // Actions
    processNexusEvent,
    clearNexusState,
    getState,
  };
}


