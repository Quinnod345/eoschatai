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
  useRef,
} from 'react';
import useSWR from 'swr';
import { useWindowSize } from 'usehooks-ts';
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
import equal from 'fast-deep-equal';
import type {
  ChatHelpers,
  ChatStatus,
  SetInputFunction,
  AppendFunction,
  HandleSubmitFunction,
  ReloadFunction,
} from './multimodal-input/types';
import type { VisibilityType } from './visibility-selector';
import {
  type VersionIndexState,
  isLatestVersion,
  resolveVersionIndex,
} from '@/lib/composer/state-machine';
import { isValidVtoContent } from '@/lib/composer/content-parsers';
import { ComposerErrorBoundary } from './composer-error-boundary';
import {
  useAutoSave,
  useSaveStatusDisplay,
} from '@/lib/composer/use-auto-save';
import type { Composer as ComposerClass } from './create-composer';
import type { ComposerKind } from '@/lib/mentions/types';

export type { ComposerKind };

type AnyComposerDef = ComposerClass<string, any>;

const composerClientLoaders: Record<string, () => Promise<AnyComposerDef>> = {
  text: () => import('@/composer/text/client').then((m) => m.textComposer),
  code: () => import('@/composer/code/client').then((m) => m.codeComposer),
  image: () => import('@/composer/image/client').then((m) => m.imageComposer),
  sheet: () => import('@/composer/sheet/client').then((m) => m.sheetComposer),
  chart: () => import('@/composer/chart/client').then((m) => m.chartComposer),
  vto: () => import('@/composer/vto/client').then((m) => m.vtoComposer),
  accountability: () =>
    import('@/composer/accountability/client').then(
      (m) => m.accountabilityComposer,
    ),
};

const defCache = new Map<string, AnyComposerDef>();

