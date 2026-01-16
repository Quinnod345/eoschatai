import { z } from 'zod/v3';
import { google } from 'googleapis';
import { addDays, format, startOfDay, endOfDay } from 'date-fns';
import type { calendar_v3 } from 'googleapis';

// Type definitions
type CalendarEvent = calendar_v3.Schema$Event;

interface TimeSlot {
  start: Date;
  end: Date;
}

interface MeetingAnalytics {
  totalMeetings: number;
  totalDuration: number;
  averageDuration: number;
  busiestDay: string;
  topAttendees: { email: string; count: number }[];
  upcomingPrep: { event: CalendarEvent; prepTime: number }[];
}

interface DailyBriefing {
  date: string;
  eventCount: number;
  events: {
    time: string;
    duration: number | null;
    title: string;
    location?: string;
    attendeeCount: number;
    needsPrep?: boolean;
  }[];
  gaps: {
    start: string;
    end: string;
    duration: number;
  }[];
  tomorrowPreview: {
    count: number;
    firstEvent: string;
    firstEventTime: string;
  } | null;
}

// Helper function to get calendar client
async function getCalendarClient(userId: string) {
  const { db } = await import('../../db');
  const { eq } = await import('drizzle-orm');
  const { googleCalendarToken } = await import('../../db/schema');

  const tokens = await db
    .select()
    .from(googleCalendarToken)
    .where(eq(googleCalendarToken.userId, userId));

  if (tokens.length === 0 || !tokens[0].token) {
    throw new Error('Calendar not connected');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendar/auth/callback`,
  );

  oauth2Client.setCredentials(tokens[0].token);

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Helper function to check for conflicts
async function checkConflicts(
  calendar: calendar_v3.Calendar,
  startTime: Date,
  endTime: Date,
): Promise<CalendarEvent[]> {
  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startTime.toISOString(),
    timeMax: endTime.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return data.items || [];
}

// Helper function to find free time slots
async function findFreeSlots(
  calendar: calendar_v3.Calendar,
  duration: number, // in minutes
  searchDays = 7,
): Promise<TimeSlot[]> {
  const now = new Date();
  const endSearch = addDays(now, searchDays);

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: now.toISOString(),
      timeMax: endSearch.toISOString(),
      items: [{ id: 'primary' }],
    },
  });

  const busySlots = data.calendars?.primary?.busy || [];
  const freeSlots: TimeSlot[] = [];

  // Convert busy slots to free slots
  let currentTime = startOfDay(now);
  currentTime.setHours(9); // Start from 9 AM

  for (let day = 0; day < searchDays; day++) {
    const dayEnd = new Date(currentTime);
    dayEnd.setHours(17); // End at 5 PM

    // Check each potential slot
    while (currentTime < dayEnd) {
      const slotEnd = new Date(currentTime.getTime() + duration * 60000);

      // Check if this slot conflicts with any busy period
      const hasConflict = busySlots.some((busy) => {
        const busyStart = new Date(busy.start!);
        const busyEnd = new Date(busy.end!);
        return currentTime < busyEnd && slotEnd > busyStart;
      });

      if (!hasConflict && slotEnd <= dayEnd) {
        freeSlots.push({
          start: new Date(currentTime),
          end: slotEnd,
        });
      }

      // Move to next 30-minute slot
      currentTime = new Date(currentTime.getTime() + 30 * 60000);
    }

    // Move to next day
    currentTime = addDays(startOfDay(currentTime), 1);
    currentTime.setHours(9);
  }

  return freeSlots.slice(0, 5); // Return top 5 slots
}

// Check conflicts tool
export const checkCalendarConflictsTool = {
  name: 'checkCalendarConflicts',
  description:
    'Check if there are any calendar conflicts for a proposed time. Use this proactively when users mention scheduling something.',
  schema: z.object({
    startDateTime: z.string().describe('Start time in ISO format'),
    endDateTime: z.string().describe('End time in ISO format'),
  }),
  execute: async (
    {
      startDateTime,
      endDateTime,
    }: { startDateTime: string; endDateTime: string },
    userId: string,
  ) => {
    try {
      const calendar = await getCalendarClient(userId);
      const conflicts = await checkConflicts(
        calendar,
        new Date(startDateTime),
        new Date(endDateTime),
      );

      if (conflicts.length === 0) {
        return {
          status: 'success',
          hasConflicts: false,
          message: 'No conflicts found for the proposed time.',
        };
      }

      return {
        status: 'success',
        hasConflicts: true,
        message: `Found ${conflicts.length} conflicting event(s) at the proposed time.`,
        conflicts: conflicts.map((event) => ({
          title: event.summary || 'Untitled',
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
        })),
      };
    } catch (error) {
      console.error('Error checking calendar conflicts:', error);
      return {
        status: 'error',
        message: 'Failed to check calendar conflicts.',
      };
    }
  },
};

// Find available time slots tool
export const findAvailableTimeSlotsTool = {
  name: 'findAvailableTimeSlots',
  description:
    'Find available time slots in the calendar for scheduling meetings. Use this when users ask for available times or need to schedule something.',
  schema: z.object({
    duration: z.number().describe('Duration in minutes'),
    searchDays: z
      .number()
      .optional()
      .default(7)
      .describe('Number of days to search ahead'),
  }),
  execute: async (
    { duration, searchDays }: { duration: number; searchDays: number },
    userId: string,
  ) => {
    try {
      const calendar = await getCalendarClient(userId);
      const freeSlots = await findFreeSlots(calendar, duration, searchDays);

      if (freeSlots.length === 0) {
        return {
          status: 'success',
          message: `No available ${duration}-minute slots found in the next ${searchDays} days.`,
          slots: [],
        };
      }

      return {
        status: 'success',
        message: `Found ${freeSlots.length} available time slots for a ${duration}-minute meeting.`,
        slots: freeSlots.map((slot) => ({
          date: format(slot.start, 'EEEE, MMMM d'),
          startTime: format(slot.start, 'h:mm a'),
          endTime: format(slot.end, 'h:mm a'),
          startISO: slot.start.toISOString(),
          endISO: slot.end.toISOString(),
        })),
      };
    } catch (error) {
      console.error('Error finding available time slots:', error);
      return {
        status: 'error',
        message: 'Failed to find available time slots.',
      };
    }
  },
};

// Get calendar analytics tool
export const getCalendarAnalyticsTool = {
  name: 'getCalendarAnalytics',
  description:
    'Get analytics and insights about calendar usage, meeting patterns, and upcoming events that need preparation.',
  schema: z.object({
    days: z
      .number()
      .optional()
      .default(30)
      .describe('Number of days to analyze'),
  }),
  execute: async ({ days }: { days: number }, userId: string) => {
    try {
      const calendar = await getCalendarClient(userId);

      const now = new Date();
      const startDate = addDays(now, -days);
      const endDate = addDays(now, 7); // Include next week for prep suggestions

      const { data } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });

      const events = data.items || [];
      const pastEvents = events.filter(
        (e) => new Date(e.start?.dateTime || e.start?.date || '') < now,
      );
      const futureEvents = events.filter(
        (e) => new Date(e.start?.dateTime || e.start?.date || '') >= now,
      );

      // Calculate analytics
      const analytics: MeetingAnalytics = {
        totalMeetings: pastEvents.length,
        totalDuration: 0,
        averageDuration: 0,
        busiestDay: '',
        topAttendees: [],
        upcomingPrep: [],
      };

      // Calculate total duration and day frequency
      const dayFrequency: Record<string, number> = {};
      const attendeeFrequency: Record<string, number> = {};

      pastEvents.forEach((event) => {
        if (event.start?.dateTime && event.end?.dateTime) {
          const duration =
            new Date(event.end.dateTime).getTime() -
            new Date(event.start.dateTime).getTime();
          analytics.totalDuration += duration;

          const day = format(new Date(event.start.dateTime), 'EEEE');
          dayFrequency[day] = (dayFrequency[day] || 0) + 1;
        }

        // Count attendees
        event.attendees?.forEach((attendee) => {
          if (attendee.email && attendee.email !== 'primary') {
            attendeeFrequency[attendee.email] =
              (attendeeFrequency[attendee.email] || 0) + 1;
          }
        });
      });

      // Calculate average duration
      if (pastEvents.length > 0) {
        analytics.averageDuration = analytics.totalDuration / pastEvents.length;
      }

      // Find busiest day
      const busiestDayEntry = Object.entries(dayFrequency).sort(
        ([, a], [, b]) => b - a,
      )[0];
      analytics.busiestDay = busiestDayEntry ? busiestDayEntry[0] : 'No data';

      // Get top attendees
      analytics.topAttendees = Object.entries(attendeeFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([email, count]) => ({ email, count }));

      // Identify meetings that might need preparation
      analytics.upcomingPrep = futureEvents
        .filter((event) => {
          // Meetings with multiple attendees or important keywords
          const needsPrep =
            (event.attendees && event.attendees.length > 2) ||
            (event.summary &&
              /review|planning|strategy|quarterly|annual/i.test(event.summary));
          return needsPrep;
        })
        .slice(0, 5)
        .map((event) => ({
          event,
          prepTime: event.attendees ? event.attendees.length * 10 : 15, // Estimate prep time
        }));

      return {
        status: 'success',
        message: `Calendar analytics for the past ${days} days:`,
        analytics: {
          totalMeetings: analytics.totalMeetings,
          totalHours: Math.round(analytics.totalDuration / (1000 * 60 * 60)),
          averageMinutes: Math.round(analytics.averageDuration / (1000 * 60)),
          busiestDay: analytics.busiestDay,
          topCollaborators: analytics.topAttendees,
          upcomingMeetingsNeedingPrep: analytics.upcomingPrep.map((prep) => ({
            title: prep.event.summary || 'Untitled',
            date: format(
              new Date(prep.event.start?.dateTime || ''),
              'MMM d, h:mm a',
            ),
            attendeeCount: prep.event.attendees?.length || 0,
            suggestedPrepMinutes: prep.prepTime,
          })),
        },
      };
    } catch (error) {
      console.error('Error getting calendar analytics:', error);
      return {
        status: 'error',
        message: 'Failed to get calendar analytics.',
      };
    }
  },
};

// Get daily briefing tool
export const getDailyBriefingTool = {
  name: 'getDailyBriefing',
  description:
    "Get a daily briefing of today's calendar events and important reminders. Use this proactively when users start their day or ask about their schedule.",
  schema: z.object({
    includePrep: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include preparation suggestions'),
  }),
  execute: async (
    { includePrep }: { includePrep: boolean },
    userId: string,
  ) => {
    try {
      const calendar = await getCalendarClient(userId);

      const today = new Date();
      const tomorrow = addDays(today, 1);

      const { data } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfDay(today).toISOString(),
        timeMax: endOfDay(today).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const todayEvents = data.items || [];

      // Get tomorrow's first events for heads up
      const { data: tomorrowData } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfDay(tomorrow).toISOString(),
        timeMax: endOfDay(tomorrow).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 3,
      });

      const tomorrowEvents = tomorrowData.items || [];

      const briefing: DailyBriefing = {
        date: format(today, 'EEEE, MMMM d, yyyy'),
        eventCount: todayEvents.length,
        events: todayEvents.map((event) => {
          const start = event.start?.dateTime
            ? new Date(event.start.dateTime)
            : null;
          const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;

          return {
            time: start ? format(start, 'h:mm a') : 'All day',
            duration:
              start && end
                ? Math.round((end.getTime() - start.getTime()) / (1000 * 60))
                : null,
            title: event.summary || 'Untitled',
            location: event.location || undefined,
            attendeeCount: event.attendees?.length || 0,
            needsPrep:
              includePrep && event.attendees && event.attendees.length > 2,
          };
        }),
        gaps: [],
        tomorrowPreview:
          tomorrowEvents.length > 0
            ? {
                count: tomorrowEvents.length,
                firstEvent: tomorrowEvents[0].summary || 'Untitled',
                firstEventTime: tomorrowEvents[0].start?.dateTime
                  ? format(new Date(tomorrowEvents[0].start.dateTime), 'h:mm a')
                  : 'All day',
              }
            : null,
      };

      // Find gaps in schedule for focused work
      for (let i = 0; i < todayEvents.length - 1; i++) {
        const currentEnd = todayEvents[i].end?.dateTime;
        const nextStart = todayEvents[i + 1].start?.dateTime;

        if (currentEnd && nextStart) {
          const gap =
            new Date(nextStart).getTime() - new Date(currentEnd).getTime();
          const gapMinutes = gap / (1000 * 60);

          if (gapMinutes >= 30) {
            briefing.gaps.push({
              start: format(new Date(currentEnd), 'h:mm a'),
              end: format(new Date(nextStart), 'h:mm a'),
              duration: Math.round(gapMinutes),
            });
          }
        }
      }

      return {
        status: 'success',
        message: "Here's your daily briefing:",
        briefing,
        _formatInstructions:
          'Format this as a clean, organized daily briefing. Include time blocks for focused work based on gaps.',
      };
    } catch (error) {
      console.error('Error getting daily briefing:', error);
      return {
        status: 'error',
        message: 'Failed to get daily briefing.',
      };
    }
  },
};

// Parse natural language to event tool
export const parseNaturalLanguageEventTool = {
  name: 'parseNaturalLanguageEvent',
  description:
    'Parse natural language into calendar event details. Use this when users describe events in natural language.',
  schema: z.object({
    text: z.string().describe('Natural language description of the event'),
    currentDate: z
      .string()
      .optional()
      .describe('Current date for relative date parsing'),
  }),
  execute: async (
    { text, currentDate }: { text: string; currentDate?: string },
    userId: string,
  ) => {
    // This is a simplified parser - in production, you'd use a more sophisticated NLP approach
    const patterns = {
      time: /(?:at|@)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
      duration: /(?:for|duration)\s*(\d+)\s*(?:hours?|hrs?|minutes?|mins?)/i,
      date: /(?:on|this|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)/i,
      with: /(?:with|attendees?:?)\s*([^,]+(?:,\s*[^,]+)*)/i,
      location: /(?:at|in|location:?)\s*([^,]+?)(?:\s+(?:on|at|with)|$)/i,
    };

    const parsed: any = {
      summary: text,
    };

    // Extract components
    const timeMatch = text.match(patterns.time);
    const durationMatch = text.match(patterns.duration);
    const dateMatch = text.match(patterns.date);
    const withMatch = text.match(patterns.with);
    const locationMatch = text.match(patterns.location);

    // Parse date
    const baseDate = currentDate ? new Date(currentDate) : new Date();
    if (dateMatch) {
      // Simple date parsing logic
      const dayStr = dateMatch[1].toLowerCase();
      if (dayStr === 'today') {
        parsed.date = baseDate;
      } else if (dayStr === 'tomorrow') {
        parsed.date = addDays(baseDate, 1);
      } else {
        // Find next occurrence of the day
        const days = [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
        ];
        const targetDay = days.indexOf(dayStr);
        if (targetDay !== -1) {
          const currentDay = baseDate.getDay();
          const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
          parsed.date = addDays(baseDate, daysUntil);
        }
      }
    }

    // Parse time
    if (timeMatch) {
      parsed.time = timeMatch[1];
    }

    // Parse duration
    if (durationMatch) {
      const value = Number.parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      parsed.durationMinutes = unit.includes('hour') ? value * 60 : value;
    }

    // Parse attendees
    if (withMatch) {
      parsed.attendees = withMatch[1].split(',').map((a) => a.trim());
    }

    // Parse location
    if (locationMatch && !patterns.time.test(locationMatch[0])) {
      parsed.location = locationMatch[1].trim();
    }

    // Clean up summary by removing parsed components
    let cleanSummary = text;
    [timeMatch, durationMatch, dateMatch, withMatch, locationMatch].forEach(
      (match) => {
        if (match) {
          cleanSummary = cleanSummary.replace(match[0], '').trim();
        }
      },
    );

    parsed.summary = cleanSummary || 'Meeting';

    return {
      status: 'success',
      message: 'Parsed event details from natural language:',
      parsed,
      needsConfirmation: true,
    };
  },
};

// Export all calendar tools
export const enhancedCalendarTools = [
  checkCalendarConflictsTool,
  findAvailableTimeSlotsTool,
  getCalendarAnalyticsTool,
  getDailyBriefingTool,
  parseNaturalLanguageEventTool,
];
