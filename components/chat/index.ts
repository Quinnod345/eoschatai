/**
 * Chat Component - Modular Exports
 *
 * This directory contains the chat component split into logical modules:
 * - types.ts - TypeScript interfaces and types
 * - use-nexus-search.ts - Hook for managing Nexus search state
 *
 * The main Chat component is still in ../chat.tsx for backward compatibility.
 */

// Types
export type {
  DocumentContext,
  MeetingMetadata,
  ChatProps,
  NexusCitation,
  NexusSearchEvent,
  NexusResearchPlanData,
  NexusSearchState,
  ChatPerformanceMetrics,
  ChatUIState,
} from './types';

// Hooks
export { useNexusSearch } from './use-nexus-search';

// Re-export the main component for backward compatibility
export { Chat } from '../chat';


