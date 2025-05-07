'use client';

import type { Attachment, UIMessage } from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { VisibilityType } from './visibility-selector';
import { XIcon } from 'lucide-react';

interface ExtendedAttachment extends Attachment {
  pdfText?: string;
  pdfInfo?: {
    numPages: number;
    info: any;
  };
}

// Add a new interface for PDF content tracking
interface PDFContent {
  name: string;
  text: string;
  numPages: number;
}

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
  selectedVisibilityType,
}: {
  chatId: string;
  input: UseChatHelpers['input'];
  setInput: UseChatHelpers['setInput'];
  status: UseChatHelpers['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  append: UseChatHelpers['append'];
  handleSubmit: UseChatHelpers['handleSubmit'];
  className?: string;
  selectedVisibilityType: VisibilityType;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  // Use separate state for PDF content
  const [pdfContents, setPdfContents] = useState<PDFContent[]>([]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Handle PDFs completely separately
      if (file.type === 'application/pdf') {
        console.log(`Processing PDF: ${file.name} (${file.size} bytes)`);

        // Create a loading toast with an ID so we can dismiss it later
        const toastId = toast.loading(`Processing PDF: ${file.name}...`);

        try {
          const response = await fetch('/api/files/pdf', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            console.log(
              `PDF processed: ${data.text.length} characters extracted`,
            );

            // Dismiss the loading toast
            toast.dismiss(toastId);

            // Show a success toast
            toast.success(
              `PDF processed: ${data.filename} (${data.numPages} pages)`,
            );

            // Add to our separate PDF content state
            setPdfContents((prev) => [
              ...prev,
              {
                name: data.filename,
                text: data.text,
                numPages: data.numPages,
              },
            ]);

            // Return null - we're not using the attachment system for PDFs
            return null;
          } else {
            const errorData = await response.json();
            const errorMessage =
              errorData.error || 'Unknown error processing PDF';
            console.error(`PDF processing error: ${errorMessage}`);

            // Dismiss the loading toast
            toast.dismiss(toastId);

            // Show an error toast
            toast.error(`PDF processing error: ${errorMessage}`);
            return undefined;
          }
        } catch (error) {
          console.error('Error during PDF processing:', error);

          // Dismiss the loading toast
          toast.dismiss(toastId);

          // Show an error toast
          toast.error(
            'Failed to process PDF. Please try a different file or format.',
          );
          return undefined;
        }
      }

      // Regular attachment handling for non-PDFs
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
      return undefined;
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file, please try again!');
      return undefined;
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);

        // Filter out null results (PDFs) and undefined results (errors)
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined && attachment !== null,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    let finalInputContent = input; // Start with current text input
    let hasPdfContent = false;

    if (pdfContents.length > 0) {
      hasPdfContent = true;
      const pdfTextContent = pdfContents
        .map((pdf) => {
          let pdfText = pdf.text || '';
          if (pdfText.length > 15000) {
            // Character limit per PDF
            pdfText = `${pdfText.substring(0, 15000)}... [PDF content truncated due to size]`;
          }
          // Format the PDF content with a consistent delimiter that our message component can extract
          return `\n\n=== PDF Content from ${pdf.name} (${pdf.numPages} pages) ===\n\n${pdfText}\n\n`;
        })
        .join('');

      finalInputContent = `${input}${pdfTextContent}`; // Combine original input with PDF text
      console.log(
        `Preparing message with ${pdfContents.length} PDFs included in text content. Total length: ${finalInputContent.length}`,
      );
    }

    if (hasPdfContent) {
      // Use append for messages with PDF content
      append(
        {
          role: 'user',
          content: finalInputContent, // Send the combined content
        },
        {
          experimental_attachments:
            attachments.length > 0 ? attachments : undefined,
        },
      );
      setInput(''); // Clear the input field as append doesn't do it automatically.
    } else {
      // No PDF content, use standard handleSubmit
      // Ensure there's something to send (text or attachments)
      if (input.trim().length > 0 || attachments.length > 0) {
        handleSubmit(undefined, {
          experimental_attachments:
            attachments.length > 0 ? attachments : undefined,
        });
        // `handleSubmit` from `useChat` should clear the input state itself.
      } else {
        // Nothing to send, might be good to log or handle, though button should be disabled
        console.log('Submit called with nothing to send.');
        return; // Early exit if there is truly nothing to send
      }
    }

    // Common cleanup operations
    setAttachments([]); // Clear regular attachments
    setPdfContents([]); // Clear PDF contents
    // `setLocalStorageInput` will be triggered by `setInput('')` or by `useChat` clearing input.
    resetHeight();

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    attachments,
    pdfContents,
    chatId,
    append,
    handleSubmit,
    setInput,
    setAttachments,
    setPdfContents,
    width,
    // Removed: setLocalStorageInput (handled by input/setInput side effect)
    // textareaRef is a ref, not needed in dep array unless its .current is used and changes behavior
  ]);

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  // Pass counts to SendButton
  const attachmentsCount = attachments.length;
  const pdfCount = pdfContents.length;

  return (
    <div className="relative w-full flex flex-col gap-4">
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute left-1/2 bottom-28 -translate-x-1/2 z-50"
          >
            <Button
              data-testid="scroll-to-bottom-button"
              className="rounded-full"
              size="icon"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 &&
        pdfContents.length === 0 && (
          <SuggestedActions
            append={append}
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 ||
        pdfContents.length > 0 ||
        uploadQueue.length > 0) && (
        <div
          data-testid="attachments-preview"
          className="flex flex-row gap-2 overflow-x-scroll items-end p-2"
        >
          {attachments.map((attachment) => (
            <PreviewAttachment
              key={attachment.url}
              attachment={attachment}
              onRemove={() => {
                setAttachments((currentAttachments) =>
                  currentAttachments.filter((a) => a.url !== attachment.url),
                );
              }}
            />
          ))}

          {pdfContents.map((pdf, index) => (
            <div
              key={`pdf-${pdf.name}-${index}`}
              className="flex flex-col gap-2 relative"
            >
              <div className="w-20 h-16 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center">
                <svg
                  className="size-8 text-zinc-500"
                  fill="none"
                  height="24"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 13h6" />
                  <path d="M9 17h6" />
                  <path d="M9 9h1" />
                </svg>

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-1 -right-1 size-5 rounded-full bg-background border shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => {
                    setPdfContents((current) =>
                      current.filter((_, i) => i !== index),
                    );
                  }}
                >
                  <XIcon size={12} />
                </Button>
              </div>
              <div className="text-xs text-zinc-500 max-w-16 truncate">
                {pdf.name}
              </div>
            </div>
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      <Textarea
        data-testid="multimodal-input"
        ref={textareaRef}
        placeholder="Send a message..."
        value={input}
        onChange={handleInput}
        className={cx(
          'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base',
          'backdrop-filter backdrop-blur-[16px]',
          'border border-white/30 dark:border-zinc-700/30',
          'pb-10',
          'input-tint shadow-enhanced',
          className,
        )}
        style={{
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow:
            'inset 0px 0px 10px rgba(0, 0, 0, 0.1), 0 8px 30px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.12)',
        }}
        rows={2}
        autoFocus
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();

            if (status !== 'ready') {
              toast.error('Please wait for the model to finish its response!');
            } else {
              submitForm();
            }
          }
        }}
      />

      <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start">
        <AttachmentsButton fileInputRef={fileInputRef} status={status} />
      </div>

      <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
        {status === 'submitted' ? (
          <StopButton stop={stop} setMessages={setMessages} />
        ) : (
          <SendButton
            input={input}
            submitForm={submitForm}
            uploadQueue={uploadQueue}
            attachmentsCount={attachmentsCount}
            pdfCount={pdfCount}
          />
        )}
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  status,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers['status'];
}) {
  return (
    <Button
      data-testid="attachments-button"
      className="rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={status !== 'ready'}
      variant="ghost"
    >
      <PaperclipIcon size={14} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers['setMessages'];
}) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
  attachmentsCount,
  pdfCount,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
  attachmentsCount: number;
  pdfCount: number;
}) {
  const nothingToSend =
    input.trim().length === 0 && attachmentsCount === 0 && pdfCount === 0;
  const isDisabled = nothingToSend || uploadQueue.length > 0;

  return (
    <Button
      data-testid="send-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={isDisabled}
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.attachmentsCount !== nextProps.attachmentsCount) return false;
  if (prevProps.pdfCount !== nextProps.pdfCount) return false;
  return true;
});
