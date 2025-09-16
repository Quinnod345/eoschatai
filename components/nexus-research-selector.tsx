'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CheckCircleFillIcon, ChevronDownIcon, SearchIcon } from './icons';
import { Telescope } from 'lucide-react';

export type ResearchMode = 'off' | 'nexus';

const researchModes: Array<{
  id: ResearchMode;
  label: string;
  description: string;
  icon: ReactNode;
  color?: string;
}> = [
  {
    id: 'off',
    label: 'Standard',
    description: 'Regular chat without deep research',
    icon: <SearchIcon size={16} />,
  },
  {
    id: 'nexus',
    label: 'Deep Research',
    description:
      'AI-powered comprehensive web research with follow-up questions',
    icon: <Telescope className="size-4" />,
    color: 'text-purple-600 dark:text-purple-400',
  },
];

interface NexusResearchSelectorProps {
  chatId: string;
  className?: string;
  selectedResearchMode: ResearchMode;
  onResearchModeChange: (mode: ResearchMode) => void;
}

export function NexusResearchSelector({
  chatId,
  className,
  selectedResearchMode,
  onResearchModeChange,
}: NexusResearchSelectorProps) {
  const [open, setOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<ResearchMode | null>(null);

  const selectedMode = useMemo(
    () => researchModes.find((mode) => mode.id === selectedResearchMode),
    [selectedResearchMode],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button
          data-testid="research-mode-selector"
          variant="outline"
          className={cn(
            'md:px-2 md:h-[34px]',
            selectedMode?.color,
            selectedResearchMode === 'nexus' &&
              'border-purple-500/50 bg-purple-50/10 dark:bg-purple-900/10',
          )}
        >
          <span className={cn('transition-all', selectedMode?.color)}>
            {selectedMode?.icon}
          </span>
          <span className={cn('hidden md:inline ml-1', selectedMode?.color)}>
            {selectedMode?.label}
          </span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[300px]">
        {researchModes.map((mode) => {
          const isHovered = hoveredId === mode.id;

          return (
            <DropdownMenuItem
              data-testid={`research-mode-selector-item-${mode.id}`}
              key={mode.id}
              onSelect={() => {
                console.log('[NexusResearchSelector] Mode selected:', mode.id);
                console.log(
                  '[NexusResearchSelector] Previous mode:',
                  selectedResearchMode,
                );
                console.log(
                  '[NexusResearchSelector] Calling onResearchModeChange with:',
                  mode.id,
                );

                // Call the change handler immediately
                onResearchModeChange(mode.id);

                console.log(
                  '[NexusResearchSelector] onResearchModeChange called, closing dropdown',
                );
                setOpen(false);
              }}
              className="gap-4 group/item flex flex-row justify-between items-center"
              data-active={mode.id === selectedResearchMode}
              onMouseEnter={() => setHoveredId(mode.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="flex flex-col gap-1 items-start">
                <div className={cn('flex items-center gap-2', mode.color)}>
                  {mode.icon}
                  <span>{mode.label}</span>
                </div>
                {mode.description && (
                  <div
                    className={`text-xs ${isHovered ? 'text-white' : 'text-muted-foreground'}`}
                    style={isHovered ? { color: 'white' } : undefined}
                  >
                    {mode.description}
                  </div>
                )}
              </div>
              <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                <CheckCircleFillIcon />
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
