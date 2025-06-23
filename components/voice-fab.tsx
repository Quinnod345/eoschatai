'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Mic, AudioWaveform } from 'lucide-react';
import { motion } from 'framer-motion';
import VoiceModeIntegrated from './voice-mode-integrated';
import VoiceModeEnhanced from './voice-mode-enhanced';
import VoiceModeFixed from './voice-mode-fixed';
import VoiceModeBatchSave from './voice-mode-batch-save';
import { cn } from '@/lib/utils';

interface VoiceFABProps {
  variant?: 'floating' | 'inline' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  selectedModelId?: string;
  selectedProviderId?: string;
  selectedPersonaId?: string;
  selectedProfileId?: string;
  chatId?: string;
  showLabel?: boolean;
  onAppendMessage?: (message: any) => void;
  onUpdateMessages?: (updater: any) => void;
}

export default function VoiceFAB({
  variant = 'floating',
  size = 'md',
  className,
  selectedModelId,
  selectedProviderId,
  selectedPersonaId,
  selectedProfileId,
  chatId,
  showLabel = false,
  onAppendMessage,
  onUpdateMessages,
}: VoiceFABProps) {
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);

  // Feature flag to use enhanced voice mode
  const useEnhancedVoiceMode = false;
  const useFixedVoiceMode = false;
  const useBatchSaveVoiceMode = true;

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-8 w-8';
      case 'lg':
        return 'h-14 w-14';
      default:
        return 'h-10 w-10';
    }
  };

  const getIconSize = () => {
    if (variant === 'inline') {
      return 'size-4'; // Match send button's ArrowUp size
    }
    switch (size) {
      case 'sm':
        return 'h-3 w-3';
      case 'lg':
        return 'h-6 w-6';
      default:
        return 'h-4 w-4';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'floating':
        return cn(
          'fixed bottom-6 right-6 z-40 rounded-full shadow-lg hover:shadow-xl',
          'bg-eos-orange hover:bg-eos-orange/90 text-white',
          'border-2 border-white/20 backdrop-blur-sm',
          getSizeClasses(),
        );
      case 'inline':
        return cn(
          'rounded-full p-1.5 h-fit border dark:border-zinc-600',
          'bg-eos-orange/10 hover:bg-eos-orange/20 text-eos-orange',
          'hover:border-eos-orange/50 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-eos-orange/50',
        );
      case 'minimal':
        return cn('rounded-md hover:bg-muted', getSizeClasses());
      default:
        return getSizeClasses();
    }
  };

  const buttonContent = (
    <>
      {variant === 'inline' ? (
        <AudioWaveform className={cn(getIconSize(), showLabel && 'mr-2')} />
      ) : (
        <Mic className={cn(getIconSize(), showLabel && 'mr-2')} />
      )}
      {showLabel && <span className="text-sm font-medium">Voice</span>}
    </>
  );

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVoiceModeOpen(true);
  };

  return (
    <>
      {variant === 'floating' ? (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 right-6 z-40"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={handleClick}
                className={cn(getVariantClasses(), className)}
                size="icon"
              >
                {buttonContent}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Start Voice Conversation
            </TooltipContent>
          </Tooltip>
        </motion.div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              onClick={handleClick}
              variant={variant === 'minimal' ? 'ghost' : 'outline'}
              size={showLabel ? 'sm' : 'icon'}
              className={cn(getVariantClasses(), className)}
            >
              {buttonContent}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {variant === 'minimal' ? 'Voice Mode' : 'Start Voice Conversation'}
          </TooltipContent>
        </Tooltip>
      )}

      {useBatchSaveVoiceMode ? (
        <VoiceModeBatchSave
          isOpen={isVoiceModeOpen}
          onClose={() => setIsVoiceModeOpen(false)}
          selectedModelId={selectedModelId}
          selectedProviderId={selectedProviderId}
          selectedPersonaId={selectedPersonaId}
          selectedProfileId={selectedProfileId}
          chatId={chatId}
          onMessagesUpdate={onUpdateMessages}
        />
      ) : useFixedVoiceMode ? (
        <VoiceModeFixed
          isOpen={isVoiceModeOpen}
          onClose={() => setIsVoiceModeOpen(false)}
          selectedModelId={selectedModelId}
          selectedProviderId={selectedProviderId}
          selectedPersonaId={selectedPersonaId}
          selectedProfileId={selectedProfileId}
          chatId={chatId}
          onMessagesUpdate={onUpdateMessages}
          navigateToChat={!chatId} // Only navigate if not already in a chat
        />
      ) : useEnhancedVoiceMode ? (
        <VoiceModeEnhanced
          isOpen={isVoiceModeOpen}
          onClose={() => setIsVoiceModeOpen(false)}
          selectedModelId={selectedModelId}
          selectedProviderId={selectedProviderId}
          selectedPersonaId={selectedPersonaId}
          selectedProfileId={selectedProfileId}
          chatId={chatId}
          onMessagesUpdate={onUpdateMessages}
        />
      ) : (
        <VoiceModeIntegrated
          isOpen={isVoiceModeOpen}
          onClose={() => setIsVoiceModeOpen(false)}
          selectedModelId={selectedModelId}
          selectedProviderId={selectedProviderId}
          selectedPersonaId={selectedPersonaId}
          selectedProfileId={selectedProfileId}
          chatId={chatId}
          onMessagesUpdate={onUpdateMessages}
        />
      )}
    </>
  );
}
