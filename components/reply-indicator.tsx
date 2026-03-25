'use client';

import { X, Reply, User, Bot } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { springSnappy } from '@/lib/motion/presets';

interface ReplyIndicatorProps {
  isVisible: boolean;
  replyingTo: {
    messageId: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp?: Date;
  } | null;
  onCancel: () => void;
  className?: string;
}

export function ReplyIndicator({
  isVisible,
  replyingTo,
  onCancel,
  className,
}: ReplyIndicatorProps) {
  if (!replyingTo) return null;

  // Truncate content if too long
  const truncateContent = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return `${content.substring(0, maxLength)}...`;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={springSnappy}
          className={cn(
            'flex items-center gap-3 p-3 mx-4 mb-2',
            'bg-gradient-to-r from-blue-50/80 to-indigo-50/80',
            'dark:from-blue-950/40 dark:to-indigo-950/40',
            'border border-blue-200/60 dark:border-blue-800/60',
            'rounded-xl shadow-sm backdrop-blur-sm',
            'relative overflow-hidden',
            className,
          )}
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 dark:from-blue-400/5 dark:to-indigo-400/5" />

          {/* Reply icon with animation */}
          <motion.div
            initial={{ rotate: -45, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
            className="flex-shrink-0 p-2 rounded-lg bg-blue-100/80 dark:bg-blue-900/50"
          >
            <Reply className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </motion.div>

          {/* Content section */}
          <div className="flex-1 min-w-0 relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Replying to:
              </span>
              <div className="flex items-center gap-1">
                {replyingTo.role === 'user' ? (
                  <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Bot className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                )}
                <span className="text-xs text-blue-600/80 dark:text-blue-400/80 font-medium">
                  {replyingTo.role === 'user' ? 'You' : 'Assistant'}
                </span>
              </div>
            </div>

            <div className="relative">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {truncateContent(replyingTo.content)}
              </p>

              {/* Subtle fade effect for long content */}
              {replyingTo.content.length > 100 && (
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-blue-50/80 dark:from-blue-950/40 to-transparent" />
              )}
            </div>
          </div>

          {/* Cancel button with hover effects */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className={cn(
              'flex-shrink-0 h-8 w-8 p-0 relative z-10',
              'hover:bg-red-100/80 dark:hover:bg-red-900/40',
              'hover:text-red-600 dark:hover:text-red-400',
              'transition-all duration-200',
              'rounded-lg group',
            )}
            aria-label="Cancel reply"
          >
            <X className="h-4 w-4 transition-transform group-hover:scale-110" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
