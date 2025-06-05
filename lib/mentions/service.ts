import {
  MentionResource,
  MentionInstance,
  MentionContext,
  MentionSuggestion,
  MentionCategory,
  MentionType,
  MentionFilter,
  MentionCommand,
} from './types';

// Enhanced mention service with intelligent features
export class MentionService {
  private static instance: MentionService;
  private resources: Map<string, MentionResource> = new Map();
  private instances: Map<string, MentionInstance[]> = new Map();
  private commands: Map<string, MentionCommand> = new Map();
  private userHistory: Map<string, MentionInstance[]> = new Map();

  private constructor() {
    this.initializeDefaultResources();
    this.initializeCommands();
  }

  static getInstance(): MentionService {
    if (!MentionService.instance) {
      MentionService.instance = new MentionService();
    }
    return MentionService.instance;
  }

  // Initialize default mention resources
  private initializeDefaultResources() {
    const defaultResources: MentionResource[] = [
      // Calendar resources
      {
        id: 'calendar',
        name: 'Calendar',
        type: 'calendar',
        category: 'calendar',
        description: 'Access your calendar events and schedule',
        icon: 'Calendar',
        color: 'blue',
        aliases: ['cal', 'schedule', 'events'],
        shortcut: '@cal',
        isDynamic: true,
        defaultAction: {
          id: 'view-calendar',
          name: 'View Calendar',
          description: 'Show upcoming events',
          handler: async () => console.log('View calendar'),
        },
      },
      {
        id: 'availability',
        name: 'Find Available Time',
        type: 'availability',
        category: 'calendar',
        description: 'Find free time slots in your calendar',
        icon: 'Clock',
        color: 'green',
        aliases: ['free', 'available', 'slots'],
        shortcut: '@free',
      },
      // Document resources
      {
        id: 'documents',
        name: 'Documents',
        type: 'document',
        category: 'resource',
        description: 'Access your documents and files',
        icon: 'FileText',
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
        icon: 'BarChart',
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
        icon: 'Target',
        color: 'indigo',
        aliases: ['vision', 'traction', 'strategy'],
        shortcut: '@vto',
      },
      // People resources
      {
        id: 'team',
        name: 'Team Members',
        type: 'team',
        category: 'person',
        description: 'Mention team members',
        icon: 'Users',
        color: 'teal',
        aliases: ['people', 'members'],
        shortcut: '@team',
        isDynamic: true,
      },
      // Tool resources
      {
        id: 'search',
        name: 'Search',
        type: 'search',
        category: 'tool',
        description: 'Search through all your content',
        icon: 'Search',
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
        icon: 'TrendingUp',
        color: 'red',
        aliases: ['analytics', 'insights'],
        shortcut: '@analyze',
      },
      // Command resources
      {
        id: 'help',
        name: 'Help',
        type: 'help',
        category: 'command',
        description: 'Get help with using the system',
        icon: 'HelpCircle',
        color: 'blue',
        aliases: ['?', 'guide'],
        shortcut: '@help',
      },
      // Template resources
      {
        id: 'agenda',
        name: 'Meeting Agenda',
        type: 'agenda',
        category: 'template',
        description: 'Create a meeting agenda template',
        icon: 'List',
        color: 'purple',
        aliases: ['meeting'],
        shortcut: '@agenda',
      },
    ];

    defaultResources.forEach((resource) => {
      this.resources.set(resource.id, resource);
    });
  }

