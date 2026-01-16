'use client';

import { memo } from 'react';
import type { Attachment } from './types';
import cx from 'classnames';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';

interface SendButtonProps {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
  attachmentsCount: number;
  pdfCount: number;
  docCount: number;
  audioCount: number;
  audioProcessing: boolean;
  handleSubmit: () => void;
  attachments: Array<Attachment>;
}

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
  attachmentsCount,
  pdfCount,
  docCount,
  audioCount,
  audioProcessing,
}: SendButtonProps) {
  const nothingToSend =
    input.trim().length === 0 &&
    attachmentsCount === 0 &&
    pdfCount === 0 &&
    docCount === 0 &&
    audioCount === 0;
  const isDisabled = nothingToSend || uploadQueue.length > 0 || audioProcessing;

  return (
    <Button
      data-testid="send-button"
      className={cx(
        'rounded-full p-2 h-9 w-9 flex items-center justify-center transition-all duration-200 shadow-sm',
        isDisabled
          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700 cursor-not-allowed'
          : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:scale-105 active:scale-95',
      )}
      onClick={(event) => {
        event.preventDefault();
        if (!isDisabled) {
          submitForm();
        }
      }}
      disabled={isDisabled}
      title={
        audioProcessing
          ? 'Waiting for audio transcription to complete...'
          : uploadQueue.length > 0
            ? 'Waiting for uploads to complete...'
            : nothingToSend
              ? 'Type a message or add files'
              : 'Send message'
      }
    >
      <ArrowUp className="size-5" />
    </Button>
  );
}

export const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.attachmentsCount !== nextProps.attachmentsCount) return false;
  if (prevProps.pdfCount !== nextProps.pdfCount) return false;
  if (prevProps.docCount !== nextProps.docCount) return false;
  if (prevProps.audioProcessing !== nextProps.audioProcessing) return false;
  return true;
});
