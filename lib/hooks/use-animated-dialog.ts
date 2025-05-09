import { useState, useCallback } from 'react';

/**
 * Hook to manage animated dialog state with proper fade-out animation
 * @returns An object with state and handlers for the animated dialog
 */
export function useAnimatedDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Open the dialog
  const open = useCallback(() => {
    setIsOpen(true);
    setIsClosing(false);
  }, []);

  // Start the closing animation
  const startClose = useCallback(() => {
    setIsClosing(true);
  }, []);

  // This should be called after the exit animation completes
  const finishClose = useCallback(() => {
    if (isClosing) {
      setIsOpen(false);
      setIsClosing(false);
    }
  }, [isClosing]);

  // Handle RadixUI's onOpenChange callback
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setIsOpen(true);
        setIsClosing(false);
      } else {
        // When RadixUI wants to close the dialog, start our closing animation
        startClose();
      }
    },
    [startClose],
  );

  return {
    isOpen,
    isClosing,
    isVisible: isOpen || isClosing,
    open,
    close: startClose,
    finishClose,
    handleOpenChange,
    getAnimationState: () => (isClosing ? 'exit' : 'visible'),
  };
}
