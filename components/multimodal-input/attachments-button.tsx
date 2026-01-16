'use client';

import { memo } from 'react';
import type { ChatHelpers } from './types';
import { Button } from '@/components/ui/button';
import { Paperclip } from 'lucide-react';

interface AttachmentsButtonProps {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: ChatHelpers['status'];
}

function PureAttachmentsButton({
  fileInputRef,
  status,
}: AttachmentsButtonProps) {
  return (
    <Button
      data-testid="attachments-button"
      className="rounded-xl p-2 h-9 w-9 flex items-center justify-center hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all duration-200"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={status !== 'ready'}
      variant="ghost"
    >
      <Paperclip className="size-4 text-muted-foreground" />
    </Button>
  );
}

export const AttachmentsButton = memo(PureAttachmentsButton);