function useComposerDefinition(kind: string): AnyComposerDef | null {
  const [def, setDef] = useState<AnyComposerDef | null>(
    () => defCache.get(kind) ?? null,
  );

  useEffect(() => {
    const cached = defCache.get(kind);
    if (cached) {
      setDef(cached);
      return;
    }
    let cancelled = false;
    composerClientLoaders[kind]?.().then((loaded) => {
      defCache.set(kind, loaded);
      if (!cancelled) setDef(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return def;
}

export const composerDefinitions = {
  find(predicate: (def: AnyComposerDef) => boolean): AnyComposerDef | undefined {
    return Array.from(defCache.values()).find(predicate);
  },
  get kinds(): string[] {
    return Object.keys(composerClientLoaders);
  },
};

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

  // Fetch documents for version history (not for content - local state is source of truth)
  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Array<Document>>(
    composer.documentId !== 'init' && composer.status !== 'streaming'
      ? `/api/document?id=${composer.documentId}&versions=true`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // IMPORTANT: Don't serve stale data on mount - always fetch fresh
      // This prevents showing old content when reopening a document
      revalidateOnMount: true,
      dedupingInterval: 0,
    },
  );

  const [mode, setMode] = useState<'edit' | 'diff'>('edit');
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] =
    useState<VersionIndexState>(null);

  // Track if initial content has been loaded
  const initialLoadDoneRef = useRef(false);
  const isMountedRef = useRef(true);

  const { open: isSidebarOpen } = useSidebar();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  // Auto-save hook - handles all save logic
  const {
    save: autoSave,
    saveStatus,
    flushNow,
    lastSavedAt,
  } = useAutoSave(
    composer.documentId !== 'init' ? composer.documentId : undefined,
    composer.kind,
    { title: composer.title },
  );

  // Display text for save status
  const saveStatusText = useSaveStatusDisplay(saveStatus);

  // Track the last loaded document content to detect fresh data
  const lastLoadedContentRef = useRef<string | null>(null);

  // Load initial content from documents (only once per document, but handle SWR revalidation)
  useEffect(() => {
    if (documents && documents.length > 0 && isMountedRef.current) {
      const mostRecentDocument = documents.at(-1);
      if (mostRecentDocument) {
        setDocument(mostRecentDocument);

        const localContent = composer.content ?? '';
        const remoteContent = mostRecentDocument.content ?? '';
        const isInitialLoad = !localContent || localContent.trim().length === 0;

        // Load remote content if:
        // 1. Local content is empty (initial load), OR
        // 2. Remote content is different from what we last loaded (SWR revalidated with fresh data)
        //    AND local content matches the stale data we loaded (user hasn't edited)
        const shouldLoadRemote =
          (isInitialLoad && !initialLoadDoneRef.current) ||
          (lastLoadedContentRef.current !== null &&
            remoteContent !== lastLoadedContentRef.current &&
            localContent === lastLoadedContentRef.current);

        if (shouldLoadRemote) {
          // For VTO, validate content before loading
          if (
            composer.kind === 'vto' &&
            remoteContent &&
            !isValidVtoContent(remoteContent)
          ) {
            // Mark initial load as done even if validation fails to prevent repeated attempts
            // This avoids wasting resources on invalid content during SWR revalidation cycles
            initialLoadDoneRef.current = true;
            lastLoadedContentRef.current = remoteContent;
            return;
          }

          console.log('[Composer] Loading content:', {
            documentId: mostRecentDocument.id,
            contentLength: remoteContent.length,
            reason: isInitialLoad ? 'initial' : 'revalidated',
          });

          setComposer((current) => ({ ...current, content: remoteContent }));
          lastLoadedContentRef.current = remoteContent;
          initialLoadDoneRef.current = true;
        } else if (!initialLoadDoneRef.current && remoteContent) {
          // First load - track what we loaded even if we didn't need to set it
          lastLoadedContentRef.current = remoteContent;
          initialLoadDoneRef.current = true;
        }
      }
    }
  }, [documents, setComposer, composer.content, composer.kind]);

  // Refresh documents when streaming completes
  useEffect(() => {
    if (composer.status === 'idle') {
      mutateDocuments();
    }
  }, [composer.status, mutateDocuments]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Auto-save hook handles beacon save on unmount
    };
  }, []);

  // Simple save function that uses auto-save (always debounced in background)
  const saveContent = useCallback(
    (updatedContent: string, _debounce: boolean) => {
      // Validate VTO content
      if (composer.kind === 'vto') {
        if (
          !isValidVtoContent(updatedContent) ||
          updatedContent.trim().length === 0
        ) {
          return;
        }
      }

      // Don't save empty text content
      if (
        composer.kind === 'text' &&
        (!updatedContent || updatedContent.trim().length === 0)
      ) {
        return;
      }

      // Queue for background save
      autoSave(updatedContent);
    },
    [composer.kind, autoSave],
  );

  function getDocumentContentById(index: number | null) {
    if (!documents || documents.length === 0) return '';
    // Use resolveVersionIndex to get actual array index
    const actualIndex = resolveVersionIndex(index, documents.length);
    return documents[actualIndex]?.content ?? '';
  }

  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (!documents || documents.length === 0) return;

    if (type === 'latest') {
      setCurrentVersionIndex(null);
      setMode('edit');

      // Force load the latest content when clicking "latest"
      const latestDoc = documents[documents.length - 1];
      if (latestDoc?.content) {
        setComposer((current) => ({
          ...current,
          content: latestDoc.content ?? '',
        }));
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

  const composerDefinition = useComposerDefinition(composer.kind);

  useEffect(() => {
    if (composer.documentId !== 'init' && composerDefinition) {
      console.log('[Composer] Document ID changed:', composer.documentId);
      initialLoadDoneRef.current = false;
      lastLoadedContentRef.current = null;
      setCurrentVersionIndex(null);

      if (composerDefinition.initialize) {
        composerDefinition.initialize({
          documentId: composer.documentId,
          setMetadata,
        });
      }
    }
  }, [composer.documentId, composerDefinition, setMetadata]);

  if (!composerDefinition) {
    return (
      <AnimatePresence>
        {composer.isVisible && (
          <motion.div
            className="flex items-center justify-center h-dvh w-dvw fixed top-0 left-0 z-[100] bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="animate-pulse text-muted-foreground text-sm">
              Loading composer...
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

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

                          // Optimistic update
                          setComposer((a) => ({ ...a, title: newTitle }));

                          if (composer.documentId && isMountedRef.current) {
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

                              if (!response.ok && isMountedRef.current) {
                                // Rollback on error
                                setComposer((a) => ({ ...a, title: oldTitle }));
                              }
                            } catch {
                              // Rollback on network error
                              if (isMountedRef.current) {
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

                  <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                    {saveStatus === 'saving' && (
                      <>
                        <span className="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                        <span>Saving...</span>
                      </>
                    )}
                    {saveStatus === 'saved' && (
                      <>
                        <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full" />
                        <span>
                          {lastSavedAt
                            ? `Saved ${formatDistance(lastSavedAt, new Date(), { addSuffix: true })}`
                            : document
                              ? `Saved ${formatDistance(new Date(document.createdAt), new Date(), { addSuffix: true })}`
                              : 'All changes saved'}
                        </span>
                      </>
                    )}
                    {saveStatus === 'pending' && (
                      <>
                        <span className="inline-block w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                        <span>Unsaved changes</span>
                      </>
                    )}
                    {saveStatus === 'error' && (
                      <>
                        <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full" />
                        <span>Save failed - click to retry</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <ComposerHeaderActions
                composer={composer}
                composerDefinition={composerDefinition}
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
                <composerDefinition.Content
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
                    composerDefinition={composerDefinition}
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