  // Initialize mention commands
  private initializeCommands() {
    const commands: MentionCommand[] = [
      {
        trigger: '@help',
        aliases: ['@?', '@guide'],
        category: 'command',
        description: 'Show help for using mentions',
        execute: async () => {
          return {
            title: 'Mention System Help',
            sections: [
              {
                title: 'Basic Usage',
                content: 'Type @ followed by a resource name to mention it.',
              },
              {
                title: 'Shortcuts',
                content:
                  'Use shortcuts like @cal for calendar, @doc for documents.',
              },
              {
                title: 'Commands',
                content:
                  'Special commands: @help, @search, @recent, @favorites',
              },
            ],
          };
        },
      },
      {
        trigger: '@recent',
        category: 'command',
        description: 'Show recently used mentions',
        execute: async (args, context) => {
          const recent = this.getRecentMentions(context.userId);
          return { mentions: recent.slice(0, 10) };
        },
      },
      {
        trigger: '@favorites',
        aliases: ['@fav'],
        category: 'command',
        description: 'Show favorite mentions',
        execute: async (args, context) => {
          const favorites = this.getFavoriteMentions(context.userId);
          return { mentions: favorites };
        },
      },
    ];

    commands.forEach((cmd) => {
      this.commands.set(cmd.trigger, cmd);
      cmd.aliases?.forEach((alias) => {
        this.commands.set(alias, cmd);
      });
    });
  }

