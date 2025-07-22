import { useRouter } from 'next/navigation';
import { useLoading } from '@/hooks/use-loading';
import { useCallback } from 'react';

interface NavigationOptions {
  prefetch?: boolean;
  loadingText?: string;
  loadingType?: 'default' | 'chat' | 'search' | 'upload' | 'processing';
}

export function useOptimizedNavigation() {
  const router = useRouter();
  const { setLoading } = useLoading();

  const navigateToChat = useCallback(
    async (chatId: string, options: NavigationOptions = {}) => {
      const {
        prefetch = true,
        loadingText = 'Loading chat...',
        loadingType = 'chat',
      } = options;

      try {
        // Show loading state
        setLoading(true, loadingText, loadingType);

        // Prefetch for better performance
        if (prefetch) {
          await router.prefetch(`/chat/${chatId}`);
        }

        // Navigate
        router.push(`/chat/${chatId}`);

        // Hide loading after a short delay to allow for page transition
        setTimeout(() => setLoading(false), 600);
      } catch (error) {
        console.error('Navigation error:', error);
        setLoading(false);
      }
    },
    [router, setLoading],
  );

  const navigateWithLoading = useCallback(
    async (path: string, options: NavigationOptions = {}) => {
      const {
        prefetch = false,
        loadingText = 'Loading...',
        loadingType = 'default',
      } = options;

      try {
        setLoading(true, loadingText, loadingType);

        if (prefetch) {
          await router.prefetch(path);
        }

        router.push(path);
        setTimeout(() => setLoading(false), 600);
      } catch (error) {
        console.error('Navigation error:', error);
        setLoading(false);
      }
    },
    [router, setLoading],
  );

  return {
    navigateToChat,
    navigateWithLoading,
  };
}
