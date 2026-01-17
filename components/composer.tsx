import type { UIMessage } from 'ai';
import type { Attachment } from './multimodal-input/types';
import { formatDistance } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
  startTransition,
  useRef,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useDebounceCallback, useWindowSize } from 'usehooks-ts';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Document, Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Toolbar } from './toolbar';
import { VersionFooter } from './version-footer';
import { ComposerHeaderActions } from './composer-header-actions';
import { ComposerCloseButton } from './composer-close-button';
import { ComposerMessages } from './composer-messages';
import { useSidebar } from './ui/sidebar';
import { useComposer } from '@/hooks/use-composer';
import { imageComposer } from '@/composer/image/client';
import { codeComposer } from '@/composer/code/client';
import { sheetComposer } from '@/composer/sheet/client';
import { textComposer } from '@/composer/text/client';
import { chartComposer } from '@/composer/chart/client';
import { vtoComposer } from '@/composer/vto/client';
import { accountabilityComposer } from '@/composer/accountability/client';
import equal from 'fast-deep-equal';
import type { ChatHelpers, ChatStatus, SetInputFunction, AppendFunction, HandleSubmitFunction, ReloadFunction } from './multimodal-input/types';
import type { VisibilityType } from './visibility-selector';
import {
  type ComposerLifecycleState,
  type VersionIndexState,
  isLatestVersion,
  resolveVersionIndex,
  shouldBlockRemoteFetch,
  shouldBlockSave,
  type ComposerStateRefs,
  createInitialStateRefs,
  resetStateRefsForNewDocument,
} from '@/lib/composer/state-machine';
import { isValidVtoContent } from '@/lib/composer/content-parsers';
import { ComposerErrorBoundary } from './composer-error-boundary';

export const composerDefinitions = [
  textComposer,
  codeComposer,
  imageComposer,
  sheetComposer,
  chartComposer,
  vtoComposer,
  accountabilityComposer,
];
export type ComposerKind = (typeof composerDefinitions)[number]['kind'];

