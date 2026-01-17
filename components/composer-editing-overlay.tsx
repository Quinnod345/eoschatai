'use client';

import { motion } from 'framer-motion';
import { LoaderIcon, SparklesIcon } from './icons';

interface ComposerEditingOverlayProps {
  isVisible: boolean;
  chatStatus?: 'submitted' | 'streaming' | 'ready' | 'error';
  message?: string;
}

export function ComposerEditingOverlay({
  isVisible,
  chatStatus,
  message = 'Editing document...',
}: ComposerEditingOverlayProps) {
  // Show overlay if streaming OR if chat is submitted (thinking)
  const shouldShow = isVisible || chatStatus === 'submitted';
  
  if (!shouldShow) return null;

  // Customize message based on state
  const displayMessage = chatStatus === 'submitted' ? 'Thinking...' : message;
  const subMessage = chatStatus === 'submitted' 
    ? 'AI is analyzing your request' 
    : 'AI is working on your document';

  return (
    <motion.div
      className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="flex flex-col items-center gap-4 p-6 rounded-xl bg-card border shadow-lg"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div className="relative">
          <motion.div
            className="text-primary"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          >
            <LoaderIcon size={32} />
          </motion.div>
          <motion.div
            className="absolute -top-1 -right-1 text-amber-500"
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
          >
            <SparklesIcon size={16} />
          </motion.div>
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground">{displayMessage}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {subMessage}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
