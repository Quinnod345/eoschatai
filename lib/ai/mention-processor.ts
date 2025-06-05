import type { MentionType } from '@/lib/mentions/types';

export interface ProcessedMention {
  type: MentionType;
  id: string;
  name: string;
  context?: string;
  metadata?: Record<string, any>;
}

export interface MentionProcessingResult {
  enhancedPrompt: string;
  toolsToActivate: string[];
  contextData: Record<string, any>;
  mentionInstructions: string;
}

export class MentionProcessor {
  // Process mentions and generate enhanced prompt instructions
  static processMentions(
    mentions: ProcessedMention[],
    originalMessage: string,
  ): MentionProcessingResult {
    const result: MentionProcessingResult = {
      enhancedPrompt: '',
      toolsToActivate: [],
      contextData: {},
      mentionInstructions: '',
    };

    // Group mentions by type for better processing
    const mentionsByType = mentions.reduce(
      (acc, mention) => {
        if (!acc[mention.type]) acc[mention.type] = [];
        acc[mention.type].push(mention);
        return acc;
      },
      {} as Record<MentionType, ProcessedMention[]>,
    );

    // Analyze user intent based on mentions and message
    const userIntent = MentionProcessor.analyzeUserIntent(mentions, originalMessage);

    // Process each mention type with intent awareness
    const instructions: string[] = [];

    // Add intent-based instructions
    if (userIntent.isQuestion) {
      instructions.push(
        'USER INTENT: The user is asking a question. Provide a helpful, direct answer.',
      );
    }
    if (userIntent.isScheduling) {
      instructions.push(
        'USER INTENT: The user wants to schedule something. Be proactive with calendar tools.',
      );
    }
    if (userIntent.isAnalysis) {
      instructions.push(
        'USER INTENT: The user wants analysis or insights. Provide data-driven responses.',
      );
    }

    // Calendar mentions
    if (
      mentionsByType.calendar ||
      mentionsByType.event ||
      mentionsByType.meeting
    ) {
      result.toolsToActivate.push(
        'getCalendarEvents',
        'checkCalendarConflicts',
      );

      const calendarMentions = [
        ...(mentionsByType.calendar || []),
        ...(mentionsByType.event || []),
        ...(mentionsByType.meeting || []),
      ];

      if (calendarMentions.length > 0) {
        instructions.push(`
CALENDAR CONTEXT:
The user has mentioned calendar/events. Automatically:
1. Check their calendar for relevant events
2. If discussing scheduling, check for conflicts
3. If asking about availability, find free slots
4. Provide calendar insights when relevant

Specific calendar items mentioned:
${calendarMentions.map((m) => `- ${m.name}: ${m.context || 'Check calendar for details'}`).join('\n')}
`);

        // Add specific event IDs to context
        calendarMentions.forEach((mention) => {
          if (mention.metadata?.eventId) {
            result.contextData[`event_${mention.metadata.eventId}`] =
              mention.metadata;
          }
        });
      }
    }

    // Document mentions
    if (mentionsByType.document || mentionsByType.file) {
      result.toolsToActivate.push('getInformation');

      const docMentions = [
        ...(mentionsByType.document || []),
        ...(mentionsByType.file || []),
      ];

      instructions.push(`
DOCUMENT CONTEXT:
The user has referenced specific documents. Focus on:
1. Content from the mentioned documents
2. Relevant sections based on the query
3. Cross-reference with other knowledge if helpful

Specific documents mentioned:
${docMentions.map((m) => `- ${m.name}: ${m.context || 'Retrieve content from document'}`).join('\n')}
`);

      // Add document IDs to context
      docMentions.forEach((mention) => {
        if (mention.metadata?.docId) {
          result.contextData[`doc_${mention.metadata.docId}`] =
            mention.metadata;
        }
      });
    }

    // EOS-specific mentions
    if (
      mentionsByType.scorecard ||
      mentionsByType.vto ||
      mentionsByType.rocks
    ) {
      result.toolsToActivate.push('getInformation');

      instructions.push(`
EOS FRAMEWORK CONTEXT:
The user is asking about EOS-specific items:
${mentionsByType.scorecard ? '- Scorecard: Focus on metrics, KPIs, and measurables\n' : ''}
${mentionsByType.vto ? '- V/TO: Reference vision, core values, and strategic goals\n' : ''}
${mentionsByType.rocks ? '- Rocks: Discuss quarterly priorities and progress\n' : ''}

Provide specific, actionable information from their EOS documents.
`);
    }

    // People mentions
    if (mentionsByType.user || mentionsByType.team || mentionsByType.contact) {
      const peopleMentions = [
        ...(mentionsByType.user || []),
        ...(mentionsByType.team || []),
        ...(mentionsByType.contact || []),
      ];

      instructions.push(`
PEOPLE CONTEXT:
The user has mentioned specific people:
${peopleMentions.map((m) => `- ${m.name}: ${m.metadata?.role || 'Team member'}`).join('\n')}

Consider their roles and relationships when providing information.
`);
    }

    // Tool mentions
    if (
      mentionsByType.search ||
      mentionsByType.analyze ||
      mentionsByType.summarize
    ) {
      const toolMentions = [
        ...(mentionsByType.search || []),
        ...(mentionsByType.analyze || []),
        ...(mentionsByType.summarize || []),
      ];

      toolMentions.forEach((mention) => {
        switch (mention.type) {
          case 'search':
            result.toolsToActivate.push('getInformation');
            instructions.push(
              'SEARCH: Perform comprehensive search across all available resources.',
            );
            break;
          case 'analyze':
            result.toolsToActivate.push('getCalendarAnalytics');
            instructions.push(
              'ANALYZE: Provide data-driven insights and analytics.',
            );
            break;
          case 'summarize':
            instructions.push(
              'SUMMARIZE: Create concise summaries of the requested information.',
            );
            break;
        }
      });
    }

    // Availability mentions
    if (mentionsByType.availability) {
      result.toolsToActivate.push('findAvailableTimeSlots');
      instructions.push(`
AVAILABILITY CHECK:
The user needs to find available time. Automatically:
1. Search for free time slots
2. Consider their typical meeting patterns
3. Suggest optimal times based on context
`);
    }

    // Compile final instructions
    result.mentionInstructions = instructions.join('\n\n');

    // Add general mention handling instructions
    result.enhancedPrompt = `
The user has used @ mentions to provide specific context. These mentions indicate:
1. Specific resources or items they want to focus on
2. Tools or actions they want you to use
3. Context that should guide your response

${result.mentionInstructions}

IMPORTANT: 
- Use the mentioned resources as the primary context for your response
- Activate relevant tools automatically without asking
- Don't just acknowledge the mentions - act on them
- Provide specific, relevant information based on the mentions
`;

    return result;
  }

