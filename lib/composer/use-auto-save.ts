'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounceCallback } from 'usehooks-ts';
import type { ComposerKind } from '@/components/composer';

export type SaveStatus = 'saved' | 'saving' | 'pending' | 'error';

interface UseAutoSaveOptions {
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number;
  /** Document title for saves */
  title?: string;
  /** Called when save completes successfully */
  onSaveComplete?: () => void;
  /** Called when save fails */
  onSaveError?: (error: Error) => void;
}

interface UseAutoSaveReturn {
  /** Queue content for background save */
  save: (content: string) => void;
  /** Current save status */
  saveStatus: SaveStatus;
  /** Force immediate save (bypasses debounce) */
  flushNow: () => Promise<void>;
  /** Last saved content (for comparison) */
  lastSavedContent: string | null;
  /** Timestamp of last successful save */
  lastSavedAt: Date | null;
}

/**
 * Auto-save hook for composer documents.
 * 
 * Features:
 * - 500ms micro-debounce (batches rapid changes)
 * - Fire-and-forget saves (never blocks UI)
 * - Beacon API fallback for unmount saves
 * - Save status tracking with timestamp
 */
export function useAutoSave(
  documentId: string | undefined,
  kind: ComposerKind,
  options: UseAutoSaveOptions = {},
): UseAutoSaveReturn {
  const {
    debounceMs = 500,
    title = '',
    onSaveComplete,
    onSaveError,
  } = options;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const lastSavedContentRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Store refs for values needed in cleanup to avoid effect dependency issues
  const documentIdRef = useRef(documentId);
  const titleRef = useRef(title);
  const kindRef = useRef(kind);
  
  // Keep refs in sync
  useEffect(() => {
    documentIdRef.current = documentId;
    titleRef.current = title;
    kindRef.current = kind;
  }, [documentId, title, kind]);

  // Actual save function (fire-and-forget)
  const performSave = useCallback(async (content: string) => {
    const currentDocId = documentIdRef.current;
    if (!currentDocId) return;
    
    // Skip if content hasn't changed
    if (content === lastSavedContentRef.current) {
      setSaveStatus('saved');
      pendingContentRef.current = null;
      return;
    }

    // Cancel previous in-flight save
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setSaveStatus('saving');

    try {
      const response = await fetch(`/api/document?id=${currentDocId}&skipVersion=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          title: titleRef.current,
          kind: kindRef.current,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }

      // Always update state on success (removed mounted check - it was causing issues)
      lastSavedContentRef.current = content;
      pendingContentRef.current = null;
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      onSaveComplete?.();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Aborted - another save is in progress, don't change status
        // The new save will set its own status
        return;
      }
      
      console.error('[useAutoSave] Save failed:', error);
      setSaveStatus('error');
      onSaveError?.(error instanceof Error ? error : new Error('Save failed'));
    }
  }, [onSaveComplete, onSaveError]);

  // Debounced save
  const debouncedSave = useDebounceCallback(performSave, debounceMs);
  
  // Store debouncedSave in ref for cleanup
  const debouncedSaveRef = useRef(debouncedSave);
  useEffect(() => {
    debouncedSaveRef.current = debouncedSave;
  }, [debouncedSave]);

  // Queue content for save
  const save = useCallback((content: string) => {
    pendingContentRef.current = content;
    setSaveStatus('pending');
    debouncedSaveRef.current(content);
  }, []);

  // Force immediate save
  const flushNow = useCallback(async () => {
    const content = pendingContentRef.current;
    if (content && content !== lastSavedContentRef.current) {
      debouncedSaveRef.current.cancel();
      await performSave(content);
    }
  }, [performSave]);

  // Cleanup on unmount - use Beacon API for reliable save
  useEffect(() => {
    return () => {
      debouncedSaveRef.current.cancel();
      
      // Use Beacon API for reliable unmount save
      const pendingContent = pendingContentRef.current;
      const docId = documentIdRef.current;
      if (pendingContent && pendingContent !== lastSavedContentRef.current && docId) {
        try {
          const payload = JSON.stringify({
            id: docId,
            content: pendingContent,
            title: titleRef.current,
            kind: kindRef.current,
          });
          
          // Beacon API is fire-and-forget, guaranteed delivery
          const beaconSent = navigator.sendBeacon('/api/document/beacon', payload);
          
          if (!beaconSent) {
            // Fallback to sync XHR if beacon fails (rare)
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `/api/document?id=${docId}&skipVersion=true`, false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify({ content: pendingContent, title: titleRef.current, kind: kindRef.current }));
          }
        } catch (e) {
          console.error('[useAutoSave] Unmount save failed:', e);
        }
      }
    };
  }, []); // Empty deps - only run on actual unmount

  return {
    save,
    saveStatus,
    flushNow,
    lastSavedContent: lastSavedContentRef.current,
    lastSavedAt,
  };
}

/**
 * Simple hook variant for components that just need save status display.
 */
export function useSaveStatusDisplay(status: SaveStatus): string {
  switch (status) {
    case 'saving':
      return 'Saving...';
    case 'saved':
      return 'All changes saved';
    case 'pending':
      return 'Unsaved changes';
    case 'error':
      return 'Save failed';
    default:
      return '';
  }
}
