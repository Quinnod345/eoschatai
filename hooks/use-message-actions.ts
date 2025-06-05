import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { PinnedMessage } from '@/lib/db/schema';

interface UseMessageActionsProps {
  chatId: string;
}

// Global event emitter for real-time updates
const emitMessageActionUpdate = (type: 'pin', data: any) => {
  window.dispatchEvent(
    new CustomEvent('messageActionUpdate', {
      detail: { type, data },
    }),
  );
};

export function useMessageActions({ chatId }: UseMessageActionsProps) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch pinned messages
  const fetchData = useCallback(async () => {
    try {
      const pinnedRes = await fetch(`/api/pin?chatId=${chatId}`);

      if (pinnedRes.ok) {
        const pinned = await pinnedRes.json();
        setPinnedMessages(pinned);
      }
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for real-time updates
  useEffect(() => {
    const handleMessageActionUpdate = (event: CustomEvent) => {
      const { type, data } = event.detail;

      if (type === 'pin') {
        if (data.pinned) {
          setPinnedMessages((prev) => [...prev, data.pinnedMessage]);
        } else {
          setPinnedMessages((prev) =>
            prev.filter((p) => p.messageId !== data.messageId),
          );
        }
      }
    };

    window.addEventListener(
      'messageActionUpdate',
      handleMessageActionUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        'messageActionUpdate',
        handleMessageActionUpdate as EventListener,
      );
    };
  }, []);

  const handlePin = async (messageId: string) => {
    try {
      const response = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, chatId }),
      });

      const data = await response.json();

      if (data.pinned) {
        toast.success('Message pinned');
        const newPinnedMessage: PinnedMessage = {
          id: data.id || '', // Server should return the ID
          userId: '', // Will be set by server
          messageId,
          chatId,
          pinnedAt: new Date(),
        };

        // Update local state immediately
        setPinnedMessages((prev) => [...prev, newPinnedMessage]);

        // Emit event for other components
        emitMessageActionUpdate('pin', {
          pinned: true,
          messageId,
          pinnedMessage: newPinnedMessage,
        });
      } else {
        toast.success('Message unpinned');

        // Update local state immediately
        setPinnedMessages((prev) =>
          prev.filter((p) => p.messageId !== messageId),
        );

        // Emit event for other components
        emitMessageActionUpdate('pin', {
          pinned: false,
          messageId,
        });
      }
    } catch (error) {
      toast.error('Failed to pin/unpin message');
    }
  };

  const handleReply = (messageId: string, messageContent: string) => {
    // Extract text content from the message
    const textContent = messageContent
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');

    // Set the input with a reply indicator
    const replyText = `${textContent}\n\n`;

    // Focus the input and set the reply text
    const inputElement = document.querySelector(
      'textarea[name="message"]',
    ) as HTMLTextAreaElement;
    if (inputElement) {
      inputElement.value = replyText;
      inputElement.focus();
      inputElement.setSelectionRange(replyText.length, replyText.length);

      // Trigger input event to update the state
      const event = new Event('input', { bubbles: true });
      inputElement.dispatchEvent(event);

      // Scroll to the input
      inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const isPinned = (messageId: string) => {
    return pinnedMessages.some((p) => p.messageId === messageId);
  };

  return {
    pinnedMessages,
    isLoading,
    handlePin,
    handleReply,
    isPinned,
    refetch: fetchData, // Expose refetch function
  };
}
