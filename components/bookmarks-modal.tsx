import { useState, useEffect } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import type { BookmarkedChat, Chat } from '@/lib/db/schema';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useOptimizedNavigation } from '@/hooks/use-optimized-navigation';
import { useLoading } from '@/hooks/use-loading';
import { toast } from '@/lib/toast-system';
import useSWR from 'swr';
import { format } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';

interface BookmarksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

interface BookmarkWithChat extends BookmarkedChat {
  chat?: Chat;
}

export function BookmarksModal({
  open,
  onOpenChange,
  userId,
}: BookmarksModalProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkWithChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { navigateToChat } = useOptimizedNavigation();

  // Fetch bookmarks with chat details
  const { data, mutate } = useSWR<BookmarkWithChat[]>(
    open && userId ? '/api/bookmark' : null,
    async () => {
      const response = await fetch('/api/bookmark');
      if (!response.ok) throw new Error('Failed to fetch bookmarks');
      const bookmarks = await response.json();

      // Fetch chat details for each bookmark using the correct API endpoint
      const bookmarksWithChats = await Promise.all(
        bookmarks.map(async (bookmark: BookmarkedChat) => {
          try {
            const chatResponse = await fetch(`/api/chat/${bookmark.chatId}`);
            if (chatResponse.ok) {
              const chat = await chatResponse.json();
              return { ...bookmark, chat };
            } else {
              // If chat fetch fails, use fallback data
              return {
                ...bookmark,
                chat: {
                  id: bookmark.chatId,
                  title: `Chat ${bookmark.chatId.slice(0, 8)}...`,
                  createdAt: bookmark.bookmarkedAt,
                },
              };
            }
          } catch (error) {
            console.error('Error fetching chat details:', error);
            // Return bookmark with fallback chat data
            return {
              ...bookmark,
              chat: {
                id: bookmark.chatId,
                title: `Chat ${bookmark.chatId.slice(0, 8)}...`,
                createdAt: bookmark.bookmarkedAt,
              },
            };
          }
        }),
      );

      return bookmarksWithChats;
    },
    {
      onSuccess: (data) => {
        setBookmarks(data || []);
        setIsLoading(false);
      },
      onError: (error) => {
        setIsLoading(false);
        console.error('Failed to load bookmarks:', error);
        toast.error('Failed to load bookmarks');
      },
    },
  );

  // Listen for real-time bookmark updates
  useEffect(() => {
    const handleMessageActionUpdate = (event: CustomEvent) => {
      const { type, data } = event.detail;

      if (type === 'bookmark') {
        // Revalidate bookmarks when they change
        mutate();
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
  }, [mutate]);

  const handleRemoveBookmark = async (chatId: string) => {
    try {
      const response = await fetch('/api/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });

      if (response.ok) {
        // Optimistically update UI
        setBookmarks((prev) => prev.filter((b) => b.chatId !== chatId));

        // Emit event for other components
        window.dispatchEvent(
          new CustomEvent('messageActionUpdate', {
            detail: {
              type: 'bookmark',
              data: { bookmarked: false, chatId },
            },
          }),
        );

        toast.success('Bookmark removed');

        // Revalidate data
        mutate();
      }
    } catch (error) {
      console.error('Error removing bookmark:', error);
      toast.error('Failed to remove bookmark');
    }
  };

  const handleNavigateToChat = async (chatId: string) => {
    onOpenChange(false);
    // Show loading immediately for better UX
    const { setLoading } = useLoading.getState();
    setLoading(true, 'Opening bookmarked chat...', 'chat');
    router.push(`/chat/${chatId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-blue-500" />
            Bookmarked Chats
            {bookmarks.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({bookmarks.length})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Loading bookmarks...
                </p>
              </div>
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Bookmark className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No bookmarked chats yet
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Bookmark your favorite chats to access them here
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-3">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="group relative rounded-lg border p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleNavigateToChat(bookmark.chatId)}
                >
                  <div className="pr-8">
                    <h3 className="font-medium text-base mb-1">
                      {bookmark.chat?.title || 'Untitled Chat'}
                    </h3>
                    {bookmark.note && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {bookmark.note}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Bookmarked{' '}
                        {format(
                          new Date(bookmark.bookmarkedAt),
                          'MMM d, yyyy • h:mm a',
                        )}
                      </span>
                      {bookmark.chat?.createdAt && (
                        <span>
                          Created{' '}
                          {format(
                            new Date(bookmark.chat.createdAt),
                            'MMM d, yyyy',
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-3 right-3 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveBookmark(bookmark.chatId);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
