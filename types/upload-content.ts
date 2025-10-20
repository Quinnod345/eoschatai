// Standard format for all embedded content in messages
// This ensures consistent parsing and rendering across all upload types

export type NoticeSeverity = 'info' | 'success' | 'warning' | 'error';

export interface EmbeddedContent {
  type:
    | 'pdf'
    | 'document'
    | 'presentation'
    | 'image'
    | 'audio'
    | 'video'
    | 'file'
    | 'notice'
    | 'calendar';
  name: string;
  metadata: {
    // Common metadata
    size?: number;
    mimeType?: string;
    uploadedAt?: string;

    // Type-specific metadata
    pageCount?: number; // for PDFs and documents
    slideCount?: number; // for presentations
    duration?: number; // for audio/video in seconds
    dimensions?: { width: number; height: number }; // for images
    transcript?: string; // for audio/video
    description?: string; // for images or any file
    error?: string; // for failed processing
    status?: 'processing' | 'ready' | 'error'; // processing status

    // Additional structured data
    severity?: NoticeSeverity; // for notice
    title?: string; // for notice/calendar
    message?: string; // for notice/calendar
    code?: string; // optional error code
    action?: string; // for calendar or notice actions
    events?: Array<any>; // for calendar list results (normalized minimal shapes)
    event?: any; // for calendar single event (normalized minimal shape)
    [key: string]: any;
  };
  content?: string; // The actual content (text, transcript, etc.)
}

// Standard format for embedding content in messages
export const EMBEDDED_CONTENT_START = '[EMBEDDED_CONTENT_START]';
export const EMBEDDED_CONTENT_END = '[EMBEDDED_CONTENT_END]';

// Helper to create embedded content string
export function createEmbeddedContentString(content: EmbeddedContent): string {
  return `${EMBEDDED_CONTENT_START}${JSON.stringify(content)}${EMBEDDED_CONTENT_END}`;
}

// Helper to extract all embedded content from a message
export function extractEmbeddedContent(text: string): {
  contents: EmbeddedContent[];
  cleanedText: string;
} {
  const contents: EmbeddedContent[] = [];
  const regex = new RegExp(
    `${EMBEDDED_CONTENT_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.*?)${EMBEDDED_CONTENT_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'gs',
  );

  let cleanedText = text;
  let match: RegExpExecArray | null;

  match = regex.exec(text);
  while (match !== null) {
    try {
      const content = JSON.parse(match[1]);
      contents.push(content);
    } catch (e) {
      console.error('Failed to parse embedded content:', e);
    }
    match = regex.exec(text);
  }

  // Remove all embedded content from the text
  cleanedText = cleanedText.replace(regex, '').trim();

  return { contents, cleanedText };
}

// Legacy format converters for backward compatibility
export function convertLegacyPDFFormat(
  name: string,
  pageCount: number,
  content: string,
): EmbeddedContent {
  return {
    type: 'pdf',
    name,
    metadata: {
      pageCount,
      status: 'ready',
    },
    content,
  };
}

export function convertLegacyAudioFormat(
  name: string,
  transcript: string,
  error?: string,
): EmbeddedContent {
  return {
    type: 'audio',
    name,
    metadata: {
      status: error ? 'error' : 'ready',
      error,
      transcript: error ? undefined : transcript,
    },
    content: error ? undefined : transcript,
  };
}

export function convertLegacyDocumentFormat(
  name: string,
  docType: 'Word Document' | 'Spreadsheet' | 'Presentation',
  pageCount?: number,
  content?: string,
): EmbeddedContent {
  return {
    type: docType === 'Presentation' ? 'presentation' : 'document',
    name,
    metadata: {
      pageCount: docType === 'Presentation' ? undefined : pageCount,
      slideCount: docType === 'Presentation' ? pageCount : undefined,
      status: 'ready',
      docType,
    },
    content,
  };
}

export function convertLegacyImageFormat(
  name: string,
  description: string,
  hasText: boolean,
): EmbeddedContent {
  return {
    type: 'image',
    name,
    metadata: {
      description,
      hasText,
      status: 'ready',
    },
  };
}

// Helpers to create standardized notice/calendar content
export function createNoticeContent(
  name: string,
  message: string,
  severity: NoticeSeverity = 'info',
  extra?: Record<string, any>,
): EmbeddedContent {
  return {
    type: 'notice',
    name,
    metadata: {
      severity,
      message,
      status: severity === 'error' ? 'error' : 'ready',
      ...extra,
    },
  };
}

export function createCalendarContent(
  name: string,
  payload: {
    status?: 'success' | 'error';
    message?: string;
    action?: 'getEvents' | 'createEvent' | string;
    events?: Array<any>;
    event?: any;
    detailsLink?: string;
    authRequired?: boolean;
    hideJSON?: boolean;
  },
): EmbeddedContent {
  const status = payload.status || 'success';
  return {
    type: 'calendar',
    name,
    metadata: {
      title: payload.action || 'Calendar',
      status: status === 'error' ? 'error' : 'ready',
      message:
        payload.message ||
        (status === 'success'
          ? 'Calendar operation completed successfully.'
          : 'Failed to complete calendar operation.'),
      action: payload.action,
      events: payload.events,
      event: payload.event,
      detailsLink: payload.detailsLink,
      authRequired: payload.authRequired,
      hideJSON: payload.hideJSON,
    },
  };
}

/**
 * Normalize arbitrary tool results into standardized embedded content for UI rendering
 */
export function normalizeToolResultToEmbeddedContents(
  toolName: string,
  result: unknown,
): EmbeddedContent[] {
  try {
    // If result is a string, attempt to parse JSON, otherwise treat as notice
    let data: any = result;
    if (typeof result === 'string') {
      try {
        data = JSON.parse(result);
      } catch (_) {
        return [createNoticeContent(toolName, result)];
      }
    }

    // If data indicates an error in a common shape
    if (data && typeof data === 'object') {
      // Calendar tool results
      if (
        toolName === 'getCalendarEvents' ||
        toolName === 'createCalendarEvent'
      ) {
        const action =
          toolName === 'getCalendarEvents' ? 'getEvents' : 'createEvent';
        // Cohere to our calendar content
        return [
          createCalendarContent('Google Calendar', {
            status: data.status,
            message: data.message,
            action,
            events: Array.isArray(data.events)
              ? data.events
              : Array.isArray(data.formattedEvents)
                ? data.formattedEvents
                : undefined,
            event: data.event,
            detailsLink: data.detailsLink,
            authRequired: !!data.authRequired,
            hideJSON: !!data.hideJSON,
          }),
        ];
      }

      // Generic status/message objects
      if (typeof data.message === 'string') {
        const severity: NoticeSeverity =
          data.status === 'error' ? 'error' : 'info';
        return [
          createNoticeContent(toolName, data.message, severity, {
            code: data.code,
            hideJSON: data.hideJSON,
          }),
        ];
      }

      // Unknown object - summarize
      return [
        createNoticeContent(
          toolName,
          'Operation completed. See details in logs.',
          'success',
        ),
      ];
    }

    // Fallback for unexpected primitives
    return [createNoticeContent(toolName, String(result ?? ''))];
  } catch (e) {
    // Last-resort fallback notice
    return [
      createNoticeContent(
        toolName,
        'An unexpected error occurred while formatting the result.',
        'error',
      ),
    ];
  }
}
