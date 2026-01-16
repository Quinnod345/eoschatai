'use client';
import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';
import { useState, useEffect, useMemo, useCallback } from 'react';

import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import type { VisibilityType } from './visibility-selector';
import type { Session } from 'next-auth';
import { PersonaWizard } from '@/components/persona-wizard';
import type { Persona, PersonaProfile } from '@/lib/db/schema';
import { Bookmark, Search } from 'lucide-react';
import { AdvancedSearch } from '@/components/advanced-search';
import { PlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast-system';
import { Dropdown as SavedContentDropdown } from '@/components/saved-content-dropdown';
import type { UIMessage } from 'ai';
import GlassSurface from '@/components/GlassSurface';

function PureChatHeader({
  chatId,
  selectedModelId,
  selectedProviderId,
  selectedVisibilityType,
  isReadonly,
  session,
  selectedPersonaId,
  selectedProfileId,
  onPersonaChange,
  onProfileChange,
  messages,
  onScrollToMessage,
}: {
  chatId: string;
  selectedModelId: string;
  selectedProviderId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  selectedPersonaId?: string;
  selectedProfileId?: string;
  onPersonaChange?: (personaId: string | null) => void;
  onProfileChange?: (profileId: string | null) => void;
  messages?: UIMessage[];
  onScrollToMessage?: (messageId: string) => void;
}) {
  const router = useRouter();
  const { width: windowWidth } = useWindowSize();

  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | undefined>();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<
    PersonaProfile | undefined
  >();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);
  const [searchButtonElement, setSearchButtonElement] =
    useState<HTMLButtonElement | null>(null);

  // Check if chat is bookmarked on mount and when chatId changes
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      if (!chatId || !session?.user) return;

      try {
        const response = await fetch('/api/bookmark');
        if (response.ok) {
          const bookmarks = await response.json();
          const isCurrentChatBookmarked = bookmarks.some(
            (bookmark: any) => bookmark.chatId === chatId,
          );
          setIsBookmarked(isCurrentChatBookmarked);
        }
      } catch (error) {
        console.error('Error checking bookmark status:', error);
      }
    };

    checkBookmarkStatus();
  }, [chatId, session]);

  // Listen for bookmark updates from other components
  useEffect(() => {
    const handleBookmarkUpdate = (event: CustomEvent) => {
      const { type, data } = event.detail;
      if (type === 'bookmark' && data.chatId === chatId) {
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
  }, [chatId]);

  // Listen for persona wizard open events from multimodal-input
  useEffect(() => {
    const handleOpenPersonaWizard = (event: CustomEvent) => {
      const { mode, persona } = event.detail;
      if (mode === 'create') {
        setEditingPersona(undefined);
        setIsPersonaModalOpen(true);
      } else if (mode === 'edit' && persona) {
        setEditingPersona(persona);
        setIsPersonaModalOpen(true);
      }
    };

    window.addEventListener(
      'openPersonaWizard',
      handleOpenPersonaWizard as EventListener,
    );
    return () => {
      window.removeEventListener(
        'openPersonaWizard',
        handleOpenPersonaWizard as EventListener,
      );
    };
  }, []);

  // Listen for profile modal open events from multimodal-input
  useEffect(() => {
    const handleOpenProfileModal = (event: CustomEvent) => {
      const { mode, profile } = event.detail;
      if (mode === 'create') {
        setEditingProfile(undefined);
        setIsProfileModalOpen(true);
      } else if (mode === 'edit' && profile) {
        setEditingProfile(profile);
        setIsProfileModalOpen(true);
      }
    };

    window.addEventListener(
      'openProfileModal',
      handleOpenProfileModal as EventListener,
    );
    return () => {
      window.removeEventListener(
        'openProfileModal',
        handleOpenProfileModal as EventListener,
      );
    };
  }, []);

  const handleBookmarkToggle = useCallback(async () => {
    if (!chatId || !session?.user || isBookmarkLoading) return;

    setIsBookmarkLoading(true);
    try {
      const response = await fetch('/api/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
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
              data: { bookmarked: data.bookmarked, chatId },
            },
          }),
        );
      } else {
        toast.error('Failed to update bookmark');
      }
    } catch (error) {
      toast.error('Failed to update bookmark');
      console.error('Error toggling bookmark:', error);
    } finally {
      setIsBookmarkLoading(false);
    }
  }, [chatId, session?.user, isBookmarkLoading]);

  const handlePersonaSelect = (personaId: string | null) => {
    console.log('CHAT_HEADER: handlePersonaSelect called', {
      personaId: personaId,
      currentSelectedPersonaId: selectedPersonaId,
      chatId: chatId,
      hasCallback: !!onPersonaChange,
    });

    if (onPersonaChange) {
      console.log('CHAT_HEADER: Calling onPersonaChange callback');
      onPersonaChange(personaId);
    } else {
      console.warn('CHAT_HEADER: No onPersonaChange callback provided');
    }

    // Clear profile selection when persona changes
    if (onProfileChange && personaId !== selectedPersonaId) {
      onProfileChange(null);
    }
  };

  const handleProfileSelect = (profileId: string | null) => {
    console.log('CHAT_HEADER: handleProfileSelect called', {
      profileId: profileId,
      currentSelectedProfileId: selectedProfileId,
      chatId: chatId,
      hasCallback: !!onProfileChange,
    });

    if (onProfileChange) {
      console.log('CHAT_HEADER: Calling onProfileChange callback');
      onProfileChange(profileId);
    } else {
      console.warn('CHAT_HEADER: No onProfileChange callback provided');
    }
  };

  const handleCreatePersona = () => {
    setEditingPersona(undefined);
    setIsPersonaModalOpen(true);
  };

  const handleEditPersona = (persona: Persona) => {
    setEditingPersona(persona);
    setIsPersonaModalOpen(true);
  };

  const handleCreateProfile = () => {
    setEditingProfile(undefined);
    setIsProfileModalOpen(true);
  };

  const handleEditProfile = (profile: PersonaProfile) => {
    setEditingProfile(profile);
    setIsProfileModalOpen(true);
  };

  const handlePersonaModalClose = () => {
    setIsPersonaModalOpen(false);
    setEditingPersona(undefined);
  };

  const handleProfileModalClose = () => {
    setIsProfileModalOpen(false);
    setEditingProfile(undefined);
  };

  const handlePersonaSave = () => {
    // Trigger a refresh of the personas dropdown by dispatching a custom event
    window.dispatchEvent(new CustomEvent('personasUpdated'));
  };

  const handleProfileSave = () => {
    // Trigger a refresh of the profiles dropdown by dispatching a custom event
    window.dispatchEvent(new CustomEvent('profilesUpdated'));
  };

  // Memoize expensive conditional checks for better performance
  const shouldShowCenterTools = useMemo(
    () => false, // Tools are now permanently in the sidebar
    [],
  );
  const shouldShowBookmark = useMemo(
    () => Boolean(chatId && session?.user && messages && messages.length > 0),
    [chatId, session?.user, messages],
  );
  const isUserAuthenticated = useMemo(
    () => Boolean(session?.user),
    [session?.user],
  );

  return (
    <>
      <header className="absolute top-0.5 left-0 right-0 pt-2.5 pb-3 px-2 md:px-2 z-40 bg-transparent pointer-events-none no-mesh-override">
        <div className="flex items-center gap-1 md:gap-2 w-full">
          {/* Left Section - Empty spacer (Personas and Profiles moved to multimodal input) */}
          <div className="flex items-center gap-1 md:gap-2 pointer-events-auto">
            {/* Personas and Profiles dropdowns are now in the multimodal input plus button */}
          </div>

          {/* Center Section - Tools (only when sidebar closed or mobile) */}
          {shouldShowCenterTools && (
            <div className="flex items-center gap-1 md:gap-2 pointer-events-auto">
              {/* Search Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <GlassSurface
                    width={36}
                    height={36}
                    borderRadius={10}
                    displace={3}
                    backgroundOpacity={0.25}
                    blur={11}
                    insetShadowIntensity={0.2}
                    isButton={true}
                    onClick={() => searchButtonElement?.click()}
                    className="h-9 w-9 cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="relative z-20 text-zinc-900 dark:text-zinc-100">
                      <Search className="h-4 w-4" />
                    </span>
                  </GlassSurface>
                </TooltipTrigger>
                <TooltipContent>Search</TooltipContent>
              </Tooltip>

              {/* Hidden AdvancedSearch button to trigger */}
              <div className="hidden">
                <div
                  ref={(el) => {
                    if (el) {
                      const button = el.querySelector(
                        'button',
                      ) as HTMLButtonElement;
                      if (button) setSearchButtonElement(button);
                    }
                  }}
                >
                  <AdvancedSearch />
                </div>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <GlassSurface
                    width="auto"
                    height={36}
                    borderRadius={12}
                    displace={3}
                    backgroundOpacity={0.25}
                    insetShadowIntensity={0.2}
                    blur={11}
                    isButton={true}
                    onClick={() => {
                      router.push('/chat');
                      router.refresh();
                    }}
                    className="h-9 px-2 md:px-3 cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <PlusIcon size={16} />
                    <span className="hidden md:inline ml-1">New Chat</span>
                  </GlassSurface>
                </TooltipTrigger>
                <TooltipContent>New Chat</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Right Section - Actions */}
          <div className="flex items-center gap-1 md:gap-2 ml-auto pointer-events-auto">
            {/* Saved Content Dropdown */}
            {isUserAuthenticated && (
              <SavedContentDropdown
                currentChatId={chatId}
                messages={messages || []}
                onScrollToMessage={onScrollToMessage || (() => {})}
              />
            )}

            {/* Bookmark Button */}
            {shouldShowBookmark && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <GlassSurface
                    width={36}
                    height={36}
                    borderRadius={10}
                    displace={3}
                    backgroundOpacity={0.25}
                    blur={11}
                    insetShadowIntensity={0.2}
                    isButton={true}
                    onClick={handleBookmarkToggle}
                    disabled={isBookmarkLoading}
                    className={cn(
                      'h-9 w-9 cursor-pointer text-zinc-900 dark:text-zinc-100',
                      isBookmarked && 'text-blue-500',
                    )}
                  >
                    <span className="relative z-20 text-zinc-900 dark:text-zinc-100">
                      <Bookmark
                        className={cn(
                          'h-4 w-4 transition-all',
                          isBookmarked && 'fill-current',
                        )}
                      />
                    </span>
                  </GlassSurface>
                </TooltipTrigger>
                <TooltipContent>
                  {isBookmarked ? 'Remove bookmark' : 'Bookmark this chat'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </header>

      {/* Persona Modal */}
      <PersonaWizard
        isOpen={isPersonaModalOpen}
        onClose={handlePersonaModalClose}
        persona={editingPersona}
        onSave={handlePersonaSave}
      />

      {/* Profile Modal - TODO: Create ProfileWizard component */}
      {/* <ProfileWizard
        isOpen={isProfileModalOpen}
        onClose={handleProfileModalClose}
        profile={editingProfile}
        personaId={selectedPersonaId}
        onSave={handleProfileSave}
      /> */}
    </>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  // Only re-render if essential props change
  if (prevProps.chatId !== nextProps.chatId) return false;
  if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;
  if (prevProps.selectedProviderId !== nextProps.selectedProviderId)
    return false;
  if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
    return false;
  if (prevProps.selectedPersonaId !== nextProps.selectedPersonaId) return false;
  if (prevProps.selectedProfileId !== nextProps.selectedProfileId) return false;
  if (prevProps.isReadonly !== nextProps.isReadonly) return false;

  // Check message length changes (for bookmark button visibility)
  const prevMessageCount = prevProps.messages?.length || 0;
  const nextMessageCount = nextProps.messages?.length || 0;
  if (prevMessageCount !== nextMessageCount) return false;

  // Session changes
  if (prevProps.session?.user?.id !== nextProps.session?.user?.id) return false;

  // All checks passed, component can skip re-render
  return true;
});
