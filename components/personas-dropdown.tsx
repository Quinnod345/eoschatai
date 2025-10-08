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
import { PlusIcon, PencilEditIcon, UserIcon } from '@/components/icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { Persona } from '@/lib/db/schema';
import { useAccountStore } from '@/lib/stores/account-store';
import { PersonasModal } from '@/components/personas-modal';
import { Sparkles, Users } from 'lucide-react';

interface PersonasDropdownProps {
  selectedPersonaId?: string;
  onPersonaSelect: (personaId: string | null) => void;
  onCreatePersona: () => void;
  onEditPersona: (persona: Persona) => void;
}

export function PersonasDropdown({
  selectedPersonaId,
  onPersonaSelect,
  onCreatePersona,
  onEditPersona,
}: PersonasDropdownProps) {
  const [systemPersonas, setSystemPersonas] = useState<Persona[]>([]);
  const [userPersonas, setUserPersonas] = useState<Persona[]>([]);
  const [sharedPersonas, setSharedPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredPersonaId, setHoveredPersonaId] = useState<string | null>(null);
  const [showPersonasModal, setShowPersonasModal] = useState(false);

  // Check if user has access to personas (any premium feature except deep_research means they have Pro)
  const entitlements = useAccountStore((state) => state.entitlements);
  const hasPersonasAccess =
    entitlements?.features?.export ||
    entitlements?.features?.calendar_connect ||
    entitlements?.features?.recordings?.enabled ||
    false;

  const allPersonas = [...systemPersonas, ...userPersonas];
  const selectedPersona = allPersonas.find((p) => p.id === selectedPersonaId);

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
  }, []);

  const fetchPersonas = async () => {
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
    console.log('PERSONA_DROPDOWN: handlePersonaSelect called', {
      selectedPersonaId: personaId,
      currentSelectedPersonaId: selectedPersonaId,
      timestamp: new Date().toISOString(),
    });

    console.log('PERSONA_DROPDOWN: Calling onPersonaSelect callback');
    onPersonaSelect(personaId);
    setIsOpen(false);
  };

  const handleEditPersona = (persona: Persona, event: React.MouseEvent) => {
    event.stopPropagation();
    onEditPersona(persona);
    setIsOpen(false);
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
              onClick={() => setShowPersonasModal(true)}
            >
              <Sparkles className="size-4 mr-2 text-eos-orange" />
              <span className="hidden md:inline font-medium">AI Personas</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="bg-background/95 backdrop-blur-sm border border-border/50"
          >
            <div className="text-sm">Unlock specialized AI assistants</div>
          </TooltipContent>
        </Tooltip>
        <PersonasModal
          open={showPersonasModal}
          onClose={() => setShowPersonasModal(false)}
        />
      </>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`
                relative overflow-hidden group
                h-9 px-3 md:h-10 md:px-4
                border-2 
                backdrop-filter backdrop-blur-[16px]
                bg-white/70 dark:bg-zinc-900/70
                border-white/30 dark:border-zinc-700/30
                hover:bg-white/80 dark:hover:bg-zinc-900/80
                hover:border-eos-orange/30 dark:hover:border-eos-orange/30
                transition-all duration-300 ease-out
                shadow-sm hover:shadow-md
                ${isOpen ? 'border-eos-orange/30 bg-eos-orange/10 dark:bg-eos-orange/10' : ''}
                ${selectedPersona ? 'ring-2 ring-eos-orange/20' : ''}
              `}
              disabled={isLoading}
              style={{
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow:
                  'inset 0px 0px 6px rgba(0, 0, 0, 0.05), 0 8px 30px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.12)',
              }}
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
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            className="w-80 p-2 border-2 border-border/50 shadow-xl backdrop-blur-xl bg-background/90 z-[150] relative max-h-[500px] overflow-y-auto"
            sideOffset={8}
            avoidCollisions={true}
            collisionPadding={{ top: 8, right: 8, bottom: 80, left: 8 }}
          >
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
                  cursor-pointer p-3 rounded-lg mb-2 group
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
                        cursor-pointer p-3 rounded-lg mb-2 group relative
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
                        <motion.div
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {/* Only show edit button for non-system personas */}
                          {!persona.isSystemPersona && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-eos-navy/20 hover:text-eos-navy rounded-lg"
                              onClick={(e) => handleEditPersona(persona, e)}
                            >
                              <PencilEditIcon size={16} />
                            </Button>
                          )}
                        </motion.div>
                      </div>
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
                            cursor-pointer p-3 rounded-lg mb-2 group relative
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
                        cursor-pointer p-3 rounded-lg mb-2 group relative
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
      <TooltipContent
        side="bottom"
        className="bg-background/95 backdrop-blur-sm border border-border/50"
      >
        <div className="text-sm">
          {selectedPersona
            ? `Using ${selectedPersona.name}`
            : 'Select EOS Persona'}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
