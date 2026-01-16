'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface TooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  delayDuration?: number;
  className?: string;
}

export function CustomTooltip({
  children,
  content,
  side = 'top',
  sideOffset = 4,
  delayDuration = 0,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [mounted, setMounted] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let x = 0;
    let y = 0;

    switch (side) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - sideOffset;
        break;
      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + sideOffset;
        break;
      case 'left':
        x = triggerRect.left - tooltipRect.width - sideOffset;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x = triggerRect.right + sideOffset;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    setPosition({ x, y });
  }, [side, sideOffset]);

  const handleMouseEnter = React.useCallback(() => {
    if (delayDuration === 0) {
      setIsVisible(true);
    } else {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delayDuration);
    }
  }, [delayDuration]);

  const handleMouseLeave = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  React.useEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [isVisible, updatePosition]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const childWithRef = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  } as any);

  return (
    <>
      {childWithRef}
      {mounted &&
        isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            className={cn(
              'fixed z-tooltip px-3 py-1.5 text-sm',
              'rounded-md overflow-hidden',
              'text-popover-foreground',
              // Glass effect - renders immediately with CSS
              'bg-popover/90',
              'backdrop-blur-xl backdrop-saturate-[1.8]',
              'border border-white/40 dark:border-white/10',
              'shadow-lg shadow-black/10',
              // Inset shadows for depth
              'before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none',
              'before:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(255,255,255,0.3)]',
              'dark:before:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),inset_0_-1px_0_0_rgba(255,255,255,0.08)]',
              // Animation
              'animate-in fade-in-0 zoom-in-95',
              'duration-100',
              className,
            )}
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
            }}
          >
            <div className="relative z-10">{content}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
