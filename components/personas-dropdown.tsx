'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
import {
  PlusIcon,
  PencilEditIcon,
  UserIcon,
  TrashIcon,
} from '@/components/icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { Persona } from '@/lib/db/schema';
import { useAccountStore } from '@/lib/stores/account-store';
import { Sparkles, Users } from 'lucide-react';
import GlassSurface from '@/components/GlassSurface';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast-system';
import { showEdgeCaseToast } from '@/lib/ui/edge-case-messages';

interface PersonasDropdownProps {
  selectedPersonaId?: string;
  onPersonaSelect: (personaId: string | null) => void;
  onCreatePersona: () => void;
  onEditPersona: (persona: Persona) => void;
  messages?: any[]; // Array of messages to determine if chat has been used
}

export function PersonasDropdown({
  selectedPersonaId,
  onPersonaSelect,
  onCreatePersona,
  onEditPersona,
  messages = [],
}: PersonasDropdownProps) {
  const [systemPersonas, setSystemPersonas] = useState<Persona[]>([]);
  const [userPersonas, setUserPersonas] = useState<Persona[]>([]);
  const [sharedPersonas, setSharedPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredPersonaId, setHoveredPersonaId] = useState<string | null>(null);
  const [isSwitchingPersona, setIsSwitchingPersona] = useState(false);

  // Determine if chat has been used (has any messages)
  const chatHasMessages = messages.length > 0;

  // Persona access is explicitly entitlement-gated (Pro+)
  const entitlements = useAccountStore((state) => state.entitlements);
  const hasPersonasAccess = Boolean(entitlements?.features?.personas?.custom);

  const allPersonas = [...systemPersonas, ...userPersonas];
  const selectedPersona = allPersonas.find((p) => p.id === selectedPersonaId);

  // Helper to check if hovering would trigger a new chat
  const shouldShowNewChatOverlay = (personaId: string | null) => {
    return (
      chatHasMessages &&
      hoveredPersonaId === personaId &&
      personaId !== selectedPersonaId
    );
  };

  // Add debug logging
  useEffect(() => {
    console.log('PERSONAS_DROPDOWN: Component state', {
      hasPersonasAccess,
      entitlements,
      selectedPersonaId,
      selectedPersona: selectedPersona?.name,
      systemPersonasCount: systemPersonas.length,
      userPersonasCount: userPersonas.length,
      allPersonasIds: allPersonas.map((p) => ({ id: p.id, name: p.name })),
      isLoading,
      isEOSImplementerUUID:
        selectedPersonaId === '00000000-0000-0000-0000-000000000001',
    });
  }, [
    hasPersonasAccess,
    entitlements,
    selectedPersonaId,
    selectedPersona?.id, // Use just the id to avoid object reference changes
    selectedPersona?.name, // Use just the name to avoid object reference changes
    systemPersonas.length, // Use length instead of the whole array
    userPersonas.length, // Use length instead of the whole array
    isLoading,
  ]);

  useEffect(() => {
    if (!hasPersonasAccess) {
      setSystemPersonas([]);
      setUserPersonas([]);
      setSharedPersonas([]);
      setIsLoading(false);
      return;
    }

    fetchPersonas();

    // Listen for personas updates
    const handlePersonasUpdated = () => {
      fetchPersonas();
    };

    // Listen for persona changes to force re-render
    const handlePersonaChanged = () => {
      // Force a re-render by refetching personas
      fetchPersonas();
    };

    window.addEventListener('personasUpdated', handlePersonasUpdated);
    window.addEventListener('personaChanged', handlePersonaChanged);

    return () => {
      window.removeEventListener('personasUpdated', handlePersonasUpdated);
      window.removeEventListener('personaChanged', handlePersonaChanged);
    };
  }, [hasPersonasAccess]);

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
        console.log('PERSONAS_DROPDOWN: API response', {
          systemPersonas: data.systemPersonas?.map((p: Persona) => ({
            id: p.id,
            name: p.name,
          })),
          userPersonas: data.userPersonas?.map((p: Persona) => ({
            id: p.id,
            name: p.name,
          })),
        });
        setSystemPersonas(data.systemPersonas || []);
        setUserPersonas(data.userPersonas || []);
        setSharedPersonas(data.sharedPersonas || []);
      } else {
        console.error('Failed to fetch personas:', response.status);
      }
    } catch (error) {
      console.error('Error fetching personas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonaSelect = async (personaId: string | null) => {
    // Prevent multiple clicks while switching
    if (isSwitchingPersona) {
      console.log(
        'PERSONA_DROPDOWN: Already switching persona, ignoring click',
      );
      return;
    }

    console.log('PERSONA_DROPDOWN: handlePersonaSelect called', {
      selectedPersonaId: personaId,
      currentSelectedPersonaId: selectedPersonaId,
      chatHasMessages,
      timestamp: new Date().toISOString(),
    });

    // If chat has messages and switching to a different persona, create new chat
    if (chatHasMessages && personaId !== selectedPersonaId) {
      setIsSwitchingPersona(true);
      setIsOpen(false); // Close dropdown immediately for better UX

      try {
        console.log(
          'PERSONA_DROPDOWN: Starting new chat with persona:',
          personaId,
        );

        // Navigate to new chat with personaId parameter
        // Use 'withPersona=true' flag to indicate this is an explicit persona selection
        const newChatUrl = personaId
          ? `/chat?personaId=${personaId}&withPersona=true`
          : '/chat';

        console.log('PERSONA_DROPDOWN: Navigating to:', newChatUrl);
        window.location.href = newChatUrl;
      } catch (error) {
        console.error('PERSONA_DROPDOWN: Error switching persona:', error);
        setIsSwitchingPersona(false);
        toast.error(
          `Failed to switch persona: ${error instanceof Error ? error.message : 'Please try again.'}`,
        );
      }
      return;
    }

    // Normal flow for empty chats or same persona
    console.log('PERSONA_DROPDOWN: Calling onPersonaSelect callback');
    onPersonaSelect(personaId);
    setIsOpen(false);
  };

  const handleEditPersona = (persona: Persona, event: React.MouseEvent) => {
    event.stopPropagation();
    onEditPersona(persona);
    setIsOpen(false);
  };

  const handleDeletePersona = async (
    persona: Persona,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();

    // Confirm deletion
    const confirmMessage = persona.isSystemPersona
      ? `Delete "${persona.name}" course assistant? This will remove it for everyone and delete all synced course content. You can re-create it by clicking the course link again.`
      : `Delete "${persona.name}"? This will permanently delete the persona and all its associated data.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`/api/personas?id=${persona.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh personas list
        fetchPersonas();
        // Dispatch event for other components
        window.dispatchEvent(new Event('personasUpdated'));

        // If this was the selected persona, clear selection
        if (selectedPersonaId === persona.id) {
          onPersonaSelect(null);
        }
      } else {
        const error = await response.json();
        toast.error(`Failed to remove persona: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting persona:', error);
      toast.error('Failed to remove persona. Please try again.');
    }
  };

  // If user doesn't have access, show a button that opens the modal
  if (!hasPersonasAccess) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className={`
                relative overflow-hidden group
                h-9 px-3 md:h-10 md:px-4
                border-2 
                !bg-zinc-50 dark:!bg-zinc-800
                border-zinc-200 dark:border-zinc-700
                hover:!bg-zinc-100 dark:hover:!bg-zinc-700
                hover:border-eos-orange/30 dark:hover:border-eos-orange/30
                transition-all duration-300 ease-out
                shadow-sm hover:shadow-md
              `}
              onClick={() => {
                void showEdgeCaseToast(toast, {
                  code: 'FEATURE_LOCKED',
                  message: 'AI Personas are available on Pro and Business plans.',
                  requiredPlan: 'pro',
                });
              }}
            >
              <Sparkles className="size-4 mr-2 text-eos-orange" />
              <span className="hidden md:inline font-medium">AI Personas</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="text-sm">Unlock specialized AI assistants</div>
          </TooltipContent>
        </Tooltip>
      </>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
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
              disabled={isLoading}
              className={cn(
                'relative overflow-hidden group h-10 px-4 transition-all duration-300 ease-out cursor-pointer text-sm font-medium',
                isOpen && 'ring-2 ring-eos-orange/30',
                selectedPersona && 'ring-2 ring-eos-orange/20',
              )}
            >
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-eos-orange/0 via-eos-orange/5 to-eos-orangeLight/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Icon with animation */}
              <motion.div
                className="relative z-10"
                animate={{
                  scale: isOpen ? 1.1 : 1,
                  rotate: isOpen ? 5 : 0,
                }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {selectedPersona?.iconUrl ? (
                  <div className="w-4 h-4 rounded-full overflow-hidden">
                    <Image
                      src={selectedPersona.iconUrl}
                      alt={`${selectedPersona.name} icon`}
                      width={16}
                      height={16}
                      className="object-cover w-full h-full"
                      onError={(e) => {
                        // If image fails to load, fall back to UserIcon
                        const container = e.currentTarget.parentElement;
                        const fallbackIcon =
                          container?.nextElementSibling as HTMLElement;
                        if (container && fallbackIcon) {
                          container.style.display = 'none';
                          fallbackIcon.style.display = 'block';
                        }
                      }}
                    />
                  </div>
                ) : (
                  <UserIcon size={16} />
                )}
                {/* Fallback UserIcon for when image fails to load */}
                {selectedPersona?.iconUrl && (
                  <div
                    className={`
                    h-4 w-4 transition-colors duration-300 hidden
                    ${selectedPersona ? 'text-eos-orange' : 'text-muted-foreground'}
                    group-hover:text-eos-orange
                  `}
                    style={{ display: 'none' }}
                  >
                    <UserIcon size={16} />
                  </div>
                )}
              </motion.div>

              {/* Text with truncation handling */}
              <span
                className={`
                hidden md:inline ml-2 font-medium transition-colors duration-300 relative z-10
                max-w-[120px] truncate
                ${selectedPersona ? 'text-eos-orange' : 'text-foreground'}
                group-hover:text-foreground
              `}
              >
                {selectedPersona ? selectedPersona.name : 'Default EOS AI'}
              </span>

              {/* Loading indicator */}
              {isLoading && (
                <motion.div
                  className="absolute inset-0 bg-background/80 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="w-4 h-4 border-2 border-eos-orange/30 border-t-eos-orange rounded-full animate-spin" />
                </motion.div>
              )}
            </GlassSurface>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            className="w-80 p-2 z-[150] relative max-h-[500px] overflow-y-auto"
            sideOffset={8}
            avoidCollisions={true}
            collisionPadding={{ top: 8, right: 8, bottom: 80, left: 8 }}
          >
            {/* Loading overlay while switching persona */}
            {isSwitchingPersona && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center rounded-lg z-50"
              >
                <div className="text-center">
                  <div className="w-8 h-8 border-3 border-eos-orange/30 border-t-eos-orange rounded-full animate-spin mx-auto mb-2" />
                  <div className="text-sm font-medium text-foreground">
                    Starting new chat...
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {/* Default EOS AI Option */}
              <DropdownMenuItem
                onClick={() => handlePersonaSelect(null)}
                className={`
                  cursor-pointer p-3 rounded-lg mb-2 group relative overflow-hidden
                  transition-all duration-200 ease-out
                  hover:bg-gradient-to-r hover:from-eos-orange/10 hover:to-eos-orangeLight/5
                  ${!selectedPersonaId ? 'bg-eos-orange/10 border border-eos-orange/20' : 'hover:bg-accent/50'}
                `}
                onMouseEnter={() => setHoveredPersonaId('default')}
                onMouseLeave={() => setHoveredPersonaId(null)}
              >
                <div className="flex items-center gap-3 w-full">
                  <motion.div
                    className="relative"
                    animate={{
                      scale: hoveredPersonaId === 'default' ? 1.1 : 1,
                      rotate: hoveredPersonaId === 'default' ? 5 : 0,
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-eos-orange to-eos-orangeLight flex items-center justify-center shadow-lg">
                      <UserIcon size={20} />
                    </div>
                    {!selectedPersonaId && (
                      <motion.div
                        className="absolute -top-1 -right-1 w-4 h-4 bg-eos-orange rounded-full flex items-center justify-center"
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
                      Default EOS AI
                    </div>
                    <div className="text-sm text-muted-foreground group-hover:text-muted-foreground transition-colors">
                      Standard EOS knowledge and guidance
                    </div>
                  </div>
                </div>

                {/* New Chat Overlay */}
                <AnimatePresence>
                  {shouldShowNewChatOverlay('default') && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 bg-background/95 backdrop-blur-md flex items-center justify-center rounded-lg"
                    >
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.2, delay: 0.05 }}
                        className="text-center px-4"
                      >
                        <div className="text-sm font-semibold text-eos-orange mb-1">
                          Start New Chat
                        </div>
                        <div className="text-xs text-muted-foreground">
                          with this persona
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </DropdownMenuItem>

              {systemPersonas.length > 0 && (
                <DropdownMenuSeparator className="my-2 bg-border/50" />
              )}

              {/* System Personas */}
              <AnimatePresence>
                {systemPersonas.map((persona, index) => (
                  <motion.div
                    key={persona.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05, duration: 0.2 }}
                  >
                    <DropdownMenuItem
                      onClick={() => handlePersonaSelect(persona.id)}
                      className={`
                        cursor-pointer p-3 rounded-lg mb-2 group relative overflow-hidden
                        transition-all duration-200 ease-out
                        hover:bg-gradient-to-r hover:from-eos-navy/10 hover:to-eos-navyLight/5
                        ${selectedPersonaId === persona.id ? 'bg-eos-navy/10 border border-eos-navy/20' : 'hover:bg-accent/50'}
                      `}
                      onMouseEnter={() => setHoveredPersonaId(persona.id)}
                      onMouseLeave={() => setHoveredPersonaId(null)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <motion.div
                          className="relative"
                          animate={{
                            scale: hoveredPersonaId === persona.id ? 1.1 : 1,
                            rotate: hoveredPersonaId === persona.id ? -5 : 0,
                          }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-eos-navy to-eos-navyLight flex items-center justify-center shadow-lg overflow-hidden">
                            {persona.iconUrl ? (
                              <Image
                                src={persona.iconUrl}
                                alt={`${persona.name} icon`}
                                width={40}
                                height={40}
                                className="object-cover w-full h-full rounded-xl"
                                onError={(e) => {
                                  // If image fails to load, fall back to text
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget
                                    .nextElementSibling as HTMLElement;
                                  if (fallback) {
                                    fallback.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <span
                              className={`text-white text-sm font-bold ${persona.iconUrl ? 'hidden' : 'flex'} items-center justify-center w-full h-full`}
                              style={{
                                display: persona.iconUrl ? 'none' : 'flex',
                              }}
                            >
                              {persona.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {selectedPersonaId === persona.id && (
                            <motion.div
                              className="absolute -top-1 -right-1 w-4 h-4 bg-eos-navy rounded-full flex items-center justify-center"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.1 }}
                            >
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </motion.div>
                          )}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-foreground transition-colors truncate">
                            {persona.name}
                          </div>
                          {persona.description && (
                            <div className="text-sm text-muted-foreground group-hover:text-muted-foreground transition-colors truncate">
                              {persona.description}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {/* Show delete button for all system personas (course assistants) */}
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-500 rounded-lg"
                              onClick={(e) => handleDeletePersona(persona, e)}
                              title="Remove course assistant"
                            >
                              <TrashIcon size={16} />
                            </Button>
                          </motion.div>
                        </div>
                      </div>

                      {/* New Chat Overlay */}
                      <AnimatePresence>
                        {shouldShowNewChatOverlay(persona.id) && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-background/95 backdrop-blur-md flex items-center justify-center rounded-lg"
                          >
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.8, opacity: 0 }}
                              transition={{ duration: 0.2, delay: 0.05 }}
                              className="text-center px-4"
                            >
                              <div className="text-sm font-semibold text-eos-navy mb-1">
                                Start New Chat
                              </div>
                              <div className="text-xs text-muted-foreground">
                                with this persona
                              </div>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </DropdownMenuItem>
                  </motion.div>
                ))}
              </AnimatePresence>

              {sharedPersonas.length > 0 && (
                <>
                  <DropdownMenuSeparator className="my-2 bg-border/50" />
                  <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
                    Organization Personas
                  </div>
                  <AnimatePresence>
                    {sharedPersonas.map((persona, index) => (
                      <motion.div
                        key={persona.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.05, duration: 0.2 }}
                      >
                        <DropdownMenuItem
                          onClick={() => handlePersonaSelect(persona.id)}
                          className={`
                            cursor-pointer p-3 rounded-lg mb-2 group relative overflow-hidden
                            transition-all duration-200 ease-out
                            hover:bg-gradient-to-r hover:from-eos-navy/10 hover:to-eos-navyLight/5
                            ${selectedPersonaId === persona.id ? 'bg-eos-navy/10 border border-eos-navy/20' : 'hover:bg-accent/50'}
                          `}
                          onMouseEnter={() => setHoveredPersonaId(persona.id)}
                          onMouseLeave={() => setHoveredPersonaId(null)}
                        >
                          <div className="flex items-start gap-3 relative">
                            <motion.div
                              className="relative flex-shrink-0"
                              whileHover={{ scale: 1.05 }}
                              transition={{ type: 'spring', stiffness: 300 }}
                            >
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-200 text-primary">
                                <UserIcon size={20} />
                              </div>
                              {selectedPersonaId === persona.id && (
                                <motion.div
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-eos-navy rounded-full flex items-center justify-center"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ delay: 0.1 }}
                                >
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                </motion.div>
                              )}
                            </motion.div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-foreground group-hover:text-foreground transition-colors truncate flex items-center gap-2">
                                {persona.name}
                                <Users className="w-3 h-3 text-muted-foreground" />
                              </div>
                              {persona.description && (
                                <div className="text-sm text-muted-foreground group-hover:text-muted-foreground transition-colors truncate">
                                  {persona.description}
                                </div>
                              )}
                            </div>
                            <motion.div
                              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-eos-navy/20 hover:text-eos-navy rounded-lg"
                                onClick={(e) => handleEditPersona(persona, e)}
                              >
                                <PencilEditIcon size={16} />
                              </Button>
                            </motion.div>
                          </div>

                          {/* New Chat Overlay */}
                          <AnimatePresence>
                            {shouldShowNewChatOverlay(persona.id) && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 bg-background/95 backdrop-blur-md flex items-center justify-center rounded-lg"
                              >
                                <motion.div
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.8, opacity: 0 }}
                                  transition={{ duration: 0.2, delay: 0.05 }}
                                  className="text-center px-4"
                                >
                                  <div className="text-sm font-semibold text-eos-navy mb-1">
                                    Start New Chat
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    with this persona
                                  </div>
                                </motion.div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </DropdownMenuItem>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </>
              )}

              {userPersonas.length > 0 && (
                <DropdownMenuSeparator className="my-2 bg-border/50" />
              )}

              {/* Custom Personas */}
              <AnimatePresence>
                {userPersonas.map((persona, index) => (
                  <motion.div
                    key={persona.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05, duration: 0.2 }}
                  >
                    <DropdownMenuItem
                      onClick={() => handlePersonaSelect(persona.id)}
                      className={`
                        cursor-pointer p-3 rounded-lg mb-2 group relative overflow-hidden
                        transition-all duration-200 ease-out
                        hover:bg-gradient-to-r hover:from-eos-navy/10 hover:to-eos-navyLight/5
                        ${selectedPersonaId === persona.id ? 'bg-eos-navy/10 border border-eos-navy/20' : 'hover:bg-accent/50'}
                      `}
                      onMouseEnter={() => setHoveredPersonaId(persona.id)}
                      onMouseLeave={() => setHoveredPersonaId(null)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <motion.div
                          className="relative"
                          animate={{
                            scale: hoveredPersonaId === persona.id ? 1.1 : 1,
                            rotate: hoveredPersonaId === persona.id ? -5 : 0,
                          }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-eos-navy to-eos-navyLight flex items-center justify-center shadow-lg overflow-hidden">
                            {persona.iconUrl ? (
                              <Image
                                src={persona.iconUrl}
                                alt={`${persona.name} icon`}
                                width={40}
                                height={40}
                                className="object-cover w-full h-full rounded-xl"
                                onError={(e) => {
                                  // If image fails to load, fall back to text
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget
                                    .nextElementSibling as HTMLElement;
                                  if (fallback) {
                                    fallback.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <span
                              className={`text-white text-sm font-bold ${persona.iconUrl ? 'hidden' : 'flex'} items-center justify-center w-full h-full`}
                              style={{
                                display: persona.iconUrl ? 'none' : 'flex',
                              }}
                            >
                              {persona.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {selectedPersonaId === persona.id && (
                            <motion.div
                              className="absolute -top-1 -right-1 w-4 h-4 bg-eos-navy rounded-full flex items-center justify-center"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.1 }}
                            >
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </motion.div>
                          )}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-foreground transition-colors truncate">
                            {persona.name}
                          </div>
                          {persona.description && (
                            <div className="text-sm text-muted-foreground group-hover:text-muted-foreground transition-colors truncate">
                              {persona.description}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-eos-navy/20 hover:text-eos-navy rounded-lg"
                              onClick={(e) => handleEditPersona(persona, e)}
                            >
                              <PencilEditIcon size={16} />
                            </Button>
                          </motion.div>
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-500 rounded-lg"
                              onClick={(e) => handleDeletePersona(persona, e)}
                            >
                              <TrashIcon size={16} />
                            </Button>
                          </motion.div>
                        </div>
                      </div>

                      {/* New Chat Overlay */}
                      <AnimatePresence>
                        {shouldShowNewChatOverlay(persona.id) && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-background/95 backdrop-blur-md flex items-center justify-center rounded-lg"
                          >
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.8, opacity: 0 }}
                              transition={{ duration: 0.2, delay: 0.05 }}
                              className="text-center px-4"
                            >
                              <div className="text-sm font-semibold text-eos-navy mb-1">
                                Start New Chat
                              </div>
                              <div className="text-xs text-muted-foreground">
                                with this persona
                              </div>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </DropdownMenuItem>
                  </motion.div>
                ))}
              </AnimatePresence>

              <DropdownMenuSeparator className="my-2 bg-border/50" />

              {/* Create New Persona */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <DropdownMenuItem
                  onClick={() => {
                    onCreatePersona();
                    setIsOpen(false);
                  }}
                  className="cursor-pointer p-3 rounded-lg group hover:bg-gradient-to-r hover:from-eos-orange/10 hover:to-eos-orangeLight/5 border-2 border-dashed border-eos-orange/30 hover:border-eos-orange/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 w-full">
                    <motion.div
                      className="w-10 h-10 rounded-xl border-2 border-eos-orange/30 group-hover:border-eos-orange/50 flex items-center justify-center transition-colors duration-200"
                      whileHover={{ rotate: 90 }}
                      transition={{ duration: 0.2 }}
                    >
                      <PlusIcon size={20} />
                    </motion.div>
                    <div className="flex-1">
                      <div className="font-semibold text-eos-orange group-hover:text-foreground transition-colors">
                        Create New Persona
                      </div>
                      <div className="text-sm text-eos-orange/70 group-hover:text-muted-foreground transition-colors">
                        Add a specialized AI assistant
                      </div>
                    </div>
                  </div>
                </DropdownMenuItem>
              </motion.div>
            </motion.div>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-sm">
          {selectedPersona
            ? `Using ${selectedPersona.name}`
            : 'Select EOS Persona'}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
