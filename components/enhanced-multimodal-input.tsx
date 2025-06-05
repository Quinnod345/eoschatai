'use client';

import type { Attachment } from 'ai';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ArrowUpIcon,
  PaperclipIcon,
  StopIcon,
  PencilEditIcon,
  SparklesIcon,
} from './icons';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useArtifact } from '@/hooks/use-artifact';
import {
  detectEditIntent,
  shouldEditArtifact,
} from '@/lib/ai/artifact-context';
import type { UIMessage } from 'ai';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';

interface EnhancedMultimodalInputProps {
  chatId: string;
  input: string;
  setInput: UseChatHelpers['setInput'];
  handleSubmit: UseChatHelpers['handleSubmit'];
  status: UseChatHelpers['status'];
  stop: UseChatHelpers['stop'];
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  append: UseChatHelpers['append'];
  className?: string;
  setMessages: UseChatHelpers['setMessages'];
  selectedVisibilityType: VisibilityType;
}

function PureEnhancedMultimodalInput({
  chatId,
  input,
  setInput,
  handleSubmit,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  append,
  className,
  setMessages,
  selectedVisibilityType,
}: EnhancedMultimodalInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { artifact } = useArtifact();

  // Detect if current input will edit artifact
  const [willEditArtifact, setWillEditArtifact] = useState(false);
  const [editIntent, setEditIntent] = useState<any>(null);

  // Check edit intent whenever input changes
  useEffect(() => {
    if (input && artifact.isVisible && artifact.documentId !== 'init') {
      const intent = detectEditIntent(input, artifact);
      const shouldEdit = shouldEditArtifact(input, artifact);

      setEditIntent(intent);
      setWillEditArtifact(shouldEdit);
    } else {
      setEditIntent(null);
      setWillEditArtifact(false);
    }
  }, [input, artifact]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localStorageInput, setLocalStorageInput] = useState('');

  useEffect(() => {
    const storedInput = localStorage.getItem(`input-${chatId}`);
    if (storedInput) {
      setInput(storedInput);
      setLocalStorageInput(storedInput);
    }
  }, [chatId, setInput]);

  useEffect(() => {
    localStorage.setItem(`input-${chatId}`, input);
    setLocalStorageInput(input);
  }, [chatId, input]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();

        if (status === 'streaming') {
          stop();
        } else {
          handleSubmit(event);
        }
      }
    },
    [handleSubmit, status, stop],
  );

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/files/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          id: pathname,
          name: file.name,
          url: url,
          contentType: contentType,
        };
      } else {
        const { error } = await response.json();
        throw new Error(error);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setAttachments((currentAttachments) => [
        ...currentAttachments,
        ...files.map((file) => ({
          name: file.name,
          url: '',
          contentType: file.type,
          file,
        })),
      ]);

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);

        setAttachments((currentAttachments) => {
          return currentAttachments.map((attachment) => {
            const uploaded = uploadedAttachments.find(
              (uploadedAttachment) =>
                uploadedAttachment.name === attachment.name,
            );

            if (uploaded) {
              return uploaded;
            }

            return attachment;
          });
        });
      } catch (error) {
        console.error('Error uploading files!', error);
      }
    },
    [setAttachments],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      const items = event.clipboardData?.items;

      if (items) {
        const files = Array.from(items)
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null);

        if (files.length > 0) {
          event.preventDefault();
          setAttachments((currentAttachments) => [
            ...currentAttachments,
            ...files.map((file) => ({
              name: file.name,
              url: '',
              contentType: file.type,
              file,
            })),
          ]);

          files.forEach(async (file) => {
            try {
              const uploadedAttachment = await uploadFile(file);
              setAttachments((currentAttachments) =>
                currentAttachments.map((attachment) =>
                  attachment.name === file.name
                    ? uploadedAttachment
                    : attachment,
                ),
              );
            } catch (error) {
              console.error('Error uploading file!', error);
            }
          });
        }
      }
    },
    [setAttachments],
  );

  // Enhanced submit handler that preserves original functionality
  const enhancedHandleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (status === 'streaming') {
        stop();
        return;
      }

      // Use the original handleSubmit - the enhanced chat hook will handle context
      handleSubmit(event);
    },
    [handleSubmit, status, stop],
  );

  // Artifact editing indicator
  const ArtifactEditIndicator = () => {
    if (!willEditArtifact || !editIntent) return null;

    const getEditTypeInfo = () => {
      switch (editIntent.type) {
        case 'extend':
          return {
            icon: <SparklesIcon size={14} />,
            text: 'Will extend artifact',
            color: 'text-blue-600 dark:text-blue-400',
            bgColor: 'bg-blue-50 dark:bg-blue-950',
            borderColor: 'border-blue-200 dark:border-blue-800',
          };
        case 'modify':
          return {
            icon: <PencilEditIcon size={14} />,
            text: 'Will modify artifact',
            color: 'text-orange-600 dark:text-orange-400',
            bgColor: 'bg-orange-50 dark:bg-orange-950',
            borderColor: 'border-orange-200 dark:border-orange-800',
          };
        case 'improve':
          return {
            icon: <SparklesIcon size={14} />,
            text: 'Will improve artifact',
            color: 'text-green-600 dark:text-green-400',
            bgColor: 'bg-green-50 dark:bg-green-950',
            borderColor: 'border-green-200 dark:border-green-800',
          };
        case 'fix':
          return {
            icon: <PencilEditIcon size={14} />,
            text: 'Will fix artifact',
            color: 'text-red-600 dark:text-red-400',
            bgColor: 'bg-red-50 dark:bg-red-950',
            borderColor: 'border-red-200 dark:border-red-800',
          };
        default:
          return {
            icon: <PencilEditIcon size={14} />,
            text: 'Will edit artifact',
            color: 'text-purple-600 dark:text-purple-400',
            bgColor: 'bg-purple-50 dark:bg-purple-950',
            borderColor: 'border-purple-200 dark:border-purple-800',
          };
      }
    };

    const editInfo = getEditTypeInfo();
    const targetText = editIntent.target
      ? ` (${editIntent.target.replace('_', ' ')})`
      : '';

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${editInfo.bgColor} ${editInfo.borderColor} ${editInfo.color}`}
      >
        {editInfo.icon}
        <span className="text-sm font-medium">
          {editInfo.text}
          {targetText}
        </span>
        <div className="text-xs opacity-75">&ldquo;{artifact.title}&rdquo;</div>
      </motion.div>
    );
  };

  return (
    <div className="relative w-full">
      <AnimatePresence>
        {willEditArtifact && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <ArtifactEditIndicator />
          </motion.div>
        )}
      </AnimatePresence>

      <form className="relative" onSubmit={enhancedHandleSubmit}>
        <input
          type="file"
          className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
          ref={fileInputRef}
          multiple
          onChange={handleFileChange}
          tabIndex={-1}
        />

        <Textarea
          ref={textareaRef}
          placeholder={
            willEditArtifact
              ? `Edit "${artifact.title}" artifact...`
              : 'Send a message...'
          }
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className={`min-h-[60px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-xl text-base bg-muted ${className} ${
            willEditArtifact ? 'border-blue-300 dark:border-blue-700' : ''
          }`}
          rows={3}
          autoFocus
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />

        {attachments.length > 0 && (
          <div className="flex flex-row gap-2 absolute bottom-2 left-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.name}
                className="flex flex-col items-center justify-center w-16 h-16 bg-muted rounded-md relative"
              >
                {attachment.contentType?.startsWith('image/') ? (
                  <img
                    src={attachment.url || ''}
                    alt={attachment.name}
                    className="w-full h-full object-cover rounded-md"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <PaperclipIcon size={20} />
                  </div>
                )}
                <button
                  type="button"
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                  onClick={() => {
                    setAttachments((prev) =>
                      prev.filter((a) => a.name !== attachment.name),
                    );
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="absolute bottom-2 right-2 flex flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={status === 'streaming'}
          >
            <PaperclipIcon size={14} />
          </Button>

          <Button
            type="submit"
            size="icon"
            disabled={input.length === 0 || status === 'streaming'}
            className="size-8 rounded-full"
          >
            {status === 'streaming' ? (
              <StopIcon size={14} />
            ) : (
              <ArrowUpIcon size={14} />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function areEqual(
  prevProps: EnhancedMultimodalInputProps,
  nextProps: EnhancedMultimodalInputProps,
) {
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.attachments.length !== nextProps.attachments.length)
    return false;
  if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
    return false;

  return true;
}

export const EnhancedMultimodalInput = memo(
  PureEnhancedMultimodalInput,
  areEqual,
);
