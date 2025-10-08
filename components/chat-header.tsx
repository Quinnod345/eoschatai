'use client';
import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';
import { useState, useEffect, useMemo, useCallback } from 'react';

import { SidebarToggle } from '@/components/sidebar-toggle';
import { Button } from '@/components/ui/button';
import { PlusIcon } from './icons';
import { useSidebar } from './ui/sidebar';
import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import type { VisibilityType } from './visibility-selector';
import type { Session } from 'next-auth';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { PersonasDropdown } from '@/components/personas-dropdown';
import { ProfilesDropdown } from '@/components/profiles-dropdown';
import { PersonaWizard } from '@/components/persona-wizard';
import type { Persona, PersonaProfile } from '@/lib/db/schema';
import { AdvancedSearch } from '@/components/advanced-search';
import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast-system';
import { SavedContentDropdown } from '@/components/saved-content-dropdown';
import type { UIMessage } from 'ai';

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
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();

  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | undefined>();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<
    PersonaProfile | undefined
  >();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);

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
    () => !open || windowWidth < 768,
    [open, windowWidth],
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
      <header className="absolute top-1 left-0 right-0 pt-2.5 pb-3 px-2 md:px-2 z-40 bg-transparent pointer-events-none no-mesh-override">
        <div className="flex items-center gap-1 md:gap-2 w-full">
          {/* Left Section - Navigation */}
          <div className="flex items-center gap-1 md:gap-2 pointer-events-auto">
            <SidebarToggle />

            {/* EOS Personas Dropdown */}
            <PersonasDropdown
              selectedPersonaId={selectedPersonaId}
              onPersonaSelect={handlePersonaSelect}
              onCreatePersona={handleCreatePersona}
              onEditPersona={handleEditPersona}
            />

            {/* EOS Profiles Dropdown - only show when a persona is selected */}
            <ProfilesDropdown
              selectedPersonaId={selectedPersonaId || null}
              selectedProfileId={selectedProfileId || null}
              onProfileSelect={handleProfileSelect}
              onCreateProfile={handleCreateProfile}
              onEditProfile={handleEditProfile}
              disabled={!selectedPersonaId}
            />
          </div>

          {/* Center Section - Tools (only when sidebar closed or mobile) */}
          {shouldShowCenterTools && (
            <div className="flex items-center gap-1 md:gap-2 pointer-events-auto">
              <AdvancedSearch />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 md:px-3 backdrop-filter backdrop-blur-[16px] bg-white/70 dark:bg-zinc-900/70 border border-white/30 dark:border-zinc-700/30 hover:bg-white/80 dark:hover:bg-zinc-900/80"
                    onClick={() => {
                      router.push('/chat');
                      router.refresh();
                    }}
                    style={{
                      WebkitBackdropFilter: 'blur(16px)',
                      boxShadow:
                        'inset 0px 0px 6px rgba(0, 0, 0, 0.05), 0 8px 30px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.12)',
                    }}
                  >
                    <PlusIcon size={16} />
                    <span className="hidden md:inline ml-1">New Chat</span>
                  </Button>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-9 w-9 p-0 backdrop-filter backdrop-blur-[16px] bg-white/70 dark:bg-zinc-900/70 border border-white/30 dark:border-zinc-700/30 hover:bg-white/80 dark:hover:bg-zinc-900/80',
                      isBookmarked && 'text-blue-500',
                    )}
                    onClick={handleBookmarkToggle}
                    disabled={isBookmarkLoading}
                    style={{
                      WebkitBackdropFilter: 'blur(16px)',
                      boxShadow:
                        'inset 0px 0px 6px rgba(0, 0, 0, 0.05), 0 8px 30px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.12)',
                    }}
                  >
                    <Bookmark
                      className={cn(
                        'h-4 w-4 transition-all',
                        isBookmarked && 'fill-current',
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isBookmarked ? 'Remove bookmark' : 'Bookmark this chat'}
                </TooltipContent>
              </Tooltip>
            )}

            {/* User account button */}
            {isUserAuthenticated && (
              <SidebarUserNav user={session.user} className="header-user-nav" />
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
