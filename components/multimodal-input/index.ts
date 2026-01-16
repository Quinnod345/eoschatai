/**
 * Multimodal Input Component - Modular Exports
 *
 * This directory contains the multimodal input component split into logical modules:
 * - types.ts - TypeScript interfaces and types
 * - constants.tsx - Constants and mention resources
 * - utils.ts - Utility functions
 * - attachments-button.tsx - File attachments button
 * - send-button.tsx - Message send button
 * - stop-button.tsx - Generation stop button
 * - usage-chip.tsx - Usage indicator chip
 *
 * The main MultimodalInput component is still in ../multimodal-input.tsx
 * for backward compatibility.
 */

// Types
export type {
  MentionResource,
  MultimodalInputProps,
  SendButtonProps,
  StopButtonProps,
  AttachmentsButtonProps,
  UsageChipProps,
  AutocompleteSuggestion,
  PendingFile,
} from './types';

// Constants
export {
  DEFAULT_MENTION_RESOURCES,
  pulseDragDropStyle,
  generateUUID as generateConstantsUUID,
} from './constants';

// Utilities
export {
  escapeHtml,
  highlightPrefix,
  generateUUID,
} from './utils';

// Components
export { AttachmentsButton } from './attachments-button';
export { SendButton } from './send-button';
export { StopButton } from './stop-button';
export { UsageChip } from './usage-chip';

// Re-export the main component from the parent file for backward compatibility
export { MultimodalInput } from '../multimodal-input';


