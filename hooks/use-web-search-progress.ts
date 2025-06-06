'use client';

import { useState, useCallback, useEffect } from 'react';

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

  // Listen for nexus-clear events to reset all search-related state
  useEffect(() => {
    const handleNexusClear = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { previousMode, newMode } = customEvent.detail || {};

      console.log('[WebSearchProgress] Nexus clear event received:', {
        previousMode,
        newMode,
        timestamp: new Date().toISOString(),
      });

      // Only clear if switching from nexus to standard mode
      if (previousMode === 'nexus' && newMode === 'off') {
        console.log(
          '[WebSearchProgress] Clearing all search progress and citations',
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
    window.addEventListener('nexus-clear', handleNexusClear);

    // Cleanup
    return () => {
      window.removeEventListener('nexus-clear', handleNexusClear);
    };
  }, []);

  const handleSearchStart = useCallback((totalSearches: number) => {
    console.log(
      `[WebSearchProgress] Starting search with ${totalSearches} queries`,
    );
    setSearchProgress({
      status: 'searching',
      searchesCompleted: 0,
      totalSearches,
      sitesVisited: [],
    });
  }, []);

  const handleSearchProgress = useCallback(
    (data: {
      currentSearch: string;
      searchIndex: number;
      searchesCompleted: number;
    }) => {
      console.log(`[WebSearchProgress] Progress update:`, data);
      setSearchProgress((prev) => ({
        ...prev,
        status: 'searching',
        currentSearch: data.currentSearch,
        searchesCompleted: data.searchesCompleted,
      }));
    },
    [],
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
        setSearchProgress((prev) => ({
          ...prev,
          status: 'error',
          error: data.error,
        }));
      }
    },
    [],
  );

  const handleSitesFound = useCallback(
    (data: {
      searchIndex: number;
      sites: Array<{ url: string; title: string }>;
    }) => {
      console.log(`[WebSearchProgress] Sites found:`, data.sites.length);
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
    },
    [],
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

  const processDataStreamMessage = useCallback(
    (data: any) => {
      if (!data.type?.startsWith('nexus-')) return;

      console.log(`[WebSearchProgress] Data stream message:`, data);

      switch (data.type) {
        case 'nexus-search-start':
          handleSearchStart(data.totalSearches);
          break;
        case 'nexus-search-progress':
          handleSearchProgress(data);
          break;
        case 'nexus-search-detail':
          handleSearchDetail(data);
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
      }
    },
    [
      handleSearchStart,
      handleSearchProgress,
      handleSearchDetail,
      handleSitesFound,
      handleSearchComplete,
      handleSearchError,
    ],
  );

  return {
    searchProgress,
    citations,
    processDataStreamMessage,
  };
}
