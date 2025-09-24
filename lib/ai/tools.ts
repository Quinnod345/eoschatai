import { findRelevantContent, processDocument } from './embeddings';
import { generateUUID } from '../utils';
import { document } from '../db/schema';
import { safeParseJson } from '../fetch-utils';
import { z } from 'zod';

// Helper function to check if environment variables are set correctly
function checkEnvironmentVariables() {
  if (typeof process !== 'undefined' && process.env) {
    console.log('Checking environment variables for API URLs');
    console.log(
      'NEXT_PUBLIC_BASE_URL:',
      process.env.NEXT_PUBLIC_BASE_URL || 'not set',
    );

    // Log if running in development or production
    console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');

    // Check for common issues like missing protocol
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (baseUrl && !baseUrl.startsWith('http')) {
      console.warn(
        'WARNING: NEXT_PUBLIC_BASE_URL does not start with http:// or https://',
        baseUrl,
      );
    }
  }
}

// Call this immediately to log environment info
checkEnvironmentVariables();

// Helper function to determine if running in Node.js environment
export function isNodeEnvironment(): boolean {
  return (
    typeof window === 'undefined' &&
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
}

// Get the base URL for API requests, handling both client and server environments
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use the window location
    return window.location.origin;
  } else {
    // Server-side: use the environment variable
    return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  }
}

// Helper function to safely create a URL with error handling
export function safeCreateURL(path: string, baseUrl?: string): URL {
  try {
    // Determine the base URL to use
    let effectiveBaseUrl: string;
    const isNode = isNodeEnvironment();
    console.log(
      `Creating URL for path: ${path}, in Node environment: ${isNode}`,
    );

    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      effectiveBaseUrl = window.location.origin;
      console.log(
        `Browser detected, using window.location.origin: ${effectiveBaseUrl}`,
      );
    }
    // If baseUrl is provided, use it
    else if (baseUrl) {
      effectiveBaseUrl = baseUrl;
      console.log(`Using provided baseUrl: ${baseUrl}`);
    }
    // Use environment variable as a fallback
    else if (isNode && process.env.NEXT_PUBLIC_BASE_URL) {
      effectiveBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      console.log('Using NEXT_PUBLIC_BASE_URL:', effectiveBaseUrl);
    }
    // Last resort fallback
    else {
      effectiveBaseUrl = 'http://localhost:3000';
      console.warn('No base URL found, using fallback URL:', effectiveBaseUrl);
    }

    // For server-side API calls, ensure we're using an absolute URL
    if (isNode && path.startsWith('/api/')) {
      if (!effectiveBaseUrl.endsWith('/')) {
        effectiveBaseUrl += '/';
      }
      // Remove the leading slash from path to avoid double slashes
      const trimmedPath = path.startsWith('/') ? path.substring(1) : path;
      const fullUrl = new URL(trimmedPath, effectiveBaseUrl);
      console.log('Created server-side API URL:', fullUrl.toString());
      return fullUrl;
    }

    // Create and return the URL
    const url = new URL(path, effectiveBaseUrl);
    console.log('Created URL:', url.toString());
    return url;
  } catch (error) {
    console.error('Error creating URL:', error);
    throw new Error(`Failed to create URL for path: ${path}`);
  }
}

// Dynamic import to avoid module not found error
const getDb = async () => {
  const { db } = await import('../db');
  return db;
};

// Type definitions for tools
type Tool<T = unknown> = {
  name: string;
  description: string;
  schema: z.ZodType<T>;
  execute: (args: T, userId: string) => Promise<any>;
  // Add handler for backward compatibility
  handler?: (args: T, userId: string) => Promise<any>;
};

type GetCalendarEventsArgs = {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  searchTerm?: string;
};

type CreateCalendarEventArgs = {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  attendees?: string[];
};

/**
 * Tool for adding a new resource to the knowledge base
 * This allows the AI to save information shared by users
 */
