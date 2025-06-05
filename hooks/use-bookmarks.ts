import { useCallback, useEffect } from 'react';
import { toast, toastUtils } from '@/lib/toast-system';
import { useSavedContentStore } from '@/lib/stores/saved-content-store';
import type { BookmarkedChat } from '@/lib/db/schema';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

interface UseBookmarksOptions {
  enabled?: boolean;
}

export function useBookmarks({ enabled = true }: UseBookmarksOptions = {}) {
  const {
    bookmarks,
    bookmarkedChatIds,
    bookmarksLoading,
    bookmarksError,
    setBookmarks,
    addBookmark,
    removeBookmark,
    setBookmarksLoading,
    setBookmarksError,
    addOptimisticOperation,
    completeOptimisticOperation,
    rollbackOptimisticOperation,
    isBookmarked,
  } = useSavedContentStore();

  // Fetch bookmarks with retry logic
  const fetchBookmarks = useCallback(
    async (retryCount = 0) => {
      if (!enabled) return;

      setBookmarksLoading(true);
      setBookmarksError(null);

      try {
        const response = await fetch('/api/bookmark');

        if (!response.ok) {
          throw new Error(`Failed to fetch bookmarks: ${response.statusText}`);
        }

        const data = await response.json();
        setBookmarks(data);
      } catch (error) {
        console.error('Error fetching bookmarks:', error);

        if (retryCount < MAX_RETRIES) {
          setTimeout(
            () => fetchBookmarks(retryCount + 1),
            RETRY_DELAY * (retryCount + 1),
          );
        } else {
          const errorMessage =
            error instanceof Error
              ? error
              : new Error('Failed to fetch bookmarks');
          setBookmarksError(errorMessage);
          toastUtils.operationError('load bookmarks');
        }
      } finally {
        setBookmarksLoading(false);
      }
    },
    [enabled, setBookmarks, setBookmarksLoading, setBookmarksError],
  );

  // Toggle bookmark with optimistic updates
  const toggleBookmark = useCallback(
    async (chatId: string, note?: string) => {
      const operationId = `bookmark-${chatId}-${Date.now()}`;
      const isCurrentlyBookmarked = isBookmarked(chatId);

      // Optimistic update
      if (isCurrentlyBookmarked) {
        const bookmarkToRemove = bookmarks.find((b) => b.chatId === chatId);
        if (bookmarkToRemove) {
          removeBookmark(chatId);
          addOptimisticOperation(operationId, 'unbookmark', {
            bookmark: bookmarkToRemove,
          });
        }
      } else {
        const newBookmark: BookmarkedChat = {
          id: `temp-${Date.now()}`,
          userId: '', // Will be set by server
          chatId,
          note: note || null,
          bookmarkedAt: new Date(),
        };

        addBookmark(newBookmark);
        addOptimisticOperation(operationId, 'bookmark', {
          chatId,
        });
      }

      try {
        const response = await fetch('/api/bookmark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, note }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to toggle bookmark');
        }

        // Update with server data
        if (data.bookmarked && data.bookmark) {
          // Replace optimistic bookmark with server data
          removeBookmark(chatId);
          addBookmark({
            id: data.bookmark.id,
            userId: data.bookmark.userId,
            chatId,
            note: data.bookmark.note,
            bookmarkedAt: new Date(data.bookmark.bookmarkedAt),
          });
        }

        completeOptimisticOperation(operationId);

        toastUtils.operationSuccess(
          data.bookmarked ? 'bookmark chat' : 'remove bookmark',
        );

        // Emit event for other components
        window.dispatchEvent(
          new CustomEvent('messageActionUpdate', {
            detail: {
              type: 'bookmark',
              data: {
                bookmarked: data.bookmarked,
                chatId,
              },
            },
          }),
        );
      } catch (error) {
        console.error('Error toggling bookmark:', error);
        rollbackOptimisticOperation(operationId);
        toastUtils.operationError('update bookmark');
      }
    },
    [
      bookmarks,
      isBookmarked,
      addBookmark,
      removeBookmark,
      addOptimisticOperation,
      completeOptimisticOperation,
      rollbackOptimisticOperation,
    ],
  );

  // Remove bookmark with confirmation
  const removeBookmarkById = useCallback(
    async (chatId: string) => {
      if (isBookmarked(chatId)) {
        await toggleBookmark(chatId);
      }
    },
    [isBookmarked, toggleBookmark],
  );

  // Add bookmark with note
  const addBookmarkWithNote = useCallback(
    async (chatId: string, note: string) => {
      if (!isBookmarked(chatId)) {
        await toggleBookmark(chatId, note);
      } else {
        // Update existing bookmark note
        try {
          const response = await fetch('/api/bookmark', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, note }),
          });

          if (response.ok) {
            const data = await response.json();
            // Update local state
            const updatedBookmarks = bookmarks.map((b) =>
              b.chatId === chatId ? { ...b, note } : b,
            );
            setBookmarks(updatedBookmarks);
            toast.success('Bookmark note updated');
          }
        } catch (error) {
          console.error('Error updating bookmark note:', error);
          toast.error('Failed to update bookmark note');
        }
      }
    },
    [isBookmarked, toggleBookmark, bookmarks, setBookmarks],
  );

  // Initial fetch
  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  // Listen for updates from other components
  useEffect(() => {
    const handleMessageActionUpdate = (event: CustomEvent) => {
      const { type } = event.detail;

      if (type === 'bookmark') {
        // Refetch to ensure consistency
        fetchBookmarks();
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
  }, [fetchBookmarks]);

  return {
    bookmarks,
    isLoading: bookmarksLoading,
    error: bookmarksError,
    toggleBookmark,
    removeBookmark: removeBookmarkById,
    addBookmarkWithNote,
    isBookmarked,
    refetch: fetchBookmarks,
  };
}
