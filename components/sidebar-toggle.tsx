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

// Spring animation configuration
const springTransition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
};

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar, state } = useSidebar();
  
  // Different icon rotation based on sidebar state
  const iconVariants = {
    expanded: { rotate: 0, transition: springTransition },
    collapsed: { rotate: 180, transition: springTransition },
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-testid="sidebar-toggle-button"
          onClick={toggleSidebar}
          variant="outline"
          className="md:px-2 md:h-fit relative overflow-hidden group"
        >
          <motion.div
            animate={state === 'expanded' ? 'expanded' : 'collapsed'}
            variants={iconVariants}
            initial={false}
          >
            <SidebarLeftIcon size={16} />
          </motion.div>
          <motion.div
            className="absolute inset-0 bg-primary/10 rounded-md opacity-0"
            whileHover={{ opacity: 1, transition: { duration: 0.2 } }}
            whileTap={{ opacity: 1, scale: 0.95 }}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent align="start">Toggle Sidebar</TooltipContent>
    </Tooltip>
  );
}
