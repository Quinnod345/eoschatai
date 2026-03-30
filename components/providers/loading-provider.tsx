'use client';

import { useLoading } from '@/hooks/use-loading';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Search, Upload, Cpu, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const loadingConfig = {
  default: {
    icon: Loader2,
    title: 'Loading...',
    description: 'Please wait while we process your request.',
  },
  chat: {
    icon: MessageSquare,
    title: 'Loading Chat',
    description: 'Preparing your conversation...',
  },
  search: {
    icon: Search,
    title: 'Searching',
    description: 'Finding the best results for you...',
  },
  upload: {
    icon: Upload,
    title: 'Uploading',
    description: 'Processing your files...',
  },
  processing: {
    icon: Cpu,
    title: 'Processing',
    description: 'Analyzing your content...',
  },
};

export function LoadingProvider() {
  const { isLoading, loadingText, loadingType, setLoading } = useLoading();
  const pathname = usePathname();
  const config = loadingConfig[loadingType];
  const IconComponent = config.icon;

  // Auto-hide loading overlay on navigation for chat and default
  useEffect(() => {
    if (!isLoading) return;
    const timeout = loadingType === 'chat' ? 300 : 400;
    const timer = setTimeout(() => setLoading(false), timeout);
    return () => clearTimeout(timer);
  }, [pathname, isLoading, loadingType, setLoading]);

  // Prevent interactions and scroll while loading
  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLoading]);

  // Don't show loading overlay for chat navigation or marketing pages
  if (loadingType === 'chat') {
    return null;
  }

  const isMarketingPage = pathname === '/' || pathname.startsWith('/features') || pathname.startsWith('/solutions') || pathname.startsWith('/privacy') || pathname.startsWith('/terms') || pathname.startsWith('/docs');
  if (isMarketingPage) {
    return null;
  }

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-[100] pointer-events-auto cursor-wait"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="flex flex-col items-center gap-6 bg-background/95 backdrop-blur-sm rounded-2xl p-8 border shadow-2xl max-w-sm mx-4 pointer-events-auto"
          >
            {/* Animated Icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-eos-orange/20 rounded-full animate-ping" />
              <div className="relative bg-eos-orange/10 rounded-full p-4">
                <IconComponent className="h-8 w-8 text-eos-orange animate-pulse" />
              </div>
            </div>

            {/* Text Content */}
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                {config.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {loadingText !== 'Loading...'
                  ? loadingText
                  : config.description}
              </p>
            </div>

            {/* Progress Bar Animation */}
            <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-eos-orange to-eos-navy rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
