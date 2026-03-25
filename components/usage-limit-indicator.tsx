'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAccountStore } from '@/lib/stores/account-store';
import { cn } from '@/lib/utils';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import { springSnappy } from '@/lib/motion/presets';

export function UsageLimitIndicator() {
  const entitlements = useAccountStore((state) => state.entitlements);
  const usageCounters = useAccountStore((state) => state.usageCounters);
  const user = useAccountStore((state) => state.user);
  const openUpgradeModal = useUpgradeStore((state) => state.openModal);

  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  if (!entitlements || !usageCounters || !user) {
    return null;
  }

  const chatLimit = entitlements.features.chats_per_day;
  const chatsUsed = usageCounters.chats_today;
  const chatsRemaining = Math.max(0, chatLimit - chatsUsed);
  const percentageUsed = chatLimit > 0 ? (chatsUsed / chatLimit) * 100 : 0;

  // Only show when getting close to limit
  const showWarning = percentageUsed >= 80;
  const isAtLimit = chatsUsed >= chatLimit;

  // Don't show for premium plans unless they're very close to limit
  if (user.plan !== 'free' && percentageUsed < 90) {
    return null;
  }

  // Don't show if plenty of messages left
  if (!showWarning) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={springSnappy}
      className="flex items-center justify-end"
    >
      <motion.button
        type="button"
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        whileHover={prefersReducedMotion || user.plan !== 'free' ? undefined : { scale: 1.04 }}
        whileTap={prefersReducedMotion || user.plan !== 'free' ? undefined : { scale: 0.97 }}
        transition={springSnappy}
        onClick={() => user.plan === 'free' && openUpgradeModal('premium')}
        className={cn(
          'group relative flex items-center gap-1.5 rounded-full px-2.5 py-1',
          'text-xs font-medium transition-all duration-150',
          'border border-transparent',
          isAtLimit
            ? 'text-red-600 dark:text-red-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50/50 dark:hover:bg-red-950/20'
            : 'text-orange-600 dark:text-orange-400 hover:border-orange-200 dark:hover:border-orange-800 hover:bg-orange-50/50 dark:hover:bg-orange-950/20',
          user.plan === 'free' ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        {/* Subtle indicator dot with micro-pulse */}
        <motion.span
          animate={
            isAtLimit ? { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] } : {}
          }
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isAtLimit
              ? 'bg-red-500 dark:bg-red-400'
              : 'bg-orange-500 dark:bg-orange-400',
          )}
        />

        {/* Text */}
        <motion.span
          animate={isHovered ? { x: 1 } : { x: 0 }}
          transition={{ duration: 0.15 }}
          className="whitespace-nowrap"
        >
          {chatsRemaining} {chatsRemaining === 1 ? 'left' : 'left'}
        </motion.span>

        {/* Subtle progress ring on hover - micro interaction */}
        {isHovered && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute -inset-0.5 -z-10 rounded-full"
            style={{
              background: `conic-gradient(
                ${isAtLimit ? 'rgb(239 68 68 / 0.15)' : 'rgb(249 115 22 / 0.15)'} ${percentageUsed * 3.6}deg,
                transparent ${percentageUsed * 3.6}deg
              )`,
            }}
          />
        )}
      </motion.button>
    </motion.div>
  );
}
