'use client';

import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { composerDefinitions, type UIComposer } from './composer';
import { type Dispatch, memo, type SetStateAction, useState } from 'react';
import type { ComposerActionContext } from './create-composer';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast-system';
import { Bold, Italic, List, ListOrdered, Type } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ComposerHeaderActionsProps {
  composer: UIComposer;
  handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: 'edit' | 'diff' | 'changes';
  metadata: any;
  setMetadata: Dispatch<SetStateAction<any>>;
}

function PureComposerHeaderActions({
  composer,
  handleVersionChange,
  currentVersionIndex,
  isCurrentVersion,
  mode,
  metadata,
  setMetadata,
}: ComposerHeaderActionsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const composerDefinition = composerDefinitions.find(
    (definition) => definition.kind === composer.kind,
  );

  if (!composerDefinition) {
    throw new Error('Composer definition not found!');
  }

  const actionContext: ComposerActionContext = {
    content: composer.content,
    title: composer.title,
    handleVersionChange,
    currentVersionIndex,
    isCurrentVersion,
    mode,
    metadata,
    setMetadata,
  };

  // Handle formatting commands via custom events
  const handleFormatCommand = (command: string, data?: any) => {
    const event = new CustomEvent(command, { detail: data });
    window.dispatchEvent(event);
  };

  return (
    <div className="flex flex-row items-center gap-1">
      {/* Text Formatting Buttons - only show for text documents */}
      {composer.kind === 'text' && isCurrentVersion && (
        <>
          {/* Font Size / Heading Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Type className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => handleFormatCommand('format-paragraph')}
              >
                Normal Text
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleFormatCommand('format-heading', { level: 1 })
                }
              >
                Heading 1
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleFormatCommand('format-heading', { level: 2 })
                }
              >
                Heading 2
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleFormatCommand('format-heading', { level: 3 })
                }
              >
                Heading 3
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bold Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => handleFormatCommand('format-bold')}
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bold (Ctrl/Cmd+B)</TooltipContent>
          </Tooltip>

          {/* Italic Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => handleFormatCommand('format-italic')}
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Italic (Ctrl/Cmd+I)</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />

          {/* Bullet List Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => handleFormatCommand('format-bullet-list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bullet List</TooltipContent>
          </Tooltip>

          {/* Ordered List Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => handleFormatCommand('format-ordered-list')}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Numbered List</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />
        </>
      )}

      {/* Regular Composer Actions */}
      {composerDefinition.actions.map((action) => (
        <Tooltip key={action.description}>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className={cn('h-fit dark:hover:bg-zinc-700', {
                'p-2': !action.label,
                'py-1.5 px-2': action.label,
              })}
              onClick={async () => {
                setIsLoading(true);

                try {
                  await Promise.resolve(action.onClick(actionContext));
                } catch (error) {
                  toast.error('Failed to execute action');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={
                isLoading || composer.status === 'streaming'
                  ? true
                  : action.isDisabled
                    ? action.isDisabled(actionContext)
                    : false
              }
            >
              {action.icon}
              {action.label}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{action.description}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export const ComposerHeaderActions = memo(
  PureComposerHeaderActions,
  (prevProps, nextProps) => {
    if (prevProps.composer.status !== nextProps.composer.status) return false;
    if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
      return false;
    if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
    if (prevProps.composer.content !== nextProps.composer.content) return false;

    return true;
  },
);