export interface UIComposer {
  title: string;
  documentId: string;
  kind: ComposerKind;
  content: string;
  isVisible: boolean;
  status: 'streaming' | 'idle';
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

function PureComposer({
  chatId,
  input,
  setInput,
  handleSubmit,
  status,
  stop,
  attachments,
  setAttachments,
  append,
  messages,
  setMessages,
  reload,
  votes,
  isReadonly,
  selectedVisibilityType,
}: {
  chatId: string;
  input: string;
  setInput: SetInputFunction;
  status: ChatStatus;
  stop: ChatHelpers['stop'];
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: ChatHelpers['setMessages'];
  votes: Array<Vote> | undefined;
  append: AppendFunction;
  handleSubmit: HandleSubmitFunction;
  reload: ReloadFunction;
  isReadonly: boolean;
  selectedVisibilityType: VisibilityType;
}) {
  const { composer, setComposer, metadata, setMetadata } = useComposer();

  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Array<Document>>(
    composer.documentId !== 'init' && composer.status !== 'streaming'
      ? `/api/document?id=${composer.documentId}&versions=true`
      : null,
    fetcher,
  );

  const [mode, setMode] = useState<'edit' | 'diff'>('edit');
  const [document, setDocument] = useState<Document | null>(null);
  // Version index: null means "use latest", number means specific version
  const [currentVersionIndex, setCurrentVersionIndex] =
    useState<VersionIndexState>(null);
  // Explicit lifecycle state for managing async operations
  const [lifecycleState, setLifecycleState] =
    useState<ComposerLifecycleState>('idle');
  // Consolidated state refs for use in closures (avoids stale closure issues)
  const stateRefsRef = useRef<ComposerStateRefs>(createInitialStateRefs());
  // Track previous documents array to detect when new versions are added
  const documentsRef = useRef<Array<Document> | undefined>(undefined);
  // Abort controller for fetch requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const { open: isSidebarOpen } = useSidebar();
  // Inline title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  // Sync lifecycle state with composer.status
  useEffect(() => {
    const newLifecycleState: ComposerLifecycleState =
      composer.status === 'streaming' ? 'streaming' : 'idle';
    setLifecycleState((prev) => {
      // Don't override 'saving' state unless streaming starts
      if (prev === 'saving' && newLifecycleState !== 'streaming') {
        return prev;
      }
      return newLifecycleState;
    });
    // Keep ref in sync for closures
    stateRefsRef.current.lifecycleState = newLifecycleState;
  }, [composer.status]);

  useEffect(() => {
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);
      const stateRefs = stateRefsRef.current;

      if (mostRecentDocument && stateRefs.isMounted) {
        const remoteCreatedAt = new Date(
          mostRecentDocument.createdAt,
        ).getTime();
        setDocument(mostRecentDocument);

        // Update version index if user is following latest or on initial load
        const wasOnLatest = isLatestVersion(
          currentVersionIndex,
          documentsRef.current?.length ?? 0,
        );
        const didArrayGrow =
          (documentsRef.current?.length || 0) < documents.length;

        // Keep following latest when new versions are created
        if (currentVersionIndex === null || (wasOnLatest && didArrayGrow)) {
          console.log('[Composer] Following latest version:', {
            wasOnLatest,
            didArrayGrow,
            newLength: documents.length,
          });
          // Keep null to indicate "latest" rather than setting specific index
          setCurrentVersionIndex(null);
        }

        // Update the ref for next comparison
        documentsRef.current = documents;

        // Block remote fetch if in streaming or saving state
        if (shouldBlockRemoteFetch(stateRefs.lifecycleState)) {
          console.log(
            '[Composer] Blocking remote fetch during:',
            stateRefs.lifecycleState,
          );
          return;
        }

        setComposer((currentComposer) => {
          if (!stateRefs.isMounted) return currentComposer;

          const remoteContent = mostRecentDocument.content ?? '';
          const localContent = currentComposer.content ?? '';

          // Check if initial load (empty local content)
          const isInitialLoad =
            !localContent || localContent.trim().length === 0;

          // Check if we just saved this exact content
          const isSameAsLastSaved =
            stateRefs.lastSavedContent !== null &&
            stateRefs.lastSavedContent === remoteContent;

          // Determine if we should override local content with remote
          const shouldOverrideContent =
            remoteContent !== undefined &&
            (isInitialLoad || // Always load on initial open
              (remoteContent !== localContent &&
                !isSameAsLastSaved &&
                remoteCreatedAt > (stateRefs.lastRemoteAppliedAt || 0))) &&
            // For VTO, only override if the fetched content is valid VTO
            (currentComposer.kind !== 'vto' ||
              !remoteContent ||
              isValidVtoContent(remoteContent));

          if (shouldOverrideContent) {
            console.log('[Composer] Loading remote content:', {
              documentId: mostRecentDocument.id,
              contentLength: remoteContent.length,
              isInitialLoad,
              documentsLength: documents.length,
            });
            // Record last applied remote version timestamp
            stateRefs.lastRemoteAppliedAt = remoteCreatedAt;
            return { ...currentComposer, content: remoteContent };
          }

          return currentComposer;
        });
      }
    }
  }, [documents, setComposer, currentVersionIndex, lifecycleState]);

  useEffect(() => {
    mutateDocuments();
  }, [composer.status, mutateDocuments]);

  const { mutate } = useSWRConfig();
  const [isContentDirty, setIsContentDirty] = useState(false);

  const handleContentChange = useCallback(
    async (updatedContent: string) => {
      const stateRefs = stateRefsRef.current;
      if (!composer || !composer.documentId) return;

      // Use state machine to check if save should be blocked
      if (shouldBlockSave(stateRefs.lifecycleState)) {
        console.log(
          '[Composer] Skipping save - blocked by state:',
          stateRefs.lifecycleState,
        );
        return;
      }

      // Never persist invalid/empty VTO content
      if (
        composer.kind === 'vto' &&
        (!isValidVtoContent(updatedContent) ||
          updatedContent.trim().length === 0)
      ) {
        return;
      }

      // Don't save empty content for text documents (likely a race condition)
      if (
        composer.kind === 'text' &&
        (!updatedContent || updatedContent.trim().length === 0)
      ) {
        console.log('[Composer] Skipping save of empty text content');
        return;
      }

      // Mark as last locally saved to avoid immediate remote clobber
      stateRefs.lastSavedContent = updatedContent;

      // Cancel previous save if in flight
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // Transition to saving state
      setLifecycleState('saving');
      stateRefs.lifecycleState = 'saving';

      // POST the latest content to persist
      try {
        await fetch(`/api/document?id=${composer.documentId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: composer.title,
            content: updatedContent,
            kind: composer.kind,
          }),
          signal: abortControllerRef.current.signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[Composer] Save aborted');
          return;
        }
        console.error('Failed to save document content', err);
      } finally {
        if (stateRefs.isMounted) {
          setIsContentDirty(false);
          // Return to idle state after save completes
          setLifecycleState('idle');
          stateRefs.lifecycleState = 'idle';
        }
      }

      // If we already have documents cached, append a new version locally
      // Schedule mutate outside of the current render cycle to avoid React warnings
      setTimeout(() => {
        startTransition(() => {
          mutate<Array<Document>>(
            `/api/document?id=${composer.documentId}`,
            (currentDocuments) => {
              if (!currentDocuments || currentDocuments.length === 0)
                return currentDocuments;
              const currentDocument = currentDocuments.at(-1);
              if (!currentDocument) return currentDocuments;
              if (currentDocument.content === updatedContent)
                return currentDocuments;
              const newDocument = {
                ...currentDocument,
                content: updatedContent,
                createdAt: new Date(),
              } as Document;
              return [...currentDocuments, newDocument];
            },
            { revalidate: false },
          );
        });
      }, 0);
    },
    [composer, mutate],
  );

  const debouncedHandleContentChange = useDebounceCallback(
    handleContentChange,
    2000,
  );

  // Cleanup on unmount
  useEffect(() => {
    const stateRefs = stateRefsRef.current;
    stateRefs.isMounted = true;

    return () => {
      console.log('[Composer] Unmounting, cleaning up...');
      stateRefs.isMounted = false;
      debouncedHandleContentChange.cancel();

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [debouncedHandleContentChange]);

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      if (updatedContent !== (document?.content ?? '')) {
        setIsContentDirty(true);
        if (debounce) {
          debouncedHandleContentChange(updatedContent);
        } else {
          void handleContentChange(updatedContent);
        }
      }
    },
    [document?.content, debouncedHandleContentChange, handleContentChange],
  );

  function getDocumentContentById(index: number | null) {
    if (!documents || documents.length === 0) return '';
    // Use resolveVersionIndex to get actual array index
    const actualIndex = resolveVersionIndex(index, documents.length);
    return documents[actualIndex]?.content ?? '';
  }

  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (!documents || documents.length === 0) return;
    const stateRefs = stateRefsRef.current;

    if (type === 'latest') {
      // Set to null to indicate "follow latest"
      setCurrentVersionIndex(null);
      setMode('edit');

      // Force load the latest content when clicking "latest"
      const latestDoc = documents[documents.length - 1];
      if (latestDoc?.content) {
        console.log('[Composer] Forcing load of latest version content:', {
          contentLength: latestDoc.content.length,
          documentId: latestDoc.id,
        });
        setComposer((current) => ({
          ...current,
          content: latestDoc.content ?? '',
        }));
        // Clear the saved content ref so it doesn't block future loads
        stateRefs.lastSavedContent = null;
      }
    }

    if (type === 'toggle') {
      setMode((m) => (m === 'edit' ? 'diff' : 'edit'));
    }

    if (type === 'prev') {
      const currentIndex = resolveVersionIndex(
        currentVersionIndex,
        documents.length,
      );
      if (currentIndex > 0) {
        setCurrentVersionIndex(currentIndex - 1);
      }
    } else if (type === 'next') {
      const currentIndex = resolveVersionIndex(
        currentVersionIndex,
        documents.length,
      );
      if (currentIndex < documents.length - 1) {
        setCurrentVersionIndex(currentIndex + 1);
      } else {
        // At latest, switch to following mode
        setCurrentVersionIndex(null);
      }
    }
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  // Determine if viewing the current/latest version
  const isCurrentVersion =
    !documents || documents.length === 0
      ? true
      : isLatestVersion(currentVersionIndex, documents.length);

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = useIsMobile();

  const composerDefinition = composerDefinitions.find(
    (definition) => definition.kind === composer.kind,
  );

  if (!composerDefinition) {
    throw new Error('Composer definition not found!');
  }

  useEffect(() => {
    if (composer.documentId !== 'init') {
      const stateRefs = stateRefsRef.current;
      // Reset refs when opening a new document
      // This prevents stale saved content ref from blocking content load
      console.log('[Composer] Document ID changed, resetting refs:', {
        newDocumentId: composer.documentId,
        clearingLastSavedRef: stateRefs.lastSavedContent !== null,
      });
      resetStateRefsForNewDocument(stateRefs, composer.documentId);
      // Reset version index to follow latest
      setCurrentVersionIndex(null);
      // Reset documents ref
      documentsRef.current = undefined;

      if (composerDefinition.initialize) {
        composerDefinition.initialize({
          documentId: composer.documentId,
          setMetadata,
        });
      }
    }
  }, [composer.documentId, composerDefinition, setMetadata]);

  return (
    <AnimatePresence>
      {composer.isVisible && (
        <motion.div
          data-testid="composer"
          className="flex flex-row h-dvh w-dvw fixed top-0 left-0 z-[100] bg-background"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.4 } }}
        >
          {!isMobile && (
            <motion.div
              className="fixed bg-background h-dvh pointer-events-none"
              initial={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
              animate={{ width: windowWidth, right: 0 }}
              exit={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
            />
          )}

          {!isMobile && (
            <motion.div
              className="relative w-[420px] bg-muted dark:bg-background h-dvh shrink-0"
              initial={{ opacity: 0, x: 10, scale: 1 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
                transition: {
                  delay: 0.2,
                  type: 'spring',
                  stiffness: 200,
                  damping: 30,
                },
              }}
              exit={{
                opacity: 0,
                x: 0,
                scale: 1,
                transition: { duration: 0 },
              }}
            >
              <AnimatePresence>
                {!isCurrentVersion && (
                  <motion.div
                    className="left-0 absolute h-dvh w-[420px] top-0 bg-zinc-900/50 z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              <div className="flex flex-col h-full justify-between items-center">
                <ComposerMessages
                  chatId={chatId}
                  status={status}
                  votes={votes}
                  messages={messages}
                  setMessages={setMessages}
                  reload={reload}
                  isReadonly={isReadonly}
                  composerStatus={composer.status}
                />

                <form className="flex flex-row gap-2 relative items-end w-full px-6 pb-6">
                  <MultimodalInput
                    chatId={chatId}
                    input={input}
                    setInput={setInput}
                    handleSubmit={handleSubmit}
                    status={status}
                    stop={stop}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    messages={messages}
                    append={append}
                    className="bg-transparent dark:bg-transparent composer-embedded"
                    setMessages={setMessages}
                    selectedVisibilityType={selectedVisibilityType}
                  />
                </form>
              </div>
            </motion.div>
          )}

          <motion.div
            className="fixed dark:bg-muted bg-background h-dvh flex flex-col overflow-y-scroll md:border-l dark:border-zinc-700 border-zinc-200 z-[70]"
            initial={
              isMobile
                ? {
                    opacity: 1,
                    x: composer.boundingBox.left,
                    y: composer.boundingBox.top,
                    height: composer.boundingBox.height,
                    width: composer.boundingBox.width,
                    borderRadius: 50,
                  }
                : {
                    opacity: 1,
                    x: composer.boundingBox.left,
                    y: composer.boundingBox.top,
                    height: composer.boundingBox.height,
                    width: composer.boundingBox.width,
                    borderRadius: 50,
                  }
            }
            animate={
              isMobile
                ? {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth ? windowWidth : 'calc(100dvw)',
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
                : {
                    opacity: 1,
                    x: 420,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth
                      ? windowWidth - 420
                      : 'calc(100dvw-420px)',
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
            }
            exit={{
              opacity: 0,
              scale: 0.5,
              transition: {
                delay: 0.1,
                type: 'spring',
                stiffness: 600,
                damping: 30,
              },
            }}
          >
            <div className="p-2 md:p-2 flex flex-row justify-between items-start gap-2">
              <div className="flex flex-row gap-4 items-start">
                <ComposerCloseButton stop={stop} />

                <div className="flex flex-col">
                  <div className="font-medium">
                    {isEditingTitle ? (
                      <input
                        type="text"
                        autoFocus
                        className="bg-transparent border-b border-transparent focus:border-primary outline-none px-1"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onBlur={async () => {
                          setIsEditingTitle(false);
                          const newTitle =
                            (draftTitle || '').trim() || 'Untitled';
                          const oldTitle = composer.title;
                          const stateRefs = stateRefsRef.current;

                          // Optimistic update
                          setComposer((a) => ({ ...a, title: newTitle }));

                          if (composer.documentId && stateRefs.isMounted) {
                            try {
                              const response = await fetch(
                                `/api/document?id=${composer.documentId}`,
                                {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({ title: newTitle }),
                                },
                              );

                              if (!response.ok && stateRefs.isMounted) {
                                // Rollback on error
                                setComposer((a) => ({ ...a, title: oldTitle }));
                              }
                            } catch {
                              // Rollback on network error
                              if (stateRefs.isMounted) {
                                setComposer((a) => ({ ...a, title: oldTitle }));
                              }
                            }
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftTitle(composer.title || '');
                          setIsEditingTitle(true);
                        }}
                        className="cursor-text text-left font-medium bg-transparent border-none p-0 hover:opacity-80"
                        title="Click to rename"
                      >
                        {composer.title || 'Untitled'}
                      </button>
                    )}
                  </div>

                  {isContentDirty ? (
                    <div className="text-sm text-muted-foreground">
                      Saving changes...
                    </div>
                  ) : document ? (
                    <div className="text-sm text-muted-foreground">
                      {`Updated ${formatDistance(
                        new Date(document.createdAt),
                        new Date(),
                        {
                          addSuffix: true,
                        },
                      )}`}
                    </div>
                  ) : (
                    <div className="w-32 h-3 mt-2 bg-muted-foreground/20 rounded-md animate-pulse" />
                  )}
                </div>
              </div>

              <ComposerHeaderActions
                composer={composer}
                currentVersionIndex={resolveVersionIndex(
                  currentVersionIndex,
                  documents?.length ?? 0,
                )}
                handleVersionChange={handleVersionChange}
                isCurrentVersion={isCurrentVersion}
                mode={mode}
                metadata={metadata}
                setMetadata={setMetadata}
              />
            </div>

            <div className="dark:bg-muted bg-background h-full overflow-y-scroll !max-w-full items-center">
              <ComposerErrorBoundary
                fallbackTitle={composer.title || 'Composer'}
                onClose={() =>
                  setComposer((prev) => ({ ...prev, isVisible: false }))
                }
              >
                <composerDefinition.content
                  title={composer.title}
                  content={
                    isCurrentVersion
                      ? composer.content ||
                        (documents && documents.length > 0
                          ? (documents[documents.length - 1]?.content ?? '')
                          : '')
                      : getDocumentContentById(currentVersionIndex)
                  }
                  mode={mode}
                  status={composer.status}
                  chatStatus={status}
                  currentVersionIndex={resolveVersionIndex(
                    currentVersionIndex,
                    documents?.length ?? 0,
                  )}
                  suggestions={[]}
                  onSaveContent={saveContent}
                  isInline={false}
                  isCurrentVersion={isCurrentVersion}
                  getDocumentContentById={(idx: number) =>
                    getDocumentContentById(idx)
                  }
                  isLoading={isDocumentsFetching && !composer.content}
                  metadata={metadata}
                  setMetadata={setMetadata}
                />
              </ComposerErrorBoundary>

              <AnimatePresence>
                {isCurrentVersion && (
                  <Toolbar
                    isToolbarVisible={isToolbarVisible}
                    setIsToolbarVisible={setIsToolbarVisible}
                    append={append}
                    status={status}
                    stop={stop}
                    setMessages={setMessages}
                    composerKind={composer.kind}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!isCurrentVersion && (
                <VersionFooter
                  currentVersionIndex={resolveVersionIndex(
                    currentVersionIndex,
                    documents?.length ?? 0,
                  )}
                  documents={documents}
                  handleVersionChange={handleVersionChange}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Composer = memo(PureComposer, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
    return false;

  return true;
});
