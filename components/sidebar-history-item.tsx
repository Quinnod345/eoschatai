import type { Chat } from '@/lib/db/schema';
import { SidebarMenuButton, SidebarMenuItem } from './ui/sidebar';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import {
  CheckCircleFillIcon,
  GlobeIcon,
  LockIcon,
  MoreHorizontalIcon,
  ShareIcon,
  TrashIcon,
} from './icons';
import { memo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { cn } from '@/lib/utils';
import { getDisplayTitle } from '@/lib/utils/chat-utils';
import { Bookmark, Pencil } from 'lucide-react';
import { toast } from '@/lib/toast-system';
import { useChatPreloader } from '@/hooks/use-chat-preloader';
import { useLoading } from '@/hooks/use-loading';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
  pinnedCount,
  bookmarkedCount,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
  pinnedCount?: number;
  bookmarkedCount?: number;
}) => {
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibilityType: chat.visibility,
  });

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isRenameLoading, setIsRenameLoading] = useState(false);
  const [isTracing, setIsTracing] = useState(false);
  const { preloadChat } = useChatPreloader();
  const preloadTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Set initial bookmark state
  useEffect(() => {
    setIsBookmarked(!!bookmarkedCount && bookmarkedCount > 0);
  }, [bookmarkedCount]);

  // Listen for bookmark updates
  useEffect(() => {
    const handleBookmarkUpdate = (event: CustomEvent) => {
      const { type, data } = event.detail;
      if (type === 'bookmark' && data.chatId === chat.id) {
        setIsBookmarked(data.bookmarked);
      }
    };

    window.addEventListener(
      'messageActionUpdate',
      handleBookmarkUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        'messageActionUpdate',
        handleBookmarkUpdate as EventListener,
      );
    };
  }, [chat.id]);

  const handleBookmarkToggle = async () => {
    if (isBookmarkLoading) return;

    setIsBookmarkLoading(true);
    try {
      const response = await fetch('/api/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat.id }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsBookmarked(data.bookmarked);
        toast.success(data.bookmarked ? 'Chat bookmarked' : 'Bookmark removed');

        // Emit event for other components
        window.dispatchEvent(
          new CustomEvent('messageActionUpdate', {
            detail: {
              type: 'bookmark',
              data: { bookmarked: data.bookmarked, chatId: chat.id },
            },
          }),
        );
      } else if (response.status === 403 && data?.code === 'FEATURE_LOCKED') {
        window.dispatchEvent(new Event('open-premium-modal'));
      } else {
        toast.error('Failed to update bookmark');
      }
    } catch (error) {
      toast.error('Failed to update bookmark');
      console.error('Error toggling bookmark:', error);
    } finally {
      setIsBookmarkLoading(false);
    }
  };

  const openRenameDialog = () => {
    setDraftTitle(getDisplayTitle(chat.title));
    setIsRenameDialogOpen(true);
  };

  const handleRenameChat = async () => {
    if (isRenameLoading) return;

    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      toast.error('Title cannot be empty');
      return;
    }

    if (nextTitle === getDisplayTitle(chat.title)) {
      setIsRenameDialogOpen(false);
      return;
    }

    setIsRenameLoading(true);
    try {
      const response = await fetch(`/api/chat/${chat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || 'Failed to rename chat');
      }

      toast.success('Chat renamed');
      setIsRenameDialogOpen(false);
      window.dispatchEvent(
        new CustomEvent('chatRenamed', {
          detail: { chatId: chat.id, title: nextTitle },
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to rename chat',
      );
    } finally {
      setIsRenameLoading(false);
    }
  };

  // Preload chat on hover
  const handleMouseEnter = () => {
    // Delay preloading by 200ms to avoid unnecessary preloads
    preloadTimeoutRef.current = setTimeout(() => {
      preloadChat(chat.id);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <SidebarMenuItem className="py-1 px-1 group/item relative">
        <motion.div
          className={cn('w-full rounded-md relative', isTracing && 'sidebar-item-trace')}
          whileHover={{ y: -1 }}
          onHoverStart={() => {
            setIsTracing(true);
            setTimeout(() => setIsTracing(false), 450);
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <SidebarMenuButton
            asChild
            isActive={isActive}
            size="lg"
            className={cn(
              'rounded-lg !h-11 py-3 px-3 text-[14px] leading-6 font-normal transition-all duration-200 mr-0 text-sidebar-foreground',
              isActive
                ? 'active-glass-button'
                : 'hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:shadow-sm',
            )}
          >
            <Link
              href={`/chat/${chat.id}`}
              onClick={() => {
                setOpenMobile(false);
                const { setLoading } = useLoading.getState();
                setLoading(true, 'Loading chat...', 'chat');
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className={cn(
                'relative flex items-center w-full rounded-md overflow-hidden z-10',
                // Bookmarked only
                isBookmarked &&
                  !((pinnedCount ?? 0) > 0) &&
                  'ring-1 ring-sky-400/70 shadow-[0_0_0_2px_rgba(56,189,248,0.25),0_0_22px_rgba(56,189,248,0.35)] hover:shadow-[0_0_0_2px_rgba(56,189,248,0.3),0_0_30px_rgba(56,189,248,0.5)]',
                // Pinned only
                !isBookmarked &&
                  (pinnedCount ?? 0) > 0 &&
                  'ring-1 ring-eos-orange/70 shadow-[0_0_0_2px_rgba(255,121,0,0.25),0_0_22px_rgba(255,121,0,0.35)] hover:shadow-[0_0_0_2px_rgba(255,121,0,0.3),0_0_30px_rgba(255,121,0,0.5)]',
              )}
            >
              {/* Half-and-half border for both bookmarked and pinned */}
              {isBookmarked && (pinnedCount ?? 0) > 0 && (
                <>
                  <div
                    className="absolute inset-0 rounded-md ring-1 ring-inset ring-sky-400/70 pointer-events-none"
                    style={{
                      clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)',
                    }}
                  />
                  <div
                    className="absolute inset-0 rounded-md ring-1 ring-inset ring-eos-orange/70 pointer-events-none"
                    style={{
                      clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)',
                    }}
                  />
                  <div className="absolute inset-0 rounded-md shadow-[0_0_0_2px_rgba(56,189,248,0.25),0_0_22px_rgba(255,121,0,0.35)] hover:shadow-[0_0_0_2px_rgba(56,189,248,0.3),0_0_30px_rgba(255,121,0,0.5)] pointer-events-none" />
                </>
              )}
              {/* Title area - expands fully by default; on hover/active, add padding to avoid the right overlay */}
              <div
                className={cn(
                  'min-w-0 flex-1 pr-0 transition-[padding] duration-150',
                  // Always same padding since we removed pin indicator
                  isActive && 'pr-6',
                  'group-hover/item:pr-6',
                )}
              >
                <span className="truncate block min-w-0 text-[14px] font-normal">
                  {getDisplayTitle(chat.title)}
                </span>
                <span className="text-[10px] text-muted-foreground/40 truncate block opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 leading-tight">
                  {formatDistanceToNow(new Date(chat.createdAt), { addSuffix: true })}
                </span>
              </div>

              {/* Right overlay: indicators (always visible) + three dots (hover/active) */}
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <DropdownMenu modal={true}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className={cn(
                        'pointer-events-auto inline-flex p-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                        // Light mode: always dark text; Dark mode: use accent
                        'text-sidebar-foreground dark:text-sidebar-accent-foreground',
                        !isActive &&
                          'group-hover/item:text-sidebar-foreground dark:group-hover/item:text-sidebar-accent-foreground',
                        'opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 data-[state=open]:opacity-100',
                        'transition-none transform-none hover:transform-none active:transform-none hover:scale-100 hover:translate-y-0 hover:shadow-none active:scale-100 active:translate-y-0',
                        isActive && 'opacity-100',
                      )}
                      aria-label="More options"
                    >
                      <MoreHorizontalIcon />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    side="bottom"
                    align="end"
                    className="w-48"
                  >
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={handleBookmarkToggle}
                      disabled={isBookmarkLoading}
                    >
                      <Bookmark
                        className={cn('h-4 w-4', isBookmarked && 'fill-current')}
                      />
                      <span>
                        {isBookmarked ? 'Remove Bookmark' : 'Bookmark Chat'}
                      </span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="cursor-pointer">
                        <ShareIcon size={16} />
                        <span>Share</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem
                            className="cursor-pointer flex-row justify-between"
                            onClick={() => {
                              setVisibilityType('private');
                            }}
                          >
                            <div className="flex flex-row gap-2 items-center">
                              <LockIcon size={12} />
                              <span>Private</span>
                            </div>
                            {visibilityType === 'private' ? (
                              <CheckCircleFillIcon />
                            ) : null}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer flex-row justify-between"
                            onClick={() => {
                              setVisibilityType('public');
                            }}
                          >
                            <div className="flex flex-row gap-2 items-center">
                              <GlobeIcon />
                              <span>Public</span>
                            </div>
                            {visibilityType === 'public' ? (
                              <CheckCircleFillIcon />
                            ) : null}
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={openRenameDialog}
                    >
                      <Pencil className="h-4 w-4" />
                      <span>Rename</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
                      onSelect={() => onDelete(chat.id)}
                    >
                      <TrashIcon size={16} />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Link>
          </SidebarMenuButton>
        </motion.div>
      </SidebarMenuItem>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>
              Choose a new title for this chat.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleRenameChat();
              }
            }}
            maxLength={200}
            autoFocus
            placeholder="Enter chat title"
            disabled={isRenameLoading}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRenameDialogOpen(false)}
              disabled={isRenameLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleRenameChat()}
              disabled={isRenameLoading || draftTitle.trim().length === 0}
            >
              {isRenameLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.chat.id !== nextProps.chat.id) return false;
  if (prevProps.chat.title !== nextProps.chat.title) return false;
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.pinnedCount !== nextProps.pinnedCount) return false;
  if (prevProps.bookmarkedCount !== nextProps.bookmarkedCount) return false;
  return true;
});
