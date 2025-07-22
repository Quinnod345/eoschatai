'use client';

import { useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useOptimizedNavigation } from './use-optimized-navigation';

interface UseKeyboardNavigationProps {
  chatIds: string[];
  enabled?: boolean;
}

export function useChatKeyboardNavigation({
  chatIds,
  enabled = true,
}: UseKeyboardNavigationProps) {
  const router = useRouter();
  const params = useParams();
  const currentChatId = params?.id as string;
  const { navigateToChat } = useOptimizedNavigation();

  const navigateToPreviousChat = useCallback(() => {
    if (!currentChatId || chatIds.length === 0) return;

    const currentIndex = chatIds.indexOf(currentChatId);
    if (currentIndex <= 0) return; // Already at the first chat or not found

    const previousChatId = chatIds[currentIndex - 1];
    navigateToChat(previousChatId, {
      loadingText: 'Opening previous chat...',
    });
  }, [currentChatId, chatIds, navigateToChat]);

  const navigateToNextChat = useCallback(() => {
    if (!currentChatId || chatIds.length === 0) return;

    const currentIndex = chatIds.indexOf(currentChatId);
    if (currentIndex === -1 || currentIndex >= chatIds.length - 1) return;

    const nextChatId = chatIds[currentIndex + 1];
    navigateToChat(nextChatId, {
      loadingText: 'Opening next chat...',
    });
  }, [currentChatId, chatIds, navigateToChat]);

  const navigateToFirstChat = useCallback(() => {
    if (chatIds.length === 0) return;

    const firstChatId = chatIds[0];
    if (firstChatId !== currentChatId) {
      navigateToChat(firstChatId, {
        loadingText: 'Opening first chat...',
      });
    }
  }, [chatIds, currentChatId, navigateToChat]);

  const navigateToLastChat = useCallback(() => {
    if (chatIds.length === 0) return;

    const lastChatId = chatIds[chatIds.length - 1];
    if (lastChatId !== currentChatId) {
      navigateToChat(lastChatId, {
        loadingText: 'Opening last chat...',
      });
    }
  }, [chatIds, currentChatId, navigateToChat]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      // Cmd/Ctrl + [ for previous chat
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        navigateToPreviousChat();
      }
      // Cmd/Ctrl + ] for next chat
      else if ((e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault();
        navigateToNextChat();
      }
      // Cmd/Ctrl + Shift + [ for first chat
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '{') {
        e.preventDefault();
        navigateToFirstChat();
      }
      // Cmd/Ctrl + Shift + ] for last chat
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '}') {
        e.preventDefault();
        navigateToLastChat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    navigateToPreviousChat,
    navigateToNextChat,
    navigateToFirstChat,
    navigateToLastChat,
  ]);

  return {
    navigateToPreviousChat,
    navigateToNextChat,
    navigateToFirstChat,
    navigateToLastChat,
  };
}
