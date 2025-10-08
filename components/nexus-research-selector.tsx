'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
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
import { useAccountStore } from '@/lib/stores/account-store';
import { DeepResearchModal } from '@/components/deep-research-modal';

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
    description: 'Regular chat without Nexus research',
    icon: <SearchIcon size={16} />,
  },
  {
    id: 'nexus',
    label: 'Nexus',
    description:
      'AI-powered Nexus research with comprehensive web analysis and follow-ups',
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
  const [showDeepResearchModal, setShowDeepResearchModal] = useState(false);
  const entitlements = useAccountStore((state) => state.entitlements);
  // IMPORTANT: Avoid allocating a new object in Zustand selector (can cause useSyncExternalStore loop)
  const ready = useAccountStore((state) => state.ready);
  const user = useAccountStore((state) => state.user);

  const selectedMode = useMemo(
    () => researchModes.find((mode) => mode.id === selectedResearchMode),
    [selectedResearchMode],
  );

  // Intensive logging for debugging in chat context
  useEffect(() => {
    console.log('[NexusSelector] render', {
      chatId,
      selectedResearchMode,
      entitlements,
      deepResearchEnabled: entitlements?.features.deep_research.enabled,
      ready,
      userPlan: user?.plan,
      menuOpen: open,
    });
  }, [chatId, selectedResearchMode, entitlements, ready, user?.plan, open]);

  return (
    <>
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
              'backdrop-blur-[16px] backdrop-filter',
              'border-white/30 dark:border-zinc-700/30',
              'bg-white/60 dark:bg-zinc-900/60 hover:bg-white/80 dark:hover:bg-zinc-900/80',
              selectedMode?.color,
              selectedResearchMode === 'nexus' &&
                'border-purple-500/50 bg-purple-50/30 dark:bg-purple-900/30',
            )}
            style={{
              WebkitBackdropFilter: 'blur(16px)',
            }}
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

        <DropdownMenuContent
          align="start"
          className={cn(
            'min-w-[300px]',
            'backdrop-blur-[16px] backdrop-filter',
            'border-white/30 dark:border-zinc-700/30',
            'bg-white/80 dark:bg-zinc-900/80',
          )}
          style={{
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow:
              'inset 0px 0px 10px rgba(0, 0, 0, 0.1), 0 8px 30px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.12)',
          }}
        >
          {researchModes.map((mode) => {
            const isHovered = hoveredId === mode.id;

            return (
              <DropdownMenuItem
                data-testid={`research-mode-selector-item-${mode.id}`}
                key={mode.id}
                onSelect={() => {
                  console.log(`[NexusSelector] Mode selected: ${mode.id}`, {
                    entitlements,
                    deepResearchEnabled:
                      entitlements?.features.deep_research.enabled,
                    willOpenUpgrade:
                      mode.id === 'nexus' &&
                      !entitlements?.features.deep_research.enabled,
                  });

                  if (
                    mode.id === 'nexus' &&
                    !entitlements?.features.deep_research.enabled
                  ) {
                    console.log('[NexusSelector] Opening deep research modal');
                    setShowDeepResearchModal(true);
                    setOpen(false);
                    return;
                  }

                  onResearchModeChange(mode.id);
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
      <DeepResearchModal
        open={showDeepResearchModal}
        onClose={() => setShowDeepResearchModal(false)}
      />
    </>
  );
}