export const addResourceTool: Tool<{ title: string; content: string }> = {
  name: 'addResource',
  description:
    'Add a new resource to the EOS knowledge base. Use this PROACTIVELY whenever users share information that should be remembered for future reference. Look for EOS concepts, methodologies, or specific company information that would be valuable to store.',
  schema: z.object({
    title: z
      .string()
      .describe('Title or topic of the resource (be specific and concise)'),
    content: z
      .string()
      .describe(
        'Content of the resource to add to the knowledge base (include all relevant details, formatted cleanly)',
      ),
  }),
  execute: async (
    { title, content }: { title: string; content: string },
    userId: string,
  ) => {
    try {
      console.log('RAG: Processing resource for knowledge base', { title });

      // Process the content to ensure it's a string
      let contentText = content;
      if (typeof content === 'object' && content !== null) {
        // Add a type assertion to avoid the 'never' type error
        const contentObj = content as { text?: string };
        if (contentObj.text && typeof contentObj.text === 'string') {
          contentText = contentObj.text;
        } else {
          // Try to convert to string if it's a complex object
          contentText = JSON.stringify(content);
        }
      }

      // Normalize title to enforce 'User Note:' prefix for saved memories
      let normalizedTitle = title || '';
      const lower = normalizedTitle.toLowerCase();
      if (!lower.startsWith('user note:')) {
        normalizedTitle = `User Note: ${normalizedTitle.replace(/^\s+|\s+$/g, '')}`;
      }

      // First, insert the document into the database (legacy knowledge entry)
      const newDocumentId = generateUUID();
      const db = await getDb();

      await db.insert(document).values({
        id: newDocumentId,
        createdAt: new Date(),
        title: normalizedTitle,
        content: contentText,
        kind: 'text',
        userId,
      });

      console.log('RAG: Document inserted into database');

      // Process the document to create embeddings (wrap in try/catch to handle vector dimension issues)
      console.log('RAG: Generating embeddings for document');
      try {
        await processDocument(newDocumentId, contentText);
        console.log('RAG: Embeddings generated and stored successfully');
      } catch (error) {
        console.error(
          'RAG ERROR: Failed to generate embeddings, but document is saved in database:',
          error,
        );
        // Still return success since the document is saved in the database
      }

      // Also write a structured UserMemory row for future memory management
      try {
        const { db } = await import('@/lib/db');
        const { userMemory } = await import('@/lib/db/schema');
        const now = new Date();
        await db.insert(userMemory).values({
          userId,
          summary: normalizedTitle.replace(/^User Note:\s*/i, ''),
          content: contentText,
          topic: null,
          memoryType: 'knowledge' as any,
          confidence: 70,
          status: 'active' as any,
          tags: null,
          createdAt: now,
          updatedAt: now,
        });
      } catch (memErr) {
        console.error(
          'Memory: Failed to mirror addResource into UserMemory:',
          memErr,
        );
      }

      return {
        status: 'success',
        message: `I've saved "${normalizedTitle}" to our knowledge base and will remember this information for future conversations.`,
        documentId: newDocumentId,
        title: normalizedTitle,
        isKnowledgeSave: true,
        hideJSON: true,
      };
    } catch (error) {
      console.error('RAG ERROR: Failed to add resource:', error);
      return {
        status: 'error',
        message:
          'I was unable to save this information to our knowledge base. Please try again later.',
      };
    }
  },
  // Add handler that calls execute for backward compatibility
  get handler() {
    return this.execute;
  },
};

/**
 * Tool to retrieve information from the knowledge base based on a query
 * This enables RAG functionality by finding relevant content
 */
export const getInformationTool: Tool<{ query: string; limit?: number }> = {
  name: 'getInformation',
  description:
    "Retrieve relevant information from the EOS knowledge base to help answer the user's question. ALWAYS use this tool when answering specific questions about EOS concepts, methodologies, or details that might be in the knowledge base. The retrieved information will be more accurate than your general knowledge.",
  schema: z.object({
    query: z
      .string()
      .describe(
        'The specific topic or question to search for in the knowledge base (be precise to get better results)',
      ),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of results to return (default: 5)'),
  }),
  execute: async ({ query, limit = 5 }: { query: string; limit?: number }) => {
    try {
      console.log(`RAG: Searching knowledge base for: "${query}"`);

      // Search for relevant content
      const results = await findRelevantContent(query, limit);

      if (results.length === 0) {
        console.log('RAG: No relevant information found');
        return {
          status: 'success',
          message:
            "I searched our knowledge base but couldn't find any information about that topic.",
          results: [],
        };
      }

      console.log(
        `RAG: Found ${results.length} relevant results. Top result (${(results[0].relevance * 100).toFixed(1)}% relevance): ${results[0].content.substring(0, 50)}...`,
      );

      return {
        status: 'success',
        message: `I found ${results.length} relevant pieces of information in our knowledge base that will help answer your question.`,
        results,
      };
    } catch (error) {
      console.error('RAG ERROR: Failed to retrieve information:', error);
      return {
        status: 'error',
        message: 'I encountered an error while searching our knowledge base.',
        results: [],
      };
    }
  },
  // Add handler that calls execute for backward compatibility
  get handler() {
    return this.execute;
  },
};

