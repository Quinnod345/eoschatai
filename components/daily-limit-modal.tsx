'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';

interface DailyLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: 'free' | 'pro' | 'business';
  currentUsage: number;
  limit: number;
}

export function DailyLimitModal({
  isOpen,
  onClose,
  plan,
  currentUsage,
  limit,
}: DailyLimitModalProps) {
  const openUpgradeModal = useUpgradeStore((state) => state.openModal);
  const [timeUntilReset, setTimeUntilReset] = useState('');

  useEffect(() => {
    const updateResetTime = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeUntilReset(`${hours}h ${minutes}m`);
    };

    updateResetTime();
    const interval = setInterval(updateResetTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const handleUpgrade = () => {
    onClose();
    openUpgradeModal('premium');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-modal-overlay bg-black/20 backdrop-blur-[8px]"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-modal-content flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-background/90 backdrop-blur-[12px] border border-white/25 dark:border-zinc-700/40 shadow-2xl"
            >
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 rounded-full p-1.5 hover:bg-muted/50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="p-5">
                {/* Title */}
                <h2 className="mb-1 text-base font-semibold">
                  Daily limit reached
                </h2>

                {/* Subtitle */}
                <p className="mb-4 text-sm text-muted-foreground">
                  You&apos;ve used all {limit} messages today
                </p>

                {/* Stats */}
                <div className="mb-4 space-y-2">
                  {/* Reset time */}
                  <div className="flex items-center gap-2.5 rounded-lg bg-muted/30 p-2.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Resets in</p>
                      <p className="text-sm font-medium">{timeUntilReset}</p>
                    </div>
                  </div>

                  {/* Upgrade benefits */}
                  {plan === 'free' && (
                    <div className="rounded-lg bg-muted/30 p-2.5">
                      <p className="text-xs text-muted-foreground mb-1">
                        Upgrade for more
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Pro:</span> 200/day •{' '}
                        <span className="font-medium">Business:</span> 1,000/day
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  {plan === 'free' && (
                    <Button
                      onClick={handleUpgrade}
                      className="w-full"
                      size="sm"
                    >
                      Upgrade
                    </Button>
                  )}

                  <Button
                    onClick={onClose}
                    variant="ghost"
                    className="w-full"
                    size="sm"
                  >
                    {plan === 'free' ? 'Not now' : 'Got it'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
