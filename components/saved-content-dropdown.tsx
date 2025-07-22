'use client';

import { useState } from 'react';
import {
  ChevronRight,
  Copy,
  X,
  Clock,
  ChevronDown,
  Archive,
  Globe,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { getDisplayTitle } from '@/lib/utils/chat-utils';
import { toast } from 'sonner';
import type { UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { useOptimizedNavigation } from '@/hooks/use-optimized-navigation';
import { useLoading } from '@/hooks/use-loading';
import { usePins } from '@/hooks/use-pins';
import { useBookmarks } from '@/hooks/use-bookmarks';

interface SavedContentDropdownProps {
  currentChatId: string;
  messages: UIMessage[];
  onScrollToMessage: (messageId: string) => void;
}

interface BookmarkedChat {
  id: string;
  chatId: string;
  bookmarkedAt: Date;
  note: string | null;
  title: string | null;
  createdAt: Date;
  messageCount: number;
  lastMessageAt: Date | null;
}

export function SavedContentDropdown({
  currentChatId,
  messages,
  onScrollToMessage,
}: SavedContentDropdownProps) {
  const router = useRouter();
  const { navigateToChat } = useOptimizedNavigation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pinned' | 'bookmarks'>(
    'bookmarks',
  );
  const [pinScope, setPinScope] = useState<'chat' | 'global'>('chat');

  // Use the new robust hooks
  const {
    pins: chatPins,
    isLoading: chatPinsLoading,
    error: chatPinsError,
    unpinMessage,
  } = usePins({
    chatId: currentChatId,
    scope: 'chat',
    enabled: open && activeTab === 'pinned' && pinScope === 'chat',
  });

  const {
    pins: globalPins,
    isLoading: globalPinsLoading,
    error: globalPinsError,
  } = usePins({
    scope: 'global',
    enabled: open && activeTab === 'pinned' && pinScope === 'global',
  });

  const {
    bookmarks,
    isLoading: bookmarksLoading,
    error: bookmarksError,
    removeBookmark,
  } = useBookmarks({
    enabled: open && activeTab === 'bookmarks',
  });

  // Get current pins based on scope
  const currentPins = pinScope === 'chat' ? chatPins : globalPins;
  const currentPinsLoading =
    pinScope === 'chat' ? chatPinsLoading : globalPinsLoading;
  const currentPinsError =
    pinScope === 'chat' ? chatPinsError : globalPinsError;

  // Get pinned messages with content for chat scope
  const pinnedWithContent =
    pinScope === 'chat'
      ? currentPins
          .map((pinned) => {
            const message = messages.find((m) => m.id === pinned.messageId);
            if (!message) return null;

            const textContent =
              message.parts
                ?.filter((part) => part.type === 'text')
                .map((part) => part.text)
                .join(' ')
                .trim() || '';

            return {
              ...pinned,
              content: textContent,
              role: message.role,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      : currentPins; // Global pins already have content

  // Filter content based on search
  const filteredPinned = pinnedWithContent.filter((item) =>
    'content' in item && typeof item.content === 'string'
      ? item.content.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  const filteredBookmarks = bookmarks.filter(
    (chat) =>
      searchQuery === '' ||
      ('title' in chat &&
        typeof chat.title === 'string' &&
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handleCopyMessage = (content: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  const handleNavigateToChat = async (chatId: string) => {
    setOpen(false);
    // Show loading immediately for better UX
    const { setLoading } = useLoading.getState();
    setLoading(true, 'Opening saved chat...', 'chat');
    router.push(`/chat/${chatId}`);
  };

  const handleNavigateToPinnedMessage = async (
    chatId: string,
    messageId: string,
  ) => {
    setOpen(false);
    if (chatId === currentChatId) {
      onScrollToMessage(messageId);
    } else {
      // Show loading immediately for better UX
      const { setLoading } = useLoading.getState();
      setLoading(true, 'Opening pinned message...', 'chat');
      router.push(`/chat/${chatId}?scrollTo=${messageId}`);
    }
  };

  const handleUnpin = async (messageId: string) => {
    try {
      await unpinMessage(messageId);
    } catch (error) {
      console.error('Error unpinning message:', error);
    }
  };

  const handleRemoveBookmark = async (chatId: string) => {
    try {
      await removeBookmark(chatId);
    } catch (error) {
      console.error('Error removing bookmark:', error);
    }
  };

  const totalSaved = currentPins.length + bookmarks.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {/* Saved content dropdown trigger styled like persona button */}
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 flex items-center gap-2 px-3 text-sm"
        >
          <Archive className="h-4 w-4" />
          <span>Saved Content</span>
          {totalSaved > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 px-1.5 text-[10px] bg-muted-foreground/20"
            >
              {totalSaved}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[90vw] max-w-[380px] p-0 animate-in fade-in-0 zoom-in-95 duration-200"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Saved Content</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Search input */}
          <div className="relative mb-3">
            <Input
              placeholder="Search saved content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Tabs for pinned messages and bookmarks - default to bookmarks */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'pinned' | 'bookmarks')}
            defaultValue="bookmarks"
          >
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="bookmarks" className="text-xs">
                All Bookmarks ({bookmarks.length})
              </TabsTrigger>
              <TabsTrigger value="pinned" className="text-xs">
                Chat Pins ({currentPins.length})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[50vh] max-h-[320px] mt-3">
              {/* Pinned Messages Tab */}
              <TabsContent value="pinned" className="mt-0 space-y-2">
                {/* Scope Toggle */}
                <div className="flex items-center gap-2 mb-3 p-2 bg-muted/30 rounded-lg">
                  <Button
                    size="sm"
                    variant={pinScope === 'chat' ? 'default' : 'ghost'}
                    className="h-7 text-xs"
                    onClick={() => setPinScope('chat')}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    This Chat
                  </Button>
                  <Button
                    size="sm"
                    variant={pinScope === 'global' ? 'default' : 'ghost'}
                    className="h-7 text-xs"
                    onClick={() => setPinScope('global')}
                  >
                    <Globe className="h-3 w-3 mr-1" />
                    All Chats
                  </Button>
                </div>

                {currentPinsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : currentPinsError ? (
                  <div className="text-center py-8 text-destructive text-sm">
                    Failed to load pins. Please try again.
                  </div>
                ) : filteredPinned.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {searchQuery
                      ? 'No pinned messages match your search'
                      : 'No pinned messages yet'}
                  </div>
                ) : (
                  filteredPinned.map((pinned) => (
                    <div
                      key={pinned?.id}
                      className="group p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                      onClick={() => {
                        if (pinScope === 'chat') {
                          handleNavigateToPinnedMessage(
                            currentChatId,
                            pinned?.messageId,
                          );
                        } else {
                          handleNavigateToPinnedMessage(
                            pinned?.chatId,
                            pinned?.messageId,
                          );
                        }
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {pinScope === 'global' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {getDisplayTitle(
                                  ('chatTitle' in pinned &&
                                  typeof pinned.chatTitle === 'string'
                                    ? pinned.chatTitle
                                    : '') || '',
                                ) || 'Untitled Chat'}
                              </Badge>
                            )}
                            <Badge
                              variant={
                                'role' in pinned && pinned.role === 'user'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="text-[10px] px-1.5 py-0"
                            >
                              {'role' in pinned && pinned.role === 'user'
                                ? 'You'
                                : 'AI'}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(pinned.pinnedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {'content' in pinned &&
                            typeof pinned.content === 'string'
                              ? pinned.content
                              : 'No content available'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) =>
                              handleCopyMessage(
                                'content' in pinned &&
                                  typeof pinned.content === 'string'
                                  ? pinned.content
                                  : '',
                                e,
                              )
                            }
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          {pinScope === 'chat' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnpin(pinned.messageId);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                          {pinScope === 'global' && (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Bookmarks Tab */}
              <TabsContent value="bookmarks" className="mt-0 space-y-2">
                {bookmarksLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : bookmarksError ? (
                  <div className="text-center py-8 text-destructive text-sm">
                    Failed to load bookmarks. Please try again.
                  </div>
                ) : filteredBookmarks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {searchQuery
                      ? 'No bookmarks match your search'
                      : 'No bookmarked chats yet'}
                  </div>
                ) : (
                  <>
                    {/* All bookmarked chats */}
                    {filteredBookmarks.map((chat) => (
                      <div
                        key={chat.id}
                        className="group p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                        onClick={() => handleNavigateToChat(chat.chatId)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate mb-1">
                              {getDisplayTitle(
                                'title' in chat &&
                                  typeof chat.title === 'string'
                                  ? chat.title
                                  : '',
                              ) || 'Untitled Chat'}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {(() => {
                                  if (
                                    'lastMessageAt' in chat &&
                                    chat.lastMessageAt
                                  ) {
                                    return new Date(
                                      chat.lastMessageAt as string | Date,
                                    ).toLocaleDateString();
                                  }
                                  if ('createdAt' in chat && chat.createdAt) {
                                    return new Date(
                                      chat.createdAt as string | Date,
                                    ).toLocaleDateString();
                                  }
                                  return new Date().toLocaleDateString();
                                })()}
                              </span>
                              <span>
                                {'messageCount' in chat &&
                                typeof chat.messageCount === 'number'
                                  ? chat.messageCount
                                  : 0}{' '}
                                messages
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveBookmark(chat.chatId);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