// Export all RAG tools for use in chat routes
export const ragTools = [addResourceTool, getInformationTool];

// Import enhanced calendar tools
export { enhancedCalendarTools } from './tools/calendar-tools';

// Helper function to check calendar connection status
async function checkCalendarConnection(): Promise<boolean> {
  try {
    const apiUrl = safeCreateURL('/api/calendar/status');
    console.log('Checking calendar connection at:', apiUrl.toString());

    try {
      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(
          'Calendar status check failed with status:',
          response.status,
        );
        return false;
      }

      // Check content type to avoid parsing HTML as JSON
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/html')) {
        console.error('Calendar status endpoint returned HTML instead of JSON');
        return false;
      }

      // Safe JSON parsing
      try {
        const data = await response.json();
        return !!data?.connected;
      } catch (jsonError) {
        console.error(
          'Failed to parse calendar status response as JSON:',
          jsonError,
        );
        return false;
      }
    } catch (fetchError) {
      console.error('Error fetching calendar status:', fetchError);
      return false;
    }
  } catch (error) {
    console.error('Calendar connection check failed:', error);
    return false;
  }
}

/**
 * Google Calendar integration tools
 * These tools allow the AI to interact with the user's Google Calendar
 */

// Get upcoming calendar events
export const getCalendarEventsTool: Tool<GetCalendarEventsArgs> = {
  name: 'getCalendarEvents',
  description:
    "Get events from the user's Google Calendar. Provide timeMin and timeMax in ISO format (e.g. 2021-01-01T00:00:00Z) to specify the date range. If not provided, defaults to current time for timeMin and 7 days later for timeMax.",
  schema: z.object({
    timeMin: z.string().optional(),
    timeMax: z.string().optional(),
    maxResults: z.number().optional(),
    searchTerm: z
      .string()
      .optional()
      .describe(
        'Optional search term to filter events by keyword in the title',
      ),
  }),
  execute: async (
    { timeMin, timeMax, maxResults = 10, searchTerm },
    userId,
  ) => {
    try {
      console.log('Calendar: Fetching upcoming events for user', userId);
      console.log('Calendar: current NODE_ENV:', process.env.NODE_ENV);
      console.log(
        'Calendar: current NEXT_PUBLIC_BASE_URL:',
        process.env.NEXT_PUBLIC_BASE_URL,
      );
      console.log('Calendar: is Node environment:', isNodeEnvironment());

      // Check for authentication status directly from database
      try {
        console.log(
          'Calendar: Checking connection status directly in database',
        );

        // Get database connection
        const db = await import('../db').then((module) => module.db);
        const { eq } = await import('drizzle-orm');
        const { googleCalendarToken, user } = await import('../db/schema');

        // Get Google Calendar token for the user
        const tokens = await db
          .select()
          .from(googleCalendarToken)
          .where(eq(googleCalendarToken.userId, userId));

        // Get user settings
        const users = await db
          .select({ googleCalendarConnected: user.googleCalendarConnected })
          .from(user)
          .where(eq(user.id, userId));

        // Use either the token existence or the user settings flag to determine connection status
        const hasToken = tokens.length > 0 && !!tokens[0].token;
        const userConnected =
          users.length > 0 && !!users[0].googleCalendarConnected;
        const isConnected = hasToken && userConnected;

        console.log('Calendar: Database connection check:', {
          userId,
          hasToken,
          userConnected,
          isConnected,
          tokensFound: tokens.length,
        });

        if (!isConnected) {
          console.log('Calendar: Not connected according to database');
          return {
            status: 'error',
            message:
              "To access your calendar, you need to connect your Google Calendar in Settings > Integrations. Once connected, I'll be able to help you manage your schedule and appointments.",
            authRequired: true,
          };
        }

        // If we have a token, use it directly with the Google API
        if (tokens.length > 0 && tokens[0].token) {
          const token = tokens[0].token;

          try {
            // Create OAuth2 client with the token
            const { google } = await import('googleapis');

            const oauth2Client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET,
              `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendar/auth/callback`,
            );

            oauth2Client.setCredentials(token);

            // Create calendar client
            const calendar = google.calendar({
              version: 'v3',
              auth: oauth2Client,
            });

            // If timeMin is not provided, use current time
            const effectiveTimeMin = timeMin || new Date().toISOString();

            // If timeMax is not provided, use 7 days from now
            const defaultTimeMax = new Date();
            defaultTimeMax.setDate(defaultTimeMax.getDate() + 7);
            const effectiveTimeMax = timeMax || defaultTimeMax.toISOString();

            console.log('Calendar: Fetching events directly from Google API', {
              timeMin: effectiveTimeMin,
              timeMax: effectiveTimeMax,
              maxResults,
              searchTerm,
            });

            // Fetch events directly from Google API
            const { data } = await calendar.events.list({
              calendarId: 'primary',
              timeMin: effectiveTimeMin,
              timeMax: effectiveTimeMax,
              maxResults: searchTerm ? 50 : maxResults, // Get more results if searching for a specific term
              singleEvents: true,
              orderBy: 'startTime',
              q: searchTerm, // Add search query if provided
            });

            // Get the unfiltered events first
            let formattedEvents = (data.items || []).map((event) => ({
              id: event.id,
              summary: event.summary,
              description: event.description,
              location: event.location,
              start: event.start,
              end: event.end,
              attendees: event.attendees ? event.attendees.length : 0, // Just return count, not full array
              htmlLink: event.htmlLink,
              created: event.created,
              updated: event.updated,
            }));

            // If we have a search term, filter the events more precisely (the Google API q param is not always accurate)
            if (searchTerm && searchTerm.trim() !== '') {
              console.log(
                `Calendar: Filtering events by search term: "${searchTerm}"`,
              );
              const normalizedSearchTerm = searchTerm.toLowerCase();

              formattedEvents = formattedEvents.filter((event) => {
                const titleMatch = (event.summary || '')
                  .toLowerCase()
                  .includes(normalizedSearchTerm);
                const descMatch = (event.description || '')
                  .toLowerCase()
                  .includes(normalizedSearchTerm);
                return titleMatch || descMatch;
              });

              // Apply the original maxResults limit after filtering
              if (formattedEvents.length > maxResults) {
                formattedEvents = formattedEvents.slice(0, maxResults);
              }

              console.log(
                `Calendar: Found ${formattedEvents.length} events matching "${searchTerm}"`,
              );
            }

            console.log(
              `Calendar: Retrieved ${formattedEvents.length} events directly from Google API`,
            );

            // Format this in a more user-friendly way to avoid the AI outputting code
            return {
              status: 'success',
              message: `Found ${formattedEvents.length} upcoming events in your calendar.`,
              events: formattedEvents,
              responseFormat: 'table', // Hint for the model to use a table format
              hideJSON: true, // Strong flag to prevent showing JSON
              _formatInstructions:
                'CRITICAL: Format calendar events as a table or list. NEVER show raw JSON data or API responses to the user. Only show essential details like title, date, time, and location. If you start to display text with JSON structures containing fields like events, status, etc., STOP IMMEDIATELY and reformat as a clean table.',
              formattedEvents: formattedEvents.map((event) => ({
                title: event.summary || 'Untitled Event',
                date: event.start?.dateTime
                  ? new Date(event.start.dateTime).toLocaleDateString()
                  : 'No date',
                time: event.start?.dateTime
                  ? new Date(event.start.dateTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'No time',
                location: event.location || 'No location',
              })),
            };
          } catch (apiError) {
            console.error(
              'Calendar: Error calling Google Calendar API directly:',
              apiError,
            );
            return {
              status: 'error',
              message:
                'Failed to fetch calendar events. There might be an issue with your Google Calendar connection.',
              error:
                apiError instanceof Error ? apiError.message : String(apiError),
            };
          }
        }

        console.log('Calendar: No token found in database.');
        return {
          status: 'error',
          message:
            'To access your calendar, you need to connect your Google Calendar in Settings > Integrations.',
          authRequired: true,
        };
      } catch (dbError) {
        console.error(
          'Error checking database for calendar connection:',
          dbError,
        );
        return {
          status: 'error',
          message:
            'Unable to verify Google Calendar connection status. Please try again later.',
          error: dbError instanceof Error ? dbError.message : String(dbError),
        };
      }
    } catch (error) {
      console.error('Calendar ERROR:', error);

      let errorMessage =
        'I encountered an error while trying to access your calendar information.';
      let errorDetails = 'Unknown error';

      if (error instanceof Error) {
        errorDetails = error.message;
        if (
          error.message.includes('Calendar is not connected') ||
          error.message.includes('token not found') ||
          error.message.includes('Unauthorized')
        ) {
          errorMessage =
            'You need to connect your Google Calendar in Settings > Integrations before I can access your calendar.';
        }
      }

      return {
        status: 'error',
        message: errorMessage,
        error: errorDetails,
      };
    }
  },
  // Add handler that calls execute for backward compatibility
  get handler() {
    return this.execute;
  },
};

