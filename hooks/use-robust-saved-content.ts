import { usePins } from './use-pins';
import { useBookmarks } from './use-bookmarks';

/**
 * Unified hook that provides robust pin and bookmark operations
 * with centralized state management, optimistic updates, and error handling
 */
export function useRobustSavedContent(chatId?: string) {
  // Chat-specific pins
  const chatPins = usePins({
    chatId,
    scope: 'chat',
    enabled: !!chatId,
  });

  // Global pins
  const globalPins = usePins({
    scope: 'global',
    enabled: true,
  });

  // Bookmarks
  const bookmarks = useBookmarks({
    enabled: true,
  });

  return {
    // Chat pins
    chatPins: {
      ...chatPins,
      pins: chatPins.pins,
      togglePin: chatPins.togglePin,
      unpinMessage: chatPins.unpinMessage,
      isPinned: chatPins.isPinned,
      isLoading: chatPins.isLoading,
      error: chatPins.error,
      refetch: chatPins.refetch,
    },

    // Global pins
    globalPins: {
      ...globalPins,
      pins: globalPins.pins,
      isLoading: globalPins.isLoading,
      error: globalPins.error,
      refetch: globalPins.refetch,
    },

    // Bookmarks
    bookmarks: {
      ...bookmarks,
      bookmarks: bookmarks.bookmarks,
      toggleBookmark: bookmarks.toggleBookmark,
      removeBookmark: bookmarks.removeBookmark,
      addBookmarkWithNote: bookmarks.addBookmarkWithNote,
      isBookmarked: bookmarks.isBookmarked,
      isLoading: bookmarks.isLoading,
      error: bookmarks.error,
      refetch: bookmarks.refetch,
    },

    // Utility functions
    getTotalSavedCount: () => {
      return chatPins.pins.length + bookmarks.bookmarks.length;
    },

    hasAnySavedContent: () => {
      return chatPins.pins.length > 0 || bookmarks.bookmarks.length > 0;
    },

    isAnythingLoading: () => {
      return chatPins.isLoading || globalPins.isLoading || bookmarks.isLoading;
    },

    hasAnyErrors: () => {
      return !!chatPins.error || !!globalPins.error || !!bookmarks.error;
    },

    getErrorMessages: () => {
      const errors = [];
      if (chatPins.error) errors.push(`Chat pins: ${chatPins.error.message}`);
      if (globalPins.error)
        errors.push(`Global pins: ${globalPins.error.message}`);
      if (bookmarks.error) errors.push(`Bookmarks: ${bookmarks.error.message}`);
      return errors;
    },

    refetchAll: () => {
      chatPins.refetch();
      globalPins.refetch();
      bookmarks.refetch();
    },
  };
}
