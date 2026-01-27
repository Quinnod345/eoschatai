'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** ClassName for the DialogContent wrapper */
  className?: string;
  /** Size variant - passed to DialogContent */
  size?: 'sm' | 'default' | 'lg' | 'xl' | '2xl' | 'full' | 'custom';
  /** If true, children provide their own container styling */
  unstyled?: boolean;
  /** Prevent auto-close when clicking outside */
  preventAutoClose?: boolean;
  /** Title for accessibility (visually hidden if not using DialogHeader) */
  title?: string;
  /** Hide the default close button */
  hideCloseButton?: boolean;
}

export function AnimatedModal({
  isOpen,
  onClose,
  children,
  className,
  size = 'default',
  unstyled = false,
  preventAutoClose = false,
  title = 'Modal Dialog',
  hideCloseButton = false,
}: AnimatedModalProps) {
  // Handle request to close from Dialog
  const handleOpenChange = (open: boolean) => {
    if (!open && !preventAutoClose) {
      // Check if any dropdown/select is open before closing
      // This prevents closing when interacting with form elements
      const openDropdowns = document.querySelectorAll(
        '[data-radix-select-content], [data-radix-dropdown-menu-content], [data-radix-popover-content]'
      );
      
      if (openDropdowns.length > 0) {
        return;
      }

      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        size={unstyled ? 'custom' : size}
        hideCloseButton={hideCloseButton || unstyled}
        className={cn(
          // When unstyled, remove all visual styling so children control it
          unstyled && 'p-0 border-none bg-transparent shadow-none !w-auto',
          className,
        )}
      >
        <VisuallyHidden>
          <DialogTitle>{title}</DialogTitle>
        </VisuallyHidden>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// Re-export Dialog sub-components for convenience
export { DialogHeader, DialogTitle, DialogDescription, DialogFooter };
