'use client';

import { useEffect, useRef } from 'react';
import { mutate } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from '@/components/sidebar-history';

export function useSidebarRefresh(chatId?: string) {
  const hasRefreshedRef = useRef(false);
  const refreshCountRef = useRef(0);

  useEffect(() => {
    if (!chatId) return;

    // Only refresh a limited number of times to prevent infinite loops
    if (refreshCountRef.current >= 3) {
      console.log('[useSidebarRefresh] Max refresh count reached, stopping');
      return;
    }

    // Initial refresh
    if (!hasRefreshedRef.current) {
      console.log('[useSidebarRefresh] Initial refresh for chat:', chatId);
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      hasRefreshedRef.current = true;
      refreshCountRef.current++;
    }

    // Set up a single delayed refresh to catch any propagation delays
    const timeout = setTimeout(() => {
      if (refreshCountRef.current < 3) {
        console.log('[useSidebarRefresh] Delayed refresh for chat:', chatId);
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        refreshCountRef.current++;
      }
    }, 2000);

    return () => {
      clearTimeout(timeout);
    };
  }, [chatId]);

  // Reset refs when chatId changes
  useEffect(() => {
    hasRefreshedRef.current = false;
    refreshCountRef.current = 0;
  }, [chatId]);
}
