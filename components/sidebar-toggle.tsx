'use client';

import type { ComponentProps } from 'react';
import { useState } from 'react';

import { type SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { SidebarLeftIcon } from './icons';

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const [isHovered, setIsHovered] = useState(false);

  // When collapsed: show bulb, on hover show sidebar icon
  // When expanded: always show sidebar icon
  const showBulb = isCollapsed && !isHovered;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid="sidebar-toggle-button"
          onClick={toggleSidebar}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="sidebar-toggle-btn w-8 h-8 flex items-center justify-center rounded-[10px] cursor-pointer 
                     bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 
                     border border-black/10 dark:border-white/15
                     transition-colors duration-150 overflow-visible"
        >
          {/* Icon container */}
          <div className="relative w-7 h-7 flex items-center justify-center overflow-visible">
            {/* EOS Logo - shown when collapsed and not hovered */}
            {showBulb ? (
              <div
                className="relative w-[28px] h-[28px] flex items-center justify-center overflow-visible"
                style={{
                  backgroundImage: 'url(/images/favicon.png)',
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                }}
              >
                {/* Fallback img tag */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/favicon.png"
                  alt="EOS"
                  className="w-full h-full object-contain opacity-0"
                  style={{ pointerEvents: 'none' }}
                  onError={(e) => {
                    console.error('Image failed to load:', e);
                    // Remove opacity-0 on error to show broken image icon
                    (e.target as HTMLImageElement).classList.remove(
                      'opacity-0',
                    );
                  }}
                />
              </div>
            ) : (
              <span
                className="flex items-center justify-center text-zinc-700 dark:text-zinc-200"
                style={{
                  transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                <SidebarLeftIcon size={16} />
              </span>
            )}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent align="start">
        {state === 'expanded' ? 'Collapse Sidebar' : 'Expand Sidebar'}
      </TooltipContent>
    </Tooltip>
  );
}
