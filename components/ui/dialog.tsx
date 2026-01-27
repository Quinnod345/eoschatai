'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

interface DialogOverlayProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {
  nested?: boolean;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  DialogOverlayProps
>(({ className, nested, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 bg-black/30 backdrop-blur-[6px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200',
      nested ? 'z-nested-modal-overlay' : 'z-modal-overlay',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideCloseButton?: boolean;
  nested?: boolean;
  /** Size variant for the dialog */
  size?: 'sm' | 'default' | 'lg' | 'xl' | '2xl' | 'full' | 'custom';
}

const dialogSizeClasses = {
  sm: 'sm:max-w-sm', // 384px
  default: 'sm:max-w-xl', // 576px - increased from lg (512px)
  lg: 'sm:max-w-2xl', // 672px
  xl: 'sm:max-w-4xl', // 896px
  '2xl': 'sm:max-w-6xl', // 1152px
  full: 'sm:max-w-[calc(100vw-2rem)]',
  custom: '', // No constraint - use className
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, hideCloseButton = false, nested = false, size = 'default', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay nested={nested} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Positioning - centered with safe area
        'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        // Z-index
        nested ? 'z-nested-modal-content' : 'z-modal-content',
        // Base sizing - full width on mobile, constrained on larger screens
        'w-[calc(100vw-1rem)] sm:w-full',
        // Max height with safe scrolling
        'max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]',
        // Overflow handling
        'overflow-y-auto overflow-x-hidden overscroll-contain',
        // Visual styling
        'bg-background border border-border/50 shadow-xl',
        'rounded-xl sm:rounded-2xl',
        // Padding - more compact on mobile
        'p-4 sm:p-6',
        // Animation
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        'duration-200',
        // Text handling
        '[overflow-wrap:break-word] [word-break:break-word]',
        // Size variant
        dialogSizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close 
          className={cn(
            // Positioning - sticky in top right corner
            'absolute right-3 top-3 sm:right-4 sm:top-4',
            // Size and shape
            'h-8 w-8 sm:h-7 sm:w-7 rounded-full',
            // Flex centering
            'inline-flex items-center justify-center',
            // Colors and interaction
            'text-muted-foreground/70 hover:text-foreground',
            'hover:bg-muted/80 active:bg-muted',
            'transition-colors duration-150',
            // Focus ring
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            // Z-index to stay above content
            'z-10',
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      // Add right padding to prevent close button overlap
      'pr-8 sm:pr-10',
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Stack buttons on mobile, row on desktop
      'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3',
      // Add top margin for separation
      'mt-4 sm:mt-6 pt-4 border-t border-border/50',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-tight tracking-tight',
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground mt-1.5', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
