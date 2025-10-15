'use client';

import { type ReactNode, useMemo, useState } from 'react';
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
import GlassSurface from '@/components/GlassSurface';

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
  className?: string;
  selectedVisibilityType: VisibilityType;
}) {
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
      <DropdownMenuTrigger asChild>
        <GlassSurface
          data-testid="visibility-selector"
          width="auto"
          height={34}
          borderRadius={15}
          displace={5}
          insetShadowIntensity={0.2}
          backgroundOpacity={0.5}
          
          blur={0}
          isButton={true}
          className={cn('md:px-2 md:h-[34px] cursor-pointer', className)}
        >
          {selectedVisibility?.icon}
          <span className="hidden md:inline ml-1">
            {selectedVisibility?.label}
          </span>
          <ChevronDownIcon />
        </GlassSurface>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className={cn('min-w-[300px]')}>
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
