'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import GlassSurface from '@/components/GlassSurface';

// Simple no-op provider for backwards compatibility
export const TooltipProvider = ({
  children,
  delayDuration,
}: { children: React.ReactNode; delayDuration?: number }) => <>{children}</>;

interface TooltipContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  content: React.ReactNode;
  setContent: (content: React.ReactNode) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  delayDuration: number;
}

const TooltipContext = React.createContext<TooltipContextValue | undefined>(
  undefined,
);

export function Tooltip({
  children,
  delayDuration = 400,
  open,
}: {
  children: React.ReactNode;
  delayDuration?: number;
  open?: boolean;
}) {
  const [isOpenInternal, setIsOpen] = React.useState(false);
  const isOpen = open !== undefined ? open : isOpenInternal;
  const [content, setContent] = React.useState<React.ReactNode>(null);
  const triggerRef = React.useRef<HTMLElement>(null);

  // Memoize setContent to prevent infinite loops
  const setContentMemoized = React.useCallback(
    (newContent: React.ReactNode) => {
      setContent(newContent);
    },
    [],
  );

  const contextValue = React.useMemo(
    () => ({
      isOpen,
      setIsOpen,
      content,
      setContent: setContentMemoized,
      triggerRef,
      delayDuration,
    }),
    [isOpen, setIsOpen, content, setContentMemoized, delayDuration],
  );

  return (
    <TooltipContext.Provider value={contextValue}>
      {children}
    </TooltipContext.Provider>
  );
}

export const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & {
    asChild?: boolean;
    children: React.ReactElement;
  }
>(({ asChild, children, ...props }, ref) => {
  const context = React.useContext(TooltipContext);
  if (!context) throw new Error('TooltipTrigger must be used within Tooltip');

  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const handleMouseEnter = React.useCallback(() => {
    // Add delay before showing tooltip
    timeoutRef.current = setTimeout(() => {
      context.setIsOpen(true);
    }, context.delayDuration);
  }, [context]);

  const handleMouseLeave = React.useCallback(() => {
    // Clear timeout if user moves mouse away before tooltip shows
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    context.setIsOpen(false);
  }, [context]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const child = React.Children.only(children);

  return React.cloneElement(child, {
    ref: (node: HTMLElement) => {
      (context.triggerRef as any).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as any).current = node;
      // Also handle the child's own ref if it has one
      const childRef = (child as any).ref;
      if (childRef) {
        if (typeof childRef === 'function') childRef(node);
        else childRef.current = node;
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter();
      (child.props as { onMouseEnter?: (e: React.MouseEvent) => void })
        .onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave();
      (child.props as { onMouseLeave?: (e: React.MouseEvent) => void })
        .onMouseLeave?.(e);
    },
    ...props,
  } as any);
});
TooltipTrigger.displayName = 'TooltipTrigger';

export const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    sideOffset?: number;
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
  }
>(
  (
    {
      className,
      sideOffset = 4,
      side = 'top',
      align = 'center',
      children,
      ...props
    },
    ref,
  ) => {
    const context = React.useContext(TooltipContext);
    if (!context) throw new Error('TooltipContent must be used within Tooltip');

    const [mounted, setMounted] = React.useState(false);
    const [position, setPosition] = React.useState({ x: -9999, y: -9999 }); // Start off-screen
    const [isPositioned, setIsPositioned] = React.useState(false);
    const tooltipRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      setMounted(true);
      context.setContent(children);
    }, [children, context.setContent]); // Only depend on setContent function, not entire context

    React.useEffect(() => {
      if (!context.isOpen) {
        setIsPositioned(false);
        setPosition({ x: -9999, y: -9999 });
        return;
      }

      if (!tooltipRef.current || !context.triggerRef.current) return;

      const updatePosition = () => {
        if (!context.triggerRef.current || !tooltipRef.current) return;

        const triggerRect = context.triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight,
        };

        const spacing = 8; // Minimum spacing from viewport edges

        // Calculate available space on each side
        const spaceAbove = triggerRect.top;
        const spaceBelow = viewport.height - triggerRect.bottom;
        const spaceLeft = triggerRect.left;
        const spaceRight = viewport.width - triggerRect.right;

        // Determine best side based on preferred side and available space
        let finalSide = side;

        // Check if preferred side has enough space, if not flip
        if (
          side === 'top' &&
          spaceAbove < tooltipRect.height + sideOffset + spacing
        ) {
          if (spaceBelow >= tooltipRect.height + sideOffset + spacing) {
            finalSide = 'bottom';
          }
        } else if (
          side === 'bottom' &&
          spaceBelow < tooltipRect.height + sideOffset + spacing
        ) {
          if (spaceAbove >= tooltipRect.height + sideOffset + spacing) {
            finalSide = 'top';
          }
        } else if (
          side === 'left' &&
          spaceLeft < tooltipRect.width + sideOffset + spacing
        ) {
          if (spaceRight >= tooltipRect.width + sideOffset + spacing) {
            finalSide = 'right';
          }
        } else if (
          side === 'right' &&
          spaceRight < tooltipRect.width + sideOffset + spacing
        ) {
          if (spaceLeft >= tooltipRect.width + sideOffset + spacing) {
            finalSide = 'left';
          }
        }

        let x = 0;
        let y = 0;

        // Calculate position based on final side
        switch (finalSide) {
          case 'top':
            x =
              triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
            y = triggerRect.top - tooltipRect.height - sideOffset;
            break;
          case 'bottom':
            x =
              triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
            y = triggerRect.bottom + sideOffset;
            break;
          case 'left':
            x = triggerRect.left - tooltipRect.width - sideOffset;
            y =
              triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
            break;
          case 'right':
            x = triggerRect.right + sideOffset;
            y =
              triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
            break;
        }

        // Keep tooltip within viewport horizontally
        if (x < spacing) {
          x = spacing;
        } else if (x + tooltipRect.width > viewport.width - spacing) {
          x = viewport.width - tooltipRect.width - spacing;
        }

        // Keep tooltip within viewport vertically
        if (y < spacing) {
          y = spacing;
        } else if (y + tooltipRect.height > viewport.height - spacing) {
          y = viewport.height - tooltipRect.height - spacing;
        }

        setPosition({ x, y });
        // Use RAF to ensure the position change has been applied before showing
        requestAnimationFrame(() => {
          setIsPositioned(true);
        });
      };

      // Use RAF to ensure tooltip is rendered before measuring
      requestAnimationFrame(() => {
        updatePosition();
      });
    }, [context, side, sideOffset]);

    if (!mounted || !context.isOpen) return null;

    return createPortal(
      <div
        ref={(node) => {
          (tooltipRef as any).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as any).current = node;
        }}
        className={cn(
          'fixed z-tooltip text-sm',
          'rounded-md overflow-visible',
          'text-popover-foreground whitespace-nowrap',
          !isPositioned && 'invisible',
          className,
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        {...props}
      >
        <GlassSurface
          width="auto"
          height="auto"
          borderRadius={15}
          displace={3}
          backgroundOpacity={0.2}
          blur={10}
          insetShadowIntensity={0.4}
          isBackdrop={false}
          noTransition={true}
          useFallback={false}
          className="px-1.5 py-0.5"
        >
          {children}
        </GlassSurface>
      </div>,
      document.body,
    );
  },
);
TooltipContent.displayName = 'TooltipContent';
