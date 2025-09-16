'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// Define SearchProgress interface locally
export interface SearchProgress {
  status: 'idle' | 'searching' | 'processing' | 'completed' | 'error';
  query?: string;
  currentSearch?: string;
  searchesCompleted: number;
  totalSearches: number;
  sitesVisited: Array<{
    url: string;
    title: string;
    status: 'pending' | 'visiting' | 'completed' | 'error';
  }>;
  error?: string;
}

interface CitationReference {
  number: number;
  title: string;
  url: string;
  snippet?: string;
}

export function useWebSearchProgress() {
  const [searchProgress, setSearchProgress] = useState<SearchProgress>({
    status: 'idle',
    searchesCompleted: 0,
    totalSearches: 0,
    sitesVisited: [],
  });

  const [citations, setCitations] = useState<CitationReference[]>([]);

  // Throttling refs to prevent too many updates
  const lastUpdateTime = useRef(0);
  const updateQueue = useRef<any[]>([]);
  const updateTimer = useRef<NodeJS.Timeout | null>(null);

  // Throttled update function
  const throttledUpdate = useCallback((updateFn: () => void) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime.current;

    // If enough time has passed, update immediately
    if (timeSinceLastUpdate >= 100) {
      // 100ms throttle
      updateFn();
      lastUpdateTime.current = now;
    } else {
      // Queue the update
      updateQueue.current.push(updateFn);

      // Set a timer to process queued updates
      if (!updateTimer.current) {
        updateTimer.current = setTimeout(() => {
          // Process the latest update from the queue
          if (updateQueue.current.length > 0) {
            const latestUpdate =
              updateQueue.current[updateQueue.current.length - 1];
            latestUpdate();
            lastUpdateTime.current = Date.now();
          }
          updateQueue.current = [];
          updateTimer.current = null;
        }, 100 - timeSinceLastUpdate);
      }
    }
  }, []);

  // Listen for mode-clear events to reset all search-related state
  useEffect(() => {
    const handleModeClear = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { previousMode, newMode } = customEvent.detail || {};

      console.log('[WebSearchProgress] Mode clear event received:', {
        previousMode,
        newMode,
        timestamp: new Date().toISOString(),
      });

      // Clear search state for any mode transition to ensure clean slate
      if (previousMode !== newMode) {
        console.log(
          `[WebSearchProgress] Clearing all search progress and citations for ${previousMode} → ${newMode} transition`,
        );

        // Reset search progress to initial state
        setSearchProgress({
          status: 'idle',
          searchesCompleted: 0,
          totalSearches: 0,
          sitesVisited: [],
        });

        // Clear all citations
        setCitations([]);

        console.log(
          '[WebSearchProgress] Search progress and citations cleared successfully',
        );
      }
    };

    // Add the event listener
    window.addEventListener('mode-clear', handleModeClear);

    // Cleanup
    return () => {
      window.removeEventListener('mode-clear', handleModeClear);
      // Clear any pending timers
      if (updateTimer.current) {
        clearTimeout(updateTimer.current);
      }
    };
  }, []);

  const handleSearchStart = useCallback(
    (totalSearches: number) => {
      console.log(
        `[WebSearchProgress] Starting search with ${totalSearches} queries`,
      );
      throttledUpdate(() => {
        setSearchProgress({
          status: 'searching',
          searchesCompleted: 0,
          totalSearches,
          sitesVisited: [],
        });
      });
    },
    [throttledUpdate],
  );

  const handleSearchProgress = useCallback(
    (data: {
      currentSearch: string;
      searchIndex: number;
      searchesCompleted: number;
      totalSearches?: number;
    }) => {
      console.log(`[WebSearchProgress] Progress update:`, data);
      throttledUpdate(() => {
        setSearchProgress((prev) => ({
          ...prev,
          status: 'searching',
          currentSearch: data.currentSearch,
          searchesCompleted: data.searchesCompleted,
          totalSearches: data.totalSearches || prev.totalSearches,
        }));
      });
    },
    [throttledUpdate],
  );

  const handleSearchDetail = useCallback(
    (data: {
      searchIndex: number;
      query: string;
      status: string;
      sitesFound?: number;
      error?: string;
    }) => {
      console.log(`[WebSearchProgress] Search detail:`, data);
      if (data.error) {
        throttledUpdate(() => {
          setSearchProgress((prev) => ({
            ...prev,
            status: 'error',
            error: data.error,
          }));
        });
      }
    },
    [throttledUpdate],
  );

  const handleSitesFound = useCallback(
    (data: {
      searchIndex: number;
      sites: Array<{ url: string; title: string }>;
    }) => {
      console.log(`[WebSearchProgress] Sites found:`, data.sites.length);
      throttledUpdate(() => {
        setSearchProgress((prev) => ({
          ...prev,
          sitesVisited: [
            ...prev.sitesVisited,
            ...data.sites.map((site) => ({
              ...site,
              status: 'completed' as const,
            })),
          ],
        }));
      });
    },
    [throttledUpdate],
  );

  const handleSearchComplete = useCallback(
    (data: {
      totalResults: number;
      results?: any[];
      citations?: CitationReference[];
    }) => {
      console.log(
        `[WebSearchProgress] Search complete with ${data.totalResults} results`,
      );
      setSearchProgress((prev) => ({
        ...prev,
        status: 'completed',
        searchesCompleted: prev.totalSearches,
      }));

      // Store citations if provided
      if (data.citations) {
        setCitations(data.citations);
      }

      // Reset search progress after a delay, but keep citations
      setTimeout(() => {
        setSearchProgress({
          status: 'idle',
          searchesCompleted: 0,
          totalSearches: 0,
          sitesVisited: [],
        });
      }, 3000);
    },
    [],
  );

  const handleSearchError = useCallback((error: string) => {
    console.error(`[WebSearchProgress] Search error:`, error);
    setSearchProgress((prev) => ({
      ...prev,
      status: 'error',
      error,
    }));
  }, []);

  const handlePhaseUpdate = useCallback(
    (data: {
      phase: 'research' | 'generating';
      message: string;
    }) => {
      console.log(`[WebSearchProgress] Phase update:`, data);
      setSearchProgress((prev) => ({
        ...prev,
        status: data.phase === 'research' ? 'searching' : 'processing',
        currentSearch: data.message,
      }));
    },
    [],
  );

  const handleCompleteResponse = useCallback(
    (data: {
      content: string;
      citations: CitationReference[];
    }) => {
      console.log(`[WebSearchProgress] Complete response received`);
      // Store citations
      setCitations(data.citations || []);

      // Mark as completed
      setSearchProgress({
        status: 'completed',
        searchesCompleted: 0,
        totalSearches: 0,
        sitesVisited: [],
      });
    },
    [],
  );

  const processDataStreamMessage = useCallback(
    (data: any) => {
      if (!data.type?.startsWith('nexus-')) return;

      console.log(`[WebSearchProgress] Data stream message:`, data);

      switch (data.type) {
        case 'nexus-query':
          // Initialize based on planned queries if start event wasn't sent
          if (Array.isArray(data.queries)) {
            handleSearchStart(data.queries.length);
          }
          break;
        case 'nexus-progress':
          handleSearchProgress({
            currentSearch: data.currentQuery,
            searchIndex: data.queriesCompleted,
            searchesCompleted: data.queriesCompleted,
            totalSearches: data.totalQueries,
          });
          break;
        case 'nexus-phase':
          // Treat generic phase updates as processing status
          handlePhaseUpdate({
            phase:
              data.phase === 'searching' || data.phase === 'research'
                ? 'research'
                : 'generating',
            message: data.message || data.phase,
          });
          break;
        case 'nexus-search-start':
          handleSearchStart(data.totalSearches);
          break;
        case 'nexus-search-progress':
          handleSearchProgress({
            currentSearch: data.currentQuery,
            searchIndex: data.queriesCompleted,
            searchesCompleted: data.queriesCompleted,
            totalSearches: data.totalQueries,
          });
          break;
        case 'nexus-search-detail':
          handleSearchDetail(data);
          break;
        case 'nexus-source':
          // Append a single visited site based on source
          throttledUpdate(() => {
            setSearchProgress((prev) => ({
              ...prev,
              sitesVisited: [
                ...prev.sitesVisited,
                {
                  url: data?.data?.source?.url,
                  title: data?.data?.source?.title,
                  status: 'completed' as const,
                },
              ],
            }));
          });
          break;
        case 'nexus-sites-found':
          handleSitesFound(data);
          break;
        case 'nexus-search-complete':
          handleSearchComplete(data);
          break;
        case 'nexus-search-error':
        case 'nexus-error':
          handleSearchError(data.error);
          break;
        case 'nexus-phase-update':
          handlePhaseUpdate(data);
          break;
        case 'nexus-complete-response':
          handleCompleteResponse(data);
          break;
      }
    },
    [
      handleSearchStart,
      handleSearchProgress,
      handleSearchDetail,
      handleSitesFound,
      handleSearchComplete,
      handleSearchError,
      handlePhaseUpdate,
      handleCompleteResponse,
    ],
  );

  return {
    searchProgress,
    citations,
    processDataStreamMessage,
  };
}
