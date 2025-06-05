'use client';

import type { Attachment, UIMessage } from 'ai';
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
import useSWR, { useSWRConfig } from 'swr';
import { useDebounceCallback, useWindowSize } from 'usehooks-ts';
import type { Document, Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { EnhancedMultimodalInput } from './enhanced-multimodal-input';
import { Toolbar } from './toolbar';
import { VersionFooter } from './version-footer';
import { ArtifactActions } from './artifact-actions';
import { ArtifactCloseButton } from './artifact-close-button';
import { ArtifactMessages } from './artifact-messages';
import { useSidebar } from './ui/sidebar';
import { useArtifact } from '@/hooks/use-artifact';
import { imageArtifact } from '@/artifacts/image/client';
import { enhancedCodeArtifact } from '@/artifacts/code/enhanced-client';
import { sheetArtifact } from '@/artifacts/sheet/client';
import { enhancedTextArtifact } from '@/artifacts/text/enhanced-client';
import { chartArtifact } from '@/artifacts/chart/client';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import { Button } from './ui/button';
import { UndoIcon, RedoIcon, SaveIcon, EditIcon } from './icons';
import { toast } from 'sonner';

export const artifactDefinitions = [
  enhancedTextArtifact,
  enhancedCodeArtifact,
  imageArtifact,
  sheetArtifact,
  chartArtifact,
];
export type ArtifactKind = (typeof artifactDefinitions)[number]['kind'];

export interface UIArtifact {
  title: string;
  documentId: string;
  kind: ArtifactKind;
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

// Enhanced change tracking interface
export interface ArtifactChange {
  id: string;
  timestamp: Date;
  type: 'edit' | 'ai-edit' | 'user-edit' | 'replace';
  description: string;
  oldContent: string;
  newContent: string;
  range?: {
    start: number;
    end: number;
  };
  metadata?: {
    aiPrompt?: string;
    userAction?: string;
    confidence?: number;
  };
}

// Enhanced artifact state with change tracking
export interface EnhancedArtifactState {
  content: string;
  changes: ArtifactChange[];
  currentChangeIndex: number;
  isDirty: boolean;
  lastSaved: Date | null;
  isEditing: boolean;
  editingRange?: {
    start: number;
    end: number;
  };
}

function PureEnhancedArtifact({
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
  setInput: UseChatHelpers['setInput'];
  status: UseChatHelpers['status'];
  stop: UseChatHelpers['stop'];
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  votes: Array<Vote> | undefined;
  append: UseChatHelpers['append'];
  handleSubmit: UseChatHelpers['handleSubmit'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  selectedVisibilityType: VisibilityType;
}) {
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();

  // Enhanced state management
  const [enhancedState, setEnhancedState] = useState<EnhancedArtifactState>({
    content: artifact.content,
    changes: [],
    currentChangeIndex: -1,
    isDirty: false,
    lastSaved: null,
    isEditing: false,
  });

  const [mode, setMode] = useState<'edit' | 'diff' | 'changes'>('edit');
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const [aiEditInProgress, setAiEditInProgress] = useState<{
    description: string;
    originalContent: string;
    timestamp: string;
  } | null>(null);

  const { open: isSidebarOpen } = useSidebar();

  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Array<Document>>(
    artifact.documentId !== 'init' && artifact.status !== 'streaming'
      ? `/api/document?id=${artifact.documentId}`
      : null,
    fetcher,
  );

  // Initialize enhanced state when artifact content changes
  useEffect(() => {
    if (
      artifact.content !== enhancedState.content &&
      !enhancedState.isEditing
    ) {
      setEnhancedState((prev) => ({
        ...prev,
        content: artifact.content,
      }));
    }
  }, [artifact.content, enhancedState.content, enhancedState.isEditing]);

  useEffect(() => {
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);

      if (mostRecentDocument) {
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(documents.length - 1);
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          content: mostRecentDocument.content ?? '',
        }));
      }
    }
  }, [documents, setArtifact]);

  useEffect(() => {
    mutateDocuments();
  }, [artifact.status, mutateDocuments]);

  const { mutate } = useSWRConfig();

  // Enhanced content change handler with intelligent editing
  const handleInlineEdit = useCallback(
    async (
      newContent: string,
      range?: { start: number; end: number },
      metadata?: {
        aiPrompt?: string;
        userAction?: string;
        confidence?: number;
      },
    ) => {
      if (!artifact) return;

      const changeId = `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const change: ArtifactChange = {
        id: changeId,
        timestamp: now,
        type: metadata?.aiPrompt ? 'ai-edit' : 'user-edit',
        description:
          metadata?.aiPrompt || metadata?.userAction || 'Content edited',
        oldContent: enhancedState.content,
        newContent,
        range,
        metadata,
      };

      // Update enhanced state with new change
      setEnhancedState((prev) => {
        const newChanges = [
          ...prev.changes.slice(0, prev.currentChangeIndex + 1),
          change,
        ];
        return {
          ...prev,
          content: newContent,
          changes: newChanges,
          currentChangeIndex: newChanges.length - 1,
          isDirty: true,
        };
      });

      // Update artifact content immediately for UI responsiveness
      setArtifact((prev) => ({
        ...prev,
        content: newContent,
      }));

      // Debounced save to backend
      debouncedSaveToBackend(newContent, change);
    },
    [artifact, enhancedState.content, setArtifact],
  );

  // Save to backend with change tracking
  const saveToBackend = useCallback(
    async (content: string, change: ArtifactChange) => {
      if (!artifact) return;

      try {
        const response = await fetch(
          `/api/document/enhanced?id=${artifact.documentId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: artifact.title,
              content,
              kind: artifact.kind,
              change,
            }),
          },
        );

        if (response.ok) {
          setEnhancedState((prev) => ({
            ...prev,
            isDirty: false,
            lastSaved: new Date(),
          }));

          // Update local cache
          mutate<Array<Document>>(
            `/api/document?id=${artifact.documentId}`,
            async (currentDocuments) => {
              if (!currentDocuments) return undefined;

              const newDocument = {
                id: artifact.documentId,
                title: artifact.title,
                content,
                kind: artifact.kind,
                createdAt: new Date(),
                userId: '', // Will be set by backend
              };

              return [...currentDocuments, newDocument];
            },
            { revalidate: false },
          );
        } else {
          toast.error('Failed to save changes');
        }
      } catch (error) {
        console.error('Error saving to backend:', error);
        toast.error('Failed to save changes');
      }
    },
    [artifact, mutate],
  );

  const debouncedSaveToBackend = useDebounceCallback(saveToBackend, 2000);

  // Undo functionality
  const handleUndo = useCallback(() => {
    if (enhancedState.currentChangeIndex > 0) {
      const previousIndex = enhancedState.currentChangeIndex - 1;
      const previousChange = enhancedState.changes[previousIndex];

      setEnhancedState((prev) => ({
        ...prev,
        content: previousChange.oldContent,
        currentChangeIndex: previousIndex,
        isDirty: true,
      }));

      setArtifact((prev) => ({
        ...prev,
        content: previousChange.oldContent,
      }));

      toast.success('Undid last change');
    }
  }, [enhancedState.currentChangeIndex, enhancedState.changes, setArtifact]);

  // Redo functionality
  const handleRedo = useCallback(() => {
    if (enhancedState.currentChangeIndex < enhancedState.changes.length - 1) {
      const nextIndex = enhancedState.currentChangeIndex + 1;
      const nextChange = enhancedState.changes[nextIndex];

      setEnhancedState((prev) => ({
        ...prev,
        content: nextChange.newContent,
        currentChangeIndex: nextIndex,
        isDirty: true,
      }));

      setArtifact((prev) => ({
        ...prev,
        content: nextChange.newContent,
      }));

      toast.success('Redid change');
    }
  }, [enhancedState.currentChangeIndex, enhancedState.changes, setArtifact]);

  // Force save
  const handleForceSave = useCallback(async () => {
    if (enhancedState.isDirty && enhancedState.changes.length > 0) {
      const latestChange =
        enhancedState.changes[enhancedState.currentChangeIndex];
      await saveToBackend(enhancedState.content, latestChange);
      toast.success('Changes saved');
    }
  }, [
    enhancedState.isDirty,
    enhancedState.changes,
    enhancedState.currentChangeIndex,
    enhancedState.content,
    saveToBackend,
  ]);

  // Enhanced save content function for editors
  const saveContent = useCallback(
    (
      updatedContent: string,
      debounce: boolean,
      range?: { start: number; end: number },
    ) => {
      if (document && updatedContent !== enhancedState.content) {
        handleInlineEdit(updatedContent, range, {
          userAction: 'Manual edit',
          confidence: 1.0,
        });
      }
    },
    [document, enhancedState.content, handleInlineEdit],
  );

  function getDocumentContentById(index: number) {
    if (!documents) return '';
    if (!documents[index]) return '';
    return documents[index].content ?? '';
  }

  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (!documents) return;

    if (type === 'latest') {
      setCurrentVersionIndex(documents.length - 1);
      setMode('edit');
    }

    if (type === 'toggle') {
      setMode((mode) => {
        if (mode === 'edit') return 'diff';
        if (mode === 'diff') return 'changes';
        return 'edit';
      });
    }

    if (type === 'prev') {
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1);
      }
    } else if (type === 'next') {
      if (currentVersionIndex < documents.length - 1) {
        setCurrentVersionIndex((index) => index + 1);
      }
    }
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  const isCurrentVersion =
    documents && documents.length > 0
      ? currentVersionIndex === documents.length - 1
      : true;

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  if (!artifactDefinition) {
    throw new Error('Artifact definition not found!');
  }

  useEffect(() => {
    if (artifact.documentId !== 'init') {
      if (artifactDefinition.initialize) {
        artifactDefinition.initialize({
          documentId: artifact.documentId,
          setMetadata,
        });
      }
    }
  }, [artifact.documentId, artifactDefinition, setMetadata]);

  // Listen for AI edit completion events
  useEffect(() => {
    const handleAIEditComplete = (event: CustomEvent) => {
      const { description, originalContent, timestamp } = event.detail;

      // Create an AI edit change entry
      const changeId = `ai-change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const change: ArtifactChange = {
        id: changeId,
        timestamp: new Date(timestamp),
        type: 'ai-edit',
        description: description,
        oldContent: originalContent,
        newContent: artifact.content, // Current content after AI edit
        metadata: {
          aiPrompt: description,
          confidence: 0.9,
        },
      };

      // Update enhanced state with AI edit change
      setEnhancedState((prev) => {
        const newChanges = [
          ...prev.changes.slice(0, prev.currentChangeIndex + 1),
          change,
        ];
        return {
          ...prev,
          changes: newChanges,
          currentChangeIndex: newChanges.length - 1,
          isDirty: true,
        };
      });

      // Save the AI edit to backend
      debouncedSaveToBackend(artifact.content, change);

      toast.success('AI edit applied and saved to version history');
    };

    window.addEventListener(
      'ai-edit-complete',
      handleAIEditComplete as EventListener,
    );

    return () => {
      window.removeEventListener(
        'ai-edit-complete',
        handleAIEditComplete as EventListener,
      );
    };
  }, [
    artifact.content,
    enhancedState.currentChangeIndex,
    debouncedSaveToBackend,
  ]);

  // Enhanced toolbar with undo/redo/save
  const EnhancedToolbar = () => (
    <div className="flex items-center gap-2 p-2 border-b dark:border-zinc-700 border-zinc-200">
      <Button
        variant="outline"
        size="sm"
        onClick={handleUndo}
        disabled={enhancedState.currentChangeIndex <= 0}
        className="flex items-center gap-1"
      >
        <UndoIcon size={14} />
        Undo
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleRedo}
        disabled={
          enhancedState.currentChangeIndex >= enhancedState.changes.length - 1
        }
        className="flex items-center gap-1"
      >
        <RedoIcon size={14} />
        Redo
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleForceSave}
        disabled={!enhancedState.isDirty}
        className="flex items-center gap-1"
      >
        <SaveIcon size={14} />
        Save
      </Button>

      <div className="flex-1" />

      <div className="text-xs text-muted-foreground">
        {enhancedState.isDirty ? (
          <span className="text-orange-500">Unsaved changes</span>
        ) : enhancedState.lastSaved ? (
          `Saved ${formatDistance(enhancedState.lastSaved, new Date(), { addSuffix: true })}`
        ) : (
          'No changes'
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        {enhancedState.changes.length} changes
      </div>
    </div>
  );

  // Changes view component
  const ChangesView = () => (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Change History</h3>
      <div className="space-y-2">
        {enhancedState.changes.map((change, index) => (
          <div
            key={change.id}
            className={`p-3 rounded-lg border ${
              index === enhancedState.currentChangeIndex
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <EditIcon size={14} />
                <span className="text-sm font-medium">
                  {change.description}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    change.type === 'ai-edit'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}
                >
                  {change.type === 'ai-edit' ? 'AI' : 'User'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistance(change.timestamp, new Date(), {
                  addSuffix: true,
                })}
              </span>
            </div>

            {change.metadata?.aiPrompt && (
              <div className="mt-2 text-xs text-muted-foreground">
                Prompt: {change.metadata.aiPrompt}
              </div>
            )}

            {change.range && (
              <div className="mt-2 text-xs text-muted-foreground">
                Range: {change.range.start} - {change.range.end}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {artifact.isVisible && (
        <motion.div
          data-testid="enhanced-artifact"
          className="flex flex-row h-dvh w-dvw fixed top-0 left-0 z-50 bg-transparent"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.4 } }}
        >
          {!isMobile && (
            <motion.div
              className="fixed bg-background h-dvh"
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
                <ArtifactMessages
                  chatId={chatId}
                  status={status}
                  votes={votes}
                  messages={messages}
                  setMessages={setMessages}
                  reload={reload}
                  isReadonly={isReadonly}
                  artifactStatus={artifact.status}
                />

                <div className="flex flex-row gap-2 relative items-end w-full px-6 pb-6">
                  <EnhancedMultimodalInput
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
                    className="bg-transparent dark:bg-transparent"
                    setMessages={setMessages}
                    selectedVisibilityType={selectedVisibilityType}
                  />
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            className="fixed dark:bg-muted bg-background h-dvh flex flex-col overflow-y-scroll md:border-l dark:border-zinc-700 border-zinc-200"
            initial={
              isMobile
                ? {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
                    borderRadius: 50,
                  }
                : {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
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
            <div className="p-2 flex flex-row justify-between items-start">
              <div className="flex flex-row gap-4 items-start">
                <ArtifactCloseButton />

                <div className="flex flex-col">
                  <div className="font-medium">{artifact.title}</div>

                  {enhancedState.isDirty ? (
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

              <ArtifactActions
                artifact={artifact}
                currentVersionIndex={currentVersionIndex}
                handleVersionChange={handleVersionChange}
                isCurrentVersion={isCurrentVersion}
                mode={mode}
                metadata={metadata}
                setMetadata={setMetadata}
              />
            </div>

            <EnhancedToolbar />

            <div className="dark:bg-muted bg-background h-full overflow-y-scroll !max-w-full items-center">
              {mode === 'changes' ? (
                <ChangesView />
              ) : (
                <artifactDefinition.content
                  title={artifact.title}
                  content={
                    isCurrentVersion
                      ? enhancedState.content
                      : getDocumentContentById(currentVersionIndex)
                  }
                  mode={mode}
                  status={artifact.status}
                  currentVersionIndex={currentVersionIndex}
                  suggestions={[]}
                  onSaveContent={saveContent}
                  isInline={false}
                  isCurrentVersion={isCurrentVersion}
                  getDocumentContentById={getDocumentContentById}
                  isLoading={isDocumentsFetching && !artifact.content}
                  metadata={metadata}
                  setMetadata={setMetadata}
                />
              )}

              <AnimatePresence>
                {isCurrentVersion && mode === 'edit' && (
                  <Toolbar
                    isToolbarVisible={isToolbarVisible}
                    setIsToolbarVisible={setIsToolbarVisible}
                    append={append}
                    status={status}
                    stop={stop}
                    setMessages={setMessages}
                    artifactKind={artifact.kind}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!isCurrentVersion && (
                <VersionFooter
                  currentVersionIndex={currentVersionIndex}
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

export const EnhancedArtifact = memo(
  PureEnhancedArtifact,
  (prevProps, nextProps) => {
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.votes, nextProps.votes)) return false;
    if (prevProps.input !== nextProps.input) return false;
    if (!equal(prevProps.messages, nextProps.messages.length)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);
