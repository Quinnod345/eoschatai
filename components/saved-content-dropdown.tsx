'use client';

import { useMemo, useRef, useState } from 'react';
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
import { toast } from '@/lib/toast-system';
import type { UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { useOptimizedNavigation } from '@/hooks/use-optimized-navigation';
import { useLoading } from '@/hooks/use-loading';
import GlassSurface from '@/components/GlassSurface';
import { useRobustSavedContent } from '@/hooks/use-robust-saved-content';

interface DropdownProps {
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

export function Dropdown({
  currentChatId,
  messages,
  onScrollToMessage,
}: DropdownProps) {
  const router = useRouter();
  const { navigateToChat } = useOptimizedNavigation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pinned' | 'bookmarks'>(
    'bookmarks',
  );
  const [pinScope, setPinScope] = useState<'chat' | 'global'>('chat');

  // Always-on saved content state for accurate badge counts
  const robustSaved = useRobustSavedContent(currentChatId);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chatPinsCount = robustSaved.chatPins.pins.length;
  const globalPinsCount = robustSaved.globalPins.pins.length;
  const bookmarksCount = robustSaved.bookmarks.bookmarks.length;

  // Derive data from robust saved state
  const chatPins = robustSaved.chatPins.pins;
  const globalPins = robustSaved.globalPins.pins;
  const bookmarks = robustSaved.bookmarks.bookmarks;
  const chatPinsLoading = robustSaved.chatPins.isLoading;
  const globalPinsLoading = robustSaved.globalPins.isLoading;
  const bookmarksLoading = robustSaved.bookmarks.isLoading;
  const chatPinsError = robustSaved.chatPins.error;
  const globalPinsError = robustSaved.globalPins.error;
  const bookmarksError = robustSaved.bookmarks.error;
  const { unpinMessage } = robustSaved.chatPins;
  const { removeBookmark } = robustSaved.bookmarks;

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
          .map((pinned: any) => {
            const message = messages.find((m) => m.id === pinned.messageId);
            if (!message) return null;

            const textContent =
              message.parts
                ?.filter((part: any) => part.type === 'text')
                .map((part: any) => part.text)
                .join(' ')
                .trim() || '';

            return {
              ...pinned,
              content: textContent,
              role: message.role,
            };
          })
          .filter(
            (item: any): item is NonNullable<typeof item> => item !== null,
          )
      : currentPins; // Global pins already have content

  // Sort by most recently pinned first
  const sortedPinnedWithContent = useMemo(() => {
    return [...pinnedWithContent].sort((a: any, b: any) => {
      const aTime = new Date((a as any).pinnedAt).getTime();
      const bTime = new Date((b as any).pinnedAt).getTime();
      return bTime - aTime;
    });
  }, [pinnedWithContent]);

  // Filter content based on search
  const filteredPinned = sortedPinnedWithContent.filter((item) =>
    'content' in item && typeof item.content === 'string'
      ? item.content.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // Sort bookmarks by recency (lastMessageAt, createdAt, or bookmarkedAt)
  const sortedBookmarks = useMemo(() => {
    return [...bookmarks].sort((a: any, b: any) => {
      const getTime = (x: any) => {
        if (x?.lastMessageAt) return new Date(x.lastMessageAt).getTime();
        if (x?.createdAt) return new Date(x.createdAt).getTime();
        if (x?.bookmarkedAt) return new Date(x.bookmarkedAt).getTime();
        return 0;
      };
      return getTime(b) - getTime(a);
    });
  }, [bookmarks]);

  const filteredBookmarks = sortedBookmarks.filter(
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

  const totalSaved = robustSaved.getTotalSavedCount();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {/* Saved content dropdown trigger styled like persona button */}
      <DropdownMenuTrigger asChild>
        <GlassSurface
          width="auto"
          height={40}
          borderRadius={12}
          displace={3}
          insetShadowIntensity={0.2}
          backgroundOpacity={0.25}
          blur={11}
          isButton={true}
          className="h-10 cursor-pointer"
        >
          <div className="flex items-center gap-3 px-2 text-sm font-medium">
            <Archive className="h-4 w-4 shrink-0" />
            <span>Saved Content</span>
            {totalSaved > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] bg-muted-foreground/20"
              >
                {totalSaved}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </GlassSurface>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[90vw] max-w-[380px] p-0 animate-in fade-in-0 zoom-in-95 duration-200 max-h-[500px] overflow-y-auto"
        onCloseAutoFocus={(e) => e.preventDefault()}
        avoidCollisions={true}
        collisionPadding={{ top: 8, right: 8, bottom: 80, left: 8 }}
      >
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between mb-4">
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

          {/* Summary and Search */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                Pins {chatPinsCount + globalPinsCount}
              </Badge>
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                Bookmarks {bookmarksCount}
              </Badge>
            </div>
          </div>
          <div className="relative mb-4">
            <Input
              ref={searchInputRef}
              placeholder="Search saved content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Tabs for pinned messages and bookmarks - default to bookmarks */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'pinned' | 'bookmarks')}
            defaultValue="bookmarks"
          >
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="bookmarks" className="text-xs">
                All Bookmarks ({bookmarksCount})
              </TabsTrigger>
              <TabsTrigger value="pinned" className="text-xs">
                Chat Pins ({chatPinsCount})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[50vh] max-h-[320px] mt-4">
              {/* Pinned Messages Tab */}
              <TabsContent value="pinned" className="mt-0 space-y-2">
                {/* Scope Toggle */}
                <div className="flex items-center gap-2 mb-3 p-2.5 bg-muted/30 rounded-lg">
                  <Button
                    size="sm"
                    variant={pinScope === 'chat' ? 'default' : 'ghost'}
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setPinScope('chat')}
                  >
                    <MessageSquare className="h-3 w-3" />
                    This Chat ({chatPinsCount})
                  </Button>
                  <Button
                    size="sm"
                    variant={pinScope === 'global' ? 'default' : 'ghost'}
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setPinScope('global')}
                  >
                    <Globe className="h-3 w-3" />
                    All Chats ({globalPinsCount})
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
                      className="group p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors duration-200"
                      role="button"
                      tabIndex={0}
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
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Enter' ||
                          e.key === ' ' ||
                          e.key === 'Spacebar'
                        ) {
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
                        }
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
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
                        className="group p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors duration-200"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleNavigateToChat(chat.chatId)}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' ||
                            e.key === ' ' ||
                            e.key === 'Spacebar'
                          ) {
                            handleNavigateToChat(chat.chatId);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium break-words mb-1.5">
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
                                chat.messageCount != null
                                  ? Number((chat as any).messageCount)
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
