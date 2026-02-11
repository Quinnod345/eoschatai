export function extractTextFromMessagePart(part: unknown): string {
  if (typeof part === 'string') {
    return part;
  }

  if (
    part &&
    typeof part === 'object' &&
    'text' in part &&
    typeof (part as { text?: unknown }).text === 'string'
  ) {
    return (part as { text: string }).text;
  }

  return '';
}

export function extractPrimaryMessageText(message: {
  parts?: unknown[];
  content?: unknown;
}): string {
  const parts = Array.isArray(message.parts) ? message.parts : [];

  for (const part of parts) {
    const text = extractTextFromMessagePart(part).trim();
    if (text.length > 0) {
      return text;
    }
  }

  if (typeof message.content === 'string') {
    return message.content.trim();
  }

  return '';
}

export function extractAssistantTextFromMessage(message: unknown): string {
  if (!message || typeof message !== 'object') {
    return '';
  }

  const maybeParts = (message as { parts?: unknown[] }).parts;
  if (Array.isArray(maybeParts)) {
    const textFromParts = maybeParts
      .map((part) => {
        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          (part as { type?: unknown }).type === 'text' &&
          'text' in part &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          return (part as { text: string }).text;
        }
        return extractTextFromMessagePart(part);
      })
      .filter((text) => typeof text === 'string' && text.length > 0)
      .join('');

    if (textFromParts.length > 0) {
      return textFromParts;
    }
  }

  const maybeContent = (message as { content?: unknown }).content;
  if (typeof maybeContent === 'string') {
    return maybeContent;
  }

  return '';
}

export function dedupeMessagesById<T extends { id: string }>(
  messages: T[],
  currentMessageId: string,
): T[] {
  return messages.filter((message) => message.id !== currentMessageId);
}

export type CalendarPromptEvent = {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  location?: string;
};

export type CalendarPromptResult = {
  status?: string;
  events?: CalendarPromptEvent[];
  authRequired?: boolean;
};

type CalendarFetcher = (params: {
  timeMin: string;
  timeMax: string;
  maxResults: number;
  searchTerm?: string;
}) => Promise<CalendarPromptResult>;

type LoggerLike = Pick<Console, 'log' | 'error'>;

export function formatCalendarRows(events: CalendarPromptEvent[]): string {
  return events
    .map((event) => {
      const rawDate = event.start?.dateTime || event.start?.date;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const hasValidDate =
        parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime());
      const eventDate = hasValidDate
        ? parsedDate.toLocaleDateString()
        : rawDate || 'No date';
      const eventTime = event.start?.dateTime
        ? hasValidDate
          ? parsedDate.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'No time'
        : event.start?.date
          ? 'All day'
          : 'No time';
      return `| ${event.summary || 'Untitled Event'} | ${eventDate} | ${eventTime} | ${event.location || 'No location'} |`;
    })
    .join('\n');
}

export async function buildCalendarPromptAdditions(params: {
  hasMentionedCalendar: boolean;
  shouldCheckCalendar: boolean;
  eventType: string | null;
  fetchCalendarEvents: CalendarFetcher;
  logger?: LoggerLike;
}): Promise<string> {
  const {
    hasMentionedCalendar,
    shouldCheckCalendar,
    eventType,
    fetchCalendarEvents,
    logger = console,
  } = params;
  let additions = '';

  if (hasMentionedCalendar) {
    try {
      logger.log('Calendar: Auto-checking calendar from @ mention');
      const now = new Date();
      const threeMonthsLater = new Date();
      threeMonthsLater.setMonth(now.getMonth() + 3);

      const calendarResult = await fetchCalendarEvents({
        timeMin: now.toISOString(),
        timeMax: threeMonthsLater.toISOString(),
        maxResults: 15,
      });

      const events = Array.isArray(calendarResult.events)
        ? calendarResult.events
        : [];
      logger.log(`Calendar @ mention: Retrieved ${events.length} events`);

      if (calendarResult.status === 'success' && events.length > 0) {
        additions += `

CALENDAR RESULTS FROM @ MENTION:
The user has requested calendar information. Here are their upcoming events:

| Event | Date | Time | Location |
|-------|------|------|----------|
${formatCalendarRows(events)}

Present this information to the user in a clear and readable format. Format it as a table using markdown syntax.
`;
      } else if (
        calendarResult.status === 'error' &&
        calendarResult.authRequired
      ) {
        additions += `

CALENDAR CONNECTION ISSUE:
The user mentioned calendar, but they need to connect their Google Calendar in Settings > Integrations.
Please inform them of this requirement.
`;
      } else {
        additions += `

CALENDAR RESULTS FROM @ MENTION:
No upcoming events found in the user's calendar.
`;
      }
    } catch (error) {
      logger.error('Calendar: Error retrieving events for @ mention:', error);
    }
  }

  if (shouldCheckCalendar && eventType) {
    try {
      logger.log(`Calendar: Auto-checking for "${eventType}" events`);
      const now = new Date();
      const sixMonthsLater = new Date();
      sixMonthsLater.setMonth(now.getMonth() + 6);

      const calendarResult = await fetchCalendarEvents({
        timeMin: now.toISOString(),
        timeMax: sixMonthsLater.toISOString(),
        maxResults: 20,
        searchTerm: eventType,
      });

      if (
        calendarResult.status === 'success' &&
        Array.isArray(calendarResult.events)
      ) {
        const matchingEvents = calendarResult.events;

        logger.log(
          `Calendar: Found ${matchingEvents.length} events matching "${eventType}"`,
        );

        additions += `

CALENDAR SEARCH RESULTS:
The user asked about "${eventType}". ${
          matchingEvents.length > 0
            ? `There are ${matchingEvents.length} matching events in their calendar:`
            : `There are no matching events in their calendar.`
        }
${
  matchingEvents.length > 0
    ? `
Here are the matching events:

| Event | Date | Time | Location |
|-------|------|------|----------|
${formatCalendarRows(matchingEvents)}
`
    : ''
}
                
${
  matchingEvents.length > 0
    ? 'IMPORTANT: Include this information in your response using the table format above. NEVER mention that you searched their calendar or that you found these events. Simply respond to their question first, then mention "I see you have the following on your calendar:" and include the table. Format it nicely with a clear header row and well-aligned columns.'
    : 'You should NOT mention that there are no events found. Just answer their question without referencing their calendar.'
}
`;
      }
    } catch (error) {
      logger.error('Calendar: Auto-check calendar event search failed:', error);
    }
  }

  return additions;
}
