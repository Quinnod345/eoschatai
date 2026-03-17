'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface WhatsNewBannerProps {
  hasNewFeatures: boolean;
  newFeaturesCount: number;
  lastSeenVersion?: string;
  onExplore: () => void;
}

export function WhatsNewBanner({
  hasNewFeatures,
  newFeaturesCount,
  lastSeenVersion,
  onExplore,
}: WhatsNewBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if banner was previously dismissed for this version
  useEffect(() => {
    const dismissedVersion = localStorage.getItem('whatsNewBannerDismissed');
    if (
      dismissedVersion &&
      lastSeenVersion &&
      dismissedVersion === lastSeenVersion
    ) {
      setIsDismissed(true);
    }
  }, [lastSeenVersion]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (lastSeenVersion) {
      localStorage.setItem('whatsNewBannerDismissed', lastSeenVersion);
    }
  };

  const handleExplore = () => {
    onExplore();
    handleDismiss(); // Auto-dismiss when user opens modal
  };

  // Don't show if no new features or if dismissed
  if (!hasNewFeatures || isDismissed || newFeaturesCount === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{
          duration: 0.2,
          ease: 'easeOut',
        }}
        className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
      >
        <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold">What&apos;s New</h3>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {newFeaturesCount}{' '}
                  {newFeaturesCount === 1 ? 'feature' : 'features'}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                New features and improvements are ready to explore.
              </p>
            </div>

            <div className="flex flex-shrink-0 items-center gap-1">
              <Button
                size="sm"
                onClick={handleExplore}
                className="h-8 gap-1 px-3 text-xs"
              >
                Explore
                <ChevronRight className="h-3 w-3" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="size-8 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
