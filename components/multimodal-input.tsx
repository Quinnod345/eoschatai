'use client';

import type { UIMessage } from 'ai';
import type {
  Attachment,
  ChatHelpers,
  ChatStatus,
  SetInputFunction,
  AppendFunction,
  HandleSubmitFunction,
} from './multimodal-input/types';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from '@/lib/toast-system';
import { showEdgeCaseToast } from '@/lib/ui/edge-case-messages';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';
import { ErrorBoundary } from './error-boundary';

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
  Mic,
  Telescope,
  Check,
  // Composer icons
  Code,
  Image as ImageIcon,
  Table,
  PieChart,
  FileStack,
} from 'lucide-react';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import {
  LoaderIcon,
  XIcon,
  PlusIcon,
  GlobeIcon,
  LockIcon,
  UserIcon,
} from './icons';
import equal from 'fast-deep-equal';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { springSnappy } from '@/lib/motion/presets';
import { ArrowDown as ArrowDownLucide } from 'lucide-react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { UsageChip } from '@/components/multimodal-input/usage-chip';
import { UsageLimitIndicator } from './usage-limit-indicator';
import { toast as sonnerToast } from 'sonner';
import type { VisibilityType } from './visibility-selector';
import type { Session } from 'next-auth';
import VoiceFAB from './voice-fab';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import type { ResearchMode } from './nexus-research-selector';
import { createEmbeddedContentString } from '@/types/upload-content';
import type { Persona, PersonaProfile } from '@/lib/db/schema';
import { PersonaSubmenu } from '@/components/persona-submenu';
import Image from 'next/image';
import { getProfileTheme } from '@/lib/constants/profile-themes';
import { useDebounce } from '@/hooks/use-debounce';
import { useUserSettings } from '@/components/user-settings-provider';
import { useAccountStore } from '@/lib/stores/account-store';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import type { UpgradeFeature } from '@/types/upgrade';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { useChatVisibility } from '@/hooks/use-chat-visibility';

function withNewAttachmentId(a: Attachment & { id?: string }): Attachment {
  return { ...a, id: a.id ?? crypto.randomUUID() };
}