  // Extract mentions from message text
  static extractMentions(text: string): ProcessedMention[] {
    const mentions: ProcessedMention[] = [];

    // Enhanced regex to capture more mention formats
    const mentionRegex = /@(\w+)(?::([^\s]+))?(?:\[([^\]]+)\])?/g;

    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const [fullMatch, type, id, metadata] = match;

      mentions.push({
        type: type as MentionType,
        id: id || type,
        name: id || type,
        metadata: metadata ? JSON.parse(metadata) : undefined,
      });
    }

    return mentions;
  }

  // Format mentions for display
  static formatMentionsForDisplay(
    text: string,
    mentions: ProcessedMention[],
  ): string {
    let formattedText = text;

    mentions.forEach((mention) => {
      const mentionPattern = new RegExp(
        `@${mention.type}(?::${mention.id})?`,
        'g',
      );
      formattedText = formattedText.replace(
        mentionPattern,
        `<mention type="${mention.type}" id="${mention.id}">${mention.name}</mention>`,
      );
    });

    return formattedText;
  }

  // Generate mention-specific tool parameters
  static generateToolParameters(
    mention: ProcessedMention,
    userQuery: string,
  ): Record<string, any> {
    const params: Record<string, any> = {};

    switch (mention.type) {
      case 'calendar':
      case 'event':
        params.searchTerm = mention.name;
        if (mention.metadata?.date) {
          params.timeMin = mention.metadata.date;
          params.timeMax = mention.metadata.date;
        }
        break;

      case 'document':
      case 'file':
        params.query = `${mention.name} ${userQuery}`;
        params.documentId = mention.id;
        break;

      case 'availability': {
        // Extract duration from query if possible
        const durationMatch = userQuery.match(/(\d+)\s*(hour|minute|min)/i);
        if (durationMatch) {
          const value = Number.parseInt(durationMatch[1]);
          const unit = durationMatch[2].toLowerCase();
          params.duration = unit.includes('hour') ? value * 60 : value;
        } else {
          params.duration = 60; // Default 1 hour
        }
        break;
      }

      case 'analyze':
        params.days = 30; // Default analysis period
        break;
    }

    return params;
  }

  // Check if a tool should be activated based on mentions
  static shouldActivateTool(
    toolName: string,
    mentions: ProcessedMention[],
  ): boolean {
    const toolMentionMap: Record<string, MentionType[]> = {
      getCalendarEvents: ['calendar', 'event', 'meeting'],
      checkCalendarConflicts: ['calendar', 'meeting'],
      findAvailableTimeSlots: ['availability'],
      getCalendarAnalytics: ['analyze'],
      getInformation: [
        'document',
        'file',
        'search',
        'scorecard',
        'vto',
        'rocks',
      ],
      createCalendarEvent: ['create'],
      getDailyBriefing: ['calendar'],
      parseNaturalLanguageEvent: ['calendar', 'event', 'meeting'],
    };

    const relevantTypes = toolMentionMap[toolName] || [];
    return mentions.some((m) => relevantTypes.includes(m.type));
  }

  // Analyze user intent from mentions and message
  private static analyzeUserIntent(
    mentions: ProcessedMention[],
    message: string,
  ): {
    isQuestion: boolean;
    isScheduling: boolean;
    isAnalysis: boolean;
    isSearch: boolean;
    needsHelp: boolean;
  } {
    const lowerMessage = message.toLowerCase();

    return {
      isQuestion:
        /\?|what|how|when|where|why|who|which|do i have|can i|is there/.test(
          lowerMessage,
        ),
      isScheduling:
        /schedule|book|calendar|meeting|appointment|available|free time/.test(
          lowerMessage,
        ) ||
        mentions.some((m) =>
          ['calendar', 'availability', 'meeting'].includes(m.type),
        ),
      isAnalysis:
        /analyze|analysis|insights|report|metrics|data|trends/.test(
          lowerMessage,
        ) || mentions.some((m) => m.type === 'analyze'),
      isSearch:
        /find|search|look for|where is|show me/.test(lowerMessage) ||
        mentions.some((m) => m.type === 'search'),
      needsHelp:
        /help|how to|guide|explain/.test(lowerMessage) ||
        mentions.some((m) => m.type === 'help'),
    };
  }

  // Generate smart tool parameters based on context
  static generateSmartToolParameters(
    mention: ProcessedMention,
    userQuery: string,
    context?: any,
  ): Record<string, any> {
    const params = MentionProcessor.generateToolParameters(mention, userQuery);

    // Enhance parameters based on context
    switch (mention.type) {
      case 'calendar':
      case 'event': {
        // If user mentions "today", "tomorrow", "this week", etc.
        const timeContext = MentionProcessor.extractTimeContext(userQuery);
        if (timeContext) {
          params.timeMin = timeContext.start;
          params.timeMax = timeContext.end;
        }
        break;
      }

      case 'availability': {
        // Extract meeting context (duration, participants, etc.)
        const meetingContext = MentionProcessor.extractMeetingContext(userQuery);
        if (meetingContext.duration) {
          params.duration = meetingContext.duration;
        }
        if (meetingContext.preferredTimes) {
          params.preferredTimes = meetingContext.preferredTimes;
        }
        break;
      }

      case 'analyze': {
        // Extract analysis period and focus areas
        const analysisContext = MentionProcessor.extractAnalysisContext(userQuery);
        if (analysisContext.period) {
          params.days = analysisContext.period;
        }
        if (analysisContext.focus) {
          params.focus = analysisContext.focus;
        }
        break;
      }
    }

    return params;
  }

  // Extract time context from natural language
  private static extractTimeContext(
    query: string,
  ): { start: string; end: string } | null {
    const now = new Date();
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('today')) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    if (lowerQuery.includes('tomorrow')) {
      const start = new Date(now);
      start.setDate(start.getDate() + 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    if (lowerQuery.includes('this week')) {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Start of week
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // End of week
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    if (lowerQuery.includes('next week')) {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 7); // Start of next week
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // End of next week
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    return null;
  }

  // Extract meeting context from query
  public static extractMeetingContext(query: string): {
    duration?: number;
    preferredTimes?: string[];
  } {
    const context: any = {};

    // Extract duration
    const durationMatch = query.match(/(\d+)\s*(hour|hr|minute|min)/i);
    if (durationMatch) {
      const value = Number.parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      context.duration = unit.includes('hour') ? value * 60 : value;
    } else {
      // Default durations based on meeting type
      if (/quick|brief|short/.test(query)) {
        context.duration = 15;
      } else if (/lunch/.test(query)) {
        context.duration = 60;
      } else {
        context.duration = 30; // Default
      }
    }

    // Extract preferred times
    if (/morning/.test(query)) {
      context.preferredTimes = ['morning'];
    } else if (/afternoon/.test(query)) {
      context.preferredTimes = ['afternoon'];
    } else if (/evening/.test(query)) {
      context.preferredTimes = ['evening'];
    }

    return context;
  }

  // Extract analysis context
  private static extractAnalysisContext(query: string): {
    period?: number;
    focus?: string[];
  } {
    const context: any = {};

    // Extract time period
    if (/last\s+(\d+)\s*(day|week|month)/i.test(query)) {
      const match = query.match(/last\s+(\d+)\s*(day|week|month)/i);
      if (match) {
        const value = Number.parseInt(match[1]);
        const unit = match[2].toLowerCase();
        context.period =
          unit === 'day' ? value : unit === 'week' ? value * 7 : value * 30;
      }
    } else if (/this\s+(week|month|quarter|year)/.test(query)) {
      const match = query.match(/this\s+(week|month|quarter|year)/);
      if (match) {
        const unit = match[1];
        context.period =
          unit === 'week'
            ? 7
            : unit === 'month'
              ? 30
              : unit === 'quarter'
                ? 90
                : 365;
      }
    }

    // Extract focus areas
    const focusAreas: string[] = [];
    if (/meeting|calendar|schedule/.test(query)) focusAreas.push('meetings');
    if (/productivity|efficiency/.test(query)) focusAreas.push('productivity');
    if (/collaboration|team/.test(query)) focusAreas.push('collaboration');
    if (/time\s+management|availability/.test(query))
      focusAreas.push('time-management');

    if (focusAreas.length > 0) {
      context.focus = focusAreas;
    }

    return context;
  }
}
