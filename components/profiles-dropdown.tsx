'use client';

import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SettingsIcon } from '@/components/icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { PersonaProfile, Persona } from '@/lib/db/schema';
import {
  PROFILE_THEMES,
  getProfileTheme,
} from '@/lib/constants/profile-themes';

import { cn } from '@/lib/utils';

interface ProfilesDropdownProps {
  selectedPersonaId: string | null;
  selectedProfileId: string | null;
  onProfileSelect: (profileId: string | null) => void;
  onCreateProfile: () => void;
  onEditProfile: (profile: PersonaProfile) => void;
  disabled?: boolean;
}

export function ProfilesDropdown({
  selectedPersonaId,
  selectedProfileId,
  onProfileSelect,
  onCreateProfile,
  onEditProfile,
  disabled = false,
}: ProfilesDropdownProps) {
  const [profiles, setProfiles] = useState<PersonaProfile[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredProfileId, setHoveredProfileId] = useState<string | null>(null);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const selectedTheme = getProfileTheme(selectedProfileId);

  useEffect(() => {
    if (selectedPersonaId) {
      fetchProfiles();
      fetchPersona();
    } else {
      setProfiles([]);
      setPersona(null);
    }
  }, [selectedPersonaId]);

  const fetchPersona = async () => {
    if (!selectedPersonaId) return;

    try {
      // Handle hardcoded EOS Implementer - check for both string and UUID
      const EOS_IMPLEMENTER_UUID = '00000000-0000-0000-0000-000000000001';
      if (
        selectedPersonaId === 'eos-implementer' ||
        selectedPersonaId === EOS_IMPLEMENTER_UUID
      ) {
        setPersona({
          id: EOS_IMPLEMENTER_UUID,
          userId: null,
          orgId: null,
          name: 'EOS Implementer',
          description:
            'Expert EOS Implementer with deep knowledge of the EOS methodology and implementation process',
          instructions: '',
          iconUrl: null,
          isDefault: true,
          isSystemPersona: true,
          isShared: false,
          visibility: 'private',
          lockInstructions: false,
          lockKnowledge: false,
          allowUserOverlay: false,
          allowUserKnowledge: false,
          publishedAt: null,
          knowledgeNamespace: 'eos-implementer',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return;
      }

      // Fetch regular personas from API
      const response = await fetch(`/api/personas/${selectedPersonaId}`);
      if (response.ok) {
        const data = await response.json();
        setPersona(data);
      } else if (response.status === 404) {
        // Persona no longer exists - clear it from user settings
        console.warn('Persona not found (404), clearing from user settings:', selectedPersonaId);
        setPersona(null);
        
        // Clear the invalid persona selection
        try {
          await fetch('/api/user-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              selectedPersonaId: null,
              selectedProfileId: null 
            }),
          });
        } catch (settingsError) {
          console.error('Failed to clear invalid persona from settings:', settingsError);
        }
      } else {
        console.error('Failed to fetch persona:', response.status);
        setPersona(null);
      }
    } catch (error) {
      console.error('Error fetching persona:', error);
      setPersona(null);
    }
  };

  const fetchProfiles = async () => {
    if (!selectedPersonaId) return;

    setIsLoading(true);
    try {
      // Handle hardcoded EOS Implementer profiles - fetch from API
      const EOS_IMPLEMENTER_UUID = '00000000-0000-0000-0000-000000000001';
      if (
        selectedPersonaId === 'eos-implementer' ||
        selectedPersonaId === EOS_IMPLEMENTER_UUID
      ) {
        const response = await fetch(
          `/api/personas/${selectedPersonaId}/profiles`,
        );
        if (response.ok) {
          const data = await response.json();
          setProfiles(data);
        } else if (response.status === 404) {
          // Persona no longer exists - profiles will be empty
          console.warn('Persona profiles not found (404)');
          setProfiles([]);
        } else {
          console.error(
            'Failed to fetch EOS implementer profiles:',
            response.status,
          );
          setProfiles([]);
        }
        return;
      }

      // Fetch regular profiles from API
      const response = await fetch(
        `/api/personas/${selectedPersonaId}/profiles`,
      );
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);
      } else if (response.status === 404) {
        // Persona no longer exists - profiles will be empty
        console.warn('Persona profiles not found (404)');
        setProfiles([]);
      } else {
        console.error('Failed to fetch profiles:', response.status);
        setProfiles([]);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
      setProfiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSelect = (profileId: string | null) => {
    onProfileSelect(profileId);
    setIsOpen(false);
  };

  const handleEditProfile = (
    profile: PersonaProfile,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    onEditProfile(profile);
    setIsOpen(false);
  };

  const handleCreateProfile = () => {
    onCreateProfile();
    setIsOpen(false);
  };

  // Don't render if no persona is selected
  if (!selectedPersonaId) {
    console.log('PROFILES_DROPDOWN: Not rendering - no persona selected');
    return null;
  }

  // Check if this is a system persona (read-only)
  const isSystemPersona = persona?.isSystemPersona || false;

  // Only show profiles dropdown for the EOS Implementer system persona
  const isEOSImplementer =
    persona?.name === 'EOS Implementer' && isSystemPersona;

  console.log('PROFILES_DROPDOWN: Visibility check', {
    selectedPersonaId,
    personaName: persona?.name,
    isSystemPersona,
    isEOSImplementer,
    shouldRender: isEOSImplementer,
  });

  // Don't render profiles dropdown unless it's the EOS Implementer
  if (!isEOSImplementer) {
    console.log('PROFILES_DROPDOWN: Not rendering - not EOS Implementer', {
      selectedPersonaId,
      personaName: persona?.name,
      isSystemPersona,
      isEOSImplementer,
    });
    return null;
  }

  const ButtonIcon = selectedTheme.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={disabled || isLoading}
              className={cn(
                'relative overflow-hidden group h-10 px-4 transition-all duration-300 ease-out cursor-pointer text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center',
                isOpen && 'ring-2 ring-eos-orange/30',
                selectedProfile &&
                  `ring-2 ring-opacity-20 ${selectedTheme.borderColor.replace('border-', 'ring-')}`,
              )}
            >
              {/* Animated background gradient */}
              <div
                className={`absolute inset-0 ${selectedTheme.gradient.from} ${selectedTheme.gradient.to} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
              />

              {/* Icon with animation */}
              <motion.div
                className="relative z-10"
                animate={{
                  rotate: isOpen ? 180 : 0,
                  scale: isLoading ? 0.8 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                <ButtonIcon
                  size={16}
                  className={`
                    transition-colors duration-300
                    ${selectedProfile ? selectedTheme.gradient.from.replace('from-', 'text-') : 'text-muted-foreground'}
                    group-hover:${selectedTheme.gradient.from.replace('from-', 'text-')}
                  `}
                />
              </motion.div>

              <span
                className={`
                hidden md:inline ml-2 font-medium transition-colors duration-300 relative z-10
                max-w-[120px] truncate
                ${selectedProfile ? selectedTheme.gradient.from.replace('from-', 'text-') : 'text-foreground'}
                group-hover:${selectedTheme.gradient.from.replace('from-', 'text-')}
              `}
              >
                {selectedProfile ? selectedProfile.name : 'Select Profile'}
              </span>

              {/* Loading indicator */}
              {isLoading && (
                <motion.div
                  className="absolute inset-0 bg-background/80 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div
                    className={`w-4 h-4 border-2 ${selectedTheme.borderColor} border-t-transparent rounded-full animate-spin`}
                  />
                </motion.div>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            className="w-80 p-2 z-[100] relative"
            sideOffset={8}
            avoidCollisions={true}
            collisionPadding={8}
          >
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {/* Default Option (No Profile) */}
              <DropdownMenuItem
                onClick={() => handleProfileSelect(null)}
                className={`
                  cursor-pointer p-3 rounded-lg mb-2 group
                  transition-all duration-200 ease-out
                  ${PROFILE_THEMES.default.hoverBg}
                  ${!selectedProfileId ? `${PROFILE_THEMES.default.gradient.from.replace('from-', 'bg-')}/10 border ${PROFILE_THEMES.default.borderColor}` : 'hover:bg-accent/50'}
                `}
                onMouseEnter={() => setHoveredProfileId('default')}
                onMouseLeave={() => setHoveredProfileId(null)}
              >
                <div className="flex items-center gap-3 w-full">
                  <motion.div
                    className="relative"
                    animate={{
                      scale: hoveredProfileId === 'default' ? 1.1 : 1,
                      rotate: hoveredProfileId === 'default' ? 5 : 0,
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl ${PROFILE_THEMES.default.iconBg} flex items-center justify-center shadow-lg`}
                    >
                      <div className={PROFILE_THEMES.default.iconColor}>
                        <SettingsIcon size={20} />
                      </div>
                    </div>
                    {!selectedProfileId && (
                      <motion.div
                        className={`absolute -top-1 -right-1 w-4 h-4 ${PROFILE_THEMES.default.gradient.from.replace('from-', 'bg-')} rounded-full flex items-center justify-center`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </motion.div>
                    )}
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground group-hover:text-foreground transition-colors">
                      General Mode
                    </div>
                    <div className="text-sm text-muted-foreground group-hover:text-muted-foreground transition-colors">
                      Use the persona without a specific profile
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>

              {profiles.length > 0 && (
                <DropdownMenuSeparator className="my-2 bg-border/50" />
              )}

              {/* Available Profiles */}
              <AnimatePresence>
                {profiles.map((profile, index) => {
                  const profileTheme = getProfileTheme(profile.id);
                  const ProfileIcon = profileTheme.icon;

                  return (
                    <motion.div
                      key={profile.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.05, duration: 0.2 }}
                    >
                      <DropdownMenuItem
                        onClick={() => handleProfileSelect(profile.id)}
                        className={`
                          cursor-pointer p-3 rounded-lg mb-2 group relative
                          transition-all duration-200 ease-out
                          ${profileTheme.hoverBg}
                          ${selectedProfileId === profile.id ? `${profileTheme.gradient.from.replace('from-', 'bg-')}/10 border ${profileTheme.borderColor}` : 'hover:bg-accent/50'}
                        `}
                        onMouseEnter={() => setHoveredProfileId(profile.id)}
                        onMouseLeave={() => setHoveredProfileId(null)}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <motion.div
                            className="relative"
                            animate={{
                              scale: hoveredProfileId === profile.id ? 1.1 : 1,
                              rotate: hoveredProfileId === profile.id ? 5 : 0,
                            }}
                            transition={{ duration: 0.2 }}
                          >
                            <div
                              className={`w-10 h-10 rounded-xl ${profileTheme.iconBg} flex items-center justify-center shadow-lg`}
                            >
                              <ProfileIcon
                                size={20}
                                className={profileTheme.iconColor}
                              />
                            </div>
                            {selectedProfileId === profile.id && (
                              <motion.div
                                className={`absolute -top-1 -right-1 w-4 h-4 ${profileTheme.gradient.from.replace('from-', 'bg-')} rounded-full flex items-center justify-center`}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.1 }}
                              >
                                <div className="w-2 h-2 bg-white rounded-full" />
                              </motion.div>
                            )}
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground group-hover:text-foreground transition-colors">
                              {profile.name}
                            </div>
                            {profile.description && (
                              <div className="text-sm text-muted-foreground group-hover:text-muted-foreground transition-colors line-clamp-2">
                                {profile.description}
                              </div>
                            )}
                          </div>
                          <motion.div
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {/* No edit button for implementer persona profiles */}
                          </motion.div>
                        </div>
                      </DropdownMenuItem>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {profiles.length === 0 && !isLoading && (
                <div className="text-center py-4 text-muted-foreground">
                  <div className="mx-auto mb-2 opacity-50">
                    <SettingsIcon size={24} />
                  </div>
                  <p className="text-sm">No profiles available</p>
                  <p className="text-xs">
                    Profiles are managed by system administrators
                  </p>
                </div>
              )}

              {/* No create profile option for implementer persona */}
            </motion.div>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipTrigger>

      <TooltipContent side="bottom">
        <div className="text-sm">
          {selectedProfile
            ? `Using ${selectedProfile.name} profile`
            : 'Select a specialized EOS Implementer profile'}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
