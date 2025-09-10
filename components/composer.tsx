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
  startTransition,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useDebounceCallback, useWindowSize } from 'usehooks-ts';
import type { Document, Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Toolbar } from './toolbar';
import { VersionFooter } from './version-footer';
import { ComposerActions } from './composer-actions';
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
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';

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
  const { composer, setComposer, metadata, setMetadata } = useComposer();

  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Array<Document>>(
    composer.documentId !== 'init' && composer.status !== 'streaming'
      ? `/api/document?id=${composer.documentId}`
      : null,
    fetcher,
  );

  const [mode, setMode] = useState<'edit' | 'diff'>('edit');
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const [mirroredChatId, setMirroredChatId] = useState<string | null>(null);
  const [mirroredMessages, setMirroredMessages] = useState<Array<UIMessage>>(
    [],
  );
  const [mirroredVotes, setMirroredVotes] = useState<Array<Vote>>([]);
  const [isMirroredLoading, setIsMirroredLoading] = useState(false);

  const { open: isSidebarOpen } = useSidebar();
  // Inline title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  // Validate VTO content to avoid saving/overriding with invalid or empty data
  const isValidVtoContent = useCallback(
    (maybeContent: string | null | undefined) => {
      if (!maybeContent) return false;
      const content = String(maybeContent);
      try {
        const hasBegin = content.includes('VTO_DATA_BEGIN');
        const hasEnd = content.includes('VTO_DATA_END');
        let jsonStr = content;
        if (hasBegin && hasEnd) {
          const start =
            content.indexOf('VTO_DATA_BEGIN') + 'VTO_DATA_BEGIN'.length;
          const end = content.indexOf('VTO_DATA_END');
          jsonStr = content.substring(start, end).trim();
        }
        const parsed: any = JSON.parse(jsonStr);
        return Boolean(parsed?.coreValues && parsed?.coreFocus);
      } catch {
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);

      if (mostRecentDocument) {
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(documents.length - 1);
        setComposer((currentComposer) => {
          // Avoid clobbering in-flight or freshly streamed content with an empty/older fetch
          const shouldOverrideContent =
            currentComposer.status !== 'streaming' &&
            !!mostRecentDocument.content &&
            mostRecentDocument.content.length > 0 &&
            mostRecentDocument.content !== currentComposer.content &&
            // For VTO, only override if the fetched content is valid VTO
            (currentComposer.kind !== 'vto' ||
              isValidVtoContent(mostRecentDocument.content));

          return shouldOverrideContent
            ? { ...currentComposer, content: mostRecentDocument.content ?? '' }
            : currentComposer;
        });
      }
    }
  }, [documents, setComposer, isValidVtoContent]);

  useEffect(() => {
    mutateDocuments();
  }, [composer.status, mutateDocuments]);
  // Load mirrored chat for this composer if it exists
  useEffect(() => {
    let cancelled = false;
    async function loadMirrored() {
      if (!composer.documentId || composer.documentId === 'init') return;
      setIsMirroredLoading(true);
      try {
        const chatRes = await fetch(
          `/api/chats/by-document?id=${composer.documentId}`,
        );
        const { chatId } = await chatRes.json();
        if (!chatId || cancelled) {
          setMirroredChatId(null);
          setMirroredMessages([]);
          setMirroredVotes([]);
          return;
        }
        setMirroredChatId(chatId);
        const msgsRes = await fetch(`/api/chats/messages?chatId=${chatId}`);
        const data = await msgsRes.json();
        if (!cancelled && Array.isArray(data?.messages)) {
          // Convert DB messages -> UIMessage expected by existing components if needed
          const uiMsgs = data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            parts: m.parts,
            createdAt: m.createdAt,
          }));
          setMirroredMessages(uiMsgs);
        }
      } catch (e) {
        if (!cancelled) {
          setMirroredChatId(null);
          setMirroredMessages([]);
          setMirroredVotes([]);
        }
      } finally {
        if (!cancelled) setIsMirroredLoading(false);
      }
    }
    loadMirrored();
    return () => {
      cancelled = true;
    };
  }, [composer.documentId]);

  const { mutate } = useSWRConfig();
  const [isContentDirty, setIsContentDirty] = useState(false);

  const handleContentChange = useCallback(
    async (updatedContent: string) => {
      if (!composer || !composer.documentId) return;

      // Never persist invalid/empty VTO content
      if (
        composer.kind === 'vto' &&
        (!isValidVtoContent(updatedContent) ||
          updatedContent.trim().length === 0)
      ) {
        return;
      }

      // Always POST the latest content to persist
      try {
        await fetch(`/api/document?id=${composer.documentId}`, {
          method: 'POST',
          body: JSON.stringify({
            title: composer.title,
            content: updatedContent,
            kind: composer.kind,
          }),
        });
      } catch (err) {
        console.error('Failed to save document content', err);
      } finally {
        setIsContentDirty(false);
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
      setMode((mode) => (mode === 'edit' ? 'diff' : 'edit'));
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

  /*
   * NOTE: if there are no documents, or if
   * the documents are being fetched, then
   * we mark it as the current version.
   */

  const isCurrentVersion =
    documents && documents.length > 0
      ? currentVersionIndex === documents.length - 1
      : true;

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  const composerDefinition = composerDefinitions.find(
    (definition) => definition.kind === composer.kind,
  );

  if (!composerDefinition) {
    throw new Error('Composer definition not found!');
  }

  useEffect(() => {
    if (composer.documentId !== 'init') {
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
          className="flex flex-row h-dvh w-dvw fixed top-0 left-0 z-50 bg-transparent"
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
                  chatId={mirroredChatId || chatId}
                  status={isMirroredLoading ? 'submitted' : status}
                  votes={mirroredChatId ? mirroredVotes : votes}
                  messages={mirroredChatId ? mirroredMessages : messages}
                  setMessages={
                    mirroredChatId ? ((() => {}) as any) : setMessages
                  }
                  reload={reload}
                  isReadonly={isReadonly}
                  composerStatus={composer.status}
                />

                <form className="flex flex-row gap-2 relative items-end w-full px-6 pb-6">
                  <MultimodalInput
                    chatId={mirroredChatId || chatId}
                    input={input}
                    setInput={setInput}
                    handleSubmit={handleSubmit}
                    status={status}
                    stop={stop}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    messages={mirroredChatId ? mirroredMessages : messages}
                    append={append}
                    className="bg-transparent dark:bg-transparent composer-embedded"
                    setMessages={
                      mirroredChatId ? ((() => {}) as any) : setMessages
                    }
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
            <div className="p-2 flex flex-row justify-between items-start">
              <div className="flex flex-row gap-4 items-start">
                <ComposerCloseButton />

                <div className="flex flex-col">
                  <div className="font-medium">
                    {isEditingTitle ? (
                      <input
                        autoFocus
                        className="bg-transparent border-b border-transparent focus:border-primary outline-none px-1"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onBlur={async () => {
                          setIsEditingTitle(false);
                          const title = (draftTitle || '').trim() || 'Untitled';
                          setComposer((a) => ({ ...a, title }));
                          if (composer.documentId) {
                            try {
                              await fetch(
                                `/api/document?id=${composer.documentId}`,
                                {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({ title }),
                                },
                              );
                            } catch {}
                          }
                        }}
                      />
                    ) : (
                      <span
                        onDoubleClick={() => {
                          setDraftTitle(composer.title || '');
                          setIsEditingTitle(true);
                        }}
                        className="cursor-text"
                        title="Double-click to rename"
                      >
                        {composer.title || 'Untitled'}
                      </span>
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

              <ComposerActions
                composer={composer}
                currentVersionIndex={currentVersionIndex}
                handleVersionChange={handleVersionChange}
                isCurrentVersion={isCurrentVersion}
                mode={mode}
                metadata={metadata}
                setMetadata={setMetadata}
              />
            </div>

            <div className="dark:bg-muted bg-background h-full overflow-y-scroll !max-w-full items-center">
              <composerDefinition.content
                title={composer.title}
                content={
                  isCurrentVersion
                    ? composer.content
                    : getDocumentContentById(currentVersionIndex)
                }
                mode={mode}
                status={composer.status}
                currentVersionIndex={currentVersionIndex}
                suggestions={[]}
                onSaveContent={saveContent}
                isInline={false}
                isCurrentVersion={isCurrentVersion}
                getDocumentContentById={getDocumentContentById}
                isLoading={isDocumentsFetching && !composer.content}
                metadata={metadata}
                setMetadata={setMetadata}
              />

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

export const Composer = memo(PureComposer, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (prevProps.input !== nextProps.input) return false;
  if (!equal(prevProps.messages, nextProps.messages.length)) return false;
  if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
    return false;

  return true;
});
