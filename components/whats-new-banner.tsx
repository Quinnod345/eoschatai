'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFeatures } from '@/hooks/use-features';
import type { User } from 'next-auth';

interface WhatsNewBannerProps {
  user?: User;
}

export function WhatsNewBanner({ user }: WhatsNewBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const {
    hasNewFeatures,
    newFeaturesCount,
    lastSeenVersion,
    markAsSeen,
    showModal,
  } = useFeatures({
    userId: user?.id,
    autoShow: false, // We'll manually control when to show the modal
  });

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
    showModal();
    handleDismiss(); // Auto-dismiss when user opens modal
  };

  // Don't show if no new features or if dismissed
  if (!hasNewFeatures || isDismissed || newFeaturesCount === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.95 }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 20,
          mass: 1,
        }}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4"
      >
        <div className="relative">
          {/* Glassmorphism background */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 backdrop-blur-xl rounded-xl border border-primary/20 shadow-2xl" />

          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 rounded-xl blur-xl" />

          {/* Content */}
          <div className="relative bg-background/80 backdrop-blur-sm rounded-xl border border-border/50 p-4 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Animated icon */}
                <motion.div
                  animate={{
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: 'loop',
                  }}
                  className="p-2 rounded-lg bg-primary/10 flex-shrink-0"
                >
                  <Sparkles className="h-5 w-5 text-primary" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">What&apos;s New!</h3>
                    <Badge variant="secondary" className="h-5 text-xs">
                      {newFeaturesCount}{' '}
                      {newFeaturesCount === 1 ? 'feature' : 'features'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Discover new features and improvements
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  size="sm"
                  onClick={handleExplore}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 text-xs px-3 py-1 h-auto"
                >
                  Explore
                  <ChevronRight className="h-3 w-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="h-6 w-6 p-0 hover:bg-muted/50"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
