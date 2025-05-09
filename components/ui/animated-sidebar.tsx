import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar';

type AnimatedSidebarWrapperProps = {
  children: React.ReactNode;
  className?: string;
};

// Spring animation configuration
const springTransition = {
  type: 'spring',
  damping: 22,
  stiffness: 250,
  mass: 0.8,
};

// This component adds spring animations to the sidebar transitions
export function AnimatedSidebarWrapper({
  children,
  className,
}: AnimatedSidebarWrapperProps) {
  const { state } = useSidebar();

  // Animation variants based on sidebar state
  const variants = {
    expanded: {
      x: 0,
      opacity: 1,
      transition: springTransition,
    },
    collapsed: {
      x: -40,
      opacity: 0,
      transition: springTransition,
    },
  };

  return (
    <motion.div
      className={cn(className)}
      initial={state === 'expanded' ? 'expanded' : 'collapsed'}
      animate={state === 'expanded' ? 'expanded' : 'collapsed'}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

// For animating individual items in the sidebar with staggered animations
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

  const itemVariants = {
    expanded: {
      x: 0,
      opacity: 1,
      transition: {
        ...springTransition,
        delay: index * 0.03,
      },
    },
    collapsed: {
      x: -20,
      opacity: 0,
      transition: springTransition,
    },
  };

  return (
    <motion.div
      className={cn(className)}
      initial={state === 'expanded' ? 'expanded' : 'collapsed'}
      animate={state === 'expanded' ? 'expanded' : 'collapsed'}
      variants={itemVariants}
    >
      {children}
    </motion.div>
  );
}

// For animating groups in the sidebar
export function AnimatedSidebarGroup({
  children,
  className,
}: AnimatedSidebarWrapperProps) {
  const { state } = useSidebar();

  const groupVariants = {
    expanded: {
      y: 0,
      opacity: 1,
      transition: {
        ...springTransition,
        staggerChildren: 0.05,
      },
    },
    collapsed: {
      y: 10,
      opacity: 0,
      transition: springTransition,
    },
  };

  return (
    <motion.div
      className={cn(className)}
      initial={state === 'expanded' ? 'expanded' : 'collapsed'}
      animate={state === 'expanded' ? 'expanded' : 'collapsed'}
      variants={groupVariants}
    >
      {children}
    </motion.div>
  );
}

export default AnimatedSidebarWrapper;
