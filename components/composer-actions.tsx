import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { composerDefinitions, type UIComposer } from './composer';
import { type Dispatch, memo, type SetStateAction, useState } from 'react';
import type { ComposerActionContext } from './create-composer';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast-system';

interface ComposerActionsProps {
  composer: UIComposer;
  handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: 'edit' | 'diff' | 'changes';
  metadata: any;
  setMetadata: Dispatch<SetStateAction<any>>;
}

function PureComposerActions({
  composer,
  handleVersionChange,
  currentVersionIndex,
  isCurrentVersion,
  mode,
  metadata,
  setMetadata,
}: ComposerActionsProps) {
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

  return (
    <div className="flex flex-row gap-1">
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

export const ComposerActions = memo(
  PureComposerActions,
  (prevProps, nextProps) => {
    if (prevProps.composer.status !== nextProps.composer.status) return false;
    if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
      return false;
    if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
    if (prevProps.composer.content !== nextProps.composer.content) return false;

    return true;
  },
);
