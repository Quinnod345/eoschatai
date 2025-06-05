import { useCallback, useEffect } from 'react';
import { toast, toastUtils } from '@/lib/toast-system';
import { useSavedContentStore } from '@/lib/stores/saved-content-store';
import type { PinnedMessage } from '@/lib/db/schema';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

interface UsePinsOptions {
  chatId?: string;
  scope?: 'chat' | 'global';
  enabled?: boolean;
}

export function usePins({
  chatId,
  scope = 'chat',
  enabled = true,
}: UsePinsOptions = {}) {
  const {
    pins,
    globalPins,
    pinsLoading,
    pinsError,
    setPins,
    setGlobalPins,
    addPin,
    removePin,
    setPinLoading,
    setPinError,
    addOptimisticOperation,
    completeOptimisticOperation,
    rollbackOptimisticOperation,
    isPinned,
    getPinsForChat,
  } = useSavedContentStore();

  // Fetch pins with retry logic
  const fetchPins = useCallback(
    async (retryCount = 0) => {
      if (!enabled || (scope === 'chat' && !chatId)) return;

      const loadingKey = scope === 'chat' ? chatId! : 'global';
      setPinLoading(loadingKey, true);
      setPinError(loadingKey, null);

      try {
        const url =
          scope === 'chat'
            ? `/api/pin?chatId=${chatId}`
            : '/api/pin?scope=global';

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch pins: ${response.statusText}`);
        }

        const data = await response.json();

        if (scope === 'chat' && chatId) {
          setPins(chatId, data);
        } else {
          setGlobalPins(data);
        }
      } catch (error) {
        console.error('Error fetching pins:', error);

        if (retryCount < MAX_RETRIES) {
          setTimeout(
            () => fetchPins(retryCount + 1),
            RETRY_DELAY * (retryCount + 1),
          );
        } else {
          const errorMessage =
            error instanceof Error ? error : new Error('Failed to fetch pins');
          setPinError(scope === 'chat' ? chatId! : 'global', errorMessage);
          toastUtils.operationError('load pinned messages');
        }
      } finally {
        setPinLoading(scope === 'chat' ? chatId! : 'global', false);
      }
    },
    [
      chatId,
      scope,
      enabled,
      setPins,
      setGlobalPins,
      setPinLoading,
      setPinError,
    ],
  );

  // Pin/unpin with optimistic updates
  const togglePin = useCallback(
    async (messageId: string, targetChatId?: string) => {
      const actualChatId = targetChatId || chatId;
      if (!actualChatId) {
        toast.error('Chat ID is required');
        return;
      }

      const operationId = `pin-${messageId}-${Date.now()}`;
      const isCurrentlyPinned = isPinned(actualChatId, messageId);

      // Optimistic update
      if (isCurrentlyPinned) {
        const currentPins = getPinsForChat(actualChatId);
        const pinToRemove = currentPins.find((p) => p.messageId === messageId);

        if (pinToRemove) {
          removePin(actualChatId, messageId);
          addOptimisticOperation(operationId, 'unpin', {
            chatId: actualChatId,
            pin: pinToRemove,
          });
        }
      } else {
        const newPin: PinnedMessage = {
          id: `temp-${Date.now()}`,
          userId: '', // Will be set by server
          messageId,
          chatId: actualChatId,
          pinnedAt: new Date(),
        };

        addPin(actualChatId, newPin);
        addOptimisticOperation(operationId, 'pin', {
          chatId: actualChatId,
          messageId,
        });
      }

      try {
        const response = await fetch('/api/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, chatId: actualChatId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to toggle pin');
        }

        // Update with server data
        if (data.pinned && data.id) {
          const serverPin: PinnedMessage = {
            id: data.id,
            userId: data.userId || '',
            messageId,
            chatId: actualChatId,
            pinnedAt: new Date(data.pinnedAt || Date.now()),
          };

          // Replace optimistic pin with server data
          removePin(actualChatId, messageId);
          addPin(actualChatId, serverPin);
        }

        completeOptimisticOperation(operationId);

        toastUtils.operationSuccess(
          data.pinned ? 'pin message' : 'unpin message',
        );

        // Emit event for other components
        window.dispatchEvent(
          new CustomEvent('messageActionUpdate', {
            detail: {
              type: 'pin',
              data: {
                pinned: data.pinned,
                messageId,
                chatId: actualChatId,
              },
            },
          }),
        );

        // Refresh global pins if needed
        if (scope === 'global') {
          fetchPins();
        }
      } catch (error) {
        console.error('Error toggling pin:', error);
        rollbackOptimisticOperation(operationId);
        toastUtils.operationError('update pin');
      }
    },
    [
      chatId,
      scope,
      isPinned,
      getPinsForChat,
      addPin,
      removePin,
      addOptimisticOperation,
      completeOptimisticOperation,
      rollbackOptimisticOperation,
      fetchPins,
    ],
  );

  // Unpin with confirmation
  const unpinMessage = useCallback(
    async (messageId: string, targetChatId?: string) => {
      const actualChatId = targetChatId || chatId;
      if (!actualChatId) return;

      if (isPinned(actualChatId, messageId)) {
        await togglePin(messageId, actualChatId);
      }
    },
    [chatId, isPinned, togglePin],
  );

  // Initial fetch
  useEffect(() => {
    fetchPins();
  }, [fetchPins]);

  // Listen for updates from other components
  useEffect(() => {
    const handleMessageActionUpdate = (event: CustomEvent) => {
      const { type, data } = event.detail;

      if (type === 'pin' && data.chatId === chatId) {
        // Refetch to ensure consistency
        fetchPins();
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
  }, [chatId, fetchPins]);

  // Get current pins based on scope
  const currentPins =
    scope === 'global' ? globalPins : chatId ? getPinsForChat(chatId) : [];

  const isLoading =
    scope === 'global'
      ? pinsLoading.has('global')
      : chatId
        ? pinsLoading.has(chatId)
        : false;

  const error =
    scope === 'global'
      ? pinsError.get('global')
      : chatId
        ? pinsError.get(chatId)
        : null;

  return {
    pins: currentPins,
    isLoading,
    error,
    togglePin,
    unpinMessage,
    isPinned: (messageId: string) =>
      chatId ? isPinned(chatId, messageId) : false,
    refetch: fetchPins,
  };
}
