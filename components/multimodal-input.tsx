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
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import {
  ArrowUp,
  Paperclip,
  X,
  Square,
  Calendar,
  FileText,
  BarChart,
  Target,
  Mountain,
  Users,
  Search,
  TrendingUp,
  HelpCircle,
  List,
  Clock,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown as ArrowDownLucide } from 'lucide-react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { VisibilityType } from './visibility-selector';
import { VisibilitySelector } from './visibility-selector';
import type { Session } from 'next-auth';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import {
  NexusResearchSelector,
  type ResearchMode,
} from './nexus-research-selector';

// Interface for @ mention resources - Enhanced version
interface MentionResource {
  id: string;
  name: string;
  type:
    | 'calendar'
    | 'document'
    | 'scorecard'
    | 'vto'
    | 'rocks'
    | 'people'
    | 'event'
    | 'meeting'
    | 'availability'
    | 'team'
    | 'search'
    | 'analyze'
    | 'help'
    | 'agenda';
  category?:
    | 'resource'
    | 'calendar'
    | 'person'
    | 'tool'
    | 'command'
    | 'template';
  description: string;
  icon: React.ReactNode;
  color?: string;
  aliases?: string[];
  shortcut?: string;
  preview?: string;
  isDynamic?: boolean;
}

// Enhanced mention resources with categories
const DEFAULT_MENTION_RESOURCES: MentionResource[] = [
  // Calendar category
  {
    id: 'calendar',
    name: 'Calendar',
    type: 'calendar',
    category: 'calendar',
    description: 'Access your calendar events and schedule',
    icon: <Calendar className="size-4" />,
    color: 'blue',
    aliases: ['cal', 'schedule', 'events'],
    shortcut: '@cal',
  },
  {
    id: 'availability',
    name: 'Find Available Time',
    type: 'availability',
    category: 'calendar',
    description: 'Find free time slots in your calendar',
    icon: <Clock className="size-4" />,
    color: 'green',
    aliases: ['free', 'available', 'slots'],
    shortcut: '@free',
  },
  // Resource category
  {
    id: 'documents',
    name: 'Documents',
    type: 'document',
    category: 'resource',
    description: 'Access your documents and files',
    icon: <FileText className="size-4" />,
    color: 'purple',
    aliases: ['docs', 'files'],
    shortcut: '@doc',
    isDynamic: true,
  },
  {
    id: 'scorecard',
    name: 'Scorecard',
    type: 'scorecard',
    category: 'resource',
    description: 'View your EOS Scorecard metrics',
    icon: <BarChart className="size-4" />,
    color: 'orange',
    aliases: ['metrics', 'kpis'],
    shortcut: '@score',
  },
  {
    id: 'vto',
    name: 'Vision/Traction Organizer',
    type: 'vto',
    category: 'resource',
    description: 'Access your V/TO and strategic vision',
    icon: <Target className="size-4" />,
    color: 'indigo',
    aliases: ['vision', 'traction', 'strategy'],
    shortcut: '@vto',
  },
  {
    id: 'rocks',
    name: 'Rocks',
    type: 'rocks',
    category: 'resource',
    description: 'Check your quarterly rocks and priorities',
    icon: <Mountain className="size-4" />,
    color: 'teal',
    aliases: ['priorities', 'quarterly'],
  },
  {
    id: 'people',
    name: 'People Analyzer',
    type: 'people',
    category: 'resource',
    description: 'Access your people analyzer data',
    icon: <Users className="size-4" />,
    color: 'pink',
  },
  // People category
  {
    id: 'team',
    name: 'Team Members',
    type: 'team',
    category: 'person',
    description: 'Mention team members',
    icon: <Users className="size-4" />,
    color: 'teal',
    aliases: ['people', 'members'],
    shortcut: '@team',
    isDynamic: true,
  },
  // Tool category
  {
    id: 'search',
    name: 'Search',
    type: 'search',
    category: 'tool',
    description: 'Search through all your content',
    icon: <Search className="size-4" />,
    color: 'gray',
    aliases: ['find', 'lookup'],
    shortcut: '@search',
  },
  {
    id: 'analyze',
    name: 'Analyze',
    type: 'analyze',
    category: 'tool',
    description: 'Analyze data and provide insights',
    icon: <TrendingUp className="size-4" />,
    color: 'red',
    aliases: ['analytics', 'insights'],
    shortcut: '@analyze',
  },
  // Command category
  {
    id: 'help',
    name: 'Help',
    type: 'help',
    category: 'command',
    description: 'Get help with using the system',
    icon: <HelpCircle className="size-4" />,
    color: 'blue',
    aliases: ['?', 'guide'],
    shortcut: '@help',
  },
  // Template category
  {
    id: 'agenda',
    name: 'Meeting Agenda',
    type: 'agenda',
    category: 'template',
    description: 'Create a meeting agenda template',
    icon: <List className="size-4" />,
    color: 'purple',
    aliases: ['meeting'],
    shortcut: '@agenda',
  },
];

