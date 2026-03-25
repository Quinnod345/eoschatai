import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar';
import { springChat } from '@/lib/motion/presets';

type AnimatedSidebarWrapperProps = {
  children: React.ReactNode;
  className?: string;
};

// SIMPLIFIED: Use CSS-only animations to avoid fighting with sidebar CSS transitions
// The sidebar width transition handles everything - these just need to show/hide content

export function AnimatedSidebarWrapper({
  children,
  className,
}: AnimatedSidebarWrapperProps) {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <div
      className={cn(className)}
      style={{
        opacity: isCollapsed ? 0 : 1,
        transition: isCollapsed
          ? 'opacity 90ms cubic-bezier(0.4, 0, 1, 1)'
          : 'opacity 180ms cubic-bezier(0, 0, 0.2, 1)',
        pointerEvents: isCollapsed ? 'none' : 'auto',
      }}
    >
      {children}
    </div>
  );
}

interface AnimatedSidebarItemProps {
  children: React.ReactNode;
  index?: number;
  className?: string;
}

export function AnimatedSidebarItem({
  children,
  index = 0,
  className,
}: AnimatedSidebarItemProps) {
  const { state } = useSidebar();
  const prefersReducedMotion = useReducedMotion();
  const isCollapsed = state === 'collapsed';

  if (prefersReducedMotion || isCollapsed) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springChat, delay: Math.min(index * 0.03, 0.25) }}
    >
      {children}
    </motion.div>
  );
}

// SIMPLIFIED: Just a wrapper div
export function AnimatedSidebarGroup({
  children,
  className,
}: AnimatedSidebarWrapperProps) {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <div
      className={cn(className)}
      style={{
        opacity: isCollapsed ? 0 : 1,
        transition: isCollapsed
          ? 'opacity 90ms cubic-bezier(0.4, 0, 1, 1)'
          : 'opacity 180ms cubic-bezier(0, 0, 0.2, 1)',
      }}
    >
      {children}
    </div>
  );
}

export default AnimatedSidebarWrapper;
