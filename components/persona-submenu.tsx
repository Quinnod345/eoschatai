'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  UserIcon,
  PlusIcon,
  PencilEditIcon,
  TrashIcon,
} from '@/components/icons';
import Image from 'next/image';
import type { Persona, PersonaProfile } from '@/lib/db/schema';
import { Users, Check, Loader2, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast-system';
import { getProfileTheme } from '@/lib/constants/profile-themes';
import { PersonaOverlayEditor } from '@/components/persona-overlay-editor';
import { useAccountStore } from '@/lib/stores/account-store';

type PersonaWithAccess = Persona & {
  canChat?: boolean;
  canViewSettings?: boolean;
  canEdit?: boolean;
  knowledgeHidden?: boolean;
};

interface PersonaSubmenuProps {
  selectedPersonaId?: string;
  selectedProfileId?: string;
  onPersonaSelect: (personaId: string | null) => void;
  onCreatePersona: () => void;
  onEditPersona: (persona: PersonaWithAccess) => void;
  onProfileSelect?: (profileId: string | null) => void;
  onCreateProfile?: () => void;
  onEditProfile?: (profile: PersonaProfile) => void;
  messages?: any[];
  onCloseDropdown?: () => void;
}

// Cache for persona profiles to avoid refetching
const profilesCache: Record<string, PersonaProfile[]> = {};

export function PersonaSubmenu({
  selectedPersonaId,
  selectedProfileId,
  onPersonaSelect,
  onCreatePersona,
  onEditPersona,
  onProfileSelect,
  onCreateProfile,
  onEditProfile,
  messages = [],
  onCloseDropdown,
}: PersonaSubmenuProps) {
  const [systemPersonas, setSystemPersonas] = useState<PersonaWithAccess[]>([]);
  const [userPersonas, setUserPersonas] = useState<PersonaWithAccess[]>([]);
  const [sharedPersonas, setSharedPersonas] = useState<PersonaWithAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingPersona, setIsSwitchingPersona] = useState(false);
  const [customizingPersonaId, setCustomizingPersonaId] = useState<string | null>(
    null,
  );
  // Track which personas have profiles (loaded on demand)
  const [personaProfiles, setPersonaProfiles] = useState<
    Record<string, PersonaProfile[]>
  >({});
  const [loadingProfiles, setLoadingProfiles] = useState<
    Record<string, boolean>
  >({});

  // Determine if chat has been used (has any messages)
  const chatHasMessages = messages.length > 0;
  const entitlements = useAccountStore((state) => state.entitlements);
  const hasPersonasAccess = Boolean(entitlements?.features?.personas?.custom);

  const allPersonas = [...systemPersonas, ...userPersonas, ...sharedPersonas];
  const selectedPersona = allPersonas.find((p) => p.id === selectedPersonaId);
  const selectedProfile =
    selectedPersonaId &&
    personaProfiles[selectedPersonaId]?.find((p) => p.id === selectedProfileId);

  useEffect(() => {
    if (!hasPersonasAccess) {
      setSystemPersonas([]);
      setUserPersonas([]);
      setSharedPersonas([]);
      setIsLoading(false);
      return;
    }

    fetchPersonas();

    const handlePersonasUpdated = () => {
      fetchPersonas();
    };

    const handleProfilesUpdated = () => {
      // Clear cache and refetch for selected persona
      Object.keys(profilesCache).forEach((key) => delete profilesCache[key]);
      setPersonaProfiles({});
      // Refetch profiles for selected persona
      if (selectedPersonaId) {
        fetchProfilesForPersonaImmediate(selectedPersonaId);
      }
    };

    window.addEventListener('personasUpdated', handlePersonasUpdated);
    window.addEventListener('profilesUpdated', handleProfilesUpdated);
    return () => {
      window.removeEventListener('personasUpdated', handlePersonasUpdated);
      window.removeEventListener('profilesUpdated', handleProfilesUpdated);
    };
  }, [selectedPersonaId, hasPersonasAccess]);

  // Fetch profiles for selected persona on mount to show selected profile correctly
  useEffect(() => {
    if (hasPersonasAccess && selectedPersonaId) {
      fetchProfilesForPersonaImmediate(selectedPersonaId);
    }
  }, [selectedPersonaId, hasPersonasAccess]);

  // Immediate fetch without checking loading state (for initial load)
  const fetchProfilesForPersonaImmediate = async (personaId: string) => {
    if (!hasPersonasAccess) {
      return;
    }

    // Check cache first
    if (profilesCache[personaId]) {
      setPersonaProfiles((prev) => ({
        ...prev,
        [personaId]: profilesCache[personaId],
      }));
      return;
    }

    setLoadingProfiles((prev) => ({ ...prev, [personaId]: true }));
    try {
      const response = await fetch(`/api/personas/${personaId}/profiles`);
      if (response.ok) {
        // API returns profiles directly as an array
        const profiles = await response.json();
        // Handle both array format and {profiles: []} format for compatibility
        const profilesArray = Array.isArray(profiles)
          ? profiles
          : profiles.profiles || [];
        profilesCache[personaId] = profilesArray;
        setPersonaProfiles((prev) => ({ ...prev, [personaId]: profilesArray }));
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoadingProfiles((prev) => ({ ...prev, [personaId]: false }));
    }
  };

  const fetchPersonas = async () => {
    if (!hasPersonasAccess) {
      setSystemPersonas([]);
      setUserPersonas([]);
      setSharedPersonas([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/personas');
      if (response.ok) {
        const data = await response.json();
        setSystemPersonas(data.systemPersonas || []);
        setUserPersonas(data.userPersonas || []);
        setSharedPersonas(data.sharedPersonas || []);
      } else {
        console.error('Failed to fetch personas:', response.status);
        toast.error('Failed to load personas');
      }
    } catch (error) {
      console.error('Error fetching personas:', error);
      toast.error('Failed to load personas');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch profiles for a specific persona (called when hovering)
  const fetchProfilesForPersona = useCallback(
    async (personaId: string) => {
      if (!hasPersonasAccess) {
        return;
      }

      // Check cache first
      if (profilesCache[personaId]) {
        setPersonaProfiles((prev) => ({
          ...prev,
          [personaId]: profilesCache[personaId],
        }));
        return;
      }

      // Already loading
      if (loadingProfiles[personaId]) return;

      setLoadingProfiles((prev) => ({ ...prev, [personaId]: true }));
      try {
        const response = await fetch(`/api/personas/${personaId}/profiles`);
        if (response.ok) {
          // API returns profiles directly as an array
          const profiles = await response.json();
          // Handle both array format and {profiles: []} format for compatibility
          const profilesArray = Array.isArray(profiles)
            ? profiles
            : profiles.profiles || [];
          profilesCache[personaId] = profilesArray;
          setPersonaProfiles((prev) => ({
            ...prev,
            [personaId]: profilesArray,
          }));
        }
      } catch (error) {
        console.error('Error fetching profiles:', error);
      } finally {
        setLoadingProfiles((prev) => ({ ...prev, [personaId]: false }));
      }
    },
    [loadingProfiles, hasPersonasAccess],
  );

  const handlePersonaSelect = useCallback(
    async (personaId: string | null, profileId: string | null = null) => {
      // If switching to a different persona while there are messages, start a new chat
      if (chatHasMessages && personaId !== selectedPersonaId) {
        setIsSwitchingPersona(true);

        // Clear current persona/profile and redirect to new chat
        if (personaId) {
          localStorage.setItem('selectedPersonaId', personaId);
          if (profileId) {
            localStorage.setItem('selectedProfileId', profileId);
          } else {
            localStorage.removeItem('selectedProfileId');
          }
        } else {
          localStorage.removeItem('selectedPersonaId');
          localStorage.removeItem('selectedProfileId');
        }

        // Dispatch event to notify of persona change
        window.dispatchEvent(
          new CustomEvent('personaChanged', {
            detail: { personaId, profileId, startNewChat: true },
          }),
        );

        // Navigate to new chat
        const url = personaId
          ? `/chat?personaId=${personaId}&withPersona=true${profileId ? `&profileId=${profileId}` : ''}`
          : '/chat';
        window.location.href = url;
        return;
      }

      // Same persona or no messages - just update selection
      onPersonaSelect(personaId);
      if (onProfileSelect) {
        onProfileSelect(profileId);
      }
      onCloseDropdown?.();
    },
    [
      chatHasMessages,
      selectedPersonaId,
      onPersonaSelect,
      onProfileSelect,
      onCloseDropdown,
    ],
  );

  const handleProfileSelect = useCallback(
    (personaId: string, profileId: string | null) => {
      // If selecting a profile for a different persona, handle persona switch too
      if (personaId !== selectedPersonaId) {
        handlePersonaSelect(personaId, profileId);
      } else {
        // Same persona, just update profile
        if (onProfileSelect) {
          onProfileSelect(profileId);
        }
        onCloseDropdown?.();
      }
    },
    [selectedPersonaId, handlePersonaSelect, onProfileSelect, onCloseDropdown],
  );

  const handleEditPersona = useCallback(
    (persona: PersonaWithAccess, e: React.MouseEvent) => {
      e.stopPropagation();
      onEditPersona(persona);
      onCloseDropdown?.();
    },
    [onEditPersona, onCloseDropdown],
  );

  const handleDeletePersona = useCallback(
    async (persona: PersonaWithAccess, e: React.MouseEvent) => {
      e.stopPropagation();

      if (
        !confirm(
          `Are you sure you want to delete "${persona.name}"? This cannot be undone.`,
        )
      ) {
        return;
      }

      try {
        const response = await fetch(`/api/personas/${persona.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          toast.success('Persona deleted successfully');

          // If this was the selected persona, clear it
          if (selectedPersonaId === persona.id) {
            onPersonaSelect(null);
            if (onProfileSelect) {
              onProfileSelect(null);
            }
          }

          // Refresh personas
          fetchPersonas();
          window.dispatchEvent(new CustomEvent('personasUpdated'));
        } else {
          const errorData = await response.json();
          toast.error(errorData.error || 'Failed to delete persona');
        }
      } catch (error) {
        console.error('Error deleting persona:', error);
        toast.error('Failed to delete persona');
      }
    },
    [selectedPersonaId, onPersonaSelect, onProfileSelect],
  );

  const handleCustomizePersona = useCallback(
    (persona: PersonaWithAccess, e: React.MouseEvent) => {
      e.stopPropagation();
      setCustomizingPersonaId(persona.id);
      onCloseDropdown?.();
    },
    [onCloseDropdown],
  );

  const handleCreateClick = useCallback(() => {
    onCreatePersona();
    onCloseDropdown?.();
  }, [onCreatePersona, onCloseDropdown]);

  const handleOpenUpgrade = useCallback(() => {
    onCloseDropdown?.();
    setTimeout(() => {
      window.dispatchEvent(new Event('open-premium-modal'));
    }, 100);
  }, [onCloseDropdown]);

  const handleEditProfile = useCallback(
    (profile: PersonaProfile, e: React.MouseEvent) => {
      e.stopPropagation();
      if (onEditProfile) {
        onEditProfile(profile);
      }
      onCloseDropdown?.();
    },
    [onEditProfile, onCloseDropdown],
  );

  const handleCreateProfile = useCallback(
    (personaId: string) => {
      // First select the persona if not already selected
      if (personaId !== selectedPersonaId) {
        onPersonaSelect(personaId);
      }
      if (onCreateProfile) {
        onCreateProfile();
      }
      onCloseDropdown?.();
    },
    [selectedPersonaId, onPersonaSelect, onCreateProfile, onCloseDropdown],
  );

  // Get theme for selected profile
  const selectedProfileTheme = selectedProfile
    ? getProfileTheme(selectedProfile.id)
    : null;

  return (
    <>
      <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        {!hasPersonasAccess ? (
          <>
            <Lock className="size-4 text-muted-foreground" />
            <span className="truncate max-w-[120px]">AI Persona</span>
          </>
        ) : (
          <>
            {selectedPersona?.iconUrl ? (
              <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={selectedPersona.iconUrl}
                  alt=""
                  width={16}
                  height={16}
                  className="object-cover w-full h-full"
                />
              </div>
            ) : selectedProfile && selectedProfileTheme ? (
              <div
                className={cn(
                  'w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0',
                  selectedProfileTheme.iconBg,
                )}
              >
                {selectedProfile.name.charAt(0).toUpperCase()}
              </div>
            ) : (
              <span className={selectedPersona ? 'text-eos-orange' : ''}>
                <UserIcon size={16} />
              </span>
            )}
            <span
              className={cn(
                'truncate max-w-[120px]',
                (selectedPersona || selectedProfile) && 'text-eos-orange',
              )}
            >
              {selectedProfile
                ? `${selectedPersona?.name} · ${selectedProfile.name}`
                : selectedPersona
                  ? selectedPersona.name
                  : 'AI Persona'}
            </span>
            {(selectedPersona || selectedProfile) && (
              <Check className="size-3 ml-auto text-eos-orange" />
            )}
          </>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent
          className="w-72 max-h-[400px] overflow-y-auto p-1"
          sideOffset={8}
        >
          {!hasPersonasAccess ? (
            <div className="p-3 space-y-3">
              <div className="text-sm font-medium">AI Personas are a Pro feature</div>
              <p className="text-xs text-muted-foreground">
                Upgrade to unlock specialized personas and custom assistants.
              </p>
              <Button
                size="sm"
                className="w-full"
                onClick={handleOpenUpgrade}
              >
                Upgrade your Circle tier
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Loading overlay while switching */}
              {isSwitchingPersona && (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center rounded-lg z-50">
                  <div className="text-center">
                    <Loader2 className="size-6 animate-spin text-eos-orange mx-auto mb-2" />
                    <div className="text-sm font-medium">
                      Starting new chat...
                    </div>
                  </div>
                </div>
              )}

              {/* Default EOS AI Option */}
              <DropdownMenuItem
                onClick={() => handlePersonaSelect(null)}
                className={cn(
                  'cursor-pointer p-2.5 rounded-lg mb-1 group relative',
                  !selectedPersonaId && 'bg-eos-orange/10',
                )}
              >
                <div className="flex items-center gap-2.5 w-full">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-eos-orange to-eos-orangeLight flex items-center justify-center shadow-sm flex-shrink-0 text-white">
                    <UserIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      Default EOS AI
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Standard EOS guidance
                    </div>
                  </div>
                  {!selectedPersonaId && (
                    <Check className="size-4 text-eos-orange flex-shrink-0" />
                  )}
                </div>
                {chatHasMessages && selectedPersonaId && (
                  <div className="absolute inset-0 bg-zinc-100/95 dark:bg-zinc-900/95 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                    <span className="text-xs font-semibold text-eos-orange dark:text-eos-orangeLight">
                      Start New Chat
                    </span>
                  </div>
                )}
              </DropdownMenuItem>

              {/* System Personas */}
              {systemPersonas.length > 0 && (
                <>
                  <DropdownMenuSeparator className="my-1" />
                  <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Course Assistants
                  </div>
                  {systemPersonas.map((persona) => (
                    <PersonaItemWithProfiles
                      key={persona.id}
                      persona={persona}
                      isSelected={selectedPersonaId === persona.id}
                      selectedProfileId={selectedProfileId}
                      chatHasMessages={chatHasMessages}
                      profiles={personaProfiles[persona.id] || []}
                      isLoadingProfiles={loadingProfiles[persona.id] || false}
                      onHover={() => fetchProfilesForPersona(persona.id)}
                      onSelectPersona={() => handlePersonaSelect(persona.id)}
                      onSelectProfile={(profileId) =>
                        handleProfileSelect(persona.id, profileId)
                      }
                      onEdit={(e) => handleEditPersona(persona, e)}
                      onDelete={(e) => handleDeletePersona(persona, e)}
                      onCreateProfile={() => handleCreateProfile(persona.id)}
                      onEditProfile={
                        onEditProfile ? handleEditProfile : undefined
                      }
                      showDelete
                    />
                  ))}
                </>
              )}

              {/* Shared Personas */}
              {sharedPersonas.length > 0 && (
                <>
                  <DropdownMenuSeparator className="my-1" />
                  <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Users className="size-3" />
                    Organization
                  </div>
                  {sharedPersonas.map((persona) => (
                    <PersonaItemWithProfiles
                      key={persona.id}
                      persona={persona}
                      isSelected={selectedPersonaId === persona.id}
                      selectedProfileId={selectedProfileId}
                      chatHasMessages={chatHasMessages}
                      profiles={personaProfiles[persona.id] || []}
                      isLoadingProfiles={loadingProfiles[persona.id] || false}
                      onHover={() => fetchProfilesForPersona(persona.id)}
                      onSelectPersona={() => handlePersonaSelect(persona.id)}
                      onSelectProfile={(profileId) =>
                        handleProfileSelect(persona.id, profileId)
                      }
                      onEdit={(e) => handleEditPersona(persona, e)}
                      onCustomize={(e) => handleCustomizePersona(persona, e)}
                      onCreateProfile={() => handleCreateProfile(persona.id)}
                      onEditProfile={
                        onEditProfile ? handleEditProfile : undefined
                      }
                      showEdit={persona.canEdit === true}
                      showCustomize={
                        persona.allowUserOverlay === true ||
                        persona.allowUserKnowledge === true
                      }
                    />
                  ))}
                </>
              )}

              {/* User Personas */}
              {userPersonas.length > 0 && (
                <>
                  <DropdownMenuSeparator className="my-1" />
                  <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    My Personas
                  </div>
                  {userPersonas.map((persona) => (
                    <PersonaItemWithProfiles
                      key={persona.id}
                      persona={persona}
                      isSelected={selectedPersonaId === persona.id}
                      selectedProfileId={selectedProfileId}
                      chatHasMessages={chatHasMessages}
                      profiles={personaProfiles[persona.id] || []}
                      isLoadingProfiles={loadingProfiles[persona.id] || false}
                      onHover={() => fetchProfilesForPersona(persona.id)}
                      onSelectPersona={() => handlePersonaSelect(persona.id)}
                      onSelectProfile={(profileId) =>
                        handleProfileSelect(persona.id, profileId)
                      }
                      onEdit={(e) => handleEditPersona(persona, e)}
                      onDelete={(e) => handleDeletePersona(persona, e)}
                      onCreateProfile={() => handleCreateProfile(persona.id)}
                      onEditProfile={
                        onEditProfile ? handleEditProfile : undefined
                      }
                      showEdit
                      showDelete
                    />
                  ))}
                </>
              )}

              {/* Create New Persona */}
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onClick={handleCreateClick}
                className="cursor-pointer p-2.5 rounded-lg group border border-dashed border-eos-orange/40 dark:border-eos-orange/30 hover:border-eos-orange hover:bg-eos-orange/10"
              >
                <div className="flex items-center gap-2.5 w-full">
                  <div className="w-8 h-8 rounded-lg border-2 border-eos-orange/40 dark:border-eos-orange/30 group-hover:border-eos-orange flex items-center justify-center transition-colors text-eos-orange dark:text-eos-orangeLight">
                    <PlusIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-eos-orange dark:text-eos-orangeLight group-hover:text-foreground transition-colors">
                      Create New Persona
                    </div>
                    <div className="text-xs text-foreground/60 group-hover:text-muted-foreground transition-colors">
                      Add a specialized assistant
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
      </DropdownMenuSub>
      <PersonaOverlayEditor
        isOpen={customizingPersonaId !== null}
        onClose={() => setCustomizingPersonaId(null)}
        personaId={customizingPersonaId}
      />
    </>
  );
}

// Helper to check if a persona is the EOS Implementer (only persona that supports profiles)
function isEOSImplementerPersona(persona: Persona): boolean {
  const EOS_IMPLEMENTER_UUID = '00000000-0000-0000-0000-000000000001';
  return (
    persona.id === EOS_IMPLEMENTER_UUID ||
    persona.knowledgeNamespace === 'eos-implementer' ||
    (persona.name === 'EOS Implementer' && persona.isSystemPersona === true)
  );
}

function isOrgSharedPersona(persona: PersonaWithAccess): boolean {
  return persona.visibility === 'org' || persona.isShared === true;
}

function PersonaAccessBadges({ persona }: { persona: PersonaWithAccess }) {
  if (!isOrgSharedPersona(persona)) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground">
        Shared
      </span>
      {persona.lockInstructions || persona.lockKnowledge ? (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground">
          <Lock className="size-2.5 mr-1" />
          Locked
        </span>
      ) : null}
      {persona.allowUserOverlay || persona.allowUserKnowledge ? (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground">
          <Sparkles className="size-2.5 mr-1" />
          Customizable
        </span>
      ) : null}
    </div>
  );
}

// Simple persona item without profile submenu (for non-EOS Implementer personas)
function SimplePersonaItem({
  persona,
  isSelected,
  chatHasMessages,
  onSelectPersona,
  onEdit,
  onDelete,
  onCustomize,
  showEdit,
  showDelete,
  showCustomize,
}: {
  persona: PersonaWithAccess;
  isSelected: boolean;
  chatHasMessages: boolean;
  onSelectPersona: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onCustomize?: (e: React.MouseEvent) => void;
  showEdit?: boolean;
  showDelete?: boolean;
  showCustomize?: boolean;
}) {
  // If we have edit/delete actions, we need a submenu for those
  const hasActions =
    (showEdit && onEdit) ||
    (showDelete && onDelete) ||
    (showCustomize && onCustomize);

  if (!hasActions) {
    // Simple click-to-select item
    return (
      <DropdownMenuItem
        onClick={onSelectPersona}
        className={cn(
          'cursor-pointer p-2.5 rounded-lg mb-1 group relative',
          isSelected && 'bg-eos-navy/10',
        )}
      >
        <div className="flex items-center gap-2.5 w-full">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-eos-navy to-eos-navyLight flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
            {persona.iconUrl ? (
              <Image
                src={persona.iconUrl}
                alt=""
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-white text-xs font-bold">
                {persona.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{persona.name}</div>
            {persona.description && (
              <div className="text-xs text-muted-foreground truncate">
                {persona.description}
              </div>
            )}
            <PersonaAccessBadges persona={persona} />
          </div>
          {isSelected && (
            <Check className="size-4 text-eos-navy dark:text-eos-orange flex-shrink-0" />
          )}
        </div>
        {chatHasMessages && !isSelected && (
          <div className="absolute inset-0 bg-zinc-100/95 dark:bg-zinc-900/95 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity pointer-events-none">
            <span className="text-xs font-semibold text-eos-navy dark:text-white">
              Start New Chat
            </span>
          </div>
        )}
      </DropdownMenuItem>
    );
  }

  // Need submenu for edit/delete actions (but no profiles)
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        className={cn(
          'cursor-pointer p-2.5 rounded-lg mb-1 group relative',
          isSelected && 'bg-eos-navy/10',
        )}
      >
        <div className="flex items-center gap-2.5 w-full">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-eos-navy to-eos-navyLight flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
            {persona.iconUrl ? (
              <Image
                src={persona.iconUrl}
                alt=""
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-white text-xs font-bold">
                {persona.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{persona.name}</div>
            {persona.description && (
              <div className="text-xs text-muted-foreground truncate">
                {persona.description}
              </div>
            )}
            <PersonaAccessBadges persona={persona} />
          </div>
          {isSelected && (
            <Check className="size-4 text-eos-navy dark:text-eos-orange flex-shrink-0" />
          )}
        </div>
        {chatHasMessages && !isSelected && (
          <div className="absolute inset-0 bg-zinc-100/95 dark:bg-zinc-900/95 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity pointer-events-none">
            <span className="text-xs font-semibold text-eos-navy dark:text-white">
              Start New Chat
            </span>
          </div>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-52 p-1" sideOffset={8}>
          {/* Select this persona */}
          <DropdownMenuItem
            onClick={onSelectPersona}
            className={cn(
              'cursor-pointer p-2 rounded-lg mb-0.5',
              isSelected && 'bg-eos-navy/10',
            )}
          >
            <div className="flex items-center gap-2 w-full">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-eos-navy to-eos-navyLight flex items-center justify-center overflow-hidden">
                {persona.iconUrl ? (
                  <Image
                    src={persona.iconUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-white text-[10px] font-bold">
                    {persona.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium">Select Persona</span>
              {isSelected && (
                <Check className="size-3 ml-auto text-eos-navy dark:text-eos-orange" />
              )}
            </div>
          </DropdownMenuItem>

          {/* Edit/Delete actions */}
          <DropdownMenuSeparator className="my-1" />
          <div className="px-2 py-1 text-[10px] font-medium text-foreground/50 uppercase tracking-wider">
            Actions
          </div>
          <div className="flex gap-1 px-1 py-1">
            {showCustomize && onCustomize && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 flex-1 text-xs text-foreground/80 hover:text-foreground hover:bg-primary/10"
                onClick={onCustomize}
              >
                <Sparkles className="size-3" />
                <span className="ml-1.5">Customize</span>
              </Button>
            )}
            {showEdit && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 flex-1 text-xs text-foreground/80 hover:text-foreground hover:bg-eos-navy/20 dark:hover:bg-eos-navy/30"
                onClick={onEdit}
              >
                <PencilEditIcon size={12} />
                <span className="ml-1.5">Edit</span>
              </Button>
            )}
            {showDelete && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 flex-1 text-xs text-foreground/80 hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400"
                onClick={onDelete}
              >
                <TrashIcon size={12} />
                <span className="ml-1.5">Delete</span>
              </Button>
            )}
          </div>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}

// Component for persona item - shows profiles submenu only for EOS Implementer
function PersonaItemWithProfiles({
  persona,
  isSelected,
  selectedProfileId,
  chatHasMessages,
  profiles,
  isLoadingProfiles,
  onHover,
  onSelectPersona,
  onSelectProfile,
  onEdit,
  onDelete,
  onCustomize,
  onCreateProfile,
  onEditProfile,
  showEdit,
  showDelete,
  showCustomize,
}: {
  persona: PersonaWithAccess;
  isSelected: boolean;
  selectedProfileId?: string;
  chatHasMessages: boolean;
  profiles: PersonaProfile[];
  isLoadingProfiles: boolean;
  onHover: () => void;
  onSelectPersona: () => void;
  onSelectProfile: (profileId: string | null) => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onCustomize?: (e: React.MouseEvent) => void;
  onCreateProfile?: () => void;
  onEditProfile?: (profile: PersonaProfile, e: React.MouseEvent) => void;
  showEdit?: boolean;
  showDelete?: boolean;
  showCustomize?: boolean;
}) {
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  // Only show profile submenu for EOS Implementer persona
  const supportsProfiles = isEOSImplementerPersona(persona);

  // For non-EOS Implementer personas, use simple item without profiles
  if (!supportsProfiles) {
    return (
      <SimplePersonaItem
        persona={persona}
        isSelected={isSelected}
        chatHasMessages={chatHasMessages}
        onSelectPersona={onSelectPersona}
        onEdit={onEdit}
        onDelete={onDelete}
        onCustomize={onCustomize}
        showEdit={showEdit}
        showDelete={showDelete}
        showCustomize={showCustomize}
      />
    );
  }

  // EOS Implementer - show full profile submenu
  return (
    <DropdownMenuSub
      onOpenChange={(open) => {
        if (open) onHover();
      }}
    >
      <DropdownMenuSubTrigger
        className={cn(
          'cursor-pointer p-2.5 rounded-lg mb-1 group relative',
          isSelected && 'bg-eos-navy/10',
        )}
      >
        <div className="flex items-center gap-2.5 w-full">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-eos-navy to-eos-navyLight flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
            {persona.iconUrl ? (
              <Image
                src={persona.iconUrl}
                alt=""
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-white text-xs font-bold">
                {persona.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{persona.name}</div>
            {persona.description && (
              <div className="text-xs text-muted-foreground truncate">
                {persona.description}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isSelected && !selectedProfile && (
              <Check className="size-4 text-eos-navy dark:text-eos-orange" />
            )}
            {isSelected && selectedProfile && (
              <div className="flex items-center gap-1">
                <div
                  className={cn(
                    'w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white',
                    getProfileTheme(selectedProfile.id).iconBg,
                  )}
                >
                  {selectedProfile.name.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </div>
        {chatHasMessages && !isSelected && (
          <div className="absolute inset-0 bg-zinc-100/95 dark:bg-zinc-900/95 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity pointer-events-none">
            <span className="text-xs font-semibold text-eos-navy dark:text-white">
              Start New Chat
            </span>
          </div>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-56 p-1" sideOffset={8}>
          {isLoadingProfiles ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Select persona without profile */}
              <DropdownMenuItem
                onClick={onSelectPersona}
                className={cn(
                  'cursor-pointer p-2 rounded-lg mb-0.5',
                  isSelected && !selectedProfileId && 'bg-eos-navy/10',
                )}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-eos-navy to-eos-navyLight flex items-center justify-center overflow-hidden">
                    {persona.iconUrl ? (
                      <Image
                        src={persona.iconUrl}
                        alt=""
                        width={24}
                        height={24}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="text-white text-[10px] font-bold">
                        {persona.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium">No Profile</span>
                  {isSelected && !selectedProfileId && (
                    <Check className="size-3 ml-auto text-eos-navy dark:text-eos-orange" />
                  )}
                </div>
              </DropdownMenuItem>

              {/* Profiles */}
              {profiles.length > 0 && (
                <>
                  <DropdownMenuSeparator className="my-1" />
                  <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Profiles
                  </div>
                  {profiles.map((profile) => {
                    const theme = getProfileTheme(profile.id);
                    const isProfileSelected =
                      isSelected && selectedProfileId === profile.id;
                    return (
                      <DropdownMenuItem
                        key={profile.id}
                        onClick={() => onSelectProfile(profile.id)}
                        className={cn(
                          'cursor-pointer p-2 rounded-lg mb-0.5 group',
                          isProfileSelected && 'bg-muted/50',
                        )}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white',
                              theme.iconBg,
                            )}
                          >
                            {profile.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {profile.name}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {isProfileSelected && (
                              <Check className="size-3 text-eos-orange dark:text-eos-orangeLight" />
                            )}
                            {onEditProfile && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-foreground/60 hover:text-foreground"
                                onClick={(e) => onEditProfile(profile, e)}
                              >
                                <PencilEditIcon size={10} />
                              </Button>
                            )}
                          </div>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </>
              )}

              {/* Create Profile - only for EOS Implementer */}
              {onCreateProfile && (
                <>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem
                    onClick={onCreateProfile}
                    className="cursor-pointer p-2 rounded-lg border border-dashed border-foreground/20 hover:border-foreground/40 hover:bg-foreground/5"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className="w-6 h-6 rounded-md border border-dashed border-foreground/20 flex items-center justify-center text-foreground/60">
                        <PlusIcon size={10} />
                      </div>
                      <span className="text-sm text-foreground/70 group-hover:text-foreground">
                        Create Profile
                      </span>
                    </div>
                  </DropdownMenuItem>
                </>
              )}

              {/* Edit/Delete persona actions - clearly labeled */}
              {(showEdit || showDelete) && (
                <>
                  <DropdownMenuSeparator className="my-1" />
                  <div className="px-2 py-1 text-[10px] font-medium text-foreground/50 uppercase tracking-wider">
                    Persona Actions
                  </div>
                  <div className="flex gap-1 px-1 py-1">
                    {showEdit && onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 flex-1 text-xs text-foreground/80 hover:text-foreground hover:bg-eos-navy/20 dark:hover:bg-eos-navy/30"
                        onClick={onEdit}
                      >
                        <PencilEditIcon size={12} />
                        <span className="ml-1.5">Edit Persona</span>
                      </Button>
                    )}
                    {showDelete && onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 flex-1 text-xs text-foreground/80 hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400"
                        onClick={onDelete}
                      >
                        <TrashIcon size={12} />
                        <span className="ml-1.5">Delete Persona</span>
                      </Button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}