// Create a new calendar event
export const createCalendarEventTool: Tool<CreateCalendarEventArgs> = {
  name: 'createCalendarEvent',
  description:
    "Create a new event in the user's Google Calendar. Provide event details like summary, description, location, startDateTime, endDateTime and optional attendees. Dates must be in ISO format (e.g. 2021-01-01T10:00:00Z).",
  schema: z.object({
    summary: z.string(),
    description: z.string().optional(),
    location: z.string().optional(),
    startDateTime: z.string(),
    endDateTime: z.string(),
    attendees: z.array(z.string()).optional(),
  }),
  execute: async (
    { summary, description, location, startDateTime, endDateTime, attendees },
    userId,
  ) => {
    try {
      console.log('Calendar: Creating new event for user', userId);
      console.log('Calendar: current NODE_ENV:', process.env.NODE_ENV);
      console.log(
        'Calendar: current NEXT_PUBLIC_BASE_URL:',
        process.env.NEXT_PUBLIC_BASE_URL,
      );

      // Check authentication directly from database
      try {
        console.log(
          'Calendar: Checking connection status directly in database',
        );

        // Get database connection
        const db = await import('../db').then((module) => module.db);
        const { eq } = await import('drizzle-orm');
        const { googleCalendarToken, user } = await import('../db/schema');

        // Get Google Calendar token for the user
        const tokens = await db
          .select()
          .from(googleCalendarToken)
          .where(eq(googleCalendarToken.userId, userId));

        // Get user settings
        const users = await db
          .select({ googleCalendarConnected: user.googleCalendarConnected })
          .from(user)
          .where(eq(user.id, userId));

        // Use either the token existence or the user settings flag to determine connection status
        const hasToken = tokens.length > 0 && !!tokens[0].token;
        const userConnected =
          users.length > 0 && !!users[0].googleCalendarConnected;
        const isConnected = hasToken && userConnected;

        console.log('Calendar: Database connection check for creating event:', {
          userId,
          hasToken,
          userConnected,
          isConnected,
          tokensFound: tokens.length,
        });

        if (!isConnected) {
          console.log('Calendar: Not connected according to database');
          return {
            status: 'error',
            message:
              "To create calendar events, you need to connect your Google Calendar in Settings > Integrations. Once connected, I'll be able to schedule events and manage your calendar for you.",
            authRequired: true,
          };
        }

        // If we have a token, use it directly with the Google API
        if (tokens.length > 0 && tokens[0].token) {
          const token = tokens[0].token;

          try {
            // Create OAuth2 client with the token
            const { google } = await import('googleapis');

            const oauth2Client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET,
              `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendar/auth/callback`,
            );

            oauth2Client.setCredentials(token);

            // Create calendar client
            const calendar = google.calendar({
              version: 'v3',
              auth: oauth2Client,
            });

            // Format attendees if provided
            const formattedAttendees = attendees
              ? attendees.map((email) => ({ email }))
              : undefined;

            // Create the event
            const event = {
              summary,
              description,
              location,
              start: {
                dateTime: startDateTime,
                timeZone: 'UTC',
              },
              end: {
                dateTime: endDateTime,
                timeZone: 'UTC',
              },
              attendees: formattedAttendees,
            };

            console.log('Calendar: Creating event directly with Google API');

            const { data } = await calendar.events.insert({
              calendarId: 'primary',
              requestBody: event,
              sendUpdates: 'all', // Send emails to attendees
            });

            console.log('Calendar: Event created successfully with Google API');

            // Format the response to prevent raw code output in chat
            const eventSummary = {
              title: data.summary || 'Untitled Event',
              date: data.start?.dateTime || startDateTime,
              link: data.htmlLink || '#',
            };

            const eventDate = data.start?.dateTime
              ? new Date(data.start.dateTime).toLocaleString()
              : new Date(startDateTime).toLocaleString();

            return {
              status: 'success',
              message: `Event "${data.summary || 'Untitled Event'}" has been created successfully for ${eventDate}.`,
              event: eventSummary,
              detailsLink: data.htmlLink || '#',
            };
          } catch (apiError) {
            console.error(
              'Calendar: Error creating event with Google API directly:',
              apiError,
            );
            return {
              status: 'error',
              message:
                'Failed to create calendar event. There might be an issue with your Google Calendar connection.',
              error:
                apiError instanceof Error ? apiError.message : String(apiError),
            };
          }
        }

        console.log('Calendar: No token found in database for event creation.');
        return {
          status: 'error',
          message:
            'To create calendar events, you need to connect your Google Calendar in Settings > Integrations.',
          authRequired: true,
        };
      } catch (dbError) {
        console.error(
          'Error checking database for calendar event creation:',
          dbError,
        );
        return {
          status: 'error',
          message:
            'Unable to verify Google Calendar connection status. Please try again later.',
          error: dbError instanceof Error ? dbError.message : String(dbError),
        };
      }
    } catch (error) {
      console.error('Calendar ERROR:', error);

      let errorMessage =
        'I encountered an error while trying to create a calendar event.';
      let errorDetails = 'Unknown error';

      if (error instanceof Error) {
        errorDetails = error.message;
        if (
          error.message.includes('Calendar is not connected') ||
          error.message.includes('token not found') ||
          error.message.includes('Unauthorized')
        ) {
          errorMessage =
            'You need to connect your Google Calendar in Settings > Integrations before I can create calendar events.';
        } else if (error.message.includes('Missing required fields')) {
          errorMessage =
            'Please provide all required information for the event (summary, start time, and end time).';
        }
      }

      return {
        status: 'error',
        message: errorMessage,
        error: errorDetails,
      };
    }
  },
  // Add handler that calls execute for backward compatibility
  get handler() {
    return this.execute;
  },
};

