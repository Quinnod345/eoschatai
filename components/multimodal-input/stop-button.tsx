'use client';

import { useState, memo } from 'react';
import type { UIMessage } from 'ai';
import { Button } from '@/components/ui/button';
import { LoaderIcon } from '@/components/icons';
import { Square } from 'lucide-react';

interface StopButtonProps {
  stop: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Array<UIMessage>>>;
  chatId: string;
}

function PureStopButton({ stop, setMessages, chatId }: StopButtonProps) {
  const [isStopping, setIsStopping] = useState(false);

  const handleStop = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (isStopping) return; // Prevent multiple clicks

    setIsStopping(true);

    try {
      // First, call the local stop function to halt the stream
      stop();

      // Then call the API to clean up server-side resources and Redis cache
      const response = await fetch(`/api/chat/${chatId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to stop stream on server:', response.statusText);
      }

      // Force a re-render to ensure UI updates
      setMessages((messages) => messages);
    } catch (error) {
      console.error('Error stopping stream:', error);
      // Even if the API call fails, the local stop() should have interrupted the stream
    } finally {
      // Reset stopping state after a short delay
      setTimeout(() => setIsStopping(false), 500);
    }
  };

  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-2 h-9 w-9 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 bg-background shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200"
      onClick={handleStop}
      disabled={isStopping}
      title="Stop generation"
    >
      {isStopping ? (
        <div className="size-4 animate-spin text-zinc-500">
          <LoaderIcon size={16} />
        </div>
      ) : (
        <Square className="size-4 text-zinc-500 fill-zinc-500" />
      )}
    </Button>
  );
}

export const StopButton = memo(PureStopButton, (prev, next) => {
  return prev.chatId === next.chatId;
});


