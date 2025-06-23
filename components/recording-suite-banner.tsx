'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileAudio, ChevronRight, Sparkles, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RecordingSuiteBannerProps {
  onOpenRecording?: () => void;
}

export function RecordingSuiteBanner({
  onOpenRecording,
}: RecordingSuiteBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if banner was previously dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem('recordingSuiteBannerDismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('recordingSuiteBannerDismissed', 'true');
  };

  const handleExplore = () => {
    if (onOpenRecording) {
      onOpenRecording();
    }
    // Don't auto-dismiss when exploring, let user decide
  };

  if (isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 300, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 300, scale: 0.9 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 25,
          mass: 1,
        }}
        className="fixed bottom-6 right-6 z-40 max-w-sm w-full"
      >
        <div className="relative">
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-xl blur-lg" />

          {/* Main banner */}
          <div className="relative bg-background/95 backdrop-blur-sm rounded-xl border border-border/60 shadow-lg overflow-hidden">
            {/* Animated background pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50 dark:from-blue-950/20 dark:via-transparent dark:to-purple-950/20" />

            {/* Content */}
            <div className="relative p-4">
              <div className="flex items-start gap-3">
                {/* Animated icon */}
                <motion.div
                  animate={{
                    scale: [1, 1.05, 1],
                    rotate: [0, 2, -2, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: 'loop',
                  }}
                  className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex-shrink-0 relative"
                >
                  <FileAudio className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  {/* Pulsing dot */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.7, 1, 0.7],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatType: 'loop',
                    }}
                    className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                  />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">
                      New: Recording Suite
                    </h3>
                    <Badge
                      variant="secondary"
                      className="h-5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Beta
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    Record meetings, get AI transcriptions, and analyze
                    conversations with speaker identification.
                  </p>

                  {/* Feature highlights */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    <span className="inline-flex items-center gap-1 text-xs bg-muted/50 rounded-full px-2 py-1">
                      <Mic className="h-3 w-3" />
                      Record
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-muted/50 rounded-full px-2 py-1">
                      <FileAudio className="h-3 w-3" />
                      Transcribe
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-muted/50 rounded-full px-2 py-1">
                      <Sparkles className="h-3 w-3" />
                      Analyze
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleExplore}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white gap-1 text-xs px-3 py-1 h-auto shadow-sm"
                    >
                      Try Now
                      <ChevronRight className="h-3 w-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismiss}
                      className="h-6 w-6 p-0 hover:bg-muted/50 text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
