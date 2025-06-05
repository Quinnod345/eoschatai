import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type { PinnedMessage, BookmarkedChat } from '@/lib/db/schema';

// Enable MapSet plugin for Immer
enableMapSet();

interface SavedContentState {
  // Pins state
  pins: Map<string, PinnedMessage[]>; // chatId -> pins
  globalPins: PinnedMessage[];
  pinsLoading: Set<string>; // Track loading state per chat
  pinsError: Map<string, Error>; // Track errors per chat

  // Bookmarks state
  bookmarks: BookmarkedChat[];
  bookmarkedChatIds: Set<string>; // For quick lookup
  bookmarksLoading: boolean;
  bookmarksError: Error | null;

  // Optimistic update tracking
  optimisticOperations: Map<
    string,
    {
      type: 'pin' | 'unpin' | 'bookmark' | 'unbookmark';
      timestamp: number;
      rollbackData: any;
    }
  >;

  // Actions
  setPins: (chatId: string, pins: PinnedMessage[]) => void;
  setGlobalPins: (pins: PinnedMessage[]) => void;
  addPin: (chatId: string, pin: PinnedMessage) => void;
  removePin: (chatId: string, messageId: string) => void;
  setPinLoading: (chatId: string, loading: boolean) => void;
  setPinError: (chatId: string, error: Error | null) => void;

  setBookmarks: (bookmarks: BookmarkedChat[]) => void;
  addBookmark: (bookmark: BookmarkedChat) => void;
  removeBookmark: (chatId: string) => void;
  setBookmarksLoading: (loading: boolean) => void;
  setBookmarksError: (error: Error | null) => void;

  // Optimistic updates
  addOptimisticOperation: (
    id: string,
    type: 'pin' | 'unpin' | 'bookmark' | 'unbookmark',
    rollbackData: any,
  ) => void;
  completeOptimisticOperation: (id: string) => void;
  rollbackOptimisticOperation: (id: string) => void;

  // Utilities
  isPinned: (chatId: string, messageId: string) => boolean;
  isBookmarked: (chatId: string) => boolean;
  getPinsForChat: (chatId: string) => PinnedMessage[];
  clearCache: () => void;
}

const OPERATION_TIMEOUT = 10000; // 10 seconds

export const useSavedContentStore = create<SavedContentState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        pins: new Map(),
        globalPins: [],
        pinsLoading: new Set(),
        pinsError: new Map(),
        bookmarks: [],
        bookmarkedChatIds: new Set(),
        bookmarksLoading: false,
        bookmarksError: null,
        optimisticOperations: new Map(),

        // Pin actions
        setPins: (chatId, pins) =>
          set((state) => {
            state.pins.set(chatId, pins);
            state.pinsError.delete(chatId);
          }),

        setGlobalPins: (pins) =>
          set((state) => {
            state.globalPins = pins;
          }),

        addPin: (chatId, pin) =>
          set((state) => {
            const currentPins = state.pins.get(chatId) || [];
            state.pins.set(chatId, [...currentPins, pin]);
          }),

        removePin: (chatId, messageId) =>
          set((state) => {
            const currentPins = state.pins.get(chatId) || [];
            state.pins.set(
              chatId,
              currentPins.filter((p) => p.messageId !== messageId),
            );
          }),

        setPinLoading: (chatId, loading) =>
          set((state) => {
            if (loading) {
              state.pinsLoading.add(chatId);
            } else {
              state.pinsLoading.delete(chatId);
            }
          }),

        setPinError: (chatId, error) =>
          set((state) => {
            if (error) {
              state.pinsError.set(chatId, error);
            } else {
              state.pinsError.delete(chatId);
            }
          }),

        // Bookmark actions
        setBookmarks: (bookmarks) =>
          set((state) => {
            state.bookmarks = bookmarks;
            state.bookmarkedChatIds = new Set(bookmarks.map((b) => b.chatId));
            state.bookmarksError = null;
          }),

        addBookmark: (bookmark) =>
          set((state) => {
            state.bookmarks.push(bookmark);
            state.bookmarkedChatIds.add(bookmark.chatId);
          }),

        removeBookmark: (chatId) =>
          set((state) => {
            state.bookmarks = state.bookmarks.filter(
              (b) => b.chatId !== chatId,
            );
            state.bookmarkedChatIds.delete(chatId);
          }),

        setBookmarksLoading: (loading) =>
          set((state) => {
            state.bookmarksLoading = loading;
          }),

        setBookmarksError: (error) =>
          set((state) => {
            state.bookmarksError = error;
          }),

        // Optimistic updates
        addOptimisticOperation: (id, type, rollbackData) =>
          set((state) => {
            state.optimisticOperations.set(id, {
              type,
              timestamp: Date.now(),
              rollbackData,
            });

            // Auto-cleanup after timeout
            setTimeout(() => {
              const operation = get().optimisticOperations.get(id);
              if (
                operation &&
                Date.now() - operation.timestamp > OPERATION_TIMEOUT
              ) {
                get().rollbackOptimisticOperation(id);
              }
            }, OPERATION_TIMEOUT);
          }),

        completeOptimisticOperation: (id) =>
          set((state) => {
            state.optimisticOperations.delete(id);
          }),

        rollbackOptimisticOperation: (id) =>
          set((state) => {
            const operation = state.optimisticOperations.get(id);
            if (!operation) return;

            // Rollback based on operation type
            switch (operation.type) {
              case 'pin':
                // Remove the optimistically added pin
                const { chatId, messageId } = operation.rollbackData;
                get().removePin(chatId, messageId);
                break;
              case 'unpin':
                // Re-add the optimistically removed pin
                const { chatId: unpinChatId, pin } = operation.rollbackData;
                get().addPin(unpinChatId, pin);
                break;
              case 'bookmark':
                // Remove the optimistically added bookmark
                const { chatId: bookmarkChatId } = operation.rollbackData;
                get().removeBookmark(bookmarkChatId);
                break;
              case 'unbookmark':
                // Re-add the optimistically removed bookmark
                const { bookmark } = operation.rollbackData;
                get().addBookmark(bookmark);
                break;
            }

            state.optimisticOperations.delete(id);
          }),

        // Utilities
        isPinned: (chatId, messageId) => {
          const pins = get().pins.get(chatId) || [];
          return pins.some((p) => p.messageId === messageId);
        },

        isBookmarked: (chatId) => {
          return get().bookmarkedChatIds.has(chatId);
        },

        getPinsForChat: (chatId) => {
          return get().pins.get(chatId) || [];
        },

        clearCache: () =>
          set((state) => {
            state.pins.clear();
            state.globalPins = [];
            state.pinsLoading.clear();
            state.pinsError.clear();
            state.bookmarks = [];
            state.bookmarkedChatIds.clear();
            state.bookmarksLoading = false;
            state.bookmarksError = null;
            state.optimisticOperations.clear();
          }),
      })),
    ),
    {
      name: 'saved-content-store',
    },
  ),
);

// Subscribe to auth changes to clear cache on logout
if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    useSavedContentStore.getState().clearCache();
  });
}
