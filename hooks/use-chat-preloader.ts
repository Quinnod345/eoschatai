'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface ChatCache {
  [chatId: string]: {
    data: any;
    timestamp: number;
    preloaded: boolean;
  };
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 20; // Maximum number of chats to cache

export function useChatPreloader() {
  const router = useRouter();
  const cacheRef = useRef<ChatCache>({});
  const preloadQueueRef = useRef<Set<string>>(new Set());
  const preloadingRef = useRef<Set<string>>(new Set());

  // Clean up old cache entries
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    const entries = Object.entries(cacheRef.current);

    // Remove expired entries
    entries.forEach(([chatId, entry]) => {
      if (now - entry.timestamp > CACHE_DURATION) {
        delete cacheRef.current[chatId];
      }
    });

    // If still too many, remove oldest
    if (Object.keys(cacheRef.current).length > MAX_CACHE_SIZE) {
      const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = sorted.slice(0, sorted.length - MAX_CACHE_SIZE);
      toRemove.forEach(([chatId]) => {
        delete cacheRef.current[chatId];
      });
    }
  }, []);

  // Preload a chat
  const preloadChat = useCallback(
    async (chatId: string) => {
      // Skip if already cached or being preloaded
      if (
        cacheRef.current[chatId]?.preloaded ||
        preloadingRef.current.has(chatId)
      ) {
        return;
      }

      preloadingRef.current.add(chatId);

      try {
        // Prefetch the route
        await router.prefetch(`/chat/${chatId}`);

        // Fetch chat data
        const response = await fetch(`/api/chat/${chatId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();

          // Store in cache
          cacheRef.current[chatId] = {
            data,
            timestamp: Date.now(),
            preloaded: true,
          };

          // Clean up old entries
          cleanupCache();
        }
      } catch (error) {
        console.error(`Failed to preload chat ${chatId}:`, error);
      } finally {
        preloadingRef.current.delete(chatId);
      }
    },
    [router, cleanupCache],
  );

  // Queue multiple chats for preloading
  const queuePreload = useCallback((chatIds: string[]) => {
    chatIds.forEach((chatId) => {
      preloadQueueRef.current.add(chatId);
    });

    // Process queue
    processPreloadQueue();
  }, []);

  // Process preload queue with rate limiting
  const processPreloadQueue = useCallback(async () => {
    const queue = Array.from(preloadQueueRef.current);
    preloadQueueRef.current.clear();

    // Preload up to 3 at a time
    for (let i = 0; i < queue.length; i += 3) {
      const batch = queue.slice(i, i + 3);
      await Promise.all(batch.map((chatId) => preloadChat(chatId)));

      // Small delay between batches
      if (i + 3 < queue.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }, [preloadChat]);

  // Get cached data
  const getCachedChat = useCallback((chatId: string) => {
    const cached = cacheRef.current[chatId];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }, []);

  // Invalidate cache for a specific chat
  const invalidateCache = useCallback((chatId: string) => {
    delete cacheRef.current[chatId];
  }, []);

  // Preload adjacent chats when viewing a chat
  const preloadAdjacentChats = useCallback(
    (currentChatId: string, allChatIds: string[]) => {
      const currentIndex = allChatIds.indexOf(currentChatId);
      if (currentIndex === -1) return;

      const adjacentIds: string[] = [];

      // Preload 2 chats before and after
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue; // Skip current chat
        const index = currentIndex + i;
        if (index >= 0 && index < allChatIds.length) {
          adjacentIds.push(allChatIds[index]);
        }
      }

      queuePreload(adjacentIds);
    },
    [queuePreload],
  );

  return {
    preloadChat,
    queuePreload,
    getCachedChat,
    invalidateCache,
    preloadAdjacentChats,
  };
}
