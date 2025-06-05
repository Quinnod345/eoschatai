import { useChat } from 'ai/react';
import { useCallback, useMemo } from 'react';
import { useArtifact } from './use-artifact';
import {
  buildEnhancedPrompt,
  detectEditIntent,
  shouldEditArtifact,
  type ArtifactContext,
} from '@/lib/ai/artifact-context';
import type { UseChatHelpers } from '@ai-sdk/react';

interface UseEnhancedChatProps {
  api?: string;
  id?: string;
  initialMessages?: any[];
  onFinish?: (message: any) => void;
  onError?: (error: Error) => void;
}

export function useEnhancedChat({
  api = '/api/enhanced-chat',
  id,
  initialMessages,
  onFinish,
  onError,
}: UseEnhancedChatProps = {}) {
  const { artifact } = useArtifact();

  // Get the original chat functionality
  const originalChat = useChat({
    api,
    id,
    initialMessages,
    onFinish,
    onError,
  });

  // Build artifact context
  const artifactContext: ArtifactContext = useMemo(() => {
    const hasActiveArtifact =
      artifact.isVisible && artifact.documentId !== 'init';

    return {
      hasActiveArtifact,
      artifact: hasActiveArtifact ? artifact : undefined,
    };
  }, [artifact]);

  // Enhanced append function that includes artifact context
  const enhancedAppend = useCallback(
    (message: any, options?: any) => {
      // Detect if this message should edit the current artifact
      const editIntent = detectEditIntent(message.content, artifact);

      // Build enhanced context
      const enhancedContext: ArtifactContext = {
        ...artifactContext,
        editIntent,
        lastUserAction: editIntent ? 'edit' : 'create',
      };

      // Enhance the message with artifact context
      const enhancedMessage = {
        ...message,
        content: buildEnhancedPrompt(message.content, enhancedContext),
      };

      // Add metadata about artifact editing intent
      const enhancedOptions = {
        ...options,
        data: {
          ...options?.data,
          artifactContext: enhancedContext,
          shouldEditArtifact: shouldEditArtifact(message.content, artifact),
        },
      };

      return originalChat.append(enhancedMessage, enhancedOptions);
    },
    [originalChat.append, artifactContext, artifact],
  );

  // Enhanced submit function
  const enhancedSubmit = useCallback(
    (event?: any, options?: any) => {
      // Get the current input value
      const inputValue = originalChat.input;

      if (inputValue) {
        // Detect edit intent for the current input
        const editIntent = detectEditIntent(inputValue, artifact);

        // Build enhanced context
        const enhancedContext: ArtifactContext = {
          ...artifactContext,
          editIntent,
          lastUserAction: editIntent ? 'edit' : 'create',
        };

        // Enhance the input with artifact context
        const enhancedInput = buildEnhancedPrompt(inputValue, enhancedContext);

        // Temporarily update the input with enhanced content
        originalChat.setInput(enhancedInput);

        // Submit with enhanced options
        const enhancedOptions = {
          ...options,
          data: {
            ...options?.data,
            artifactContext: enhancedContext,
            shouldEditArtifact: shouldEditArtifact(inputValue, artifact),
          },
        };

        const result = originalChat.handleSubmit(event, enhancedOptions);

        // Reset input to original value after submission
        setTimeout(() => {
          originalChat.setInput('');
        }, 0);

        return result;
      }

      return originalChat.handleSubmit(event, options);
    },
    [
      originalChat.handleSubmit,
      originalChat.input,
      originalChat.setInput,
      artifactContext,
      artifact,
    ],
  );

  // Enhanced reload function
  const enhancedReload = useCallback(
    (options?: any) => {
      const enhancedOptions = {
        ...options,
        data: {
          ...options?.data,
          artifactContext,
        },
      };

      return originalChat.reload(enhancedOptions);
    },
    [originalChat.reload, artifactContext],
  );

  // Return enhanced chat interface
  return {
    ...originalChat,
    append: enhancedAppend,
    handleSubmit: enhancedSubmit,
    reload: enhancedReload,
    // Additional artifact-aware properties
    artifactContext,
    shouldEditArtifact: (message: string) =>
      shouldEditArtifact(message, artifact),
    detectEditIntent: (message: string) => detectEditIntent(message, artifact),
  } as UseChatHelpers & {
    artifactContext: ArtifactContext;
    shouldEditArtifact: (message: string) => boolean;
    detectEditIntent: (message: string) => ArtifactContext['editIntent'];
  };
}
