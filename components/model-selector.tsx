'use client';

import { startTransition, useMemo, useOptimistic, useState } from 'react';

import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { chatModels } from '@/lib/ai/models';
import { cn } from '@/lib/utils';
import { toast } from '@/components/toast';

import { CheckCircleFillIcon, ChevronDownIcon } from './icons';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import type { Session } from 'next-auth';

export function ModelSelector({
  session,
  selectedModelId,
  className,
}: {
  session: Session;
  selectedModelId: string;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);

  const userType = session.user.type;
  const { availableChatModelIds } = entitlementsByUserType[userType];

  const availableChatModels = chatModels.filter((chatModel) =>
    availableChatModelIds.includes(chatModel.id),
  );

  const selectedChatModel = useMemo(
    () =>
      availableChatModels.find(
        (chatModel) => chatModel.id === optimisticModelId,
      ),
    [optimisticModelId, availableChatModels],
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
          data-testid="model-selector"
          variant="outline"
          className="md:px-2 md:h-[34px]"
        >
          <span className="hidden md:inline">{selectedChatModel?.name}</span>
          <span className="md:hidden">Model</span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[300px]">
        {availableChatModels.map((chatModel) => {
          const { id } = chatModel;
          const isHovered = hoveredId === id;

          return (
            <DropdownMenuItem
              data-testid={`model-selector-item-${id}`}
              key={id}
              onSelect={() => {
                setOpen(false);

                startTransition(() => {
                  setOptimisticModelId(id);
                  saveChatModelAsCookie(id);

                  // Show warning toast for reasoning model
                  if (
                    id === 'chat-model-reasoning' &&
                    optimisticModelId !== id
                  ) {
                    toast({
                      type: 'error',
                      description:
                        "The Reasoning model has limited functionality. It cannot access calendar features, use saved knowledge, retrieve documents, or use most other tools. It's designed for step-by-step reasoning on complex problems.",
                    });
                  }

                  // Dispatch a custom event for model change
                  if (typeof window !== 'undefined') {
                    // Clear any pending provider change timestamp
                    sessionStorage.removeItem('provider_change_timestamp');

                    // Set model in session storage
                    sessionStorage.setItem('current_model', id);

                    // Create and dispatch a custom event
                    const event = new CustomEvent('modelChanged', {
                      detail: {
                        modelId: id,
                        timestamp: Date.now(),
                        preventReload: true,
                      },
                    });
                    window.dispatchEvent(event);
                    console.log(`Model change event dispatched: ${id}`);
                  }
                });
              }}
              data-active={id === optimisticModelId}
              asChild
            >
              <button
                type="button"
                className="gap-4 group/item flex flex-row justify-between items-center w-full"
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="flex flex-col gap-1 items-start">
                  <div>{chatModel.name}</div>
                  <div
                    className={`text-xs ${isHovered ? 'text-white' : 'text-muted-foreground'}`}
                    style={isHovered ? { color: 'white' } : undefined}
                  >
                    {chatModel.description}
                  </div>
                </div>

                <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                  <CheckCircleFillIcon />
                </div>
              </button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
