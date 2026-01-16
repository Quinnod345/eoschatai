'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from './use-debounce';
import { toast } from '@/lib/toast-system';

export interface DocumentHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  currentVersionId: string | null;
  isLoading: boolean;
  isSaving: boolean;
}

export interface UseDocumentHistoryOptions {
  documentId: string;
  userId: string;
  /**
   * Enable auto-save when content changes via updateContent().
   * Set to false when using with main composer save flow to avoid conflicts.
   * @default true
   */
  autoSave?: boolean;
  autoSaveDelay?: number;
  onHistoryChange?: (state: DocumentHistoryState) => void;
  /**
   * Suppress toast notifications for undo/redo operations.
   * Useful when integrating with custom UI feedback.
   */
  suppressToasts?: boolean;
}

export function useDocumentHistory({
  documentId,
  userId,
  autoSave = true,
  autoSaveDelay = 2000,
  onHistoryChange,
  suppressToasts = false,
}: UseDocumentHistoryOptions) {
  const [state, setState] = useState<DocumentHistoryState>({
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,
    currentVersionId: null,
    isLoading: false,
    isSaving: false,
  });

  const [pendingContent, setPendingContent] = useState<{
    title: string;
    content: string;
    kind: string;
  } | null>(null);

  const editSessionRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced content for auto-save
  const debouncedContent = useDebounce(pendingContent, autoSaveDelay);

  // Fetch undo/redo state
  const fetchUndoRedoState = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/composer-documents/${documentId}/history/state?userId=${userId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setState((prev) => ({
          ...prev,
          ...data,
        }));
        onHistoryChange?.(data);
      }
    } catch (error) {
      console.error('Failed to fetch undo/redo state:', error);
    }
  }, [documentId, userId, onHistoryChange]);

  // Save document version
  const saveVersion = useCallback(
    async (title: string, content: string, kind: string) => {
      setState((prev) => ({ ...prev, isSaving: true }));

      try {
        const response = await fetch(
          `/api/composer-documents/${documentId}/history`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              title,
              content,
              kind,
              sessionId: editSessionRef.current,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          editSessionRef.current = data.sessionId;
          await fetchUndoRedoState();
        } else {
          throw new Error('Failed to save version');
        }
      } catch (error) {
        console.error('Failed to save document version:', error);
        if (!suppressToasts) {
          toast.error('Failed to save document version');
        }
      } finally {
        setState((prev) => ({ ...prev, isSaving: false }));
      }
    },
    [documentId, userId, fetchUndoRedoState, suppressToasts],
  );

  // Handle content changes
  const updateContent = useCallback(
    (title: string, content: string, kind: string) => {
      setPendingContent({ title, content, kind });
    },
    [],
  );

  // Auto-save when content changes
  useEffect(() => {
    if (autoSave && debouncedContent) {
      saveVersion(
        debouncedContent.title,
        debouncedContent.content,
        debouncedContent.kind,
      );
    }
  }, [debouncedContent, autoSave, saveVersion]);

  // Undo operation
  const undo = useCallback(async () => {
    if (!state.canUndo) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(
        `/api/composer-documents/${documentId}/history/undo`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        },
      );

      if (response.ok) {
        const version = await response.json();
        await fetchUndoRedoState();
        if (!suppressToasts) {
          toast.success('Undone to previous version');
        }
        return version;
      } else {
        throw new Error('Failed to undo');
      }
    } catch (error) {
      console.error('Failed to undo:', error);
      if (!suppressToasts) {
        toast.error('Failed to undo');
      }
      return null;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [documentId, userId, state.canUndo, fetchUndoRedoState, suppressToasts]);

  // Redo operation
  const redo = useCallback(async () => {
    if (!state.canRedo) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(
        `/api/composer-documents/${documentId}/history/redo`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        },
      );

      if (response.ok) {
        const version = await response.json();
        await fetchUndoRedoState();
        if (!suppressToasts) {
          toast.success('Redone to next version');
        }
        return version;
      } else {
        throw new Error('Failed to redo');
      }
    } catch (error) {
      console.error('Failed to redo:', error);
      if (!suppressToasts) {
        toast.error('Failed to redo');
      }
      return null;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [documentId, userId, state.canRedo, fetchUndoRedoState, suppressToasts]);

  // Get document history
  const getHistory = useCallback(
    async (limit = 50, offset = 0) => {
      try {
        const response = await fetch(
          `/api/composer-documents/${documentId}/history?limit=${limit}&offset=${offset}`,
        );
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
        if (!suppressToasts) {
          toast.error('Failed to fetch history');
        }
      }
      return [];
    },
    [documentId, suppressToasts],
  );

  // Get specific version
  const getVersion = useCallback(
    async (versionId: string) => {
      try {
        const response = await fetch(
          `/api/composer-documents/history/version/${versionId}`,
        );
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.error('Failed to fetch version:', error);
        if (!suppressToasts) {
          toast.error('Failed to fetch version');
        }
      }
      return null;
    },
    [suppressToasts],
  );

  /**
   * Refresh undo/redo state from server.
   * Call this after external saves (e.g., from main composer flow).
   */
  const refresh = useCallback(() => {
    return fetchUndoRedoState();
  }, [fetchUndoRedoState]);

  // End edit session on unmount
  useEffect(() => {
    return () => {
      if (editSessionRef.current) {
        fetch(
          `/api/composer-documents/history/session/${editSessionRef.current}`,
          {
            method: 'DELETE',
          },
        ).catch(console.error);
      }
    };
  }, []);

  // Initial load
  useEffect(() => {
    fetchUndoRedoState();
  }, [fetchUndoRedoState]);

  return {
    ...state,
    updateContent,
    saveVersion,
    undo,
    redo,
    getHistory,
    getVersion,
    /**
     * Refresh undo/redo state from server.
     * Call this after external saves (e.g., from main composer flow).
     */
    refresh,
  };
}
