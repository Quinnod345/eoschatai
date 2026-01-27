// Enhanced mention system types

export type MentionCategory =
  | 'resource' // Documents, files, knowledge base items
  | 'calendar' // Calendar events, time slots
  | 'person' // Team members, contacts
  | 'tool' // AI tools and capabilities
  | 'command' // Quick actions and commands
  | 'template' // Message templates
  | 'history' // Previous chats or messages
  | 'insight' // Analytics and reports
  | 'composer'; // Composer documents (AI-generated content)

export type MentionType =
  // Resources
  | 'document'
  | 'scorecard'
  | 'vto'
  | 'rocks'
  | 'people'
  | 'file'
  | 'knowledge'
  | 'recording' // Voice recordings
  | 'accountability' // Accountability charts
  // Calendar
  | 'calendar'
  | 'event'
  | 'meeting'
  | 'availability'
  // Person
  | 'user'
  | 'team'
  | 'contact'
  // Tools
  | 'search'
  | 'analyze'
  | 'summarize'
  | 'create'
  // Commands
  | 'help'
  | 'settings'
  | 'export'
  | 'share'
  // Templates
  | 'agenda'
  | 'report'
  | 'email'
  // History
  | 'chat'
  | 'message'
  // Insights
  | 'analytics'
  | 'trends'
  // Composers (AI-generated documents)
  | 'composer' // Generic composer
  | 'text-composer' // Text/markdown composer
  | 'code-composer' // Code composer
  | 'sheet-composer' // Spreadsheet composer
  | 'chart-composer' // Chart composer
  | 'image-composer' // Image composer
  | 'vto-composer' // VTO composer
  | 'accountability-composer'; // Accountability chart composer

// Composer kind to mention type mapping
export type ComposerKind =
  | 'text'
  | 'code'
  | 'image'
  | 'sheet'
  | 'chart'
  | 'vto'
  | 'accountability';

export const COMPOSER_KIND_TO_MENTION_TYPE: Record<ComposerKind, MentionType> = {
  text: 'text-composer',
  code: 'code-composer',
  image: 'image-composer',
  sheet: 'sheet-composer',
  chart: 'chart-composer',
  vto: 'vto-composer',
  accountability: 'accountability-composer',
};

export const MENTION_TYPE_TO_COMPOSER_KIND: Partial<Record<MentionType, ComposerKind>> = {
  'text-composer': 'text',
  'code-composer': 'code',
  'image-composer': 'image',
  'sheet-composer': 'sheet',
  'chart-composer': 'chart',
  'vto-composer': 'vto',
  'accountability-composer': 'accountability',
  composer: 'text', // Default to text for generic composer mentions
};

// Composer-specific mention shortcuts
export const COMPOSER_MENTION_SHORTCUTS: Record<string, ComposerKind | 'all'> = {
  '@doc': 'text',
  '@code': 'code',
  '@sheet': 'sheet',
  '@chart': 'chart',
  '@image': 'image',
  '@vto': 'vto',
  '@ac': 'accountability',
  '@composer': 'all', // Shows all composers
};

export interface MentionResource {
  id: string;
  name: string;
  type: MentionType;
  category: MentionCategory;
  description: string;
  icon: string; // Icon name or component
  color?: string; // Optional color for visual distinction

  // Enhanced properties
  aliases?: string[]; // Alternative names for searching
  shortcut?: string; // Keyboard shortcut (e.g., "@cal" for calendar)
  preview?: string; // Quick preview of content
  metadata?: Record<string, any>; // Additional data

  // Dynamic properties
  isDynamic?: boolean; // If true, can have dynamic instances
  instances?: MentionInstance[]; // Specific instances (e.g., specific documents)

  // Actions
  defaultAction?: MentionAction; // What happens when selected
  availableActions?: MentionAction[]; // Additional actions

  // Permissions
  requiresPremium?: boolean;
  requiredPermissions?: string[];
}

export interface MentionInstance {
  id: string;
  parentId: string; // ID of parent MentionResource
  name: string;
  description?: string;
  preview?: string;
  lastUsed?: Date;
  metadata?: Record<string, any>;
}

// Composer-specific mention instance with rich metadata
export interface ComposerMentionInstance extends MentionInstance {
  kind: ComposerKind;
  title: string;
  content?: string; // Full content for context
  contentSummary?: string; // AI-generated summary
  tags?: string[];
  category?: string;
  viewCount?: number;
  editCount?: number;
  mentionCount?: number;
  lastAccessedAt?: Date;
  createdAt: Date;
  userId: string;
  isContext?: boolean; // Whether this composer is used for RAG
}

// Result type when a composer mention is selected
export interface ComposerMentionSelection {
  composer: ComposerMentionInstance;
  action: 'reference' | 'edit' | 'open' | 'link';
  instruction?: string; // For edit actions, the instruction to apply
}

// Icons for each composer type
export const COMPOSER_KIND_ICONS: Record<ComposerKind, string> = {
  text: 'FileText',
  code: 'Code',
  image: 'Image',
  sheet: 'Table',
  chart: 'BarChart',
  vto: 'Target',
  accountability: 'Users',
};

// Display names for each composer type
export const COMPOSER_KIND_DISPLAY_NAMES: Record<ComposerKind, string> = {
  text: 'Text Document',
  code: 'Code',
  image: 'Image',
  sheet: 'Spreadsheet',
  chart: 'Chart',
  vto: 'V/TO',
  accountability: 'Accountability Chart',
};

// Colors for each composer type (for visual distinction)
export const COMPOSER_KIND_COLORS: Record<ComposerKind, string> = {
  text: '#3B82F6', // blue
  code: '#10B981', // green
  image: '#F59E0B', // amber
  sheet: '#8B5CF6', // purple
  chart: '#EC4899', // pink
  vto: '#EF4444', // red
  accountability: '#06B6D4', // cyan
};

export interface MentionAction {
  id: string;
  name: string;
  description: string;
  handler: (mention: MentionResource | MentionInstance) => void | Promise<void>;
  icon?: string;
  shortcut?: string;
}

export interface MentionContext {
  // Current conversation context
  currentChat?: string;
  recentMessages?: string[];
  selectedPersona?: string;

  // User context
  userId: string;
  userRole?: string;
  userPreferences?: Record<string, any>;

  // Time context
  currentTime: Date;
  timezone?: string;

  // Search context
  searchQuery?: string;
  filters?: MentionFilter[];
}

export interface MentionFilter {
  type: 'category' | 'type' | 'permission' | 'recency' | 'custom';
  value: any;
  operator?: 'equals' | 'contains' | 'gt' | 'lt' | 'in';
}

export interface MentionSuggestion {
  resource: MentionResource | MentionInstance;
  relevanceScore: number;
  reason?: string; // Why this was suggested
  context?: string; // Additional context
}

export interface MentionState {
  // UI State
  isOpen: boolean;
  searchQuery: string;
  selectedIndex: number;
  position: { top: number; left: number };

  // Data State
  suggestions: MentionSuggestion[];
  selectedMentions: (MentionResource | MentionInstance)[];
  recentMentions: (MentionResource | MentionInstance)[];
  favoriteMentions: (MentionResource | MentionInstance)[];

  // Loading States
  isLoading: boolean;
  isSearching: boolean;

  // Filters
  activeFilters: MentionFilter[];
  activeCategory?: MentionCategory;
}

// Enhanced mention command structure
export interface MentionCommand {
  trigger: string; // e.g., "@help", "@search"
  aliases?: string[];
  category: MentionCategory;
  execute: (args: string[], context: MentionContext) => Promise<any>;
  description: string;
  usage?: string;
  examples?: string[];
}
