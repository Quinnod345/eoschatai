import type React from 'react';
import type { UIMessage } from 'ai';
import type { UseChatHelpers } from '@ai-sdk/react';

// AI SDK 5: Attachment type is no longer exported from 'ai'
// Define locally for backward compatibility
export type Attachment = {
  name?: string;
  contentType?: string;
  url: string;
};

// AI SDK 5: UseChatHelpers requires a type parameter
export type ChatHelpers = UseChatHelpers<UIMessage>;

// AI SDK 5: Define explicit types for component props
// These methods were renamed or removed in SDK 5, but we use adapters in chat.tsx
export type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error';
export type AppendFunction = (message: { role: string; content?: string; parts?: any[] }, options?: { experimental_attachments?: Attachment[] }) => void;
export type HandleSubmitFunction = (event?: { preventDefault?: () => void }, options?: any) => void;
export type ReloadFunction = (options?: { messageId?: string }) => void;
export type SetInputFunction = (value: string) => void;
import type { VisibilityType } from '@/components/visibility-selector';
import type { ResearchMode } from '@/components/nexus-research-selector';
import type { Persona, PersonaProfile } from '@/lib/db/schema';
import type { Session } from 'next-auth';

// Interface for @ mention resources
export interface MentionResource {
  id: string;
  name: string;
  type:
    | 'calendar'
    | 'document'
    | 'recording'
    | 'scorecard'
    | 'vto'
    | 'accountability'
    | 'rocks'
    | 'people'
    | 'event'
    | 'meeting'
    | 'availability'
    | 'team'
    | 'search'
    | 'analyze'
    | 'help'
    | 'agenda';
  category?:
    | 'resource'
    | 'calendar'
    | 'person'
    | 'tool'
    | 'command'
    | 'template';
  description: string;
  icon: React.ReactNode;
  color?: string;
  aliases?: string[];
  shortcut?: string;
  preview?: string;
  isDynamic?: boolean;
}

// Props for the main MultimodalInput component
export interface MultimodalInputProps {
  chatId: string;
  input: string;
  setInput: SetInputFunction;
  status: ChatStatus;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: React.Dispatch<React.SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: React.Dispatch<React.SetStateAction<Array<UIMessage>>>;
  append: AppendFunction;
  handleSubmit: HandleSubmitFunction;
  className?: string;
  selectedVisibilityType: VisibilityType;
  setSelectedVisibilityType: React.Dispatch<
    React.SetStateAction<VisibilityType>
  >;
  isReadonly: boolean;
  selectedModelId: string;
  setSelectedModelId: React.Dispatch<React.SetStateAction<string>>;
  selectedProviderId: string;
  setSelectedProviderId: React.Dispatch<React.SetStateAction<string>>;
  selectedPersonaId?: string;
  setSelectedPersonaId?: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  selectedProfileId?: string;
  setSelectedProfileId?: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  selectedResearchMode?: ResearchMode;
  setSelectedResearchMode?: React.Dispatch<React.SetStateAction<ResearchMode>>;
  replyingToMessage?: UIMessage | null;
  setReplyingToMessage?: React.Dispatch<React.SetStateAction<UIMessage | null>>;
  session: Session;
  personas?: Persona[];
  profiles?: PersonaProfile[];
}

// Props for send button
export interface SendButtonProps {
  submitForm: () => void;
  input: string;
  uploadQueue: string[];
  status: ChatStatus;
}

// Props for stop button
export interface StopButtonProps {
  stop: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Array<UIMessage>>>;
  chatId: string;
}

// Props for attachments button
export interface AttachmentsButtonProps {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: ChatStatus;
}

// Props for usage chip
export interface UsageChipProps {
  label: string;
  used: number;
  limit: number | null;
  title?: string;
}

// Type for autocomplete suggestion
export interface AutocompleteSuggestion {
  text: string;
  score: number;
  category?: string;
}

// Type for pending files
export interface PendingFile {
  file: File;
  previewUrl?: string;
}
