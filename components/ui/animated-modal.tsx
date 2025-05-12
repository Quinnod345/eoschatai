'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
            <motion.div
              className="w-full max-h-[90vh] mx-auto bg-background rounded-lg border shadow-md overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent"
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
