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
import { ModelSelector } from './model-selector';
import { ProviderSelector } from './provider-selector';
import { VisibilitySelector } from './visibility-selector';
import type { Session } from 'next-auth';

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

// Add interfaces for document and image content
interface DocumentContent {
  name: string;
  text: string;
  type: 'docx' | 'xlsx';
  pageCount?: number;
}

interface ImageContent {
  name: string;
  text: string; // OCR text
  description: string; // AI-generated description
  type: string; // image mime type
  url: string; // The URL for display
}

// Add a CSS module for the drag-and-drop animation
const pulseDragDropStyle = `
  @keyframes pulse {
    0% {
      opacity: 0.6;
    }
    50% {
      opacity: 0.8;
    }
    100% {
      opacity: 0.6;
    }
  }
`;

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
  selectedModelId,
  selectedProviderId,
  session,
  isReadonly,
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
  selectedModelId?: string;
  selectedProviderId?: string;
  session?: Session;
  isReadonly?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

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
  // Add new state for documents and images
  const [documentContents, setDocumentContents] = useState<DocumentContent[]>(
    [],
  );
  const [imageContents, setImageContents] = useState<ImageContent[]>([]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Get file extension
      const fileExt = file.name.split('.').pop()?.toLowerCase();

      // Handle PDFs completely separately
      if (file.type === 'application/pdf' || fileExt === 'pdf') {
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

      // Handle DOCX files
      else if (
        file.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword' ||
        fileExt === 'docx' ||
        fileExt === 'doc'
      ) {
        console.log(`Processing Document: ${file.name} (${file.size} bytes)`);

        // Create a loading toast
        const toastId = toast.loading(`Processing document: ${file.name}...`);

        try {
          const response = await fetch('/api/files/document', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            console.log(
              `Document processed: ${data.text.length} characters extracted`,
            );

            // Dismiss loading toast
            toast.dismiss(toastId);

            // Show success toast
            toast.success(`Document processed: ${data.filename}`);

            // Add to document content state
            setDocumentContents((prev) => [
              ...prev,
              {
                name: data.filename,
                text: data.text,
                type: 'docx',
                pageCount: data.pageCount,
              },
            ]);

            // Return null - not using attachment system for documents
            return null;
          } else {
            const errorData = await response.json();
            const errorMessage =
              errorData.error || 'Unknown error processing document';
            console.error(`Document processing error: ${errorMessage}`);

            // Dismiss loading toast
            toast.dismiss(toastId);

            // Show error toast
            toast.error(`Document processing error: ${errorMessage}`);
            return undefined;
          }
        } catch (error) {
          console.error('Error during document processing:', error);

          // Dismiss loading toast
          toast.dismiss(toastId);

          // Show error toast
          toast.error(
            'Failed to process document. Please try a different file or format.',
          );
          return undefined;
        }
      }

      // Handle XLSX files
      else if (
        file.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        fileExt === 'xlsx' ||
        fileExt === 'xls'
      ) {
        console.log(
          `Processing Spreadsheet: ${file.name} (${file.size} bytes)`,
        );

        // Create a loading toast
        const toastId = toast.loading(
          `Processing spreadsheet: ${file.name}...`,
        );

        try {
          const response = await fetch('/api/files/document', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            console.log(
              `Spreadsheet processed: ${data.text.length} characters extracted`,
            );

            // Dismiss loading toast
            toast.dismiss(toastId);

            // Show success toast
            toast.success(`Spreadsheet processed: ${data.filename}`);

            // Add to document content state
            setDocumentContents((prev) => [
              ...prev,
              {
                name: data.filename,
                text: data.text,
                type: 'xlsx',
                pageCount: data.pageCount,
              },
            ]);

            // Return null - not using attachment system for documents
            return null;
          } else {
            const errorData = await response.json();
            const errorMessage =
              errorData.error || 'Unknown error processing spreadsheet';
            console.error(`Spreadsheet processing error: ${errorMessage}`);

            // Dismiss loading toast
            toast.dismiss(toastId);

            // Show error toast
            toast.error(`Spreadsheet processing error: ${errorMessage}`);
            return undefined;
          }
        } catch (error) {
          console.error('Error during spreadsheet processing:', error);

          // Dismiss loading toast
          toast.dismiss(toastId);

          // Show error toast
          toast.error(
            'Failed to process spreadsheet. Please try a different file or format.',
          );
          return undefined;
        }
      }

      // Handle images - First upload the image normally, then process it afterward
      else if (
        file.type.startsWith('image/') ||
        ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt || '')
      ) {
        console.log(`Processing Image: ${file.name} (${file.size} bytes)`);

        // First, upload the image as a normal attachment
        try {
          // Regular upload for the image to be visible
          const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const { error } = await response.json();
            toast.error(error || 'Failed to upload image');
            return undefined;
          }

          const data = await response.json();
          const attachment = {
            url: data.url,
            name: data.pathname || file.name,
            contentType: file.type,
          };

          // Now process the image with AI in the background
          toast.loading(`Analyzing image: ${file.name}...`, {
            id: `image-analysis-${file.name}`,
          });

          // Process the image asynchronously
          fetch('/api/files/image-process', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageUrl: data.url,
              filename: file.name,
            }),
          })
            .then(async (processResponse) => {
              toast.dismiss(`image-analysis-${file.name}`);

              if (processResponse.ok) {
                const processData = await processResponse.json();

                // Store the image analysis data
                setImageContents((prev) => [
                  ...prev,
                  {
                    name: file.name,
                    text: processData.text || '',
                    description: processData.description || '',
                    type: file.type,
                    url: data.url,
                  },
                ]);

                toast.success(`Image analyzed: ${file.name}`);
              } else {
                console.error('Image analysis failed but upload succeeded');
              }
            })
            .catch((error) => {
              console.error('Error during image analysis:', error);
              toast.dismiss(`image-analysis-${file.name}`);
              toast.error('Image analysis failed, but image was uploaded');
            });

          // Return the attachment immediately so the image appears in the UI
          return attachment;
        } catch (error) {
          console.error('Failed to upload image:', error);
          toast.error('Failed to upload image, please try again!');
          return undefined;
        }
      }

      // Regular attachment handling for other file types
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
    let hasProcessedContent = false;

    // Handle PDF content
    if (pdfContents.length > 0) {
      hasProcessedContent = true;
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

      finalInputContent += pdfTextContent; // Combine original input with PDF text
    }

    // Handle document content
    if (documentContents.length > 0) {
      hasProcessedContent = true;
      const docTextContent = documentContents
        .map((doc) => {
          let docText = doc.text || '';
          if (docText.length > 15000) {
            // Character limit per document
            docText = `${docText.substring(0, 15000)}... [Document content truncated due to size]`;
          }
          // Format the document content
          const docType = doc.type === 'docx' ? 'Word Document' : 'Spreadsheet';
          const pageInfo = doc.pageCount ? ` (${doc.pageCount} pages)` : '';
          return `\n\n=== ${docType} Content from ${doc.name}${pageInfo} ===\n\n${docText}\n\n`;
        })
        .join('');

      finalInputContent += docTextContent; // Combine with document text
    }

    // Handle image content
    if (imageContents.length > 0) {
      hasProcessedContent = true;
      const imageTextContent = imageContents
        .map((img) => {
          const imgDescription = img.description || 'No description available';
          const imgText = img.text || 'No text detected';

          // Format the image content
          return `\n\n=== Image Analysis for ${img.name} ===\n\nDescription: ${imgDescription}\n\nExtracted Text: ${imgText}\n\n`;
        })
        .join('');

      finalInputContent += imageTextContent; // Combine with image text
    }

    // Ensure the submit doesn't hang by checking first
    if (status !== 'ready') {
      toast.error('Please wait for the model to finish its response!');
      return;
    }

    if (hasProcessedContent) {
      // Use append for messages with processed content
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
      // No processed content, use standard handleSubmit
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
    setDocumentContents([]); // Clear document contents
    setImageContents([]); // Clear image contents
    // `setLocalStorageInput` will be triggered by `setInput('')` or by `useChat` clearing input.
    resetHeight();

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    attachments,
    pdfContents,
    documentContents,
    imageContents,
    chatId,
    append,
    handleSubmit,
    setInput,
    setAttachments,
    setPdfContents,
    width,
    status,
  ]);

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  // Calculate total processed content items
  const attachmentsCount = attachments.length;
  const pdfCount = pdfContents.length;
  const docCount = documentContents.length;
  const imgCount = imageContents.length;

  // Add drag and drop related event handlers
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDragging) setIsDragging(true);
    },
    [isDragging],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if the cursor is outside the drop zone
    if (dropZoneRef.current) {
      const rect = dropZoneRef.current.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      if (
        x < rect.left ||
        x >= rect.right ||
        y < rect.top ||
        y >= rect.bottom
      ) {
        setIsDragging(false);
      }
    }
  }, []);

  // Helper function to process dropped files
  const processDroppedFiles = useCallback(
    (files: File[]) => {
      setUploadQueue(files.map((file) => file.name));

      Promise.all(files.map((file) => uploadFile(file)))
        .then((uploadedAttachments) => {
          // Filter out null results (PDFs) and undefined results (errors)
          const successfullyUploadedAttachments = uploadedAttachments.filter(
            (attachment) => attachment !== undefined && attachment !== null,
          );

          if (successfullyUploadedAttachments.length > 0) {
            setAttachments((currentAttachments) => [
              ...currentAttachments,
              ...successfullyUploadedAttachments,
            ]);

            if (successfullyUploadedAttachments.length !== files.length) {
              toast.info(
                `${successfullyUploadedAttachments.length} of ${files.length} files were processed successfully`,
              );
            }
          } else if (uploadedAttachments.some((a) => a === null)) {
            // Some files were processed as special formats (PDF, etc.)
            toast.success('Files processed successfully');
          } else {
            toast.error('Failed to process any of the dropped files');
          }
        })
        .catch((error) => {
          console.error('Error uploading dropped files!', error);
          toast.error('Failed to upload one or more files');
        })
        .finally(() => {
          setUploadQueue([]);
        });
    },
    [setAttachments, setUploadQueue, uploadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (status !== 'ready') {
        toast.error('Please wait for the model to finish its response!');
        return;
      }

      if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) {
        toast.error('No valid files detected');
        return;
      }

      const droppedFiles = Array.from(e.dataTransfer.files);

      // Handle max file size (50MB) and count limits
      const MAX_FILE_SIZE_MB = 50;
      const MAX_FILE_COUNT = 10;
      const BYTES_PER_MB = 1024 * 1024;

      if (droppedFiles.length > MAX_FILE_COUNT) {
        toast.error(
          `Too many files! Please upload a maximum of ${MAX_FILE_COUNT} files at once.`,
        );
        return;
      }

      // Check for file size issues
      const oversizedFiles = droppedFiles.filter(
        (file) => file.size > MAX_FILE_SIZE_MB * BYTES_PER_MB,
      );

      if (oversizedFiles.length > 0) {
        toast.error(
          `${oversizedFiles.length > 1 ? 'Some files are' : 'One file is'} too large. Maximum size is ${MAX_FILE_SIZE_MB}MB per file.`,
          {
            description: oversizedFiles.map((f) => f.name).join(', '),
            duration: 5000,
          },
        );

        // Filter out oversized files
        const validFiles = droppedFiles.filter(
          (file) => file.size <= MAX_FILE_SIZE_MB * BYTES_PER_MB,
        );

        if (validFiles.length === 0) return;

        // Continue with valid files only
        toast.info(`Processing ${validFiles.length} valid file(s)...`);

        try {
          // Try to use the file input method first (most compatible)
          if (fileInputRef.current) {
            try {
              // Create a new DataTransfer object
              const dataTransfer = new DataTransfer();

              // Add all valid files to the DataTransfer object
              validFiles.forEach((file) => dataTransfer.items.add(file));

              // Update the files property of the file input
              fileInputRef.current.files = dataTransfer.files;

              // Manually trigger the onChange handler
              const event = new Event('change', { bubbles: true });
              fileInputRef.current.dispatchEvent(event);
            } catch (error) {
              console.error('Error using DataTransfer API:', error);
              // Fallback to direct processing if DataTransfer API fails
              processDroppedFiles(validFiles);
            }
          } else {
            // Fallback in case fileInputRef is not available
            processDroppedFiles(validFiles);
          }
        } catch (error) {
          console.error('Error handling dropped files:', error);
          toast.error('Failed to process the dropped files');

          // Last resort fallback
          processDroppedFiles(validFiles);
        }
      } else {
        // All files are valid
        try {
          // Try to use the file input method first (most compatible)
          if (fileInputRef.current) {
            try {
              // Create a new DataTransfer object
              const dataTransfer = new DataTransfer();

              // Add all dropped files to the DataTransfer object
              droppedFiles.forEach((file) => dataTransfer.items.add(file));

              // Update the files property of the file input
              fileInputRef.current.files = dataTransfer.files;

              // Manually trigger the onChange handler
              const event = new Event('change', { bubbles: true });
              fileInputRef.current.dispatchEvent(event);
            } catch (error) {
              console.error('Error using DataTransfer API:', error);
              // Fallback to direct processing if DataTransfer API fails
              processDroppedFiles(droppedFiles);
            }
          } else {
            // Fallback in case fileInputRef is not available
            processDroppedFiles(droppedFiles);
          }
        } catch (error) {
          console.error('Error handling dropped files:', error);
          toast.error('Failed to process the dropped files');

          // Last resort fallback
          processDroppedFiles(droppedFiles);
        }
      }
    },
    [status, processDroppedFiles],
  );

  // Ensure keyboard users can access file upload as well
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // If user presses Ctrl+V or Cmd+V, check if there are files in the clipboard data
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      // Let the default paste behavior happen
      // The browser will handle pasting text, but we'll need separate
      // clipboard API implementation for files (not done in this edit)
    }
  }, []);

  // Prevent textarea from capturing drag events
  const handleTextareaDragOver = useCallback(
    (e: React.DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );

  // Handle clipboard paste events for images
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      if (status !== 'ready') {
        // Don't interrupt if the model is responding
        return;
      }

      // Check if any clipboard items are files
      const imageItems = Array.from(clipboardItems).filter(
        (item) => item.type.indexOf('image') !== -1,
      );

      if (imageItems.length === 0) return; // No image items found

      // Prevent default paste behavior for images
      e.preventDefault();

      // Process the pasted images
      const files = imageItems
        .map((item) => item.getAsFile())
        .filter(Boolean) as File[];

      if (files.length === 0) return;

      // Show toast notification
      toast.info(
        `Processing ${files.length} pasted image${files.length > 1 ? 's' : ''}...`,
      );

      // Create unique filenames for pasted images
      const processedFiles = files.map((file) => {
        const timestamp = new Date().getTime();
        const extension = file.name || file.type.split('/')[1] || 'png';
        const newFileName = `pasted-image-${timestamp}.${extension}`;
        return new File([file], newFileName, { type: file.type });
      });

      // Simulate file selection
      setUploadQueue(processedFiles.map((file) => file.name));

      Promise.all(processedFiles.map((file) => uploadFile(file)))
        .then((uploadedAttachments) => {
          // Filter out null and undefined results
          const successfullyUploadedAttachments = uploadedAttachments.filter(
            (attachment) => attachment !== undefined && attachment !== null,
          );

          if (successfullyUploadedAttachments.length > 0) {
            setAttachments((currentAttachments) => [
              ...currentAttachments,
              ...successfullyUploadedAttachments,
            ]);
            toast.success('Image pasted successfully');
          } else if (uploadedAttachments.some((a) => a === null)) {
            // Special formats were processed
            toast.success('Image processed successfully');
          } else {
            toast.error('Failed to process pasted image');
          }
        })
        .catch((error) => {
          console.error('Error uploading pasted image:', error);
          toast.error('Failed to upload pasted image');
        })
        .finally(() => {
          setUploadQueue([]);
        });
    },
    [status, uploadFile, setAttachments],
  );

  return (
    <div
      className={cx(
        'relative w-full flex flex-col gap-4',
        isDragging && 'drag-active',
      )}
      ref={dropZoneRef}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Message input with file drop zone"
    >
      {/* Add style tag for the animations */}
      <style jsx global>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.8; }
          100% { opacity: 0.6; }
        }
        
        .drag-drop-overlay {
          animation: pulse 1.5s infinite;
          transition: all 0.3s ease;
        }
        
        .drag-active {
          transform: scale(1.005);
          transition: transform 0.2s ease;
        }
        
        .drag-icon-bounce {
          animation: bounce 1s infinite alternate;
        }
        
        @keyframes bounce {
          0% { transform: translateY(0); }
          100% { transform: translateY(-10px); }
        }
      `}</style>

      {/* Drag overlay with improved visuals */}
      {isDragging && (
        <div
          className="absolute inset-0 bg-black/10 dark:bg-white/10 backdrop-blur-sm rounded-lg z-50 flex items-center justify-center drag-drop-overlay"
          style={{
            border: '3px dashed rgba(128, 128, 128, 0.5)',
          }}
          aria-live="polite"
          role="status"
        >
          <div className="bg-background/90 dark:bg-background/80 rounded-lg p-6 shadow-lg flex flex-col items-center">
            <div className="drag-icon-bounce">
              <PaperclipIcon size={36} className="mx-auto mb-3 text-primary" />
            </div>
            <p className="text-base font-medium">Drop files to upload</p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports images, documents, PDFs, and more
            </p>
          </div>
        </div>
      )}

      {/* File upload information for screen readers */}
      <div className="sr-only" aria-live="polite">
        {isDragging
          ? 'Drop files to upload them'
          : 'You can drag and drop files into this area to upload them'}
      </div>

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
        pdfContents.length === 0 &&
        documentContents.length === 0 &&
        imageContents.length === 0 && (
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
        documentContents.length > 0 ||
        imageContents.length > 0 ||
        uploadQueue.length > 0) && (
        <div
          data-testid="attachments-preview"
          className="flex flex-row gap-2 overflow-x-scroll items-end p-2"
        >
          {/* Total files counter when there are many */}
          {attachments.length +
            pdfContents.length +
            documentContents.length +
            imageContents.length >
            5 && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full shadow-sm">
              {attachments.length +
                pdfContents.length +
                documentContents.length +
                imageContents.length}{' '}
              files
            </div>
          )}

          {attachments.map((attachment) => (
            <PreviewAttachment
              key={attachment.url}
              attachment={attachment}
              onRemove={() => {
                setAttachments((currentAttachments) =>
                  currentAttachments.filter((a) => a.url !== attachment.url),
                );
                // Also remove any processed image content for this URL
                setImageContents((current) =>
                  current.filter((img) => img.url !== attachment.url),
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
                  className="size-8 text-red-500"
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

          {documentContents.map((doc, index) => (
            <div
              key={`doc-${doc.name}-${index}`}
              className="flex flex-col gap-2 relative"
            >
              <div className="w-20 h-16 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center">
                <svg
                  className={`size-8 ${doc.type === 'docx' ? 'text-blue-500' : 'text-green-500'}`}
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
                  {doc.type === 'docx' ? (
                    <>
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <line x1="10" y1="9" x2="8" y2="9" />
                    </>
                  ) : (
                    <>
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <line x1="7" y1="3" x2="7" y2="21" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="3" y1="15" x2="21" y2="15" />
                    </>
                  )}
                </svg>

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-1 -right-1 size-5 rounded-full bg-background border shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => {
                    setDocumentContents((current) =>
                      current.filter((_, i) => i !== index),
                    );
                  }}
                >
                  <XIcon size={12} />
                </Button>
              </div>
              <div className="text-xs text-zinc-500 max-w-16 truncate">
                {doc.name}
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
        placeholder="Send a message... or drop files here"
        value={input}
        onChange={handleInput}
        onPaste={handlePaste}
        onDragOver={handleTextareaDragOver}
        className={cx(
          'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base',
          'backdrop-filter backdrop-blur-[16px]',
          'border border-white/30 dark:border-zinc-700/30',
          'pb-10',
          'input-tint shadow-enhanced',
          isDragging && 'pointer-events-none',
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

      <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start gap-1 items-center z-10">
        <AttachmentsButton fileInputRef={fileInputRef} status={status} />

        {!isReadonly && session && selectedProviderId && (
          <ProviderSelector
            session={session}
            selectedProviderId={selectedProviderId}
            className="h-[30px] text-xs"
          />
        )}

        {!isReadonly && session && selectedModelId && (
          <ModelSelector
            session={session}
            selectedModelId={selectedModelId}
            className="h-[30px] text-xs"
          />
        )}

        {!isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
            className="h-[30px] text-xs"
          />
        )}
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
            docCount={docCount}
            imgCount={imgCount}
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
    if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;
    if (prevProps.selectedProviderId !== nextProps.selectedProviderId)
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
  docCount,
  imgCount,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
  attachmentsCount: number;
  pdfCount: number;
  docCount: number;
  imgCount: number;
}) {
  const nothingToSend =
    input.trim().length === 0 &&
    attachmentsCount === 0 &&
    pdfCount === 0 &&
    docCount === 0 &&
    imgCount === 0;
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
  if (prevProps.docCount !== nextProps.docCount) return false;
  if (prevProps.imgCount !== nextProps.imgCount) return false;
  return true;
});