// Interface for PDFs and other file-based content
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

// Add a utility function to generate UUIDs
function generateUUID(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

// Add this new interface for selected mentions
interface SelectedMention {
  id: string;
  type: string;
  name: string;
  icon?: React.ReactNode;
  category?: string;
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
  selectedModelId,
  selectedProviderId,
  session,
  isReadonly,
  selectedResearchMode,
  onResearchModeChange,
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
  selectedResearchMode?: ResearchMode;
  onResearchModeChange?: (mode: ResearchMode) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  // @ Mention feature state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionResources] = useState<MentionResource[]>(
    DEFAULT_MENTION_RESOURCES,
  );
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionSelectionIndex, setMentionSelectionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const mentionsRef = useRef<HTMLDivElement>(null);

  // Add state for selected mentions - store as separate array rather than in text
  const [selectedMentions, setSelectedMentions] = useState<SelectedMention[]>(
    [],
  );

  // Add regex to detect mentions in the input
  const mentionRegex = /@(\w+):([^\s]+)/g;

  // Calculate absolute position for portal-rendered dropdown
  const calculateCursorPosition = useCallback(() => {
    if (!textareaRef.current || !inputWrapperRef.current) return null;

    // Get current cursor position for horizontal alignment
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = input.substring(0, cursorPosition);
    const lineBeforeCursor = textBeforeCursor.split('\n').pop() || '';

    // Calculate an approximate horizontal position based on cursor
    const charWidth = 8.5; // Approximate character width in pixels
    const padding = 12; // Approximate padding

    // Get absolute position of the input wrapper on the page
    const inputRect = inputWrapperRef.current.getBoundingClientRect();

    // Calculate position relative to viewport
    const xPos = Math.min(
      inputRect.left + padding + lineBeforeCursor.length * charWidth,
      window.innerWidth - 320 - 20, // Account for dropdown width and margin
    );

    // Position above the input with some spacing
    const yPos = inputRect.top - 8; // Position above input with 8px gap

    return { top: yPos, left: xPos };
  }, [input]);

  // Close mentions dropdown when clicking outside and handle scroll
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mentionsRef.current &&
        !mentionsRef.current.contains(event.target as Node)
      ) {
        setShowMentions(false);
      }
    };

    const handleScroll = () => {
      if (showMentions) {
        // Recalculate position on scroll
        setCursorPosition(calculateCursorPosition());
      }
    };

    const handleResize = () => {
      if (showMentions) {
        // Recalculate position on resize
        setCursorPosition(calculateCursorPosition());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [showMentions, calculateCursorPosition]);

  // Enhanced filtering with alias support and scoring
  const filteredMentionResources = mentionResources
    .map((resource) => {
      const query = mentionFilter.toLowerCase();
      let score = 0;
      let matchType = '';

      // Check shortcut match (highest priority)
      if (
        resource.shortcut &&
        resource.shortcut.toLowerCase() === `@${query}`
      ) {
        score = 1.0;
        matchType = 'shortcut';
      }
      // Check name match
      else if (resource.name.toLowerCase().includes(query)) {
        score = 0.8;
        matchType = 'name';
      }
      // Check alias match
      else if (
        resource.aliases?.some((alias) => alias.toLowerCase().includes(query))
      ) {
        score = 0.7;
        matchType = 'alias';
      }
      // Check type match
      else if (resource.type.toLowerCase().includes(query)) {
        score = 0.6;
        matchType = 'type';
      }
      // Check description match
      else if (resource.description.toLowerCase().includes(query)) {
        score = 0.5;
        matchType = 'description';
      }

      return { resource, score, matchType };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.resource);

  // Handle @ mention detection
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setInput(value);

      // Get cursor position
      const cursorPosition = event.target.selectionStart;

      // Check if we're in a potential @ mention context
      const textUpToCursor = value.substring(0, cursorPosition);
      const mentionMatch = textUpToCursor.match(/@(\w*)$/);

      if (mentionMatch) {
        const matchText = mentionMatch[1];
        setMentionFilter(matchText);
        setMentionQuery(matchText);
        setShowMentions(true);
        setMentionSelectionIndex(0);

        // Calculate position for the mention dropdown
        setCursorPosition(calculateCursorPosition());
      } else {
        setShowMentions(false);
      }

      adjustHeight();
    },
    [setInput, calculateCursorPosition],
  );

  // Handle selecting a mention - enhanced with better UX feedback
  const handleSelectMention = useCallback(
    (resource: MentionResource) => {
      if (!textareaRef.current) return;

      const cursorPosition = textareaRef.current.selectionStart;

      // Check if this mention type is already selected
      const isDuplicate = selectedMentions.some(
        (mention) => mention.type === resource.type,
      );

      if (isDuplicate) {
        // Show brief feedback for duplicate
        const existingMention = selectedMentions.find(
          (mention) => mention.type === resource.type,
        );
        console.log(`${existingMention?.name} is already selected`);
        setShowMentions(false);
        textareaRef.current.focus();
        return;
      }

      // Get text before and after the @ symbol
      const textBeforeMention = input
        .substring(0, cursorPosition)
        .replace(/@\w*$/, '');
      const textAfterMention = input.substring(cursorPosition);

      // Add to selected mentions with the icon and category
      const newMention = {
        id: Math.random().toString(36).substring(2, 15),
        type: resource.type,
        name: resource.name,
        icon: resource.icon,
        category: resource.category,
      };

      setSelectedMentions((prev) => [...prev, newMention]);

      // Remove the @ mention text entirely
      const newText = textBeforeMention + textAfterMention;
      setInput(newText);

      // Close the dropdown
      setShowMentions(false);

      // Set focus back to textarea with smooth transition
      textareaRef.current.focus();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textBeforeMention.length;
          textareaRef.current.selectionEnd = textBeforeMention.length;
        }
      }, 0);
    },
    [input, setInput, selectedMentions],
  );

  // Handle removing a selected mention
  const handleRemoveMention = useCallback((id: string) => {
    setSelectedMentions((prev) => prev.filter((mention) => mention.id !== id));
  }, []);

  // Handle navigation within the mentions dropdown using keyboard
  const handleMentionKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showMentions) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setMentionSelectionIndex((prev) =>
            prev < filteredMentionResources.length - 1 ? prev + 1 : prev,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setMentionSelectionIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredMentionResources[mentionSelectionIndex]) {
            handleSelectMention(
              filteredMentionResources[mentionSelectionIndex],
            );
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowMentions(false);
          break;
        case 'Tab':
          e.preventDefault();
          if (filteredMentionResources[mentionSelectionIndex]) {
            handleSelectMention(
              filteredMentionResources[mentionSelectionIndex],
            );
          }
          break;
      }
    },
    [
      filteredMentionResources,
      mentionSelectionIndex,
      handleSelectMention,
      showMentions,
    ],
  );

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

    // Enhanced mention processing - create structured mention data
    let mentionContext = '';
    let mentionMetadata: any[] = [];

    if (selectedMentions.length > 0) {
      // Create structured mention data for backend processing
      mentionMetadata = selectedMentions.map((mention) => ({
        type: mention.type,
        name: mention.name,
        id: mention.id,
        category: mention.category,
        // Add any additional context or metadata
        timestamp: new Date().toISOString(),
      }));

      // Create intelligent mention context based on types
      const mentionsByCategory = selectedMentions.reduce(
        (acc, mention) => {
          const category = mention.category || 'other';
          if (!acc[category]) acc[category] = [];
          acc[category].push(mention);
          return acc;
        },
        {} as Record<string, typeof selectedMentions>,
      );

      // Build contextual mention string
      const contextParts: string[] = [];

      // Calendar mentions
      if (mentionsByCategory.calendar) {
        const calendarMentions = mentionsByCategory.calendar;
        if (calendarMentions.some((m) => m.type === 'availability')) {
          contextParts.push('[User wants to find available time slots]');
        }
        if (calendarMentions.some((m) => m.type === 'calendar')) {
          contextParts.push('[User is referencing their calendar]');
        }
      }

      // Resource mentions
      if (mentionsByCategory.resource) {
        const resourceTypes = mentionsByCategory.resource
          .map((m) => m.type)
          .join(', ');
        contextParts.push(`[User is asking about: ${resourceTypes}]`);
      }

      // Tool mentions
      if (mentionsByCategory.tool) {
        const tools = mentionsByCategory.tool;
        if (tools.some((m) => m.type === 'analyze')) {
          contextParts.push('[User wants data analysis and insights]');
        }
        if (tools.some((m) => m.type === 'search')) {
          contextParts.push('[User wants to search for information]');
        }
      }

      // Add contextual hints
      if (contextParts.length > 0) {
        mentionContext = `\n\n${contextParts.join('\n')}`;
      }

      // Add mention markers for backward compatibility
      const mentionTags = selectedMentions
        .map((mention) => `@${mention.type}:${mention.name}`)
        .join(' ');

      // Only add mention tags if there's no other content
      if (!finalInputContent.trim() && mentionTags) {
        finalInputContent = `Please help me with: ${mentionTags}`;
      } else if (mentionTags) {
        // Add context and tags
        finalInputContent = `${finalInputContent}${mentionContext}\n\n[Mentions: ${mentionTags}]`;
      }
    }

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

    try {
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
        if (
          input.trim().length > 0 ||
          attachments.length > 0 ||
          selectedMentions.length > 0
        ) {
          // If we have selected mentions but no text content, create a message with just the mentions
          if (input.trim().length === 0 && selectedMentions.length > 0) {
            // Create a message with just the mentions for the AI
            const mentionContent = selectedMentions
              .map((mention) => `@${mention.type}:${mention.name}`)
              .join(' ');

            append(
              {
                role: 'user',
                content: mentionContent,
              },
              {
                experimental_attachments:
                  attachments.length > 0 ? attachments : undefined,
              },
            );
          } else {
            // If we have text, use the finalInputContent with mentions appended
            append(
              {
                role: 'user',
                content: finalInputContent,
              },
              {
                experimental_attachments:
                  attachments.length > 0 ? attachments : undefined,
              },
            );
          }
          setInput('');
        } else {
          // Nothing to send
          return;
        }
      }

      // Common cleanup operations
      setAttachments([]); // Clear regular attachments
      setPdfContents([]); // Clear PDF contents
      setDocumentContents([]); // Clear document contents
      setImageContents([]); // Clear image contents
      setSelectedMentions([]); // Clear mentions
      resetHeight();

      if (width && width > 768) {
        textareaRef.current?.focus();
      }
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    }
  }, [
    input,
    attachments,
    pdfContents,
    documentContents,
    imageContents,
    selectedMentions,
    chatId,
    append,
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
        
        .mention-dropdown {
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .mention-item {
          transition: background-color 0.1s ease;
        }
        
        .mention-item:hover, .mention-item.selected {
          background-color: rgba(59, 130, 246, 0.1);
        }
      `}</style>

      {/* Enhanced @ Mention dropdown - rendered via Portal to escape stacking context */}
      {showMentions &&
        filteredMentionResources.length > 0 &&
        cursorPosition &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            ref={mentionsRef}
            className="mention-dropdown bg-white dark:bg-zinc-900 shadow-xl rounded-lg border border-zinc-200 dark:border-zinc-700 w-96 max-h-96 overflow-y-auto"
            style={{
              position: 'fixed', // Fixed positioning relative to viewport
              top: `${cursorPosition.top}px`,
              left: `${cursorPosition.left}px`,
              transform: 'translateY(-100%)', // Move up by its own height
              boxShadow:
                '0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)',
              zIndex: 999999, // Very high z-index since it's in document body
            }}
          >
            <div className="p-3 text-sm font-medium border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  Searching:{' '}
                  {mentionQuery ? (
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      &quot;{mentionQuery}&quot;
                    </span>
                  ) : (
                    'All Resources'
                  )}
                </div>
                <Badge variant="secondary" className="text-xs">
                  {filteredMentionResources.length} results
                </Badge>
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Type to filter • Use shortcuts like @cal, @doc, @free • Click or
                press Enter to select
              </div>
            </div>

            {/* Group resources by category */}
            {['calendar', 'resource', 'person', 'tool', 'command', 'template']
              .filter((category) =>
                filteredMentionResources.some((r) => r.category === category),
              )
              .map((category) => {
                const categoryResources = filteredMentionResources.filter(
                  (r) => r.category === category,
                );
                const categoryColors = {
                  calendar: 'blue',
                  resource: 'purple',
                  person: 'teal',
                  tool: 'orange',
                  command: 'gray',
                  template: 'indigo',
                };
                const color =
                  categoryColors[category as keyof typeof categoryColors] ||
                  'gray';

                return (
                  <div key={category}>
                    <div
                      className={`px-3 py-1.5 text-xs font-medium text-${color}-600 dark:text-${color}-400 bg-${color}-50 dark:bg-${color}-900/20`}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </div>
                    {categoryResources.map((resource, index) => {
                      const globalIndex =
                        filteredMentionResources.indexOf(resource);
                      return (
                        <div
                          key={resource.id}
                          className={`mention-item p-3 cursor-pointer flex items-start gap-3 hover:bg-${color}-50 dark:hover:bg-${color}-900/20 transition-colors ${
                            globalIndex === mentionSelectionIndex
                              ? `selected bg-${color}-50 dark:bg-${color}-900/20 border-l-2 border-${color}-500`
                              : 'border-l-2 border-transparent'
                          }`}
                          onClick={() => handleSelectMention(resource)}
                          onMouseEnter={() =>
                            setMentionSelectionIndex(globalIndex)
                          }
                        >
                          <div
                            className={cn(
                              'p-2 rounded-md',
                              `bg-${resource.color || color}-100 dark:bg-${resource.color || color}-900/30`,
                            )}
                          >
                            <div
                              className={cn(
                                'size-4',
                                `text-${resource.color || color}-600 dark:text-${resource.color || color}-400`,
                              )}
                            >
                              {resource.icon}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {resource.name}
                              </span>
                              {resource.shortcut && (
                                <code className="text-xs px-1 py-0.5 rounded bg-muted">
                                  {resource.shortcut}
                                </code>
                              )}
                              {resource.isDynamic && (
                                <Sparkles className="h-3 w-3 text-yellow-500" />
                              )}
                            </div>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {resource.description}
                            </span>
                            {resource.preview && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {resource.preview}
                              </p>
                            )}
                          </div>
                          {globalIndex === mentionSelectionIndex && (
                            <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

            {/* No grouped resources fallback */}
            {![
              'calendar',
              'resource',
              'person',
              'tool',
              'command',
              'template',
            ].some((category) =>
              filteredMentionResources.some((r) => r.category === category),
            ) &&
              filteredMentionResources.map((resource, index) => (
                <div
                  key={resource.id}
                  className={`mention-item p-3 cursor-pointer flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                    index === mentionSelectionIndex
                      ? 'selected bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                      : 'border-l-2 border-transparent'
                  }`}
                  onClick={() => handleSelectMention(resource)}
                  onMouseEnter={() => setMentionSelectionIndex(index)}
                >
                  <div className="text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 p-2 rounded-md">
                    {resource.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{resource.name}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {resource.description}
                    </span>
                  </div>
                </div>
              ))}

            <div className="p-2 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-b-lg">
              <div className="flex items-center justify-between">
                <div>
                  <kbd className="px-2 py-1 bg-white dark:bg-zinc-700 rounded border border-zinc-300 dark:border-zinc-600 mr-1">
                    ↑↓
                  </kbd>
                  Navigate
                  <kbd className="px-2 py-1 bg-white dark:bg-zinc-700 rounded border border-zinc-300 dark:border-zinc-600 mx-1">
                    Enter
                  </kbd>
                  Select
                  <kbd className="px-2 py-1 bg-white dark:bg-zinc-700 rounded border border-zinc-300 dark:border-zinc-600 mx-1">
                    Esc
                  </kbd>
                  Close
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSelectMention({
                      id: 'help',
                      name: 'Help',
                      type: 'help',
                      description: 'Learn more about mentions',
                      icon: <HelpCircle className="size-4" />,
                    });
                  }}
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  Help
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

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
              <Paperclip className="mx-auto mb-3 text-primary size-9" />
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
              <ArrowDownLucide className="size-4" />
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
                  <X className="size-3" />
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
                  <X className="size-3" />
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

      <div className="relative" ref={inputWrapperRef}>
        {/* Show selected mentions above the input with helpful context */}
        {selectedMentions.length > 0 && (
          <div className="mb-3 pt-1">
            <div className="flex items-center gap-2 mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              <Sparkles className="size-3" />
              <span>
                Selected resources - these will be included in your message:
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedMentions.map((mention) => (
                <div
                  key={mention.id}
                  className="group inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-200 text-sm font-medium border border-blue-200 dark:border-blue-800/70 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-300 rounded-md p-1.5">
                      {mention.icon}
                    </span>
                    <span className="font-medium">{mention.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMention(mention.id)}
                    className="ml-1 text-blue-400 dark:text-blue-500 hover:text-red-500 dark:hover:text-red-400 focus:outline-none transition-colors p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 group-hover:opacity-100 opacity-60"
                    aria-label={`Remove ${mention.name} mention`}
                    title="Remove this mention"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Textarea
          data-testid="multimodal-input"
          ref={textareaRef}
          placeholder={
            selectedMentions.length > 0
              ? 'Continue your message...'
              : 'Send a message... (Type @ to mention calendar, documents, or other resources)'
          }
          value={input}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onDragOver={handleTextareaDragOver}
          onKeyDown={(event) => {
            // Handle @ mention dropdown navigation
            if (showMentions) {
              handleMentionKeyDown(event);
              return;
            }

            // Normal enter key handling
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();

              if (status !== 'ready') {
                toast.error(
                  'Please wait for the model to finish its response!',
                );
              } else {
                // Submit the form manually
                submitForm();
              }
            }
          }}
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
        />

        <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start gap-1 items-center z-10">
          <AttachmentsButton fileInputRef={fileInputRef} status={status} />

          {!isReadonly && (
            <VisibilitySelector
              chatId={chatId}
              selectedVisibilityType={selectedVisibilityType}
              className="h-[30px] text-xs"
            />
          )}

          {!isReadonly &&
            selectedResearchMode !== undefined &&
            onResearchModeChange && (
              <NexusResearchSelector
                chatId={chatId}
                selectedResearchMode={selectedResearchMode}
                onResearchModeChange={onResearchModeChange}
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
              handleSubmit={handleSubmit}
              attachments={attachments}
            />
          )}
        </div>
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
    if (prevProps.selectedResearchMode !== nextProps.selectedResearchMode)
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
      <Paperclip className="size-3.5" />
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
      <Square className="size-4" />
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
  handleSubmit,
  attachments,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
  attachmentsCount: number;
  pdfCount: number;
  docCount: number;
  imgCount: number;
  handleSubmit: any;
  attachments: Array<Attachment>;
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

        if (!isDisabled) {
          // For debugging only - can be removed if not needed
          console.log(
            `Sending message: ${input.substring(0, 30)}${input.length > 30 ? '...' : ''}`,
          );

          // Always use direct handleSubmit which is more reliable
          handleSubmit(event, {
            experimental_attachments:
              attachments.length > 0 ? attachments : undefined,
          });
        }
      }}
      disabled={isDisabled}
    >
      <ArrowUp className="size-4" />
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
  // We intentionally don't compare handleSubmit or attachments since they don't affect rendering
  return true;
});
