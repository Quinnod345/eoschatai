'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springSoft } from '@/lib/motion/presets';

interface MessageSkeletonProps {
  count?: number;
  className?: string;
}

export function MessageSkeleton({
  count = 3,
  className,
}: MessageSkeletonProps) {
  const skeletonIds = Array.from({ length: count }, (_, i) => `msg-skeleton-${i}`);
  
  return (
    <div className={cn('space-y-4 p-4', className)}>
      {skeletonIds.map((id, i) => (
        <motion.div
          key={id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: i * 0.07 }}
          className="flex gap-3"
        >
          {/* Avatar skeleton */}
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          </div>

          {/* Message content skeleton */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted/70 rounded animate-pulse" />
            </div>

            <div className="space-y-2">
              <div
                className="h-4 bg-muted rounded animate-pulse"
                style={{ width: `${80 + Math.random() * 20}%` }}
              />
              <div
                className="h-4 bg-muted rounded animate-pulse"
                style={{ width: `${60 + Math.random() * 30}%` }}
              />
              {i % 2 === 0 && (
                <div
                  className="h-4 bg-muted rounded animate-pulse"
                  style={{ width: `${40 + Math.random() * 20}%` }}
                />
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
