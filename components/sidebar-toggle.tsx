import type { ComponentProps } from 'react';
import { motion } from 'framer-motion';

import { type SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { SidebarLeftIcon } from './icons';
import { Button } from './ui/button';

// Enhanced spring animation configuration
const springTransition = {
  type: 'spring',
  stiffness: 450,
  damping: 22,
  mass: 0.9,
};

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar, state } = useSidebar();

  // Different animation variants based on sidebar state
  const iconVariants = {
    expanded: {
      rotate: 0,
      scale: 1,
      transition: springTransition,
    },
    collapsed: {
      rotate: 180,
      scale: 1,
      transition: springTransition,
    },
  };

  // Background animation variants
  const backgroundVariants = {
    rest: {
      background: 'rgba(var(--primary-rgb), 0.05)',
      scale: 1,
    },
    hover: {
      background: 'rgba(var(--primary-rgb), 0.15)',
      scale: 1.05,
      boxShadow: '0 0 10px rgba(var(--primary-rgb), 0.2)',
    },
    tap: {
      scale: 0.95,
      background: 'rgba(var(--primary-rgb), 0.25)',
    },
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          className="relative"
          initial="rest"
          whileHover="hover"
          whileTap="tap"
        >
          <Button
            data-testid="sidebar-toggle-button"
            onClick={toggleSidebar}
            variant="ghost"
            className="md:px-3 py-2 md:h-9 relative overflow-hidden rounded-lg border border-primary/30 group"
          >
            <motion.div
              className="z-10 relative"
              animate={state === 'expanded' ? 'expanded' : 'collapsed'}
              variants={iconVariants}
              initial={false}
            >
              <SidebarLeftIcon size={18} />
            </motion.div>

            {/* Decorative elements */}
            <motion.div
              className="absolute inset-0 rounded-lg"
              variants={backgroundVariants}
              transition={{ duration: 0.2 }}
            />

            {/* Pulsing glow effect */}
            <motion.div
              className="absolute inset-0 bg-primary/5 rounded-lg"
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(var(--primary-rgb), 0)',
                  '0 0 0 4px rgba(var(--primary-rgb), 0.1)',
                  '0 0 0 0 rgba(var(--primary-rgb), 0)',
                ],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: 'loop',
                ease: 'easeInOut',
              }}
            />

            {/* Side marker to indicate sidebar state */}
            <motion.div
              className="absolute left-0 top-0 h-full w-1 bg-primary"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{
                opacity: state === 'expanded' ? 1 : 0,
                scaleY: state === 'expanded' ? 1 : 0,
              }}
              transition={{ duration: 0.2 }}
            />
          </Button>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent align="start">
        {state === 'expanded' ? 'Collapse Sidebar' : 'Expand Sidebar'}
      </TooltipContent>
    </Tooltip>
  );
}