// Export all Calendar tools
export const calendarTools = [getCalendarEventsTool, createCalendarEventTool];

// Export all tools for use in chat routes
export const allTools = [...ragTools, ...calendarTools];

// Helper function to safely create API requests with proper cookie handling
async function makeApiRequest(url: string, options: RequestInit = {}) {
  try {
    // Log the original URL for debugging
    console.log(`Original API request URL: ${url}`);

    // Determine the final URL to use
    let urlToUse = url;

    // Check if we're in a browser environment where we can use window.location
    if (typeof window !== 'undefined') {
      try {
        // Check if this might be a full URL already
        new URL(url); // Will throw if not a valid URL
        console.log(`Using provided full URL: ${url}`);
      } catch (urlError) {
        // If URL parsing fails, it's a relative path - use it directly
        console.log(`Using relative URL path: ${url}`);
      }
    } else if (isNodeEnvironment()) {
      // In Node.js environment, ensure we have a full URL with base path
      try {
        // Check if this might be a full URL already
        new URL(url);
        console.log(`Using provided full URL in Node.js: ${url}`);
      } catch (urlError) {
        // For relative paths in Node.js, prepend the base URL
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        urlToUse = new URL(
          url.startsWith('/') ? url.slice(1) : url,
          baseUrl,
        ).toString();
        console.log(`Created full URL in Node.js: ${urlToUse}`);
      }
    }

    // Always include credentials for proper cookie handling
    const requestOptions: RequestInit = {
      ...options,
      credentials: 'include', // This is crucial for including cookies
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
    };

    // Add content-type only for POST requests with JSON body
    if (options.method === 'POST' && options.body) {
      requestOptions.headers = {
        ...requestOptions.headers,
        'Content-Type': 'application/json',
      };
    }

    console.log(`Making API request to: ${urlToUse}`);
    const response = await fetch(urlToUse, requestOptions);

    // Log response details for debugging
    console.log(`Response status: ${response.status} ${response.statusText}`);

    // Handle authentication errors
    if (response.status === 401) {
      return {
        status: 'error',
        message:
          'You need to connect your Google Calendar in Settings > Integrations before I can access your calendar.',
        authRequired: true,
      };
    }

    // For non-OK responses, try to parse the error
    if (!response.ok) {
      const errorData = await safeParseJson(response, {
        error: 'Failed to fetch data from API',
      });
      throw new Error(errorData.error || 'Unknown API error');
    }

    // For successful responses, return the parsed data or a default object if parsing fails
    try {
      const data = await safeParseJson(response, null);
      // Ensure we're returning an object even if the response was null
      return data || { status: 'error', message: 'API returned null response' };
    } catch (parseError) {
      console.error('Failed to parse API response:', parseError);
      return {
        status: 'error',
        message: 'Failed to parse API response',
        error:
          parseError instanceof Error
            ? parseError.message
            : 'Unknown parsing error',
      };
    }
  } catch (error) {
    console.error('API request error:', error);
    // Always return a valid object even in case of error
    return {
      status: 'error',
      message: 'Failed to connect to calendar API',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
