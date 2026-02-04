'use client';

import { cn } from '@/lib/utils';

interface SkipLinkProps {
  href?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Skip link for keyboard users to bypass navigation and jump to main content.
 * Only visible when focused via keyboard navigation.
 */
export function SkipLink({
  href = '#main-content',
  className,
  children = 'Skip to main content',
}: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        // Visually hidden by default
        'sr-only',
        // Visible when focused
        'focus:not-sr-only',
        'focus:fixed focus:top-4 focus:left-4 focus:z-[100]',
        'focus:px-4 focus:py-2',
        'focus:bg-primary focus:text-primary-foreground',
        'focus:rounded-md focus:shadow-lg',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'transition-all duration-150',
        className,
      )}
    >
      {children}
    </a>
  );
}
