import type { ComponentProps } from 'react';

import { type SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { SidebarLeftIcon } from './icons';
import GlassSurface from '@/components/GlassSurface';

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar, state } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <GlassSurface
          data-testid="sidebar-toggle-button"
          width={32}
          height={32}
          borderRadius={10}
          displace={3}
          backgroundOpacity={0.25}
          blur={11}
          insetShadowIntensity={0.2}
          isButton={true}
          onClick={toggleSidebar}
          className="md:w-8 md:h-8 cursor-pointer hover:bg-white/10 dark:hover:bg-black/10 text-zinc-900 dark:text-zinc-100"
        >
          <span className="relative z-20 text-zinc-900 dark:text-zinc-100">
            <SidebarLeftIcon size={16} />
          </span>
        </GlassSurface>
      </TooltipTrigger>
      <TooltipContent align="start">
        {state === 'expanded' ? 'Collapse Sidebar' : 'Expand Sidebar'}
      </TooltipContent>
    </Tooltip>
  );
}
