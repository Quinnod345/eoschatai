import type { UIMessage } from 'ai';
import type { Session } from 'next-auth';
import type { VisibilityType } from '@/components/visibility-selector';
import type { ResearchMode } from '@/components/nexus-research-selector';

/**
 * Document context for starting a chat with pre-loaded document information
 */
export interface DocumentContext {
  type: 'ai-document' | 'user-document';
  id: string;
  title: string;
  message: string;
}

/**
 * Meeting metadata for L10 or other meeting-related chats
 */
export interface MeetingMetadata {
  meetingId?: string;
  meetingType?: string;
  attendees?: string[];
  [key: string]: unknown;
}

/**
 * Props for the main Chat component
 */
export interface ChatProps {
  id: string;
  initialMessages: Array<UIMessage>;
  initialChatModel: string;
  initialProvider?: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
  initialPersonaId?: string;
  initialProfileId?: string;
  documentContext?: DocumentContext | null;
  initialResearchMode?: ResearchMode;
  pendingMessage?: string | null;
  onPendingMessageSent?: () => void;
  meetingMetadata?: MeetingMetadata;
}

/**
 * Nexus citation structure from research results
 */
export interface NexusCitation {
  number: number;
  title: string;
  url: string;
}

/**
 * Nexus search event from data stream
 */
export interface NexusSearchEvent {
  type: string;
  query?: string;
  results?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  plan?: NexusResearchPlanData;
  followUpQuestions?: string[];
  citations?: NexusCitation[];
  [key: string]: unknown;
}

/**
 * Nexus research plan data
 */
export interface NexusResearchPlanData {
  mainObjective?: string;
  researchQuestions?: string[];
  phases?: Array<{
    name: string;
    description: string;
    queries: string[];
    expectedDuration: number;
  }>;
  estimatedDuration?: number;
  [key: string]: unknown;
}

/**
 * State for tracking Nexus search progress
 */
export interface NexusSearchState {
  searchData: NexusSearchEvent | null;
  researchPlan: NexusResearchPlanData | null;
  followUpQuestions: string[];
  searchEvents: NexusSearchEvent[];
  citations: NexusCitation[];
}

/**
 * Performance metrics for chat operations
 */
export interface ChatPerformanceMetrics {
  messageCount: number;
  lastResponseTime?: number;
  totalTokens?: number;
  averageResponseTime?: number;
}

/**
 * Chat state for managing various UI states
 */
export interface ChatUIState {
  isAnimating: boolean;
  hasAnimated: boolean;
  isResearchModeChanging: boolean;
  showOverview: boolean;
}


