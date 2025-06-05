import { useEffect, useState, useRef } from 'react';
import type { ChartData } from '@/artifacts/chart/client';
import { ChartRenderer } from './chart-renderer';
import { motion } from 'framer-motion';

export function ChartPreview({
  chartConfig,
  isLoading = false,
}: {
  chartConfig: string;
  isLoading?: boolean;
}) {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<number>(0);
  const loadingPhrases = [
    'Parsing chart data...',
    'Preparing visualization...',
    'Rendering chart...',
    'Finalizing display...',
  ];
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cycle through loading phases for better UX
  useEffect(() => {
    if (isLoading) {
      setLoadingPhase(0);

      // Create a timer that cycles through loading phases
      loadingTimerRef.current = setInterval(() => {
        setLoadingPhase((prev) => (prev + 1) % loadingPhrases.length);
      }, 1200);
    } else {
      // Clear timer when loading completes
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }

    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [isLoading]);

  // Parse chart config when it changes
  useEffect(() => {
    if (!chartConfig) return;

    try {
      let parsedConfig: ChartData;
      const trimmedConfig = chartConfig.trim();

      // Check if there are CHART_DATA markers
      if (
        trimmedConfig.includes('CHART_DATA_BEGIN') &&
        trimmedConfig.includes('CHART_DATA_END')
      ) {
        const match = trimmedConfig.match(
          /CHART_DATA_BEGIN([\s\S]*?)CHART_DATA_END/,
        );
        if (match?.[1]) {
          const jsonStr = match[1].trim();
          parsedConfig = JSON.parse(jsonStr);
        } else {
          throw new Error('Could not extract chart data between markers');
        }
      } else {
        // Try to parse the entire string as JSON
        parsedConfig = JSON.parse(trimmedConfig);
      }

      console.log('Chart config parsed successfully:', parsedConfig);
      setChartData(parsedConfig);
      setParseError(null);
    } catch (error) {
      console.error('Error parsing chart config:', error);
      setParseError(
        error instanceof Error ? error.message : 'Unknown parsing error',
      );
      setChartData(null);
    }
  }, [chartConfig]);

  if (isLoading) {
    return (
      <div className="chart-preview bg-muted/40 border border-border rounded-md p-4 flex flex-col items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24">
            {/* Background chart icon */}
            <svg
              className="w-full h-full text-muted-foreground/20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M8 15v-6" />
              <path d="M12 15V9" />
              <path d="M16 15v-3" />
            </svg>

            {/* Animated elements */}
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-t-2 border-primary rounded-full"
              animate={{ rotate: 360 }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
              }}
            />

            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 border-t-2 border-l-2 border-primary/60 rounded-full"
              animate={{ rotate: -180 }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              }}
            />
          </div>

          <motion.div
            key={loadingPhase}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-muted-foreground font-medium"
          >
            {loadingPhrases[loadingPhase]}
          </motion.div>

          <motion.div
            className="h-1 bg-muted rounded-full overflow-hidden w-48"
            initial={{ width: 120 }}
            animate={{ width: [120, 180, 140, 200] }}
            transition={{
              duration: 3,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
          >
            <motion.div
              className="h-full bg-primary/30 rounded-full"
              animate={{ x: ['0%', '100%', '20%', '80%'] }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        </div>
      </div>
    );
  }

  if (parseError) {
    return (
      <div className="chart-preview bg-muted/40 border border-red-200 dark:border-red-900 rounded-md p-4 text-red-500">
        <h3 className="text-sm font-medium mb-2">Error Processing Chart</h3>
        <p className="text-xs">{parseError}</p>
        <pre className="mt-2 text-xs overflow-auto max-h-32 bg-muted/60 p-2 rounded">
          {chartConfig.substring(0, 200)}
          {chartConfig.length > 200 ? '...' : ''}
        </pre>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="chart-preview bg-muted/40 border border-border rounded-md p-4 text-muted-foreground">
        No chart data available.
      </div>
    );
  }

  return (
    <div className="chart-preview border border-border rounded-md overflow-hidden">
      <ChartRenderer chartData={chartData} />
    </div>
  );
}
