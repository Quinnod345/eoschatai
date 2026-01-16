/**
 * Composer State Machine
 *
 * Provides explicit state management for the composer lifecycle to prevent
 * race conditions between streaming, saving, and remote content fetching.
 */

/**
 * Composer lifecycle states:
 * - 'idle': No active operation, ready for user edits or remote fetch
 * - 'streaming': AI is generating content, block remote fetches and saves
 * - 'saving': Content is being saved to server, prevent concurrent saves
 * - 'loading': Initial document load from server
 */
export type ComposerLifecycleState =
  | 'idle'
  | 'streaming'
  | 'saving'
  | 'loading';

/**
 * Version index state that replaces magic numbers.
 * - null: Use latest version (replaces 9999 magic number)
 * - number: Specific version index
 */
export type VersionIndexState = number | null;

/**
 * Check if the version index represents "latest"
 */
export function isLatestVersion(
  versionIndex: VersionIndexState,
  documentsLength: number,
): boolean {
  if (versionIndex === null) return true;
  if (documentsLength === 0) return true;
  return versionIndex >= documentsLength - 1;
}

/**
 * Get the actual index to use for array access
 */
export function resolveVersionIndex(
  versionIndex: VersionIndexState,
  documentsLength: number,
): number {
  if (versionIndex === null || documentsLength === 0) {
    return Math.max(0, documentsLength - 1);
  }
  // Clamp to valid range
  return Math.max(0, Math.min(versionIndex, documentsLength - 1));
}

/**
 * State transition rules for the composer lifecycle
 */
export function canTransition(
  from: ComposerLifecycleState,
  to: ComposerLifecycleState,
): boolean {
  // Valid transitions:
  // idle -> streaming, saving, loading
  // streaming -> idle (when streaming completes)
  // saving -> idle (when save completes)
  // loading -> idle, streaming (if streaming starts during load)

  const validTransitions: Record<
    ComposerLifecycleState,
    ComposerLifecycleState[]
  > = {
    idle: ['streaming', 'saving', 'loading'],
    streaming: ['idle', 'saving'], // Allow save after streaming completes
    saving: ['idle', 'streaming'], // Allow streaming to interrupt if needed
    loading: ['idle', 'streaming'], // Streaming takes priority over loading
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Check if remote content fetch should be blocked
 */
export function shouldBlockRemoteFetch(state: ComposerLifecycleState): boolean {
  return state === 'streaming' || state === 'saving';
}

/**
 * Check if save operation should be blocked
 */
export function shouldBlockSave(state: ComposerLifecycleState): boolean {
  return state === 'streaming' || state === 'saving';
}

/**
 * Check if content updates from streaming should be applied
 */
export function shouldApplyStreamingContent(
  state: ComposerLifecycleState,
): boolean {
  return state === 'streaming' || state === 'idle';
}

/**
 * Ref state tracker for use in useCallback closures
 * This helps avoid stale closure issues
 */
export interface ComposerStateRefs {
  lifecycleState: ComposerLifecycleState;
  lastSavedContent: string | null;
  lastRemoteAppliedAt: number;
  documentId: string | null;
  isMounted: boolean;
}

/**
 * Create initial state refs
 */
export function createInitialStateRefs(): ComposerStateRefs {
  return {
    lifecycleState: 'idle',
    lastSavedContent: null,
    lastRemoteAppliedAt: 0,
    documentId: null,
    isMounted: true,
  };
}

/**
 * Reset refs when document changes
 */
export function resetStateRefsForNewDocument(
  refs: ComposerStateRefs,
  newDocumentId: string,
): void {
  refs.lastSavedContent = null;
  refs.lastRemoteAppliedAt = 0;
  refs.documentId = newDocumentId;
  // Don't reset lifecycleState or isMounted
}