  // Get intelligent suggestions based on context
  async getSuggestions(
    query: string,
    context: MentionContext,
    limit: number = 10,
  ): Promise<MentionSuggestion[]> {
    const suggestions: MentionSuggestion[] = [];

    // 1. Check for exact commands
    if (query.startsWith('@')) {
      const command = this.commands.get(query.toLowerCase());
      if (command) {
        return [
          {
            resource: {
              id: command.trigger,
              name: command.trigger,
              type: 'help' as MentionType,
              category: command.category,
              description: command.description,
              icon: 'Terminal',
            },
            relevanceScore: 1.0,
            reason: 'Exact command match',
          },
        ];
      }
    }

    // 2. Search through resources
    const searchTerm = query.replace('@', '').toLowerCase();

    for (const [id, resource] of this.resources) {
      let score = 0;
      let reason = '';

      // Name matching
      if (resource.name.toLowerCase().includes(searchTerm)) {
        score += 0.8;
        reason = 'Name match';
      }

      // Alias matching
      if (
        resource.aliases?.some((alias) =>
          alias.toLowerCase().includes(searchTerm),
        )
      ) {
        score += 0.7;
        reason = 'Alias match';
      }

      // Shortcut matching
      if (resource.shortcut?.toLowerCase().includes(searchTerm)) {
        score += 0.9;
        reason = 'Shortcut match';
      }

      // Context-based scoring
      score += this.getContextScore(resource, context);

      if (score > 0) {
        suggestions.push({
          resource,
          relevanceScore: Math.min(score, 1.0),
          reason,
        });
      }

      // Add dynamic instances if applicable
      if (resource.isDynamic && score > 0.5) {
        const instances = await this.getDynamicInstances(
          resource,
          searchTerm,
          context,
        );
        instances.forEach((instance) => {
          suggestions.push({
            resource: instance,
            relevanceScore: score * 0.9, // Slightly lower than parent
            reason: `${reason} (specific item)`,
          });
        });
      }
    }

    // 3. Add recently used items
    const recentItems = this.getRecentMentions(context.userId);
    recentItems.forEach((item) => {
      const existing = suggestions.find((s) => s.resource.id === item.id);
      if (!existing && item.name.toLowerCase().includes(searchTerm)) {
        suggestions.push({
          resource: item,
          relevanceScore: 0.6,
          reason: 'Recently used',
        });
      }
    });

    // 4. Sort by relevance and limit
    return suggestions
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  // Calculate context-based relevance score
  private getContextScore(
    resource: MentionResource,
    context: MentionContext,
  ): number {
    let score = 0;

    // Time-based scoring
    const hour = context.currentTime.getHours();
    if (resource.type === 'calendar' && hour >= 7 && hour <= 9) {
      score += 0.2; // Morning - likely checking schedule
    }

    // Message context scoring
    if (context.recentMessages?.length) {
      const recentText = context.recentMessages.join(' ').toLowerCase();

      if (recentText.includes('meeting') && resource.category === 'calendar') {
        score += 0.3;
      }
      if (recentText.includes('document') && resource.category === 'resource') {
        score += 0.3;
      }
      if (recentText.includes('team') && resource.category === 'person') {
        score += 0.3;
      }
    }

    // Persona-based scoring
    if (context.selectedPersona === 'eos-implementer') {
      if (['scorecard', 'vto', 'rocks'].includes(resource.type)) {
        score += 0.2;
      }
    }

    return score;
  }

  // Get dynamic instances (e.g., specific documents, events)
  private async getDynamicInstances(
    resource: MentionResource,
    searchTerm: string,
    context: MentionContext,
  ): Promise<MentionInstance[]> {
    const instances: MentionInstance[] = [];

    switch (resource.type) {
      case 'calendar':
        // Fetch upcoming events
        const events = await this.fetchCalendarEvents(
          context.userId,
          searchTerm,
        );
        events.forEach((event) => {
          instances.push({
            id: `event-${event.id}`,
            parentId: resource.id,
            name: event.summary,
            description: `${event.date} at ${event.time}`,
            metadata: { eventId: event.id },
          });
        });
        break;

      case 'document':
        // Fetch user documents
        const docs = await this.fetchUserDocuments(context.userId, searchTerm);
        docs.forEach((doc) => {
          instances.push({
            id: `doc-${doc.id}`,
            parentId: resource.id,
            name: doc.title,
            description: doc.preview,
            metadata: { docId: doc.id },
          });
        });
        break;

      case 'team':
        // Fetch team members
        const members = await this.fetchTeamMembers(context.userId, searchTerm);
        members.forEach((member) => {
          instances.push({
            id: `user-${member.id}`,
            parentId: resource.id,
            name: member.name,
            description: member.role,
            metadata: { userId: member.id },
          });
        });
        break;
    }

    return instances;
  }

  // Stub methods for fetching dynamic data
  private async fetchCalendarEvents(
    userId: string,
    search: string,
  ): Promise<any[]> {
    // This would call the calendar API
    return [];
  }

  private async fetchUserDocuments(
    userId: string,
    search: string,
  ): Promise<any[]> {
    // This would call the documents API
    return [];
  }

  private async fetchTeamMembers(
    userId: string,
    search: string,
  ): Promise<any[]> {
    // This would fetch team members
    return [];
  }

  // Get recent mentions for a user
  private getRecentMentions(userId: string): MentionInstance[] {
    return this.userHistory.get(userId) || [];
  }

  // Get favorite mentions for a user
  private getFavoriteMentions(userId: string): MentionInstance[] {
    // This would fetch from user preferences
    return [];
  }

  // Record a mention usage
  recordMentionUsage(
    userId: string,
    mention: MentionResource | MentionInstance,
  ) {
    const history = this.userHistory.get(userId) || [];

    // Remove existing instance if present
    const filtered = history.filter((m) => m.id !== mention.id);

    // Add to front
    filtered.unshift(mention as MentionInstance);

    // Keep only last 50
    this.userHistory.set(userId, filtered.slice(0, 50));
  }

  // Apply filters to suggestions
  applyFilters(
    suggestions: MentionSuggestion[],
    filters: MentionFilter[],
  ): MentionSuggestion[] {
    return suggestions.filter((suggestion) => {
      return filters.every((filter) => {
        switch (filter.type) {
          case 'category':
            return suggestion.resource.category === filter.value;
          case 'type':
            return suggestion.resource.type === filter.value;
          case 'permission':
            // Check permissions
            return true;
          default:
            return true;
        }
      });
    });
  }

  // Get all available categories
  getCategories(): MentionCategory[] {
    const categories = new Set<MentionCategory>();
    this.resources.forEach((resource) => {
      categories.add(resource.category);
    });
    return Array.from(categories);
  }

  // Execute a mention command
  async executeCommand(
    command: string,
    args: string[],
    context: MentionContext,
  ): Promise<any> {
    const cmd = this.commands.get(command);
    if (cmd) {
      return await cmd.execute(args, context);
    }
    throw new Error(`Unknown command: ${command}`);
  }
}
