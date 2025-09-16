'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Globe,
  Sparkles,
  Clock,
  AlertCircle,
  CheckCircle,
  Brain,
  Database,
  FileText,
  Activity,
  BookOpen,
  Link,
  FileSearch,
  Loader2,
  Info,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface SearchProgressData {
  type: string;
  totalSearches?: number;
  query?: string;
  currentSearch?: string;
  searchIndex?: number;
  searchesCompleted?: number;
  sites?: Array<{
    url: string;
    title: string;
    citationNumber?: number;
    hasContent?: boolean;
    contentLength?: number;
  }>;
  status?: string;
  sitesFound?: number;
  contentScraped?: number;
  error?: string | null;
  retryAfter?: number | null;
  message?: string;
  delaySeconds?: number;
  phase?: string;
  phaseName?: string;
  phaseDescription?: string;
  phaseIndex?: number;
  totalPhases?: number;
  queriesInPhase?: number;
  estimatedTimeRemaining?: number;
  startTime?: number;
  sourcesFound?: number;
  totalResults?: number;
  costEstimate?: {
    baseCredits: number;
    totalEstimate: number;
    costFactors: string[];
  };
}

interface NexusSearchProgressProps {
  data: SearchProgressData;
}

export function NexusSearchProgress({ data }: NexusSearchProgressProps) {
  const [overallProgress, setOverallProgress] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [statusHistory, setStatusHistory] = useState<string[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Calculate accurate progress based on actual searches completed
  useEffect(() => {
    if (data.searchesCompleted !== undefined && data.totalSearches) {
      const searchProgress =
        (data.searchesCompleted / data.totalSearches) * 100;
      setOverallProgress(searchProgress);

      // Calculate phase-specific progress
      if (
        data.phase === 'research' &&
        data.searchIndex !== undefined &&
        data.totalSearches
      ) {
        const currentSearchProgress =
          ((data.searchIndex + 1) / data.totalSearches) * 100;
        setPhaseProgress(currentSearchProgress);
      } else if (data.phase === 'analyzing') {
        setPhaseProgress(85);
      } else if (data.phase === 'complete' || data.phase === 'generating') {
        setPhaseProgress(95);
      } else if (data.phase === 'planning') {
        setPhaseProgress(5);
      }
    }
  }, [
    data.searchesCompleted,
    data.totalSearches,
    data.searchIndex,
    data.phase,
  ]);

  // Track elapsed time with proper cleanup
  useEffect(() => {
    if (data.startTime) {
      const startTime = data.startTime;
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [data.startTime]);

  // Track status history for transparency
  useEffect(() => {
    if (data.message) {
      setStatusHistory((prev) => [...prev.slice(-4), data.message!]);
    }
  }, [data.message]);

  // Auto-hide completion after delay
  useEffect(() => {
    if (data.type === 'nexus-search-complete') {
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
      }, 10000); // Show for 10 seconds

      return () => clearTimeout(hideTimer);
    }
  }, [data.type]);

  // Handle countdown timers
  useEffect(() => {
    const seconds = data.retryAfter || data.delaySeconds;
    if (seconds) {
      setRetryCountdown(seconds);
      const interval = setInterval(() => {
        setRetryCountdown((prev) => {
          if (prev && prev > 0) return prev - 1;
          return null;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [data.retryAfter, data.delaySeconds]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseIcon = (phase?: string) => {
    switch (phase) {
      case 'planning':
        return <Brain className="w-5 h-5" />;
      case 'research':
        return <Search className="w-5 h-5" />;
      case 'analyzing':
        return <Database className="w-5 h-5" />;
      case 'generating':
      case 'complete':
        return <FileText className="w-5 h-5" />;
      default:
        return <Globe className="w-5 h-5" />;
    }
  };

  const getPhaseColor = (phase?: string) => {
    switch (phase) {
      case 'planning':
        return 'text-blue-500';
      case 'research':
        return 'text-purple-500';
      case 'analyzing':
        return 'text-orange-500';
      case 'generating':
      case 'complete':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  // Render different UI based on event type
  if (data.type === 'nexus-research-plan') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-6 mb-4 border border-purple-500/20"
      >
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-purple-500" />
          <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300">
            Research Plan Generated
          </h3>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Total searches planned:{' '}
            <span className="font-medium">{data.totalSearches}</span>
          </p>
          {(data as any).phases && (
            <p className="text-muted-foreground">
              Research phases:{' '}
              <span className="font-medium">{data.totalPhases}</span>
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  if (data.type === 'nexus-phase-start') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-4"
      >
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-500/20">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-blue-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Phase {(data.phaseIndex || 0) + 1} of {data.totalPhases}:{' '}
                {data.phaseName}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.phaseDescription} ({data.queriesInPhase} searches)
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (
    data.type === 'nexus-search-start' ||
    data.type === 'nexus-phase-update'
  ) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-6 mb-4 border border-purple-500/20"
      >
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
            }}
          >
            {getPhaseIcon(data.phase)}
          </motion.div>
          <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300">
            {data.phase === 'planning'
              ? 'Creating Research Strategy'
              : data.phase === 'research'
                ? 'Conducting Nexus Research'
                : data.phase === 'analyzing'
                  ? 'Analyzing Research Findings'
                  : data.phase === 'complete'
                    ? 'Research Complete'
                    : 'Nexus Research'}
          </h3>
        </div>

        {/* Main Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Overall Progress
            </span>
            <span className="text-sm font-medium">
              {Math.round(overallProgress)}%
            </span>
          </div>
          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute h-full bg-gradient-to-r from-purple-500 to-blue-500"
            />
            {/* Animated progress indicator */}
            <motion.div
              animate={{
                left: `${overallProgress}%`,
                scale: [1, 1.2, 1],
              }}
              transition={{
                left: { duration: 0.5 },
                scale: { duration: 1, repeat: Number.POSITIVE_INFINITY },
              }}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ transform: 'translateX(-50%)' }}
            >
              <div className="w-4 h-4 bg-white dark:bg-gray-900 border-2 border-purple-500 rounded-full shadow-lg" />
            </motion.div>
          </div>

          {/* Phase Indicators */}
          <div className="flex justify-between mt-4">
            {['Planning', 'Researching', 'Analyzing', 'Generating'].map(
              (phase, idx) => {
                const isActive =
                  (data.phase === 'planning' && idx === 0) ||
                  (data.phase === 'research' && idx === 1) ||
                  (data.phase === 'analyzing' && idx === 2) ||
                  (data.phase === 'generating' && idx === 3) ||
                  (data.phase === 'complete' && idx === 3);
                const isPast =
                  (data.phase === 'research' && idx < 1) ||
                  (data.phase === 'analyzing' && idx < 2) ||
                  (data.phase === 'generating' && idx < 3) ||
                  (data.phase === 'complete' && idx <= 3);

                return (
                  <div
                    key={phase}
                    className={`flex flex-col items-center gap-1 transition-colors ${
                      isActive
                        ? 'text-purple-500'
                        : isPast
                          ? 'text-green-500'
                          : 'text-gray-400'
                    }`}
                  >
                    <motion.div
                      animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                      transition={{
                        duration: 1,
                        repeat: Number.POSITIVE_INFINITY,
                      }}
                      className={`w-3 h-3 rounded-full ${
                        isActive
                          ? 'bg-purple-500'
                          : isPast
                            ? 'bg-green-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                    <span className="text-xs font-medium">{phase}</span>
                  </div>
                );
              },
            )}
          </div>
        </div>

        {/* Status Message */}
        {data.message && (
          <div className="mb-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <Info className="w-4 h-4 inline mr-2 text-blue-500" />
              {data.message}
            </p>
          </div>
        )}

        {/* Statistics Grid */}
        <div className="grid grid-cols-3 gap-3">
          {data.totalSearches && (
            <div className="bg-white/30 dark:bg-gray-800/30 rounded-lg p-3">
              <FileSearch className="w-4 h-4 text-purple-500 mb-1" />
              <p className="text-xs text-muted-foreground">Searches</p>
              <p className="text-sm font-medium">
                {data.searchesCompleted || 0} / {data.totalSearches}
              </p>
            </div>
          )}
          {data.sourcesFound !== undefined && (
            <div className="bg-white/30 dark:bg-gray-800/30 rounded-lg p-3">
              <Link className="w-4 h-4 text-blue-500 mb-1" />
              <p className="text-xs text-muted-foreground">Sources</p>
              <p className="text-sm font-medium">{data.sourcesFound}</p>
            </div>
          )}
          {elapsedTime > 0 && (
            <div className="bg-white/30 dark:bg-gray-800/30 rounded-lg p-3">
              <Clock className="w-4 h-4 text-green-500 mb-1" />
              <p className="text-xs text-muted-foreground">Time</p>
              <p className="text-sm font-medium">{formatTime(elapsedTime)}</p>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  if (
    data.type === 'nexus-search-progress' ||
    data.type === 'nexus-search-detail'
  ) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-4"
      >
        <div className="bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-lg p-4 border border-purple-500/10">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={getPhaseColor(data.phase)}>
                {data.status === 'searching' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : data.status === 'scraping' ? (
                  <FileText className="w-5 h-5 animate-pulse" />
                ) : (
                  getPhaseIcon(data.phase)
                )}
              </div>
              <div>
                <span className="text-sm font-medium">
                  Search {(data.searchIndex ?? 0) + 1} of{' '}
                  {data.totalSearches || '...'}
                </span>
                {data.phase && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({data.phase})
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {data.costEstimate && (
                <div className="text-xs text-muted-foreground">
                  ~{data.costEstimate.totalEstimate} credits
                </div>
              )}
              {data.status === 'completed' && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              {data.status === 'rate-limited' && (
                <AlertCircle className="w-4 h-4 text-orange-500" />
              )}
            </div>
          </div>

          {/* Current Search Query */}
          <div className="mb-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded">
            <p className="text-sm text-muted-foreground truncate">
              <Search className="w-3 h-3 inline mr-1" />
              {data.currentSearch || data.query || 'Searching...'}
            </p>
          </div>

          {/* Progress Bar for Current Search */}
          <div className="space-y-2">
            <div className="relative bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              {data.status === 'searching' || data.status === 'scraping' ? (
                <motion.div
                  className="absolute h-full w-full bg-gradient-to-r from-purple-500/30 to-blue-500/30"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{
                    duration: 1.5,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'linear',
                  }}
                />
              ) : (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${phaseProgress}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                />
              )}
            </div>

            {/* Status Row */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3 text-muted-foreground">
                {data.status && (
                  <span className="capitalize">{data.status}</span>
                )}
                {data.sitesFound !== undefined && (
                  <div className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    <span>{data.sitesFound} sites</span>
                  </div>
                )}
                {data.contentScraped !== undefined && (
                  <div className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>{data.contentScraped} scraped</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rate Limit Warning */}
          {data.status === 'rate-limited' && retryCountdown !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 p-2 bg-orange-500/10 rounded flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400"
            >
              <Clock className="w-4 h-4" />
              <span>Rate limited. Retrying in {retryCountdown}s...</span>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  if (data.type === 'nexus-sites-found') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="mb-3"
        >
          <div className="bg-gradient-to-r from-green-500/5 to-blue-500/5 rounded-lg p-3 border border-green-500/10">
            <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
              <Sparkles className="w-3 h-3 inline mr-1" />
              Found {data.sites?.length || 0} sources with content
            </p>
            <div className="flex flex-wrap gap-2">
              {data.sites?.slice(0, 5).map((site, index) => (
                <motion.div
                  key={`${site.url}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white/70 dark:bg-gray-800/70 rounded-md text-xs"
                >
                  <Globe className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  <span className="text-purple-700 dark:text-purple-300 truncate max-w-[150px]">
                    {site.citationNumber && `[${site.citationNumber}] `}
                    {site.title}
                  </span>
                  {site.hasContent && (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  )}
                </motion.div>
              ))}
              {data.sites && data.sites.length > 5 && (
                <span className="text-xs text-muted-foreground px-2 py-1">
                  +{data.sites.length - 5} more
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (data.type === 'nexus-batch-delay') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
            >
              <Clock className="w-5 h-5 text-blue-500" />
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {data.message || 'Preparing next batch...'}
              </p>
              {retryCountdown !== null && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Next batch in</span>
                    <span>{retryCountdown}s</span>
                  </div>
                  <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{
                        duration: data.delaySeconds || 3,
                        ease: 'linear',
                      }}
                      className="h-full bg-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (data.type === 'nexus-search-complete') {
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4"
          >
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-6 border border-green-500/20">
              <div className="flex items-center gap-3 mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                >
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </motion.div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">
                    Research Complete! Generating comprehensive response...
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Analyzed {data.totalResults || 0} sources with full content
                    extraction
                  </p>
                </div>
              </div>

              {/* Final Stats Grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <FileSearch className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Searches</p>
                  <p className="text-sm font-medium">
                    {data.searchesCompleted || 0}
                  </p>
                </div>
                <div className="text-center">
                  <Globe className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Sources</p>
                  <p className="text-sm font-medium">
                    {data.totalResults || 0}
                  </p>
                </div>
                <div className="text-center">
                  <BookOpen className="w-5 h-5 text-green-500 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Cited</p>
                  <p className="text-sm font-medium">
                    {data.sites?.filter((site) => site.citationNumber)
                      ?.length || 0}
                  </p>
                </div>
                <div className="text-center">
                  <Clock className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="text-sm font-medium">
                    {formatTime(elapsedTime)}
                  </p>
                </div>
              </div>

              {/* Final Progress Bar - 100% */}
              <div className="mt-4 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1 }}
                  className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                />
              </div>

              <p className="text-xs text-center text-muted-foreground mt-3">
                <Info className="w-3 h-3 inline mr-1" />
                Now generating a comprehensive, citation-rich response with
                maximum detail...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (data.type === 'nexus-search-error') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-2"
      >
        <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300">
              Search failed: {data.error}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Default/fallback render
  return null;
}
