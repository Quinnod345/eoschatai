'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface Source {
  url: string;
  title: string;
  snippet?: string;
  stage?: 'browsing' | 'extracting' | 'analyzing' | 'complete';
  summary?: string;
}

interface SearchEvent {
  type: string;
  message?: string;
  phase?: string;
  queries?: string[];
  sources?: Source[];
  currentQuery?: string;
  queriesCompleted?: number;
  totalQueries?: number;
  content?: string;
  error?: string;
  data?: any;
}

interface SearchStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

// Helper functions for favicons
function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '/globe.svg';
  }
}

function getDefaultFavicon(_size = 24): string {
  return '/globe.svg';
}

// Component for animated thinking line that cycles through messages
function AnimatedThinkingLine({ messages }: { messages: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (messages.length <= 1) return;

    const cycleDelay = 2000;
    const fadeDelay = 300;

    const cycleMessages = () => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
        setIsVisible(true);
      }, fadeDelay);
    };

    const interval = setInterval(cycleMessages, cycleDelay);
    return () => clearInterval(interval);
  }, [messages]);

  const currentMessage = messages[currentIndex];

  return (
    <div className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
      <div className="w-5 h-5 mt-0.5 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      <span
        className={`text-sm transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        {currentMessage}
      </span>
    </div>
  );
}

// Component for source processing line
function SourceProcessingLine({
  url,
  stage,
  summary,
}: {
  url: string;
  stage: 'browsing' | 'extracting' | 'analyzing' | 'complete';
  summary?: string;
}) {
  const stageLabels = {
    browsing: 'Browsing',
    extracting: 'Extracting',
    analyzing: 'Analyzing',
    complete: 'Complete',
  };

  return (
    <div className="group flex items-start gap-2 text-xs py-1 animate-fade-in">
      <Image
        src={getFaviconUrl(url)}
        alt=""
        width={16}
        height={16}
        className="w-4 h-4 rounded flex-shrink-0 mt-0.5"
        unoptimized
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          img.src = getDefaultFavicon(16);
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-600 dark:text-gray-400 truncate">
          {new URL(url).hostname}
        </div>
        {stage === 'complete' ? (
          summary ? (
            <div className="text-gray-500 dark:text-gray-500 mt-0.5">
              {summary}
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <svg
                className="w-3 h-3 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-gray-500 dark:text-gray-500">Complete</span>
            </div>
          )
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-gray-500 dark:text-gray-500">
              {stageLabels[stage as keyof typeof stageLabels]}...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Found sources group component
function FoundSourcesGroup({
  sources,
  query,
  isExpanded,
  onToggle,
}: {
  sources: Source[];
  query: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <div className="w-5 h-5 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-3 h-3 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <span>
            Found{' '}
            <span className="font-bold text-gray-900 dark:text-gray-100">
              {sources.length} sources
            </span>{' '}
            for "{query}"
          </span>
        </div>
        {sources.length > 0 && (
          <button
            type="button"
            onClick={onToggle}
            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors flex-shrink-0"
            aria-label={isExpanded ? 'Collapse sources' : 'Expand sources'}
          >
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
      </div>
      <div
        className={`ml-7 mt-1 overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded && sources.length > 0
            ? 'max-h-96 opacity-100'
            : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-1">
          {sources.map((source, index) => (
            <div
              key={source.url}
              className="animate-slide-down"
              style={{
                animationDelay: `${index * 50}ms`,
                animationFillMode: 'both',
              }}
            >
              <SourceProcessingLine
                url={source.url}
                stage={source.stage || 'complete'}
                summary={source.summary}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NexusResearchDisplay({ events }: { events: SearchEvent[] }) {
  const [steps, setSteps] = useState<SearchStep[]>([]);
  const [showFinalResult, setShowFinalResult] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const stepsScrollRef = useRef<HTMLDivElement>(null);

  // Format seconds into mm:ss or just ss
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize steps and start timer
  useEffect(() => {
    if (steps.length === 0 && events.length > 0) {
      setSteps([
        {
          id: 'understanding',
          label: 'Understanding request',
          status: 'pending',
        },
        { id: 'planning', label: 'Planning search', status: 'pending' },
        { id: 'searching', label: 'Searching sources', status: 'pending' },
        { id: 'analyzing', label: 'Analyzing content', status: 'pending' },
        { id: 'synthesizing', label: 'Synthesizing answer', status: 'pending' },
        { id: 'complete', label: 'Complete', status: 'pending' },
      ]);
      setStartTime(Date.now());
    }
  }, [events.length, steps.length]);

  // Update timer
  useEffect(() => {
    if (startTime && !showFinalResult) {
      const interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [startTime, showFinalResult]);

  // Update steps based on events
  useEffect(() => {
    const latestPhase = events.findLast((e) => e.phase)?.phase;
    const searchQueries = events
      .filter((e) => e.type === 'nexus-query')
      .flatMap((e) => e.queries || []);

    if (latestPhase) {
      const phases = [
        'understanding',
        'planning',
        'searching',
        'analyzing',
        'synthesizing',
        'complete',
      ];
      const currentPhaseIndex = phases.indexOf(latestPhase);

      setSteps((prev) => {
        const baseSteps = [...prev];

        // Add search query steps dynamically
        if (latestPhase === 'searching' && searchQueries.length > 0) {
          const searchSteps = searchQueries.map((query, idx) => ({
            id: `search-${idx}`,
            label: query.length > 25 ? `${query.substring(0, 25)}…` : query,
            status: 'pending' as const,
          }));

          // Insert search steps after "Searching sources"
          const searchingIndex = baseSteps.findIndex(
            (s) => s.id === 'searching',
          );
          if (searchingIndex !== -1) {
            baseSteps.splice(searchingIndex + 1, 0, ...searchSteps);
          }
        }

        // Update statuses
        return baseSteps.map((step) => {
          const stepPhaseIndex = phases.indexOf(step.id);
          if (stepPhaseIndex !== -1) {
            if (stepPhaseIndex < currentPhaseIndex) {
              return { ...step, status: 'completed' };
            } else if (stepPhaseIndex === currentPhaseIndex) {
              return { ...step, status: 'active' };
            }
          }
          return step;
        });
      });
    }

    // Check if complete
    if (events.some((e) => e.type === 'nexus-search-complete')) {
      setShowFinalResult(true);
    }

    // Count sources
    const totalSources = events.filter((e) => e.type === 'nexus-source').length;
    setScrapedCount(totalSources);
  }, [events]);

  // Auto-scroll
  useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop =
        messagesScrollRef.current.scrollHeight;
    }
  }, [events]);

  useEffect(() => {
    if (stepsScrollRef.current) {
      stepsScrollRef.current.scrollTop = stepsScrollRef.current.scrollHeight;
    }
  }, [steps]);

  const toggleSourceExpansion = (key: string) => {
    setExpandedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const renderEvent = (event: SearchEvent, index: number) => {
    switch (event.type) {
      case 'nexus-phase': {
        const phaseMessages = {
          planning: 'Creating research strategy...',
          searching: 'Executing targeted searches...',
          analyzing: 'Analyzing search results...',
          synthesizing: 'Generating comprehensive research report...',
        };
        return (
          <AnimatedThinkingLine
            messages={[
              phaseMessages[event.phase as keyof typeof phaseMessages] ||
                event.message ||
                '',
            ]}
          />
        );
      }

      case 'nexus-query': {
        return (
          <div className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
            <div className="w-5 h-5 mt-0.5 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-3 h-3 text-orange-600 dark:text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <div className="text-sm">
              <span className="font-medium">Research strategy:</span>
              <ul className="mt-1 space-y-1">
                {event.queries?.map((query, i) => (
                  <li
                    key={`query-${i}-${query.slice(0, 10)}`}
                    className="text-gray-600 dark:text-gray-400"
                  >
                    • {query}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      }

      case 'nexus-progress': {
        return (
          <div className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
            <div className="w-5 h-5 mt-0.5 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-3 h-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <span className="text-sm">
              Search {event.queriesCompleted || 0} of {event.totalQueries || 0}:{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                "{event.currentQuery}"
              </span>
            </span>
          </div>
        );
      }

      case 'nexus-source': {
        // Group sources by query
        const query =
          events
            .slice(0, index)
            .filter((e) => e.type === 'nexus-progress')
            .pop()?.currentQuery || 'Unknown query';

        const sourcesForQuery = events
          .slice(0, index + 1)
          .filter((e) => e.type === 'nexus-source')
          .map((e) => e.data?.source || { url: '', title: '', snippet: '' });

        const key = `sources-${index}`;

        return (
          <FoundSourcesGroup
            sources={sourcesForQuery}
            query={query}
            isExpanded={expandedSources.has(key)}
            onToggle={() => toggleSourceExpansion(key)}
          />
        );
      }

      case 'nexus-error': {
        return (
          <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
            <div className="w-5 h-5 mt-0.5 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="text-sm">
              <span className="font-medium">Error: </span>
              <span>{event.error || event.message}</span>
            </div>
          </div>
        );
      }

      default:
        if (event.message) {
          return (
            <div className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
              <div className="w-5 h-5 mt-0.5 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className="text-sm">{event.message}</span>
            </div>
          );
        }
        return null;
    }
  };

  return (
    <div className="flex h-[500px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Steps sidebar */}
      <div className="w-56 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0 flex flex-col">
        {/* Progress header */}
        <div className="p-4 pb-2">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Progress
              </h4>
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-gray-500 dark:text-gray-500">
                Sources found
              </span>
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                {scrapedCount}
              </span>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div
          className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4"
          ref={stepsScrollRef}
        >
          <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
            <div className="relative pl-6">
              {steps.map((step, index) => (
                <div
                  key={`step-${step.id}-${index}`}
                  className="relative animate-fade-in opacity-0"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: 'forwards',
                  }}
                >
                  <div className="relative flex items-start gap-2 mb-6">
                    <div className="absolute left-[-24px] flex-shrink-0 mt-0.5">
                      {step.status === 'completed' ? (
                        <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shadow-sm animate-scale-in">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      ) : step.status === 'active' ? (
                        <div className="w-5 h-5 rounded-full bg-orange-400 animate-pulse shadow-sm" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600" />
                      )}
                    </div>

                    <div className="flex-1">
                      <p
                        className={`text-xs leading-tight transition-all ${
                          step.status === 'active'
                            ? 'font-medium text-gray-900 dark:text-gray-100'
                            : step.status === 'completed'
                              ? 'text-gray-700 dark:text-gray-300'
                              : 'text-gray-500 dark:text-gray-500'
                        }`}
                      >
                        {step.label}
                      </p>
                      {step.status === 'active' && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          Processing...
                        </p>
                      )}
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <div
                      className={`absolute left-[-14px] top-[20px] h-[calc(100%+8px)] w-0.5 transition-all duration-300 ${
                        index <
                        steps.filter((s) => s.status === 'completed').length
                          ? 'bg-orange-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div
        className="flex-1 p-8 overflow-y-auto scrollbar-hide"
        ref={messagesScrollRef}
      >
        <div className="max-w-4xl">
          <div className="space-y-3">
            {events
              .filter((e) => e.type !== 'nexus-search-complete')
              .map((event, i) => (
                <div
                  key={`event-${i}-${event.type}`}
                  className="animate-fade-in"
                >
                  {renderEvent(event, i)}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
