'use client';

import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { useParams, useRouter } from 'next/navigation';
import type { User } from 'next-auth';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  AnimatedSidebarWrapper,
  AnimatedSidebarItem,
} from '@/components/ui/animated-sidebar';
import type { Chat } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { ChatItem } from './sidebar-history-item';
import useSWRInfinite from 'swr/infinite';
import useSWR from 'swr';
import { LoaderIcon } from './icons';

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

export interface ChatHistory {
  chats: Array<Chat>;
  hasMore: boolean;
}

interface ChatIndicators {
  pinned: Record<string, number>;
  bookmarked: Record<string, number>;
}

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats,
  );
};

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory,
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) return `/api/history?limit=${PAGE_SIZE}`;

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) return null;

  return `/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

export function SidebarHistory({
  user,
}: {
  user: User | undefined;
}) {
  const { setOpenMobile } = useSidebar();
  const { id } = useParams();

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(getChatHistoryPaginationKey, fetcher, {
    fallbackData: [],
    revalidateOnFocus: false,
    revalidateOnMount: true,
    refreshInterval: 0, // Disable polling, rely on event-based updates
    dedupingInterval: 2000, // Standard deduping interval
  });

  // Fetch chat indicators (pinned and bookmarked counts)
  const { data: indicators, mutate: mutateIndicators } = useSWR<ChatIndicators>(
    user ? '/api/chat-indicators' : null,
    fetcher,
    {
      refreshInterval: 0, // Disable polling, rely on event-based updates
    },
  );

  // Listen for voice chat creation events
  useEffect(() => {
    const handleVoiceChatCreated = (event: CustomEvent<{ chatId: string }>) => {
      console.log(
        '[SidebarHistory] Voice chat created, refreshing sidebar:',
        event.detail.chatId,
      );
      // Force immediate refresh of chat history
      mutate();
    };

    window.addEventListener('voiceChatCreated' as any, handleVoiceChatCreated);
    return () => {
      window.removeEventListener(
        'voiceChatCreated' as any,
        handleVoiceChatCreated,
      );
    };
  }, [mutate]);

  // Listen for message action updates to refetch indicators
  useEffect(() => {
    const handleMessageActionUpdate = () => {
      // Trigger a revalidation of indicators when messages are pinned/bookmarked
      if (mutateIndicators) {
        mutateIndicators();
      }
    };

    window.addEventListener('messageActionUpdate', handleMessageActionUpdate);
    return () => {
      window.removeEventListener(
        'messageActionUpdate',
        handleMessageActionUpdate,
      );
    };
  }, [mutateIndicators]);

  // Force refresh when navigating to a new chat
  useEffect(() => {
    if (id && typeof id === 'string') {
      // Check if this chat exists in our current data
      const allChats =
        paginatedChatHistories && Array.isArray(paginatedChatHistories)
          ? paginatedChatHistories.flatMap((page) => page.chats)
          : [];

      const chatExists = allChats.some((chat) => chat.id === id);

      if (!chatExists && !isLoading) {
        console.log(
          '[SidebarHistory] Current chat not in sidebar, refreshing:',
          id,
        );
        mutate();
      }
    }
  }, [id]); // Only depend on id change, not the data

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasReachedEnd =
    paginatedChatHistories && Array.isArray(paginatedChatHistories)
      ? paginatedChatHistories.some((page) => page.hasMore === false)
      : false;

  const hasEmptyChatHistory =
    paginatedChatHistories && Array.isArray(paginatedChatHistories)
      ? paginatedChatHistories.every((page) => page.chats.length === 0)
      : false;

  // Get all chats from paginated data
  const allChats =
    paginatedChatHistories && Array.isArray(paginatedChatHistories)
      ? paginatedChatHistories.flatMap(
          (paginatedChatHistory) => paginatedChatHistory.chats,
        )
      : [];

  const handleDelete = async () => {
    const deletePromise = fetch(`/api/chat?id=${deleteId}`, {
      method: 'DELETE',
    });

    toast.promise(deletePromise, {
      loading: 'Deleting chat...',
      success: () => {
        mutate((chatHistories) => {
          if (chatHistories) {
            return chatHistories.map((chatHistory) => ({
              ...chatHistory,
              chats: chatHistory.chats.filter((chat) => chat.id !== deleteId),
            }));
          }
        });

        return 'Chat deleted successfully';
      },
      error: 'Failed to delete chat',
    });

    setShowDeleteDialog(false);

    if (deleteId === id) {
      router.push('/chat');
    }
  };

  if (!user) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Login to save and revisit previous chats!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
          Today
        </div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                key={item}
                className="rounded-md h-8 flex gap-2 px-2 items-center"
              >
                <div
                  className="h-4 rounded-md flex-1 max-w-[--skeleton-width] bg-sidebar-accent-foreground/10"
                  style={
                    {
                      '--skeleton-width': `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Your conversations will appear here once you start chatting!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  // Sort all chats by creation date
  allChats.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  // Group chats by date
  const groupedChats = allChats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats,
  );

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <AnimatedSidebarWrapper>
              <div className="flex flex-col gap-8 pb-2">
                {groupedChats.today.length > 0 && (
                  <div key="today" className="space-y-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-sidebar-foreground/60">
                      Today
                    </div>
                    <div className="space-y-1.5">
                      {groupedChats.today.map((chat, index) => (
                        <AnimatedSidebarItem key={chat.id} index={index}>
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                            pinnedCount={indicators?.pinned[chat.id]}
                            bookmarkedCount={indicators?.bookmarked[chat.id]}
                          />
                        </AnimatedSidebarItem>
                      ))}
                    </div>
                  </div>
                )}

                {groupedChats.yesterday.length > 0 && (
                  <div key="yesterday" className="space-y-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-sidebar-foreground/60">
                      Yesterday
                    </div>
                    <div className="space-y-1.5">
                      {groupedChats.yesterday.map((chat, index) => (
                        <AnimatedSidebarItem key={chat.id} index={index}>
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                            pinnedCount={indicators?.pinned[chat.id]}
                            bookmarkedCount={indicators?.bookmarked[chat.id]}
                          />
                        </AnimatedSidebarItem>
                      ))}
                    </div>
                  </div>
                )}

                {groupedChats.lastWeek.length > 0 && (
                  <div key="lastWeek" className="space-y-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-sidebar-foreground/60">
                      Last 7 Days
                    </div>
                    <div className="space-y-1.5">
                      {groupedChats.lastWeek.map((chat, index) => (
                        <AnimatedSidebarItem key={chat.id} index={index}>
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                            pinnedCount={indicators?.pinned[chat.id]}
                            bookmarkedCount={indicators?.bookmarked[chat.id]}
                          />
                        </AnimatedSidebarItem>
                      ))}
                    </div>
                  </div>
                )}

                {groupedChats.lastMonth.length > 0 && (
                  <div key="lastMonth" className="space-y-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-sidebar-foreground/60">
                      Last 30 Days
                    </div>
                    <div className="space-y-1.5">
                      {groupedChats.lastMonth.map((chat, index) => (
                        <AnimatedSidebarItem key={chat.id} index={index}>
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                            pinnedCount={indicators?.pinned[chat.id]}
                            bookmarkedCount={indicators?.bookmarked[chat.id]}
                          />
                        </AnimatedSidebarItem>
                      ))}
                    </div>
                  </div>
                )}

                {groupedChats.older.length > 0 && (
                  <div key="older" className="space-y-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-sidebar-foreground/60">
                      Older
                    </div>
                    <div className="space-y-1.5">
                      {groupedChats.older.map((chat, index) => (
                        <AnimatedSidebarItem key={chat.id} index={index}>
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                            pinnedCount={indicators?.pinned[chat.id]}
                            bookmarkedCount={indicators?.bookmarked[chat.id]}
                          />
                        </AnimatedSidebarItem>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AnimatedSidebarWrapper>
          </SidebarMenu>

          <>
            <motion.div
              onViewportEnter={() => {
                if (!isValidating && !hasReachedEnd) {
                  setSize((size) => size + 1);
                }
              }}
            />

            {hasReachedEnd ? (
              <div className="px-1 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2 mt-8">
                You have reached the end of your chat history.
              </div>
            ) : (
              <div className="p-1 text-zinc-500 dark:text-zinc-400 flex flex-row gap-2 items-center mt-8">
                <div className="animate-spin">
                  <LoaderIcon />
                </div>
                <div>Loading Chats...</div>
              </div>
            )}
          </>
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
