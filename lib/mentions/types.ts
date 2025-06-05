// Enhanced mention system types

export type MentionCategory =
  | 'resource' // Documents, files, knowledge base items
  | 'calendar' // Calendar events, time slots
  | 'person' // Team members, contacts
  | 'tool' // AI tools and capabilities
  | 'command' // Quick actions and commands
  | 'template' // Message templates
  | 'history' // Previous chats or messages
  | 'insight'; // Analytics and reports

export type MentionType =
  // Resources
  | 'document'
  | 'scorecard'
  | 'vto'
  | 'rocks'
  | 'people'
  | 'file'
  | 'knowledge'
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
  | 'trends';

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