// Interface for @ mention resources - Enhanced version
interface MentionResource {
  id: string;
  name: string;
  type:
    | 'calendar'
    | 'document'
    | 'recording'
    | 'scorecard'
    | 'vto'
    | 'accountability'
    | 'rocks'
    | 'people'
    | 'event'
    | 'meeting'
    | 'availability'
    | 'team'
    | 'search'
    | 'analyze'
    | 'help'
    | 'agenda'
    // Composer types
    | 'composer'
    | 'text-composer'
    | 'code-composer'
    | 'sheet-composer'
    | 'chart-composer'
    | 'image-composer'
    | 'vto-composer'
    | 'accountability-composer';
  category?:
    | 'resource'
    | 'calendar'
    | 'person'
    | 'tool'
    | 'command'
    | 'template'
    | 'composer';
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
    id: 'recordings',
    name: 'Vocal Recordings',
    type: 'recording',
    category: 'resource',
    description: 'Use voice recordings and transcripts as context',
    icon: <Mic className="size-4" />,
    color: 'pink',
    aliases: ['audio', 'voice', 'transcript'],
    shortcut: '@rec',
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
    id: 'accountability',
    name: 'Accountability Chart',
    type: 'accountability',
    category: 'resource',
    description: 'Build or view your EOS Accountability Chart',
    icon: <Users className="size-4" />,
    color: 'indigo',
    aliases: ['ac', 'orgchart', 'organization', 'roles', 'seats'],
    shortcut: '@ac',
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
  // Composer category - AI-generated documents
  {
    id: 'composers',
    name: 'All Composers',
    type: 'composer',
    category: 'composer',
    description: 'Access all your AI-generated documents',
    icon: <FileStack className="size-4" />,
    color: 'blue',
    aliases: ['composer', 'generated', 'ai-docs'],
    shortcut: '@composer',
    isDynamic: true,
  },
  {
    id: 'text-composers',
    name: 'Text Documents',
    type: 'text-composer',
    category: 'composer',
    description: 'Text and markdown documents',
    icon: <FileText className="size-4" />,
    color: 'blue',
    aliases: ['text', 'markdown', 'notes'],
    shortcut: '@doc',
    isDynamic: true,
  },
  {
    id: 'code-composers',
    name: 'Code Documents',
    type: 'code-composer',
    category: 'composer',
    description: 'Code snippets and scripts',
    icon: <Code className="size-4" />,
    color: 'emerald',
    aliases: ['code', 'script', 'programming'],
    shortcut: '@code',
    isDynamic: true,
  },
  {
    id: 'sheet-composers',
    name: 'Spreadsheets',
    type: 'sheet-composer',
    category: 'composer',
    description: 'Spreadsheet and data tables',
    icon: <Table className="size-4" />,
    color: 'violet',
    aliases: ['spreadsheet', 'table', 'data', 'csv', 'excel'],
    shortcut: '@sheet',
    isDynamic: true,
  },
  {
    id: 'chart-composers',
    name: 'Charts',
    type: 'chart-composer',
    category: 'composer',
    description: 'Data visualizations and charts',
    icon: <PieChart className="size-4" />,
    color: 'pink',
    aliases: ['chart', 'graph', 'visualization', 'viz'],
    shortcut: '@chart',
    isDynamic: true,
  },
  {
    id: 'image-composers',
    name: 'Images',
    type: 'image-composer',
    category: 'composer',
    description: 'AI-generated images',
    icon: <ImageIcon className="size-4" />,
    color: 'amber',
    aliases: ['image', 'picture', 'photo', 'dalle'],
    shortcut: '@image',
    isDynamic: true,
  },
  {
    id: 'vto-composers',
    name: 'V/TO Documents',
    type: 'vto-composer',
    category: 'composer',
    description: 'Vision/Traction Organizer documents',
    icon: <Target className="size-4" />,
    color: 'red',
    aliases: ['vto-doc', 'vision-doc'],
    shortcut: '@vto-doc',
    isDynamic: true,
  },
  {
    id: 'accountability-composers',
    name: 'Accountability Charts',
    type: 'accountability-composer',
    category: 'composer',
    description: 'Organizational accountability charts',
    icon: <Users className="size-4" />,
    color: 'cyan',
    aliases: ['ac-doc', 'org-chart-doc'],
    shortcut: '@ac-doc',
    isDynamic: true,
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
  type: 'docx' | 'xlsx' | 'pptx';
  pageCount?: number;
}

interface ImageContent {
  name: string;
  text: string; // OCR text
  description: string; // AI-generated description
  type: string; // image mime type
  url: string; // The URL for display
  status: 'uploading' | 'analyzing' | 'ready' | 'error'; // Processing status
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
  selectedPersonaId,
  selectedProfileId,
  session,
  isReadonly,
  selectedResearchMode,
  onResearchModeChange,
  isChanging,
  onPersonaSelect,
  onCreatePersona,
  onEditPersona,
  onProfileSelect,
  onCreateProfile,
  onEditProfile,
}: {
  chatId: string;
  input: string;
  setInput: SetInputFunction;
  status: ChatStatus;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: ChatHelpers['setMessages'];
  append: AppendFunction;
  handleSubmit: HandleSubmitFunction;
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId?: string;
  selectedProviderId?: string;
  selectedPersonaId?: string;
  selectedProfileId?: string;
  session?: Session;
  isReadonly?: boolean;
  selectedResearchMode?: ResearchMode;
  onResearchModeChange?: (mode: ResearchMode) => void;
  isChanging?: boolean;
  onPersonaSelect?: (personaId: string | null) => void;
  onCreatePersona?: () => void;
  onEditPersona?: (persona: Persona) => void;
  onProfileSelect?: (profileId: string | null) => void;
  onCreateProfile?: () => void;
  onEditProfile?: (profile: PersonaProfile) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const prefersReducedMotion = useReducedMotion();
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

  // Predictive suggestions
  const [predictions, setPredictions] = useState<string[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);

  // Plus dropdown state (for persona submenu coordination)
  const [isPlusDropdownOpen, setIsPlusDropdownOpen] = useState(false);

  // Selected persona details for indicator
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<PersonaProfile | null>(
    null,
  );

  // Fetch selected persona details when selectedPersonaId changes
  useEffect(() => {
    if (!selectedPersonaId) {
      setSelectedPersona(null);
      return;
    }

    // Fetch persona details
    const fetchPersona = async () => {
      try {
        const response = await fetch('/api/personas');
        if (response.ok) {
          const data = await response.json();
          const allPersonas = [
            ...(data.systemPersonas || []),
            ...(data.userPersonas || []),
            ...(data.sharedPersonas || []),
          ];
          const persona = allPersonas.find(
            (p: Persona) => p.id === selectedPersonaId,
          );
          setSelectedPersona(persona || null);
        }
      } catch (error) {
        console.error('Error fetching persona:', error);
      }
    };

    fetchPersona();
  }, [selectedPersonaId]);

  // Fetch selected profile details when selectedProfileId changes
  useEffect(() => {
    if (!selectedProfileId || !selectedPersonaId) {
      setSelectedProfile(null);
      return;
    }

    // Fetch profile details
    const fetchProfile = async () => {
      try {
        const response = await fetch(
          `/api/personas/${selectedPersonaId}/profiles`,
        );
        if (response.ok) {
          const profiles = await response.json();
          const profile = profiles.find(
            (p: PersonaProfile) => p.id === selectedProfileId,
          );
          setSelectedProfile(profile || null);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [selectedProfileId, selectedPersonaId]);
  const { settings: userSettings } = useUserSettings();
  const autocompleteEnabled = userSettings.autocompleteEnabled ?? true;
  const debouncedInput = useDebounce(input, 120);
  const isNewChat = messages.length === 0;

  // Dynamic specific-item suggestions (composer documents, recordings, etc.)
  const [dynamicMentionResources, setDynamicMentionResources] = useState<
    MentionResource[]
  >([]);

  // No longer need to fetch settings - using context

  const entitlements = useAccountStore((state) => state.entitlements);
  const usageCounters = useAccountStore((state) => state.usageCounters);
  const user = useAccountStore((state) => state.user);
  const openUpgradeModal = useUpgradeStore((state) => state.openModal);

  const uploadLimit = entitlements?.features.context_uploads_total ?? null;
  const uploadsUsed = usageCounters?.uploads_total ?? 0;
  const chatLimit = entitlements?.features.chats_per_day ?? null;
  const chatsUsed = usageCounters?.chats_today ?? 0;

  // Hide predictions when messages change (chat is no longer new)
  useEffect(() => {
    if (messages.length > 0) {
      setShowPredictions(false);
      setPredictions([]);
    }
  }, [messages.length]);

  // Track previous research mode to detect changes to nexus
  const prevResearchModeRef = useRef(selectedResearchMode);

  // Track streaming→ready transition for the finish animation
  const prevStatusRef = useRef(status);
  const [showFinish, setShowFinish] = useState(false);
  useEffect(() => {
    const wasResponding =
      prevStatusRef.current === 'streaming' ||
      prevStatusRef.current === 'submitted';
    const isNowReady = status === 'ready';

    if (wasResponding && isNowReady) {
      setShowFinish(true);
      const t = setTimeout(() => setShowFinish(false), 950);
      return () => clearTimeout(t);
    }
    prevStatusRef.current = status;
  }, [status]);
  useEffect(() => {
    // Trigger purple animation when switching TO nexus mode
    if (
      selectedResearchMode === 'nexus' &&
      prevResearchModeRef.current !== 'nexus'
    ) {
      const element = document.getElementById(`textarea-motion-${chatId}`);
      if (element) {
        // Elastic shrink animation
        element.animate(
          [
            { transform: 'scale(1)' },
            { transform: 'scale(0.97)' },
            { transform: 'scale(1)' },
          ],
          {
            duration: 300,
            easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          },
        );

        // Purple shadow explosion (additional glow that fades, base border persists via CSS)
        element.animate(
          [
            {
              filter: 'drop-shadow(0 0 0px rgba(147, 51, 234, 0))',
              offset: 0,
            },
            {
              filter: 'drop-shadow(0 0 30px rgba(147, 51, 234, 0.8))',
              offset: 0.15,
            },
            {
              filter: 'drop-shadow(0 0 60px rgba(147, 51, 234, 0.4))',
              offset: 0.4,
            },
            {
              filter: 'drop-shadow(0 0 0px rgba(147, 51, 234, 0))',
              offset: 1,
            },
          ],
          {
            duration: 800,
            delay: 50,
            easing: 'ease-out',
          },
        );
      }
    }
    prevResearchModeRef.current = selectedResearchMode;
  }, [selectedResearchMode, chatId]);

  // Add regex to detect mentions in the input
  // Track if we've already shown the upgrade modal for this session
  const [hasShownUpgradeModal, setHasShownUpgradeModal] = useState(false);
  const modalOpen = useUpgradeStore((state) => state.open);

  // If the user has hit the daily chat limit, surface the upgrade modal proactively
  useEffect(() => {
    try {
      // Only show the modal if:
      // 1. Chat limit exists and is exceeded
      // 2. We haven't already shown it this session
      // 3. No modal is currently open
      // 4. User is not already on a paid plan
      const shouldShowModal =
        chatLimit &&
        chatLimit > 0 &&
        chatsUsed >= chatLimit &&
        !hasShownUpgradeModal &&
        !modalOpen &&
        user?.plan === 'free';

      if (shouldShowModal) {
        // Prefer showing the plan choice modal with context
        const feature: UpgradeFeature = 'deep_research';
        openUpgradeModal(feature);
        setHasShownUpgradeModal(true);
      }
    } catch (error) {
      console.error('[MultimodalInput] Error checking upgrade modal:', error);
    }
  }, [
    chatLimit,
    chatsUsed,
    openUpgradeModal,
    hasShownUpgradeModal,
    modalOpen,
    user?.plan,
  ]);

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
  const filteredMentionResources = [
    ...mentionResources,
    ...dynamicMentionResources,
  ]
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

  // Fetch dynamic suggestions for specific items when typing after @
  useEffect(() => {
    let cancelled = false;
    async function fetchDynamic() {
      if (!showMentions) {
        setDynamicMentionResources([]);
        return;
      }
      const q = mentionFilter.trim();
      if (q.length === 0) {
        setDynamicMentionResources([]);
        return;
      }

      // Check for composer-specific shortcuts
      const composerShortcuts: Record<string, string> = {
        'doc:': 'text',
        'code:': 'code',
        'sheet:': 'sheet',
        'chart:': 'chart',
        'image:': 'image',
        'vto:': 'vto',
        'ac:': 'accountability',
        'composer:': 'all',
      };
      let composerKind: string | undefined;
      let searchQuery = q;
      for (const [shortcut, kind] of Object.entries(composerShortcuts)) {
        if (q.toLowerCase().startsWith(shortcut)) {
          composerKind = kind;
          searchQuery = q.slice(shortcut.length).trim();
          break;
        }
      }

      try {
        // Build query params for composer documents
        const composerParams = new URLSearchParams({
          search: searchQuery,
          limit: '8',
        });
        if (composerKind && composerKind !== 'all') {
          composerParams.set('kind', composerKind);
        }

        // Fetch composer documents (by title) and recordings
        const [docsRes, recsRes] = await Promise.all([
          fetch(`/api/documents?${composerParams}`),
          fetch(`/api/voice/recordings`),
        ]);

        const dyn: MentionResource[] = [];

        // Helper to get icon for composer kind
        const getComposerIcon = (kind: string) => {
          switch (kind) {
            case 'text':
              return <FileText className="size-4" />;
            case 'code':
              return <Code className="size-4" />;
            case 'sheet':
              return <Table className="size-4" />;
            case 'chart':
              return <PieChart className="size-4" />;
            case 'image':
              return <ImageIcon className="size-4" />;
            case 'vto':
              return <Target className="size-4" />;
            case 'accountability':
              return <Users className="size-4" />;
            default:
              return <FileStack className="size-4" />;
          }
        };

        // Helper to get color for composer kind
        const getComposerColor = (kind: string) => {
          switch (kind) {
            case 'text':
              return 'blue';
            case 'code':
              return 'emerald';
            case 'sheet':
              return 'violet';
            case 'chart':
              return 'pink';
            case 'image':
              return 'amber';
            case 'vto':
              return 'red';
            case 'accountability':
              return 'cyan';
            default:
              return 'blue';
          }
        };

        // Helper to get type for composer kind
        const getComposerType = (kind: string): MentionResource['type'] => {
          switch (kind) {
            case 'text':
              return 'text-composer';
            case 'code':
              return 'code-composer';
            case 'sheet':
              return 'sheet-composer';
            case 'chart':
              return 'chart-composer';
            case 'image':
              return 'image-composer';
            case 'vto':
              return 'vto-composer';
            case 'accountability':
              return 'accountability-composer';
            default:
              return 'composer';
          }
        };

        if (docsRes.ok) {
          const data = await docsRes.json();
          const docs = Array.isArray(data?.documents) ? data.documents : [];
          for (const d of docs) {
            const kind = d.kind || 'text';
            dyn.push({
              id: d.id,
              name: d.title || 'Untitled Document',
              type: getComposerType(kind),
              category: 'composer',
              description: `${kind.charAt(0).toUpperCase() + kind.slice(1)} Composer${d.tags?.length ? ` • ${d.tags.slice(0, 2).join(', ')}` : ''}`,
              icon: getComposerIcon(kind),
              color: getComposerColor(kind),
              isDynamic: true,
              preview: d.contentSummary || d.preview,
            } as MentionResource);
          }
        }

        if (recsRes.ok) {
          const data = await recsRes.json();
          const recs = Array.isArray(data?.recordings) ? data.recordings : [];
          for (const r of recs) {
            const title: string = r?.recording?.title || 'Untitled Recording';
            const transcript: string = r?.transcript?.text || '';
            const matches =
              title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              transcript.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matches) continue;
            dyn.push({
              id: r?.recording?.id,
              name: title,
              type: 'recording',
              category: 'resource',
              description: transcript
                ? `Transcript • ${transcript.slice(0, 60)}…`
                : 'Transcript unavailable',
              icon: <Mic className="size-4" />,
              color: 'pink',
              isDynamic: true,
            } as MentionResource);
          }
        }

        if (!cancelled) setDynamicMentionResources(dyn);
      } catch (e) {
        if (!cancelled) setDynamicMentionResources([]);
      }
    }

    fetchDynamic();
    return () => {
      cancelled = true;
    };
  }, [showMentions, mentionFilter]);

  // Add state to track multi-line status
  const [isMultiLine, setIsMultiLine] = useState(false);

  // Add flag to prevent height adjustment during submission
  const isSubmittingRef = useRef(false);
  // Disable textarea height/padding transitions during submit to prevent visible jump
  const [disableInputTransitions, setDisableInputTransitions] = useState(false);
  // Store locked height during submission
  const lockedHeightRef = useRef<number | null>(null);
  // Store the input value at submission time to prevent value prop changes during submission
  const inputValueAtSubmitRef = useRef<string | null>(null);

  // Maintain height lock when input changes during submission
  // Use useLayoutEffect to apply lock SYNCHRONOUSLY before browser paint
  useLayoutEffect(() => {
    if (
      isSubmittingRef.current &&
      lockedHeightRef.current !== null &&
      textareaRef.current
    ) {
      // Re-apply height lock SYNCHRONOUSLY before paint to prevent visual jump
      textareaRef.current.style.height = `${lockedHeightRef.current}px`;
      textareaRef.current.style.minHeight = `${lockedHeightRef.current}px`;
      textareaRef.current.style.maxHeight = `${lockedHeightRef.current}px`;
      textareaRef.current.style.transition = 'none';
    }
  }, [input]);

  // Multi-line detection based on TEXT CONTENT ONLY (not pixel measurements)
  // This prevents feedback loops from layout width changes affecting measurements
  const lastMultiLineRef = useRef(false);

  const adjustHeight = useCallback(() => {
    if (isSubmittingRef.current || !textareaRef.current) {
      return;
    }

    const textarea = textareaRef.current;
    const text = textarea.value;

    // FIRST: Decide layout based on text content (stable - doesn't depend on width)
    // Estimate if text would wrap: ~50 chars fit on single line with buttons
    // Count words and their lengths to estimate wrapping
    const hasNewlines = text.includes('\n');
    const charCount = text.length;

    // Simple heuristic: if text is long enough that it would likely wrap
    // in the narrower single-line layout, use multi-line
    // Single-line textarea is roughly 50-60 chars wide, use 70 for buffer
    const likelyToWrap = charCount > 70;

    const shouldBeMultiLine = hasNewlines || likelyToWrap;

    // Update layout state BEFORE measuring height
    // Only update if changed to prevent unnecessary re-renders
    if (shouldBeMultiLine !== lastMultiLineRef.current) {
      lastMultiLineRef.current = shouldBeMultiLine;
      setIsMultiLine(shouldBeMultiLine);
    }

    // THEN: Measure and set height (after layout decision is stable)
    const minHeight = 40;
    const maxHeightPx =
      typeof window !== 'undefined' ? window.innerHeight * 0.35 : 400;

    const scrollTop = textarea.scrollTop;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;

    const finalHeight = Math.max(
      minHeight,
      Math.min(scrollHeight, maxHeightPx),
    );
    textarea.style.height = `${finalHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeightPx ? 'auto' : 'hidden';
    textarea.scrollTop = scrollTop;
  }, []);

  // Handle @ mention detection
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setInput(value);

      // Toggle predictive suggestions (after 2 chars, unless in @mention mode, and only if enabled)
      const plain = value.trim();
      setShowPredictions(plain.length >= 2 && autocompleteEnabled && isNewChat);

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

      // Adjust textarea height after input change
      adjustHeight();
    },
    [
      setInput,
      calculateCursorPosition,
      autocompleteEnabled,
      isNewChat,
      adjustHeight,
    ],
  );

  // Handle selecting a mention - enhanced with better UX feedback
  const handleSelectMention = useCallback(
    (resource: MentionResource) => {
      if (!textareaRef.current) return;

      const cursorPosition = textareaRef.current.selectionStart;

      // Prevent duplicate selection (for dynamic items use id+type, for static use type)
      const isDuplicate = selectedMentions.some((mention) => {
        const isStatic =
          resource.id === 'calendar' ||
          resource.id === 'availability' ||
          resource.id === 'documents' ||
          resource.id === 'recordings' ||
          resource.id === 'scorecard' ||
          resource.id === 'vto' ||
          resource.id === 'accountability' ||
          resource.id === 'rocks' ||
          resource.id === 'people' ||
          resource.id === 'team' ||
          resource.id === 'search' ||
          resource.id === 'analyze' ||
          resource.id === 'help' ||
          resource.id === 'agenda';
        return isStatic
          ? mention.type === resource.type
          : mention.type === resource.type && mention.id === resource.id;
      });

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
        id: resource.id || Math.random().toString(36).substring(2, 15),
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
  }, [adjustHeight]);

  const resetHeight = () => {
    // Don't reset height if we're submitting - let submitForm handle it
    if (isSubmittingRef.current) {
      return;
    }

    if (textareaRef.current) {
      const textarea = textareaRef.current;
      // Smoothly transition to minimum height
      textarea.style.transition = 'height 0.2s ease';
      textarea.style.height = 'auto';

      // Calculate the height for 2 rows (the default rows value)
      // Use scrollHeight to get natural height
      const naturalHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.max(naturalHeight, 64)}px`;
      textarea.style.overflowY = 'hidden';

      // Remove transition after reset completes
      setTimeout(() => {
        if (textarea) {
          textarea.style.transition = '';
        }
      }, 200);
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

  // Fetch predictive suggestions when input changes (debounced)
  useEffect(() => {
    const run = async () => {
      try {
        const prefix = (debouncedInput || '').trim();

        // Better edge case detection
        const hasMultipleLines = /\n/.test(prefix);
        const hasPunctuation = /[\?\!\.]$/.test(prefix);
        const hasMultipleSentences = (prefix.match(/[.!?]/g) || []).length > 1;
        const looksLikeCompleteQuestion =
          /^(what|where|when|why|who|how|can|could|would|should|is|are|do|does)\s/i.test(
            prefix,
          ) &&
          (prefix.length > 30 || hasPunctuation);

        // Hide suggestions in these cases
        const shouldHide =
          !showPredictions ||
          showMentions ||
          prefix.length < 3 || // Require at least 3 characters
          prefix.length > 120 ||
          hasMultipleLines ||
          hasPunctuation ||
          hasMultipleSentences ||
          looksLikeCompleteQuestion ||
          !isNewChat ||
          !autocompleteEnabled;

        if (shouldHide) {
          setPredictions([]);
          if (hasPunctuation || !isNewChat || hasMultipleLines) {
            setShowPredictions(false);
          }
          return;
        }

        // Build context for smarter predictions
        const context = {
          chatId,
          personaId: selectedPersonaId || undefined,
          personaName: selectedPersona?.name,
          isNewChat,
          selectedModelId: selectedModelId || undefined,
        };

        const res = await fetch('/api/predictions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, context }),
        });

        if (!res.ok) {
          setPredictions([]);
          return;
        }

        const data = await res.json();
        const items: string[] = Array.isArray(data?.predictions)
          ? data.predictions
          : [];

        // Additional client-side filtering
        const filtered = items.filter((item) => {
          const trimmed = item.trim();
          // Skip empty or very short suggestions
          if (trimmed.length < 2) return false;
          // Skip if it looks like a full sentence/answer
          if (/^[A-Z].*[.!?]$/.test(trimmed)) return false;
          // Skip if it's asking a question back
          if (trimmed.endsWith('?')) return false;
          // Skip if it repeats words from the prefix
          const prefixWords = prefix.toLowerCase().split(/\s+/).slice(-3);
          const itemWords = trimmed.toLowerCase().split(/\s+/);
          const hasRepeatedWord = prefixWords.some(
            (pw) => pw.length > 3 && itemWords.includes(pw),
          );
          if (hasRepeatedWord) return false;
          return true;
        });

        setPredictions(filtered.slice(0, 3));
      } catch {
        setPredictions([]);
      }
    };
    run();
  }, [
    debouncedInput,
    showPredictions,
    showMentions,
    isNewChat,
    autocompleteEnabled,
    chatId,
    selectedPersonaId,
    selectedPersona?.name,
    selectedModelId,
  ]);

  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId,
    initialVisibilityType: selectedVisibilityType,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  // Use separate state for PDF content
  const [pdfContents, setPdfContents] = useState<PDFContent[]>([]);
  // Add new state for documents and images
  const [documentContents, setDocumentContents] = useState<DocumentContent[]>(
    [],
  );
  // Track recently-ready audio IDs for upload completion flash
  const [flashReadyIds, setFlashReadyIds] = useState<Set<string>>(new Set());
  // Removed imageContents - images now go via attachments and experimental_attachments
  // Add state for audio recordings
  const [audioContents, setAudioContents] = useState<
    Array<{
      id: string;
      name: string;
      transcript: string;
      duration: number;
      status: 'uploading' | 'transcribing' | 'ready' | 'error';
      url?: string;
    }>
  >([]);

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
            // Dismiss the loading toast
            toast.dismiss(toastId);
            await showEdgeCaseToast(toast, errorData);
            const errorMessage =
              errorData.error || 'Unknown error processing PDF';
            console.error(`PDF processing error: ${errorMessage}`);
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
          // Optional Code Interpreter route for spreadsheets
          try {
            let ciSucceeded = false;
            const { useSettingsStore } = await import(
              '@/lib/stores/use-settings'
            );
            const ciEnabled =
              useSettingsStore.getState().useCodeInterpreterForSpreadsheets;
            if (ciEnabled) {
              const ciForm = new FormData();
              ciForm.append('file', file);
              ciForm.append('mode', 'code_interpreter');
              const ciRes = await fetch('/api/files/spreadsheet-analyze', {
                method: 'POST',
                body: ciForm,
              });
              if (ciRes.ok) {
                const ciData = await ciRes.json();
                toast.dismiss(toastId);
                toast.success(`Spreadsheet analyzed: ${ciData.filename}`);
                // Do not inject embedded markers into the input; attach structured summary at send time instead
                ciSucceeded = true;
                return null;
              }
              // If CI fails, fall through to Node parsing with a toast info
              try {
                const err = await ciRes.json().catch(() => ({}));
                console.warn(
                  'Code Interpreter analysis failed, falling back:',
                  err,
                );
                toast.info('Falling back to local spreadsheet parsing');
              } catch {}
            }
            if (ciSucceeded) {
              return null;
            }
          } catch {}

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
            // Dismiss loading toast
            toast.dismiss(toastId);
            await showEdgeCaseToast(toast, errorData);
            const errorMessage =
              errorData.error || 'Unknown error processing document';
            console.error(`Document processing error: ${errorMessage}`);
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

      // Handle PPTX files
      else if (
        file.type ===
          'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        file.type === 'application/vnd.ms-powerpoint' ||
        fileExt === 'pptx' ||
        fileExt === 'ppt'
      ) {
        console.log(
          `Processing Presentation: ${file.name} (${file.size} bytes)`,
        );

        // Create a loading toast
        const toastId = toast.loading(
          `Processing presentation: ${file.name}...`,
        );

        try {
          const response = await fetch('/api/files/document', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            console.log(
              `Presentation processed: ${data.text.length} characters extracted`,
            );

            // Dismiss loading toast
            toast.dismiss(toastId);

            // Show success toast
            toast.success(`Presentation processed: ${data.filename}`);

            // Add to document content state
            setDocumentContents((prev) => [
              ...prev,
              {
                name: data.filename,
                text: data.text,
                type: 'pptx',
                pageCount: data.pageCount,
              },
            ]);

            // Return null - not using attachment system for documents
            return null;
          } else {
            const errorData = await response.json();
            // Dismiss loading toast
            toast.dismiss(toastId);
            await showEdgeCaseToast(toast, errorData);
            const errorMessage =
              errorData.error || 'Unknown error processing presentation';
            console.error(`Presentation processing error: ${errorMessage}`);
            toast.error(`Presentation processing error: ${errorMessage}`);
            return undefined;
          }
        } catch (error) {
          console.error('Error during presentation processing:', error);

          // Dismiss loading toast
          toast.dismiss(toastId);

          // Show error toast
          toast.error(
            'Failed to process presentation. Please try a different file or format.',
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

            // Add to document content state with structured analysis embedded markers
            setDocumentContents((prev) => [
              ...prev,
              {
                name: data.filename,
                text: data.text,
                type: 'xlsx',
                pageCount: data.pageCount,
              },
            ]);

            // Do not inject embedded markers into the input; attach structured summary at send time instead

            // Return null - not using attachment system for documents
            return null;
          } else {
            const errorData = await response.json();
            // Dismiss loading toast
            toast.dismiss(toastId);
            await showEdgeCaseToast(toast, errorData);
            const errorMessage =
              errorData.error || 'Unknown error processing spreadsheet';
            console.error(`Spreadsheet processing error: ${errorMessage}`);
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

      // Handle images - Simple upload, AI model analyzes directly
      else if (
        file.type.startsWith('image/') ||
        ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt || '')
      ) {
        console.log(`Uploading Image: ${file.name} (${file.size} bytes)`);

        try {
          const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            await showEdgeCaseToast(toast, err);
            toast.error(err?.error || 'Failed to upload image');
            return undefined;
          }

          const data = await response.json();

          // Validate the uploaded URL
          if (!data.url || typeof data.url !== 'string') {
            console.error('Invalid upload response:', data);
            toast.error('Upload failed: Invalid URL returned');
            return undefined;
          }

          // Clean and validate the URL
          const cleanUrl = data.url.trim();

          // Ensure URL doesn't have trailing dots or malformed parts
          if (cleanUrl.endsWith('.') || cleanUrl.includes('..')) {
            console.error('Malformed URL detected:', cleanUrl);
            toast.error('Upload failed: Malformed URL');
            return undefined;
          }

          // Determine the proper content type
          let contentType = file.type;
          if (!contentType || contentType === 'application/octet-stream') {
            const ext = fileExt?.toLowerCase();
            const typeMap: { [key: string]: string } = {
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              png: 'image/png',
              gif: 'image/gif',
              webp: 'image/webp',
              bmp: 'image/bmp',
            };
            contentType = typeMap[ext || ''] || 'image/jpeg';
          }

          const imageAttachment = withNewAttachmentId({
            url: cleanUrl,
            name: file.name,
            contentType,
          });

          sonnerToast.success('Image attached', {
            description: (
              <span className="flex items-center gap-3 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cleanUrl}
                  alt=""
                  className="size-11 shrink-0 rounded-md border border-border object-cover shadow-sm"
                />
                <span className="text-sm text-muted-foreground">
                  Added to your message — send when you&apos;re ready.
                </span>
              </span>
            ),
            duration: 4000,
          });

          return imageAttachment;
        } catch (error) {
          console.error('Failed to upload image:', error);
          toast.error('Failed to upload image, please try again!');
          return undefined;
        }
      }

      // Audio files: send to recordings endpoint (MP3/M4A/MP4/WAV)
      else if (
        file.type.startsWith('audio/') ||
        ['mp3', 'm4a', 'mp4', 'wav'].includes((fileExt || '').toLowerCase())
      ) {
        const tempId = `audio-${Date.now()}-${Math.random()}`;

        // Warn about potential MP4 compatibility issues
        if (file.type.includes('mp4') || fileExt === 'mp4') {
          toast.warning(
            'MP4 files may have compatibility issues. If transcription fails, try converting to MP3 or M4A format.',
            { duration: 5000 },
          );
        }

        // Add to audio contents with uploading status
        setAudioContents((prev) => [
          ...prev,
          {
            id: tempId,
            name: file.name,
            transcript: '',
            duration: 0,
            status: 'uploading',
          },
        ]);

        try {
          // Get audio duration if possible
          let audioDuration = 0;
          try {
            const audioEl = document.createElement('audio');
            const objectUrl = URL.createObjectURL(file);
            audioEl.src = objectUrl;
            await new Promise((resolve) => {
              audioEl.addEventListener('loadedmetadata', () => {
                audioDuration = Math.floor(audioEl.duration);
                URL.revokeObjectURL(objectUrl);
                resolve(null);
              });
              audioEl.addEventListener('error', () => {
                URL.revokeObjectURL(objectUrl);
                resolve(null);
              });
            });
          } catch {
            // Ignore duration detection errors
          }

          const fd = new FormData();
          fd.append('audio', file);
          fd.append('title', file.name.replace(/\.[^.]+$/, ''));
          fd.append('duration', audioDuration.toString());

          const res = await fetch('/api/voice/recordings', {
            method: 'POST',
            body: fd,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            setAudioContents((prev) =>
              prev.map((a) =>
                a.id === tempId ? { ...a, status: 'error' } : a,
              ),
            );
            await showEdgeCaseToast(toast, err);
            toast.error(err?.error || 'Failed to upload audio');
            return undefined;
          }

          const data = await res.json();
          const recordingId = data.id;

          // Update to transcribing status
          setAudioContents((prev) =>
            prev.map((a) =>
              a.id === tempId
                ? {
                    ...a,
                    id: recordingId,
                    status: 'transcribing',
                    url: data.audioUrl,
                  }
                : a,
            ),
          );

          // Start polling for transcription status
          const pollInterval = setInterval(async () => {
            try {
              const statusRes = await fetch(
                `/api/voice/recordings/status?recordingId=${recordingId}`,
              );
              if (statusRes.ok) {
                const statusData = await statusRes.json();

                if (statusData.status === 'ready' && statusData.transcript) {
                  clearInterval(pollInterval);

                  // Update with final transcript
                  setAudioContents((prev) =>
                    prev.map((a) =>
                      a.id === recordingId
                        ? {
                            ...a,
                            status: 'ready',
                            transcript: statusData.transcript,
                            duration: data.duration || 0,
                          }
                        : a,
                    ),
                  );

                  // Flash the thumbnail on completion
                  setFlashReadyIds((prev) => {
                    const next = new Set(prev);
                    next.add(recordingId);
                    return next;
                  });
                  setTimeout(() => {
                    setFlashReadyIds((prev) => {
                      const next = new Set(prev);
                      next.delete(recordingId);
                      return next;
                    });
                  }, 550);

                  toast.success(`Transcription complete: ${file.name}`);
                } else if (statusData.status === 'error') {
                  clearInterval(pollInterval);
                  setAudioContents((prev) =>
                    prev.map((a) =>
                      a.id === recordingId
                        ? {
                            ...a,
                            status: 'error',
                            transcript:
                              statusData.error || 'Transcription failed',
                          }
                        : a,
                    ),
                  );
                  toast.error(
                    `Transcription failed: ${statusData.error || 'Unknown error'}`,
                  );
                }
              }
            } catch (error) {
              console.error('Error polling transcription status:', error);
            }
          }, 2000); // Poll every 2 seconds

          // Clear interval after 5 minutes timeout
          setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);

          return null; // Don't add as regular attachment
        } catch (e) {
          setAudioContents((prev) =>
            prev.map((a) => (a.id === tempId ? { ...a, status: 'error' } : a)),
          );
          toast.error('Failed to upload audio');
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

        const fileAttachment = withNewAttachmentId({
          url,
          name: pathname,
          contentType,
        });

        sonnerToast.success('File attached', {
          description: (
            <span className="text-sm text-muted-foreground">
              {String(pathname || 'File')} — send when you&apos;re ready.
            </span>
          ),
          duration: 3500,
        });

        return fileAttachment;
      }
      const err = await response.json().catch(() => ({}));
      await showEdgeCaseToast(toast, err);
      toast.error(err?.error || 'Failed to upload file');
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
          ...successfullyUploadedAttachments.map((a) => withNewAttachmentId(a)),
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  // Helper to reset submission state when submit is cancelled or fails
  const resetSubmitState = useCallback(() => {
    isSubmittingRef.current = false;
    lockedHeightRef.current = null;
    inputValueAtSubmitRef.current = null;
    setDisableInputTransitions(false);
    if (textareaRef.current) {
      textareaRef.current.style.minHeight = '';
      textareaRef.current.style.maxHeight = '';
      textareaRef.current.style.transition = '';
    }
  }, []);

  const submitForm = useCallback(() => {
    // Set flag to prevent height adjustments during submission
    isSubmittingRef.current = true;

    // Lock current height to prevent visual jump when input is cleared
    if (textareaRef.current) {
      const currentHeight = textareaRef.current.offsetHeight;
      lockedHeightRef.current = currentHeight;
      inputValueAtSubmitRef.current = input;
      textareaRef.current.style.height = `${currentHeight}px`;
      textareaRef.current.style.minHeight = `${currentHeight}px`;
      textareaRef.current.style.maxHeight = `${currentHeight}px`;
      textareaRef.current.style.transition = 'none';
    }
    setDisableInputTransitions(true);

    window.history.replaceState({}, '', `/chat/${chatId}`);

    // Trim the input to remove any trailing/leading whitespace or newlines
    let finalInputContent = input.trim(); // Start with trimmed text input

    // Mentions: Structured metadata only (no visible tags/context)
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

      // Append hidden metadata block only
      if (mentionMetadata.length > 0) {
        try {
          const meta = JSON.stringify({ mentions: mentionMetadata });
          finalInputContent = `${finalInputContent}\n\n[MENTIONS_META_BEGIN]${meta}[MENTIONS_META_END]`;
        } catch (_) {
          // ignore JSON errors
        }
      }
    }

    let hasProcessedContent = false;

    // Handle PDF content
    if (pdfContents.length > 0) {
      hasProcessedContent = true;
      // Embed metadata + truncated text inside standardized markers
      const pdfMarkers = pdfContents
        .map((pdf) => {
          let pdfText = pdf.text || '';
          if (pdfText.length > 15000) {
            pdfText = `${pdfText.substring(0, 15000)}... [PDF content truncated due to size]`;
          }
          return createEmbeddedContentString({
            type: 'pdf',
            name: pdf.name,
            metadata: {
              pageCount: pdf.numPages,
              status: 'ready',
            },
            content: pdfText,
          });
        })
        .join('\n\n');

      finalInputContent += `\n\n${pdfMarkers}`; // Combine original input with structured markers incl. content
    }

    // Handle document content
    if (documentContents.length > 0) {
      hasProcessedContent = true;
      // Embed metadata + truncated text inside standardized markers
      const docMarkers = documentContents
        .map((doc) => {
          let docText = doc.text || '';
          if (docText.length > 15000) {
            docText = `${docText.substring(0, 15000)}... [Document content truncated due to size]`;
          }
          const docType =
            doc.type === 'docx'
              ? 'Word Document'
              : doc.type === 'pptx'
                ? 'Presentation'
                : 'Spreadsheet';
          const contentType = doc.type === 'pptx' ? 'presentation' : 'document';
          return createEmbeddedContentString({
            type: contentType,
            name: doc.name,
            metadata: {
              pageCount: doc.type === 'pptx' ? undefined : doc.pageCount,
              slideCount: doc.type === 'pptx' ? doc.pageCount : undefined,
              status: 'ready',
              docType,
            },
            content: docText,
          });
        })
        .join('\n\n');

      finalInputContent += `\n\n${docMarkers}`; // Combine with structured markers incl. content
    }

    // Images are sent via experimental_attachments - AI analyzes them directly

    // Handle audio content - include all audio (ready, error, or processing)
    const allAudioContents = audioContents.filter(
      (a) => a.status === 'ready' || a.status === 'error',
    );
    if (allAudioContents.length > 0) {
      hasProcessedContent = true;

      // Use the new embedded content format - only include ready audio (no errors)
      const audioEmbeddedContent = allAudioContents
        .filter((audio) => audio.status === 'ready') // Only include successfully transcribed audio
        .map((audio) => {
          const embeddedContent = {
            type: 'audio' as const,
            name: audio.name,
            metadata: {
              status: audio.status,
              duration: audio.duration,
              transcript: audio.transcript,
            },
            content: audio.transcript,
          };

          return `[EMBEDDED_CONTENT_START]${JSON.stringify(embeddedContent)}[EMBEDDED_CONTENT_END]`;
        })
        .join('\n');

      finalInputContent += `\n\n${audioEmbeddedContent}`;
    }

    // Check if any audio is still processing
    const processingAudio = audioContents.filter(
      (a) => a.status === 'uploading' || a.status === 'transcribing',
    );
    if (processingAudio.length > 0) {
      toast.error('Please wait for audio transcription to complete!');
      resetSubmitState();
      return;
    }

    // Check if any audio has errors
    const errorAudio = audioContents.filter((a) => a.status === 'error');
    if (errorAudio.length > 0) {
      toast.error(
        `Cannot send message with failed audio attachments. Please remove the failed audio files (${errorAudio.map((a) => a.name).join(', ')}) or try uploading in a supported format.`,
      );
      resetSubmitState();
      return;
    }

    // Ensure the submit doesn't hang by checking first
    if (status !== 'ready') {
      toast.error('Please wait for the model to finish its response!');
      resetSubmitState();
      return;
    }

    try {
      // AI SDK 5: Convert attachments to file parts
      const fileParts = attachments.map((attachment) => ({
        type: 'file' as const,
        url: attachment.url,
        mediaType: attachment.contentType,
        name: attachment.name,
        ...(attachment.contextOnly ? { contextOnly: true as const } : {}),
      }));

      if (hasProcessedContent) {
        // Use append for messages with processed content
        // AI SDK 5: Attachments are now file parts in the parts array
        append({
          role: 'user',
          parts: [{ type: 'text', text: finalInputContent }, ...fileParts],
        });
        // Don't clear input state yet - will be cleared after height reset
      } else {
        // No processed content, use standard handleSubmit
        if (
          input.trim().length > 0 ||
          attachments.length > 0 ||
          selectedMentions.length > 0
        ) {
          // If we have selected mentions but no text content, send zero-width content + hidden meta
          if (input.trim().length === 0 && selectedMentions.length > 0) {
            let content = '\u200B';
            if (mentionMetadata.length > 0) {
              try {
                const meta = JSON.stringify({ mentions: mentionMetadata });
                content = `${content}\n\n[MENTIONS_META_BEGIN]${meta}[MENTIONS_META_END]`;
              } catch (_) {
                // ignore
              }
            }
            // AI SDK 5: Attachments are now file parts in the parts array
            append({
              role: 'user',
              parts: [{ type: 'text', text: content }, ...fileParts],
            });
          } else {
            // If we have text, use the finalInputContent with mentions appended
            // AI SDK 5: Attachments are now file parts in the parts array
            append({
              role: 'user',
              parts: [{ type: 'text', text: finalInputContent }, ...fileParts],
            });
          }
          // Don't clear input state yet - will be cleared after height reset
        } else {
          // Nothing to send
          resetSubmitState();
          return;
        }
      }

      // Common cleanup operations
      setAttachments([]);
      setPdfContents([]);
      setDocumentContents([]);
      setAudioContents([]);
      setSelectedMentions([]);
      setShowPredictions(false);
      setPredictions([]);

      // Delay shrinking input to avoid visible jump at submit moment
      setTimeout(() => {
        if (textareaRef.current) {
          // Reset to single-line height with smooth transition
          textareaRef.current.style.height = '40px';
          textareaRef.current.style.minHeight = '';
          textareaRef.current.style.maxHeight = '';
          textareaRef.current.style.transition = 'height 0.2s ease';
          textareaRef.current.style.overflowY = 'hidden';
        }

        // Reset all submission state
        lockedHeightRef.current = null;
        inputValueAtSubmitRef.current = null;
        isSubmittingRef.current = false;
        lastMultiLineRef.current = false;
        setDisableInputTransitions(false);
        setIsMultiLine(false);
        setInput('');
      }, 150);

      if (width && width > 768) {
        textareaRef.current?.focus();
      }
    } catch (error) {
      resetSubmitState();
      toast.error('Failed to send message. Please try again.');
    }
  }, [
    input,
    attachments,
    pdfContents,
    documentContents,
    audioContents,
    selectedMentions,
    chatId,
    append,
    setInput,
    setAttachments,
    setPdfContents,
    setDocumentContents,
    setAudioContents,
    width,
    status,
    resetSubmitState,
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
  const audioCount = audioContents.length;
  const audioProcessing = audioContents.some(
    (a) => a.status === 'uploading' || a.status === 'transcribing',
  );

  // Intelligent layout helpers
  const hasPreviews =
    attachmentsCount + pdfCount + docCount + audioCount + uploadQueue.length >
    0;
  const isWide = (width ?? 0) >= 1024;
  const isEmbedded = className?.includes('composer-embedded');
  const textareaMaxVh = hasPreviews ? (isWide ? 55 : 50) : 75;
  const effectiveTextareaMaxVh = isEmbedded ? 40 : textareaMaxVh;

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
              ...successfullyUploadedAttachments.map((a) =>
                withNewAttachmentId(a),
              ),
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

      if (imageItems.length === 0) {
        // No image items found - might be text paste
        // Small delay to let the paste complete before measuring height
        setTimeout(adjustHeight, 0);
        return;
      }

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
              ...successfullyUploadedAttachments.map((a) =>
                withNewAttachmentId(a),
              ),
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
    [status, uploadFile, setAttachments, adjustHeight],
  );

  return (
    <div
      className={cx(
        'relative w-full flex flex-col',
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
      {/* Mentions dropdown + drag affordance (single motion budget: no bounce/pulse on drop) */}
      <style jsx global>{`
        .drag-active {
          outline: 2px solid hsl(var(--primary) / 0.14);
          outline-offset: 3px;
          border-radius: 1.25rem;
          transition: outline-color 0.2s ease;
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
            className="mention-dropdown bg-popover shadow-xl rounded-lg border border-border w-[calc(100vw-2rem)] md:w-96 max-h-[60vh] md:max-h-96 overflow-y-auto"
            style={{
              position: 'fixed', // Fixed positioning relative to viewport
              top: `${cursorPosition.top}px`,
              left: `${cursorPosition.left}px`,
              transform: 'translateY(-100%)', // Move up by its own height
              boxShadow:
                '0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)',
              zIndex: 'var(--z-toast)', // High z-index since it's in document body
            }}
          >
            <div className="p-3 text-sm font-medium border-b border-border bg-muted rounded-t-lg">
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
            {[
              'composer',
              'calendar',
              'resource',
              'person',
              'tool',
              'command',
              'template',
            ]
              .filter((category) =>
                filteredMentionResources.some((r) => r.category === category),
              )
              .map((category) => {
                const categoryResources = filteredMentionResources.filter(
                  (r) => r.category === category,
                );
                const categoryColors = {
                  composer: 'blue',
                  calendar: 'sky',
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
                        <button
                          key={resource.id}
                          type="button"
                          className={`text-left w-full mention-item p-3 cursor-pointer flex items-start gap-3 hover:bg-${color}-50 dark:hover:bg-${color}-900/20 transition-colors ${
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
                        </button>
                      );
                    })}
                  </div>
                );
              })}

            {/* No grouped resources fallback */}
            {![
              'composer',
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
                <button
                  key={resource.id}
                  type="button"
                  className={`text-left w-full mention-item p-3 cursor-pointer flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
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
                </button>
              ))}

            <div className="p-2 text-xs text-muted-foreground border-t border-border bg-muted rounded-b-lg">
              <div className="flex items-center justify-between">
                <div>
                  <kbd className="px-2 py-1 bg-background rounded border border-border mr-1">
                    ↑↓
                  </kbd>
                  Navigate
                  <kbd className="px-2 py-1 bg-background rounded border border-border mx-1">
                    Enter
                  </kbd>
                  Select
                  <kbd className="px-2 py-1 bg-background rounded border border-border mx-1">
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

      {isDragging && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-background/75 backdrop-blur-[3px] dark:bg-background/60"
          aria-live="polite"
          role="status"
        >
          <div className="max-w-sm rounded-2xl border border-border bg-card px-6 py-5 text-center shadow-lg">
            <Paperclip
              className="mx-auto mb-3 size-8 text-primary"
              aria-hidden
            />
            <p className="text-base font-semibold tracking-tight">
              Drop to attach
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Up to 10 files · 50MB each · images, PDFs, documents, audio
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

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      <AnimatePresence>
        {(attachments.length > 0 ||
          pdfContents.length > 0 ||
          documentContents.length > 0 ||
          audioContents.length > 0 ||
          uploadQueue.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{
              duration: 0.25,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-7 rounded-l-xl bg-gradient-to-r from-muted/60 to-transparent dark:from-muted/45"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-7 rounded-r-xl bg-gradient-to-l from-muted/60 to-transparent dark:from-muted/45"
                aria-hidden
              />
              <div
                className={cx(
                  'relative custom-scrollbar flex flex-row items-end gap-3 overflow-x-auto overflow-y-visible scroll-smooth snap-x snap-mandatory px-3 py-3 pt-4',
                  'rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50',
                  isEmbedded ? 'max-h-36' : 'max-h-48',
                )}
              >
                {attachments.length +
                  pdfContents.length +
                  documentContents.length +
                  audioContents.length >
                  5 && (
                  <div className="pointer-events-none absolute bottom-2 right-3 z-[2] rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-md tabular-nums">
                    {attachments.length +
                      pdfContents.length +
                      documentContents.length +
                      audioContents.length}{' '}
                    files
                  </div>
                )}

                {attachments.map((attachment) => {
                  const attId = attachment.id ?? attachment.url;
                  return (
                    <PreviewAttachment
                      key={attId}
                      attachment={attachment}
                      onRemove={() => {
                        setAttachments((currentAttachments) =>
                          currentAttachments.filter(
                            (a) => (a.id ?? a.url) !== attId,
                          ),
                        );
                      }}
                      onDuplicate={() => {
                        setAttachments((prev) => [
                          ...prev,
                          withNewAttachmentId({
                            ...attachment,
                            id: undefined,
                            contextOnly: attachment.contextOnly,
                          }),
                        ]);
                      }}
                      onRename={(nextName) => {
                        setAttachments((prev) =>
                          prev.map((a) =>
                            (a.id ?? a.url) === attId
                              ? { ...a, name: nextName }
                              : a,
                          ),
                        );
                      }}
                      onContextOnlyChange={(v) => {
                        setAttachments((prev) =>
                          prev.map((a) =>
                            (a.id ?? a.url) === attId
                              ? { ...a, contextOnly: v }
                              : a,
                          ),
                        );
                      }}
                    />
                  );
                })}

                {pdfContents.map((pdf, index) => (
                  <div
                    key={`pdf-${pdf.name}-${index}`}
                    className="relative flex shrink-0 snap-start flex-col gap-1.5 pt-2"
                  >
                    <div className="relative w-20 h-16 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm upload-done-flash">
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
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute -top-2.5 -right-2.5 size-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-red-500 hover:text-white shadow-md z-20 transition-colors"
                        onClick={() => {
                          setPdfContents((current) =>
                            current.filter((_, i) => i !== index),
                          );
                        }}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-[80px] truncate text-center">
                      {pdf.name}
                    </div>
                  </div>
                ))}

                {documentContents.map((doc, index) => (
                  <div
                    key={`doc-${doc.name}-${index}`}
                    className="relative flex shrink-0 snap-start flex-col gap-1.5 pt-2"
                  >
                    <div className="relative w-20 h-16 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm upload-done-flash">
                      <svg
                        className={`size-8 ${doc.type === 'docx' ? 'text-blue-500' : doc.type === 'pptx' ? 'text-orange-500' : 'text-green-500'}`}
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
                        ) : doc.type === 'pptx' ? (
                          <>
                            <rect
                              width="18"
                              height="18"
                              x="3"
                              y="3"
                              rx="2"
                              ry="2"
                            />
                            <path d="M7 3v18" />
                            <path d="M3 7.5h18" />
                            <path d="M3 12h18" />
                            <path d="M3 16.5h18" />
                          </>
                        ) : (
                          <>
                            <rect
                              width="18"
                              height="18"
                              x="3"
                              y="3"
                              rx="2"
                              ry="2"
                            />
                            <line x1="7" y1="3" x2="7" y2="21" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="3" y1="15" x2="21" y2="15" />
                          </>
                        )}
                      </svg>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute -top-2.5 -right-2.5 size-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-red-500 hover:text-white shadow-md z-20 transition-colors"
                        onClick={() => {
                          setDocumentContents((current) =>
                            current.filter((_, i) => i !== index),
                          );
                        }}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-[80px] truncate text-center">
                      {doc.name}
                    </div>
                  </div>
                ))}

                {audioContents.map((audio) => (
                  <div
                    key={`audio-${audio.id}`}
                    className="relative flex shrink-0 snap-start flex-col gap-1.5 pt-2"
                  >
                    <div
                      className={cx(
                        'relative w-20 h-16 flex flex-col items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm',
                        flashReadyIds.has(audio.id) && 'upload-done-flash',
                      )}
                    >
                      {audio.status === 'uploading' ? (
                        <>
                          <div className="animate-spin text-zinc-500">
                            <LoaderIcon size={24} />
                          </div>
                          <span className="text-[10px] text-zinc-500 mt-1">
                            Uploading
                          </span>
                        </>
                      ) : audio.status === 'transcribing' ? (
                        <>
                          <svg
                            className="size-8 text-purple-500 animate-pulse"
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
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" x2="12" y1="19" y2="22" />
                          </svg>
                          <span className="text-[10px] text-zinc-500 mt-1">
                            Transcribing
                          </span>
                        </>
                      ) : audio.status === 'ready' ? (
                        <svg
                          className="size-8 text-purple-500"
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
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                      ) : (
                        <div
                          className="flex flex-col items-center justify-center cursor-help"
                          title={audio.transcript || 'Transcription failed'}
                        >
                          <div className="text-red-500">
                            <XIcon size={24} />
                          </div>
                          <span className="text-[10px] text-red-500 mt-1">
                            Failed
                          </span>
                        </div>
                      )}

                      {audio.status !== 'uploading' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'absolute -top-2.5 -right-2.5 size-5 rounded-full shadow-md z-20 transition-colors',
                            audio.status === 'error'
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-red-500 hover:text-white',
                          )}
                          title={
                            audio.status === 'error'
                              ? 'Remove failed audio'
                              : 'Remove audio'
                          }
                          onClick={() => {
                            setAudioContents((current) =>
                              current.filter((a) => a.id !== audio.id),
                            );
                          }}
                        >
                          <X className="size-3" />
                        </Button>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-[80px] truncate text-center">
                      {audio.name}
                    </div>
                  </div>
                ))}

                {uploadQueue.map((filename, qIdx) => (
                  <PreviewAttachment
                    key={`upload-${qIdx}-${filename}`}
                    attachment={{
                      url: '',
                      name: filename,
                      contentType: '',
                    }}
                    isUploading={true}
                    uploadStatusLabel="Uploading…"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mt-4" ref={inputWrapperRef}>
        {/* Show selected mentions above the input with helpful context */}
        <AnimatePresence>
          {selectedMentions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{
                duration: 0.25,
                ease: [0.4, 0, 0.2, 1],
              }}
              className="pt-1"
            >
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Predictive suggestions list - positioned ABOVE the textarea */}
        {showPredictions && predictions.length > 0 && !showMentions && (
          <div className="hidden">{/* Hidden here, moved below input */}</div>
        )}

        <motion.div
          key={`textarea-${chatId}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={
            isNewChat && input.length === 0 && attachments.length === 0
              ? { opacity: 1, scale: 1 }
              : { opacity: 1, scale: 1 }
          }
          onClick={(e) => {
            // Don't trigger animation if clicking on dropdown menus or buttons
            const target = e.target as HTMLElement;
            if (
              target.closest('[role="menu"]') ||
              target.closest('[data-radix-popper-content-wrapper]') ||
              target.closest('button') ||
              target.closest('[role="menuitem"]') ||
              isPlusDropdownOpen
            ) {
              return;
            }

            if (isNewChat && input.length === 0 && attachments.length === 0) {
              const element = document.getElementById(
                `textarea-motion-${chatId}`,
              );
              if (element) {
                // Elastic shrink animation
                element.animate(
                  [
                    { transform: 'scale(1)' },
                    { transform: 'scale(0.97)' },
                    { transform: 'scale(1)' },
                  ],
                  {
                    duration: 300,
                    easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  },
                );

                // Orange burst glow explosion
                element.animate(
                  [
                    {
                      filter: 'drop-shadow(0 0 0px rgba(249, 115, 22, 0))',
                      offset: 0,
                    },
                    {
                      filter: 'drop-shadow(0 0 24px rgba(249, 115, 22, 0.9))',
                      offset: 0.15,
                    },
                    {
                      filter: 'drop-shadow(0 0 48px rgba(249, 115, 22, 0.4))',
                      offset: 0.4,
                    },
                    {
                      filter: 'drop-shadow(0 0 0px rgba(249, 115, 22, 0))',
                      offset: 1,
                    },
                  ],
                  { duration: 700, delay: 30, easing: 'ease-out' },
                );
              }
            }
          }}
          id={`textarea-motion-${chatId}`}
          style={{
            borderRadius: 24,
          }}
          className={cn(
            'transition-all duration-300',
            // Animated border trace while AI is responding
            (status === 'streaming' || status === 'submitted') && (
              selectedResearchMode === 'nexus'
                ? 'input-loading-border input-loading-border-nexus'
                : 'input-loading-border'
            ),
            // Finish flash when response completes
            showFinish && 'input-finish-border',
            selectedResearchMode === 'nexus' &&
              'ring-1 ring-purple-500/40 shadow-[0_0_15px_2px_rgba(147,51,234,0.12),0_0_30px_4px_rgba(147,51,234,0.06)]',
          )}
          transition={{
            duration: 0.3,
            delay: 0.05,
            ease: [0.19, 1, 0.22, 1],
          }}
        >
          <div
            className={cn(
              'w-full relative z-[2] overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.1),0_2px_16px_0_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(255,255,255,0.6),inset_0_-1px_0_0_rgba(255,255,255,0.2)] dark:shadow-[0_4px_16px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.06),inset_0_-1px_0_0_rgba(255,255,255,0.03)] p-2',
              isDragging && 'input-drag-swell-inner',
            )}
            >
              <div
                className={cx(
                  'grid w-full transition-all duration-200 ease-in-out',
                  // Expand layout when multiline OR when persona/profile is selected (to show indicator)
                  isMultiLine || selectedPersona || selectedProfile
                    ? "grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] [grid-template-areas:'primary_primary_primary'_'leading_footer_trailing'] gap-y-2"
                    : "grid-cols-[auto_1fr_auto] [grid-template-areas:'leading_primary_trailing'] items-center",
                )}
              >
                <div
                  style={{ gridArea: 'primary' }}
                  className="relative w-full min-w-0"
                >
                  <Textarea
                    data-testid="multimodal-input"
                    ref={textareaRef}
                    aria-label="Message input - Type your message here, press Enter to send"
                    aria-describedby="input-hint"
                    placeholder={
                      selectedMentions.length > 0
                        ? 'Continue your message…'
                        : 'Ask anything…'
                    }
                    value={
                      inputValueAtSubmitRef.current !== null
                        ? inputValueAtSubmitRef.current
                        : input
                    }
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
                      'min-h-[40px] resize-none rounded-2xl !text-base',
                      'bg-transparent border-0 shadow-none',
                      disableInputTransitions
                        ? 'transition-none'
                        : 'transition-[height,padding] duration-200 ease-in-out',
                      'custom-scrollbar',
                      'px-3 py-2',
                              isDragging && 'pointer-events-none',
                      className,
                    )}
                    style={{
                      maxHeight: `calc(${effectiveTextareaMaxVh}dvh)`,
                      overflowY: 'hidden',
                    }}
                    rows={1}
                    autoFocus
                  />
                </div>

                {/* Leading Area: Attach Button + Settings Menu */}
                <div
                  style={{ gridArea: 'leading' }}
                  className={cx(
                    'flex items-center gap-1.5 pl-2 z-20',
                    isMultiLine || selectedPersona || selectedProfile
                      ? 'pb-1'
                      : '',
                  )}
                >
                  <div className="flex items-center gap-0.5 rounded-full border border-zinc-200/80 bg-muted/35 p-0.5 dark:border-zinc-700/60 dark:bg-muted/25">
                    {/* Attach Dropdown */}
                    <DropdownMenu
                      open={isPlusDropdownOpen}
                      onOpenChange={setIsPlusDropdownOpen}
                    >
                      <DropdownMenuTrigger
                        asChild
                        id={`composer-attach-dropdown-trigger-${chatId}`}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'rounded-full p-2 h-10 w-10 md:h-9 md:w-9 flex items-center justify-center hover:bg-zinc-200/60 dark:hover:bg-zinc-800/55 transition-all duration-200 touch-target-sm',
                            selectedPersonaId &&
                              'ring-2 ring-eos-orange/30 bg-eos-orange/5',
                          )}
                        >
                          <PlusIcon size={18} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        side="top"
                        className="w-56 z-[200]"
                        onCloseAutoFocus={(e) => e.preventDefault()}
                        onPointerDownOutside={(e) => {
                          // Prevent clicks inside submenus from triggering focus changes
                          const target = e.target as HTMLElement;
                          if (
                            target.closest('[role="menu"]') ||
                            target.closest(
                              '[data-radix-popper-content-wrapper]',
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }}
                        >
                          <Paperclip className="mr-2 size-4" />
                          <span>Upload File</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Research Mode Submenu */}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            {selectedResearchMode === 'nexus' ? (
                              <Telescope className="mr-2 size-4 text-purple-500" />
                            ) : (
                              <Search className="mr-2 size-4" />
                            )}
                            <span>Research Mode</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  onResearchModeChange?.('off');
                                }}
                                className="gap-2"
                              >
                                <Search className="size-4" />
                                <span>Standard</span>
                                {selectedResearchMode === 'off' && (
                                  <Check className="ml-auto size-4" />
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  onResearchModeChange?.('nexus');
                                }}
                                className="gap-2"
                              >
                                <Telescope className="size-4 text-purple-500" />
                                <span>Nexus Research</span>
                                {selectedResearchMode === 'nexus' && (
                                  <Check className="ml-auto size-4" />
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>

                        {/* AI Persona Submenu */}
                        {onPersonaSelect &&
                          onCreatePersona &&
                          onEditPersona && (
                            <>
                              <DropdownMenuSeparator />
                              <PersonaSubmenu
                                selectedPersonaId={selectedPersonaId}
                                selectedProfileId={selectedProfileId}
                                onPersonaSelect={onPersonaSelect}
                                onCreatePersona={onCreatePersona}
                                onEditPersona={onEditPersona}
                                onProfileSelect={onProfileSelect}
                                onCreateProfile={onCreateProfile}
                                onEditProfile={onEditProfile}
                                messages={messages}
                                onCloseDropdown={() =>
                                  setIsPlusDropdownOpen(false)
                                }
                              />
                            </>
                          )}

                        {/* Visibility Submenu */}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            {selectedVisibilityType === 'public' ? (
                              <GlobeIcon size={16} />
                            ) : (
                              <LockIcon size={16} />
                            )}
                            <span className="ml-2">Visibility</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  setVisibilityType('private');
                                }}
                                className="gap-2"
                              >
                                <LockIcon size={16} />
                                <span>Private</span>
                                {selectedVisibilityType === 'private' && (
                                  <Check className="ml-auto size-4" />
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  setVisibilityType('public');
                                }}
                                className="gap-2"
                              >
                                <GlobeIcon size={16} />
                                <span>Public</span>
                                {selectedVisibilityType === 'public' && (
                                  <Check className="ml-auto size-4" />
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Footer Area: Shows selected persona/profile indicators and other context */}
                {(isMultiLine || selectedPersona || selectedProfile) && (
                  <div
                    style={{ gridArea: 'footer' }}
                    className="min-w-0 flex items-center gap-2.5 overflow-x-auto scrollbar-none ml-2"
                  >
                    {/* Selected Persona Indicator */}
                    <AnimatePresence mode="popLayout">
                      {selectedPersona && (
                        <motion.div
                          key={`persona-${selectedPersona.id}`}
                          initial={{ opacity: 0, scale: 0.9, x: -8 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9, x: -8 }}
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 25,
                          }}
                          whileHover={{ scale: 1.02 }}
                          className="flex-shrink-0"
                        >
                          <div className="group inline-flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full bg-gradient-to-r from-eos-orange/15 to-eos-orange/5 dark:from-eos-orange/25 dark:to-eos-orange/10 text-eos-orange dark:text-eos-orangeLight text-[13px] font-medium border border-eos-orange/25 dark:border-eos-orange/35 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-eos-orange/40 transition-all duration-200">
                            <span className="flex items-center gap-1.5">
                              {selectedPersona.iconUrl ? (
                                <motion.div
                                  className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-eos-orange/20"
                                  animate={prefersReducedMotion ? {} : { scale: [1, 1.06, 1] }}
                                  transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut', repeatDelay: 0.5 }}
                                >
                                  <Image
                                    src={selectedPersona.iconUrl}
                                    alt=""
                                    width={20}
                                    height={20}
                                    className="object-cover w-full h-full"
                                  />
                                </motion.div>
                              ) : (
                                <motion.div
                                  className="w-5 h-5 rounded-full bg-gradient-to-br from-eos-orange to-eos-orangeLight flex items-center justify-center flex-shrink-0 shadow-sm text-white"
                                  animate={prefersReducedMotion ? {} : { scale: [1, 1.06, 1] }}
                                  transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut', repeatDelay: 0.5 }}
                                >
                                  <UserIcon size={10} />
                                </motion.div>
                              )}
                              <span className="font-medium max-w-[140px] truncate">
                                {selectedPersona.name}
                              </span>
                            </span>
                            {onPersonaSelect && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPersonaSelect(null);
                                }}
                                className="ml-0.5 text-eos-orange/50 hover:text-red-500 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 rounded-full transition-all duration-150 p-1 -mr-0.5 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                                aria-label="Clear persona selection"
                                title="Use Default EOS AI"
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Selected Profile Indicator */}
                      {selectedProfile &&
                        (() => {
                          const theme = getProfileTheme(selectedProfile.id);
                          const textColorClass = theme.gradient.from.replace(
                            'from-',
                            'text-',
                          );
                          return (
                            <motion.div
                              key={`profile-${selectedProfile.id}`}
                              initial={{ opacity: 0, scale: 0.9, x: -8 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.9, x: -8 }}
                              transition={{
                                type: 'spring',
                                stiffness: 400,
                                damping: 25,
                                delay: 0.05,
                              }}
                              whileHover={{ scale: 1.02 }}
                              className="flex-shrink-0"
                            >
                              <div
                                className={cn(
                                  'group inline-flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full text-[13px] font-medium border backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200',
                                  theme.borderColor,
                                  textColorClass,
                                  'bg-gradient-to-r from-white/80 to-white/40 dark:from-zinc-800/80 dark:to-zinc-800/40',
                                  'hover:border-opacity-60',
                                )}
                              >
                                <span className="flex items-center gap-1.5">
                                  <div
                                    className={cn(
                                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-sm',
                                      theme.iconBg,
                                    )}
                                  >
                                    {selectedProfile.name
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>
                                  <span className="font-medium max-w-[140px] truncate">
                                    {selectedProfile.name}
                                  </span>
                                </span>
                                {onProfileSelect && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onProfileSelect(null);
                                    }}
                                    className="ml-0.5 opacity-50 hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 rounded-full transition-all duration-150 p-1 -mr-0.5 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                                    aria-label="Clear profile selection"
                                    title="Remove Profile"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })()}
                    </AnimatePresence>
                  </div>
                )}

                {/* Trailing Area: Voice, Stop, Send */}
                <div
                  style={{ gridArea: 'trailing' }}
                  className={cx(
                    'flex items-center gap-1.5 pr-2 z-20',
                    isMultiLine || selectedPersona || selectedProfile
                      ? 'pb-1'
                      : '',
                  )}
                >
                  {/* Show stop button during both thinking (submitted) and streaming phases */}
                  {status === 'submitted' || status === 'streaming' ? (
                    <motion.div
                      key={`stop-${chatId}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <StopButton
                        stop={stop}
                        setMessages={setMessages}
                        chatId={chatId}
                      />
                    </motion.div>
                  ) : (
                    <>
                      {session?.user && (
                        <motion.div
                          key={`voice-${chatId}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                        >
                          <VoiceFAB
                            variant="inline"
                            size="sm"
                            selectedModelId={selectedModelId}
                            selectedProviderId={selectedProviderId}
                            selectedPersonaId={selectedPersonaId || undefined}
                            selectedProfileId={selectedProfileId || undefined}
                            chatId={chatId}
                            onAppendMessage={append}
                            onUpdateMessages={setMessages}
                          />
                        </motion.div>
                      )}
                      <div
                        className="mx-0.5 hidden h-8 w-px shrink-0 bg-border sm:block"
                        aria-hidden
                      />
                      <motion.div
                        key={`send-${chatId}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <SendButton
                          input={input}
                          submitForm={submitForm}
                          uploadQueue={uploadQueue}
                          attachmentsCount={attachmentsCount}
                          pdfCount={pdfCount}
                          docCount={docCount}
                          audioCount={audioCount}
                          audioProcessing={audioProcessing}
                          handleSubmit={handleSubmit}
                          attachments={attachments}
                        />
                      </motion.div>
                    </>
                  )}
                </div>
              </div>
            </div>
        </motion.div>

        {/* Predictive suggestions list - positioned BELOW the textarea */}
        {showPredictions && predictions.length > 0 && !showMentions && (
          <div className="absolute top-full left-0 right-0 mt-2 z-10">
            <div className="flex flex-wrap gap-2 justify-start px-2">
              {predictions.slice(0, 3).map((p, index) => (
                <motion.button
                  key={p}
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{
                    duration: 0.2,
                    delay: index * 0.05,
                    ease: 'easeOut',
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    // Smart fill behavior for prediction completion
                    const current = (input || '').trimEnd();
                    const remainder = p.trim();

                    // Determine the best way to join the current input with the prediction
                    let finalText = current;

                    // Check if current input ends with a partial word (no space at end)
                    const lastSpaceIndex = current.lastIndexOf(' ');
                    const lastWord =
                      lastSpaceIndex === -1
                        ? current
                        : current.slice(lastSpaceIndex + 1);
                    const remainderFirstWord = remainder.split(/\s+/)[0] || '';

                    // Check if the remainder starts with the partial word (case-insensitive)
                    // If so, replace the partial word with the full completion
                    const partialMatch =
                      lastWord.length > 0 &&
                      lastWord.length < 4 &&
                      remainderFirstWord
                        .toLowerCase()
                        .startsWith(lastWord.toLowerCase());

                    if (partialMatch) {
                      // Replace partial word with completion
                      const baseText =
                        lastSpaceIndex === -1
                          ? ''
                          : current.slice(0, lastSpaceIndex + 1);
                      finalText = baseText + remainder;
                    } else {
                      // Normal append with smart spacing
                      const needsSpace =
                        current.length > 0 &&
                        !current.endsWith(' ') &&
                        !remainder.startsWith(' ') &&
                        !/^[.,!?;:]/.test(remainder); // Don't add space before punctuation

                      finalText = current + (needsSpace ? ' ' : '') + remainder;
                    }

                    setInput(finalText);
                    setShowPredictions(false);
                    setPredictions([]);
                    textareaRef.current?.focus();

                    // Track prediction usage for ranking
                    try {
                      await fetch('/api/predictions/rank', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phrase: p }),
                      });
                    } catch {}
                  }}
                  className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 bg-white/50 dark:bg-zinc-800/50 hover:bg-white/80 dark:hover:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 rounded-full transition-all shadow-sm"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{p}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 text-xs">
                      →
                    </span>
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom toolbar (Secondary controls only) */}
        <div className="mt-2 flex flex-col md:flex-row flex-wrap items-start md:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            {/* Only show usage chips for free plan users */}
            {user?.plan === 'free' && (
              <UsageChip
                label="Uploads"
                used={uploadsUsed}
                limit={uploadLimit}
                title="Free plan: uploads and context files count toward this limit (hover for detail)."
                tooltipDescription="Counts files you attach in chat and items added as context (e.g. pulled into a conversation). Resets per your plan; upgrade for higher caps."
              />
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Only show usage chips for free plan users */}
            <UsageLimitIndicator />
          </div>
        </div>
      </div>
    </div>
  );
}

const MemoizedMultimodalInput = memo(
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
    if (prevProps.selectedPersonaId !== nextProps.selectedPersonaId)
      return false;
    if (prevProps.selectedProfileId !== nextProps.selectedProfileId)
      return false;
    if (prevProps.selectedResearchMode !== nextProps.selectedResearchMode)
      return false;

    return true;
  },
);

// Wrap MultimodalInput with error boundary to prevent input errors from crashing the chat
export const MultimodalInput: React.FC<
  Parameters<typeof PureMultimodalInput>[0]
> = (props) => (
  <ErrorBoundary
    context="Chat Input"
    fallback={(error, reset) => (
      <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5 mx-4 mb-4">
        <p className="text-sm text-muted-foreground">
          Input component error. Please refresh the page.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-xs text-primary hover:underline mt-2"
        >
          Refresh
        </button>
      </div>
    )}
  >
    <MemoizedMultimodalInput {...props} />
  </ErrorBoundary>
);

function PureStopButton({
  stop,
  setMessages,
  chatId,
}: {
  stop: () => void;
  setMessages: ChatHelpers['setMessages'];
  chatId: string;
}) {
  const [isStopping, setIsStopping] = useState(false);

  const handleStop = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (isStopping) return; // Prevent multiple clicks

    setIsStopping(true);

    try {
      // First, call the local stop function to halt the stream
      stop();

      // Then call the API to clean up server-side resources and Redis cache
      const response = await fetch(`/api/chat/${chatId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to stop stream on server:', response.statusText);
      } else {
        const data = await response.json();
      }

      // Force a re-render to ensure UI updates
      setMessages((messages) => messages);
    } catch (error) {
      console.error('Error stopping stream:', error);
      // Even if the API call fails, the local stop() should have interrupted the stream
    } finally {
      // Reset stopping state after a short delay
      setTimeout(() => setIsStopping(false), 500);
    }
  };

  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
      transition={springSnappy}
    >
      <Button
        data-testid="stop-button"
        className="rounded-full p-2 h-10 w-10 md:h-9 md:w-9 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 bg-background shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200 touch-target-sm"
        onClick={handleStop}
        disabled={isStopping}
        title="Stop generation"
        aria-label={isStopping ? 'Stopping response' : 'Stop response generation'}
      >
        {isStopping ? (
          <div className="size-4 animate-spin text-zinc-500">
            <LoaderIcon size={16} />
          </div>
        ) : (
          <Square className="size-4 text-zinc-500 fill-zinc-500" />
        )}
      </Button>
    </motion.div>
  );
}

const StopButton = memo(PureStopButton, (prev, next) => {
  return prev.chatId === next.chatId;
});

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
  attachmentsCount,
  pdfCount,
  docCount,
  audioCount,
  audioProcessing,
  handleSubmit,
  attachments,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
  attachmentsCount: number;
  pdfCount: number;
  docCount: number;
  audioCount: number;
  audioProcessing: boolean;
  handleSubmit: any;
  attachments: Array<Attachment>;
}) {
  const nothingToSend =
    input.trim().length === 0 &&
    attachmentsCount === 0 &&
    pdfCount === 0 &&
    docCount === 0 &&
    audioCount === 0;
  const isDisabled = nothingToSend || uploadQueue.length > 0 || audioProcessing;
  const [isBursting, setIsBursting] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={prefersReducedMotion || isDisabled ? undefined : { scale: 1.05 }}
      whileTap={prefersReducedMotion || isDisabled ? undefined : { scale: 0.96 }}
      transition={springSnappy}
    >
      <Button
        data-testid="send-button"
        className={cx(
          'relative rounded-full p-2 h-10 w-10 flex items-center justify-center transition-[background-color,box-shadow,ring] duration-200 touch-target-sm',
          isDisabled
            ? 'border border-zinc-200 bg-zinc-100 text-zinc-400 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed'
            : 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 hover:bg-primary/90 hover:shadow-lg hover:ring-primary/45',
          isBursting && 'send-burst',
        )}
        onClick={(event) => {
          event.preventDefault();
          if (!isDisabled) {
            setIsBursting(true);
            setTimeout(() => setIsBursting(false), 420);
            submitForm();
          }
        }}
        disabled={isDisabled}
        aria-label={
          audioProcessing
            ? 'Waiting for audio transcription'
            : uploadQueue.length > 0
              ? 'Waiting for uploads'
              : nothingToSend
                ? 'Send message (empty)'
                : 'Send message'
        }
        title={
          audioProcessing
            ? 'Waiting for audio transcription to complete...'
            : uploadQueue.length > 0
              ? 'Waiting for uploads to complete...'
              : nothingToSend
                ? 'Type a message or add files'
                : 'Send message'
        }
      >
        <ArrowUp className="size-5" />
      </Button>
    </motion.div>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.attachmentsCount !== nextProps.attachmentsCount) return false;
  if (prevProps.pdfCount !== nextProps.pdfCount) return false;
  if (prevProps.docCount !== nextProps.docCount) return false;
  if (prevProps.audioProcessing !== nextProps.audioProcessing) return false;
  // We intentionally don't compare handleSubmit or attachments since they don't affect rendering
  return true;
});

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightPrefix(suggestion: string, prefix: string) {
  if (!prefix) return escapeHtml(suggestion);
  const i = suggestion.toLowerCase().indexOf(prefix.toLowerCase());
  if (i !== 0) return escapeHtml(suggestion);
  const head = escapeHtml(suggestion.slice(0, prefix.length));
  const tail = escapeHtml(suggestion.slice(prefix.length));
  return `<span class="predictive-highlight">${head}</span>${tail}`;
}
