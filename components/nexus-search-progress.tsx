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
  TrendingUp,
  Zap,
  BarChart3,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface SearchProgressData {
  type: string;
  totalSearches?: number;
  query?: string;
  currentSearch?: string;
  searchIndex?: number;
  searchesCompleted?: number;
  sites?: Array<{ url: string; title: string }>;
  status?: string;
  sitesFound?: number;
  error?: string | null;
  retryAfter?: number | null;
  message?: string;
  delaySeconds?: number;
  phase?: 'planning' | 'research' | 'analyzing' | 'generating';
  estimatedTimeRemaining?: number;
  startTime?: number;
  sourcesFound?: number;
}

interface NexusSearchProgressProps {
  data: SearchProgressData;
}

export function NexusSearchProgress({ data }: NexusSearchProgressProps) {
  const [progress, setProgress] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (data.searchesCompleted && data.totalSearches) {
      setProgress((data.searchesCompleted / data.totalSearches) * 100);
    }
  }, [data.searchesCompleted, data.totalSearches]);

  // Track elapsed time
  useEffect(() => {
    if (data.startTime) {
      const startTime = data.startTime; // Capture to avoid null check issues
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [data.startTime]);

  // Auto-hide the complete dialog after 5 seconds
  useEffect(() => {
    if (data.type === 'nexus-search-complete') {
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
      }, 5000);

      return () => clearTimeout(hideTimer);
    }
  }, [data.type]);

  useEffect(() => {
    if (data.retryAfter) {
      setRetryCountdown(data.retryAfter);
      const interval = setInterval(() => {
        setRetryCountdown((prev) => {
          if (prev && prev > 0) return prev - 1;
          return null;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [data.retryAfter]);

  useEffect(() => {
    if (data.delaySeconds) {
      setRetryCountdown(data.delaySeconds);
      const interval = setInterval(() => {
        setRetryCountdown((prev) => {
          if (prev && prev > 0) return prev - 1;
          return null;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [data.delaySeconds]);

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
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  const getPhaseProgress = (phase?: string) => {
    switch (phase) {
      case 'planning':
        return 10;
      case 'research':
        return 40 + progress * 0.4; // 40-80%
      case 'analyzing':
        return 80 + progress * 0.1; // 80-90%
      case 'generating':
        return 90 + progress * 0.1; // 90-100%
      default:
        return 0;
    }
  };

  if (data.type === 'nexus-search-start') {
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
            <Globe className="w-6 h-6 text-purple-500" />
          </motion.div>
          <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300">
            Nexus Research Mode Activated
          </h3>
        </div>

        {/* Research Timeline */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Research Progress
            </span>
            <span className="text-sm font-medium">0%</span>
          </div>
          <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '10%' }}
              transition={{ duration: 1 }}
              className="absolute h-full bg-gradient-to-r from-purple-500 to-blue-500"
            />
          </div>

          {/* Phase Indicators */}
          <div className="flex justify-between mt-3">
            {['Planning', 'Researching', 'Analyzing', 'Generating'].map(
              (phase, idx) => (
                <div
                  key={phase}
                  className={`flex flex-col items-center gap-1 ${
                    idx === 0 ? 'text-purple-500' : 'text-gray-400'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      idx === 0
                        ? 'bg-purple-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                  <span className="text-xs">{phase}</span>
                </div>
              ),
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-2">
          Searching for: <span className="font-medium">{data.query}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Preparing {data.totalSearches} comprehensive searches...
        </p>
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
          {/* Header with Phase Info */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={getPhaseColor(data.phase)}>
                {getPhaseIcon(data.phase)}
              </div>
              <span className="text-sm font-medium">
                Search {(data.searchIndex ?? 0) + 1} of{' '}
                {data.totalSearches || '...'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {data.estimatedTimeRemaining && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>~{formatTime(data.estimatedTimeRemaining)} left</span>
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

          <p className="text-sm text-muted-foreground mb-2 truncate">
            {data.currentSearch || data.query}
          </p>

          {/* Enhanced Progress Bar */}
          <div className="space-y-2">
            <div className="relative bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${getPhaseProgress(data.phase)}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
              />
              {/* Progress Indicator */}
              <motion.div
                animate={{ left: `${getPhaseProgress(data.phase)}%` }}
                transition={{ duration: 0.5 }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              >
                <div className="w-3 h-3 bg-white dark:bg-gray-900 border-2 border-purple-500 rounded-full" />
              </motion.div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                {data.sourcesFound !== undefined && (
                  <div className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>{data.sourcesFound} sources</span>
                  </div>
                )}
                {elapsedTime > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(elapsedTime)}</span>
                  </div>
                )}
              </div>
              <span>{Math.round(getPhaseProgress(data.phase))}%</span>
            </div>
          </div>

          {data.status === 'rate-limited' && retryCountdown !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400"
            >
              <Clock className="w-4 h-4" />
              <span>Rate limited. Retrying in {retryCountdown}s...</span>
            </motion.div>
          )}

          {data.sitesFound !== undefined && data.sitesFound > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
            >
              <Sparkles className="w-4 h-4" />
              <span>Found {data.sitesFound} relevant sources</span>
            </motion.div>
          )}
        </div>
      </motion.div>
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
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {data.message}
              </p>
              {retryCountdown !== null && (
                <p className="text-sm text-muted-foreground mt-1">
                  Next batch in {retryCountdown} seconds...
                </p>
              )}
            </div>
          </div>
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
          className="mb-2"
        >
          <div className="flex flex-wrap gap-2">
            {data.sites?.map((site, index) => (
              <motion.div
                key={site.url}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-md text-xs"
              >
                <Globe className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span className="text-purple-700 dark:text-purple-300 truncate max-w-[200px]">
                  {site.title}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
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

  if (data.type === 'nexus-phase-update') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-4 border border-purple-500/20">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
              }}
            >
              {data.phase === 'research' ? (
                <Search className="w-5 h-5 text-purple-500" />
              ) : data.phase === 'analyzing' ? (
                <TrendingUp className="w-5 h-5 text-orange-500" />
              ) : (
                <Sparkles className="w-5 h-5 text-blue-500" />
              )}
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                {data.message}
              </p>
              {data.phase === 'generating' && (
                <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 30, ease: 'linear' }}
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                  />
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
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                >
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </motion.div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">
                    Research Complete!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Found {data.sourcesFound || 0} unique sources across{' '}
                    {data.searchesCompleted || 0} searches
                  </p>
                </div>

                {/* Summary Stats */}
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <BarChart3 className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">
                      {formatTime(elapsedTime)}
                    </p>
                  </div>
                  <div className="text-center">
                    <Zap className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">
                      {data.sourcesFound || 0} sources
                    </p>
                  </div>
                </div>
              </div>

              {/* Final Progress Bar */}
              <div className="mt-4 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: '90%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return null;
}
