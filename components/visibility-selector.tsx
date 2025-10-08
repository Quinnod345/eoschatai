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
import {
  CheckCircleFillIcon,
  ChevronDownIcon,
  GlobeIcon,
  LockIcon,
} from './icons';
import { useChatVisibility } from '@/hooks/use-chat-visibility';

export type VisibilityType = 'private' | 'public';

const visibilities: Array<{
  id: VisibilityType;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    id: 'private',
    label: 'Private',
    description: 'Only you can access this chat',
    icon: <LockIcon />,
  },
  {
    id: 'public',
    label: 'Public',
    description: 'Anyone with the link can access this chat',
    icon: <GlobeIcon />,
  },
];

export function VisibilitySelector({
  chatId,
  className,
  selectedVisibilityType,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<VisibilityType | null>(null);

  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId,
    initialVisibilityType: selectedVisibilityType,
  });

  const selectedVisibility = useMemo(
    () => visibilities.find((visibility) => visibility.id === visibilityType),
    [visibilityType],
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
          data-testid="visibility-selector"
          variant="outline"
          className={cn(
            'md:px-2 md:h-[34px]',
            'backdrop-blur-[16px] backdrop-filter',
            'border-white/30 dark:border-zinc-700/30',
            'bg-white/60 dark:bg-zinc-900/60 hover:bg-white/80 dark:hover:bg-zinc-900/80',
          )}
          style={{
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {selectedVisibility?.icon}
          <span className="hidden md:inline ml-1">
            {selectedVisibility?.label}
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
        {visibilities.map((visibility) => {
          const isHovered = hoveredId === visibility.id;

          return (
            <DropdownMenuItem
              data-testid={`visibility-selector-item-${visibility.id}`}
              key={visibility.id}
              onSelect={() => {
                setVisibilityType(visibility.id);
                setOpen(false);
              }}
              className="gap-4 group/item flex flex-row justify-between items-center"
              data-active={visibility.id === visibilityType}
              onMouseEnter={() => setHoveredId(visibility.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="flex flex-col gap-1 items-start">
                {visibility.label}
                {visibility.description && (
                  <div
                    className={`text-xs ${isHovered ? 'text-white' : 'text-muted-foreground'}`}
                    style={isHovered ? { color: 'white' } : undefined}
                  >
                    {visibility.description}
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
