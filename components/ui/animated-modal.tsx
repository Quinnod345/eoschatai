'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

// VisuallyHidden component for accessibility
const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: 0,
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
    }}
  >
    {children}
  </span>
);

// Conditional imports to avoid SSR issues
let motion: any;
let AnimatePresence: any;

if (typeof window !== 'undefined') {
  const framerMotion = require('framer-motion');
  motion = framerMotion.motion;
  AnimatePresence = framerMotion.AnimatePresence;
}

// Animation variants for the modal
const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.15,
      ease: 'easeOut',
    },
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.15,
      ease: 'easeIn',
    },
  },
};

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  preventAutoClose?: boolean;
}

export function AnimatedModal({
  isOpen,
  onClose,
  children,
  className,
  preventAutoClose = false,
}: AnimatedModalProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);

  // When isOpen changes, update our internal state
  React.useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
    }
  }, [isOpen]);

  // When the exit animation completes, tell parent we're fully closed
  const handleAnimationComplete = (definition: string) => {
    if (definition === 'exit') {
      setIsVisible(false);
      if (onClose) onClose();
    }
  };

  // Handle request to close from AlertDialog
  const handleOpenChange = (open: boolean) => {
    if (!open && !isClosing && !preventAutoClose) {
      // Check if any dropdown is open before closing
      const openDropdowns = document.querySelectorAll('[data-state="open"]');
      const selectContent = document.querySelector('[role="listbox"]');

      // Don't close if there are open dropdowns
      if (openDropdowns.length > 0 || selectContent) {
        return;
      }

      setIsClosing(true);
    }
  };

  // Fallback for SSR
  if (typeof window === 'undefined' || !motion || !AnimatePresence) {
    return (
      <AlertDialog open={!isClosing && isOpen} onOpenChange={handleOpenChange}>
        <AlertDialogContent
          className={cn(
            'p-0 border-none bg-transparent shadow-none max-h-[95vh] max-w-screen-md w-[95vw] sm:w-auto',
            className,
          )}
        >
          <VisuallyHidden>
            <AlertDialogTitle>Modal Dialog</AlertDialogTitle>
          </VisuallyHidden>
          <div
            className="w-full max-h-[90vh] mx-auto bg-background/90 rounded-2xl border border-white/25 dark:border-zinc-700/40 shadow-enhanced backdrop-blur-[12px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent"
            style={{
              overscrollBehavior: 'contain',
            }}
          >
            {children}
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AnimatePresence>
      {(isVisible || isOpen) && (
        <AlertDialog
          open={!isClosing && isOpen}
          onOpenChange={handleOpenChange}
        >
          <AlertDialogContent
            className={cn(
              'p-0 border-none bg-transparent shadow-none max-h-[95vh] max-w-screen-md w-[95vw] sm:w-auto',
              className,
            )}
            forceMount
          >
            <VisuallyHidden>
              <AlertDialogTitle>Modal Dialog</AlertDialogTitle>
            </VisuallyHidden>
            <motion.div
              className="w-full max-h-[90vh] mx-auto bg-background/90 rounded-2xl border border-white/25 dark:border-zinc-700/40 shadow-enhanced backdrop-blur-[12px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent"
              initial="hidden"
              animate={isClosing ? 'exit' : 'visible'}
              exit="exit"
              variants={modalVariants}
              onAnimationComplete={handleAnimationComplete}
              style={{
                overscrollBehavior: 'contain',
              }}
            >
              {children}
            </motion.div>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </AnimatePresence>
  );
}
