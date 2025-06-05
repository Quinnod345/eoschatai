'use client';
import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';
import { useState, useEffect } from 'react';

import { SidebarToggle } from '@/components/sidebar-toggle';
import { Button } from '@/components/ui/button';
import { PlusIcon, } from './icons';
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
import { toast } from 'sonner';
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

  const handleBookmarkToggle = async () => {
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
  };

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

  return (
    <>
      <header className="flex sticky top-0 bg-background py-1.5 items-center px-2 md:px-2 gap-2">
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

        {/* Advanced Search - only show when sidebar is closed or on mobile */}
        {(!open || windowWidth < 768) && <AdvancedSearch />}

        {(!open || windowWidth < 768) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="order-2 md:order-1 md:px-2 px-2 md:h-fit"
                onClick={() => {
                  router.push('/');
                  router.refresh();
                }}
              >
                <PlusIcon />
                <span className="md:sr-only">New Chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Chat</TooltipContent>
          </Tooltip>
        )}

        {/* Saved Content Dropdown */}
        {session?.user && (
          <SavedContentDropdown
            currentChatId={chatId}
            messages={messages || []}
            onScrollToMessage={onScrollToMessage || (() => {})}
          />
        )}

        {/* Separate Bookmark Button */}
        {chatId && session?.user && messages && messages.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-9 w-9 p-0', isBookmarked && 'text-blue-500')}
                onClick={handleBookmarkToggle}
                disabled={isBookmarkLoading}
              >
                <Bookmark
                  className={cn(
                    'h-5 w-5 transition-all',
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

        {/* User account button in top right */}
        <div className="ml-auto">
          {session?.user && (
            <SidebarUserNav user={session.user} className="header-user-nav" />
          )}
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
  return (
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.selectedProviderId === nextProps.selectedProviderId &&
    prevProps.selectedPersonaId === nextProps.selectedPersonaId &&
    prevProps.selectedProfileId === nextProps.selectedProfileId &&
    prevProps.chatId === nextProps.chatId &&
    prevProps.messages?.length === nextProps.messages?.length
  );
});
