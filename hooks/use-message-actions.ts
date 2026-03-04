import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/lib/toast-system';
import type { PinnedMessage } from '@/lib/db/schema';

interface UseMessageActionsProps {
  chatId: string;
  onStartReply?: (
    messageId: string,
    content: string,
    role: 'user' | 'assistant',
  ) => void;
}

// Global event emitter for real-time updates
const emitMessageActionUpdate = (type: 'pin', data: any) => {
  window.dispatchEvent(
    new CustomEvent('messageActionUpdate', {
      detail: { type, data },
    }),
  );
};

export function useMessageActions({
  chatId,
  onStartReply,
}: UseMessageActionsProps) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch pinned messages
  const fetchData = useCallback(async () => {
    try {
      const pinnedRes = await fetch(`/api/pin?chatId=${chatId}`);

      if (pinnedRes.ok) {
        const pinned = await pinnedRes.json();
        // Ensure we only set valid pinned messages
        if (Array.isArray(pinned)) {
          const validPinned = pinned.filter(
            (p) => p && typeof p === 'object' && p.messageId,
          );
          setPinnedMessages(validPinned);
        } else {
          setPinnedMessages([]);
        }
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
    const handleMessageActionUpdate = (event: Event) => {
      const custom = event as CustomEvent;
      const detail: any = (custom as any)?.detail;
      const type = detail?.type;
      const data = detail?.data;

      if (type === 'pin') {
        setPinnedMessages((prev) => {
          const safePrev = Array.isArray(prev)
            ? prev.filter((p) => (p as any)?.messageId)
            : [];
          const messageId: string | undefined = data?.messageId;
          const pinned: boolean | undefined = data?.pinned;

          if (!messageId) return safePrev;

          if (pinned) {
            const newPin: PinnedMessage =
              data?.pinnedMessage ||
              ({
                id: data?.id || `temp-${Date.now()}`,
                userId: data?.userId || '',
                messageId,
                chatId: data?.chatId || chatId,
                pinnedAt: data?.pinnedAt ? new Date(data.pinnedAt) : new Date(),
              } as PinnedMessage);

            const without = safePrev.filter((p) => p?.messageId !== messageId);
            return [...without, newPin];
          }

          // Unpin path
          return safePrev.filter((p) => p?.messageId !== messageId);
        });
      }
    };

    window.addEventListener('messageActionUpdate', handleMessageActionUpdate);

    return () => {
      window.removeEventListener(
        'messageActionUpdate',
        handleMessageActionUpdate,
      );
    };
  }, [chatId]);

  const handlePin = async (messageId: string) => {
    // Optimistic toggle
    const wasPinned = isPinned(messageId);
    const previousPin =
      pinnedMessages.find((p) => p.messageId === messageId) || null;

    if (wasPinned) {
      // Optimistically remove
      setPinnedMessages((prev) =>
        prev.filter((p) => p.messageId !== messageId),
      );
      emitMessageActionUpdate('pin', {
        pinned: false,
        messageId,
        chatId,
      });
    } else {
      // Optimistically add
      const optimisticPin: PinnedMessage = {
        id: `temp-${Date.now()}`,
        userId: '',
        messageId,
        chatId,
        pinnedAt: new Date(),
      };
      setPinnedMessages((prev) => [...prev, optimisticPin]);
      emitMessageActionUpdate('pin', {
        pinned: true,
        messageId,
        pinnedMessage: optimisticPin,
        chatId,
      });
    }

    try {
      const response = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, chatId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data?.code === 'FEATURE_LOCKED') {
          setPinnedMessages((prev) => {
            const without = prev.filter((p) => p.messageId !== messageId);
            if (wasPinned && previousPin) {
              return [...without, previousPin];
            }
            return without;
          });
          emitMessageActionUpdate('pin', {
            pinned: wasPinned,
            messageId,
            chatId,
          });
          window.dispatchEvent(new Event('open-premium-modal'));
          return;
        }
        throw new Error(data.error || 'Failed to pin/unpin');
      }

      // Reconcile with server state
      if (data.pinned) {
        const serverPin: PinnedMessage = {
          id: data.id || previousPin?.id || `temp-${Date.now()}`,
          userId: data.userId || previousPin?.userId || '',
          messageId,
          chatId,
          pinnedAt: data.pinnedAt
            ? new Date(data.pinnedAt)
            : previousPin?.pinnedAt || new Date(),
        };

        setPinnedMessages((prev) => {
          const without = prev.filter((p) => p.messageId !== messageId);
          return [...without, serverPin];
        });

        toast.success('Message pinned');
      } else {
        setPinnedMessages((prev) =>
          prev.filter((p) => p.messageId !== messageId),
        );
        toast.success('Message unpinned');
      }

      emitMessageActionUpdate('pin', {
        pinned: data.pinned,
        messageId,
        chatId,
      });
    } catch (error) {
      // Rollback
      setPinnedMessages((prev) => {
        const without = prev.filter((p) => p.messageId !== messageId);
        if (wasPinned && previousPin) {
          return [...without, previousPin];
        }
        return without;
      });

      emitMessageActionUpdate('pin', {
        pinned: wasPinned,
        messageId,
        chatId,
      });

      toast.error('Failed to pin/unpin message');
    }
  };

  const handleReply = (
    messageId: string,
    messageContent: string,
    messageRole: 'user' | 'assistant' = 'assistant',
  ) => {
    // If we have a modern reply callback, use it
    if (onStartReply) {
      onStartReply(messageId, messageContent, messageRole);
      return;
    }

    // Fallback to the old direct DOM manipulation method
    // Extract text content from the message
    const textContent = messageContent
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');

    // Set the input with a reply indicator
    const replyText = `${textContent}\n\n`;

    // Focus the input and set the reply text - use the correct selector
    const inputElement = document.querySelector(
      'textarea[data-testid="multimodal-input"]',
    ) as HTMLTextAreaElement;

    if (inputElement) {
      inputElement.value = replyText;
      inputElement.focus();
      inputElement.setSelectionRange(replyText.length, replyText.length);

      // Trigger input event to update the state - use a more comprehensive event
      const inputEvent = new Event('input', { bubbles: true });
      inputElement.dispatchEvent(inputEvent);

      // Also trigger a change event to ensure all event handlers are called
      const changeEvent = new Event('change', { bubbles: true });
      inputElement.dispatchEvent(changeEvent);

      // Scroll to the input
      inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Trigger height adjustment if the textarea has an adjustHeight method
      // This ensures the textarea expands to fit the reply content
      if (textContent.split('\n').length > 2) {
        setTimeout(() => {
          if (inputElement) {
            inputElement.style.height = 'auto';
            inputElement.style.height = `${inputElement.scrollHeight + 2}px`;
          }
        }, 10);
      }
    } else {
      console.warn('Could not find textarea element for reply functionality');
    }
  };

  const isPinned = (messageId: string) => {
    if (!messageId) return false;
    if (!Array.isArray(pinnedMessages)) return false;

    return pinnedMessages.some((p) => {
      // Extra safety check
      if (!p || typeof p !== 'object') {
        return false;
      }
      return p.messageId === messageId;
    });
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
