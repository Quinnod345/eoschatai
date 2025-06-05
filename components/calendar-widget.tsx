'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Calendar, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  attendees?: any[];
}

interface CalendarAnalytics {
  totalMeetings: number;
  totalHours: number;
  averageMinutes: number;
  busiestDay: string;
  topCollaborators: { email: string; count: number }[];
}

export function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [analytics, setAnalytics] = useState<CalendarAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);

      // Fetch today's events
      const eventsRes = await fetch(
        `/api/calendar/events?${new URLSearchParams({
          timeMin: new Date().toISOString(),
          timeMax: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          maxResults: '5',
        })}`,
      );

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
      }

      // This would normally call our analytics endpoint
      // For now, we'll show mock data
      setAnalytics({
        totalMeetings: 24,
        totalHours: 36,
        averageMinutes: 90,
        busiestDay: 'Tuesday',
        topCollaborators: [
          { email: 'john@company.com', count: 8 },
          { email: 'sarah@company.com', count: 6 },
        ],
      });
    } catch (err) {
      setError('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-pulse text-muted-foreground">
            Loading calendar...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Today's Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today&apos;s Schedule
          </CardTitle>
          <CardDescription>
            {events.length === 0
              ? 'No events scheduled for today'
              : `${events.length} events today`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="space-y-1">
                <p className="font-medium">
                  {event.summary || 'Untitled Event'}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {event.start?.dateTime
                      ? format(new Date(event.start.dateTime), 'h:mm a')
                      : 'All day'}
                  </span>
                  {event.location && (
                    <>
                      <span>•</span>
                      <span>{event.location}</span>
                    </>
                  )}
                </div>
              </div>
              {event.attendees && event.attendees.length > 1 && (
                <Badge variant="secondary">
                  {event.attendees.length} attendees
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Calendar Analytics */}
      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Calendar Insights
            </CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Meetings</p>
                <p className="text-2xl font-bold">{analytics.totalMeetings}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Meeting Hours</p>
                <p className="text-2xl font-bold">{analytics.totalHours}h</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Busiest Day</p>
                <p className="text-lg font-semibold">{analytics.busiestDay}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-lg font-semibold">
                  {analytics.averageMinutes} min
                </p>
              </div>
            </div>

            {analytics.topCollaborators.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Top Collaborators</p>
                <div className="space-y-1">
                  {analytics.topCollaborators.slice(0, 3).map((collab) => (
                    <div
                      key={collab.email}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {collab.email.split('@')[0]}
                      </span>
                      <Badge variant="outline">{collab.count} meetings</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Use natural language in chat to manage your calendar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground">Try saying:</p>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>
                &ldquo;Schedule a meeting with John tomorrow at 2pm&rdquo;
              </li>
              <li>&ldquo;What&apos;s my schedule for today?&rdquo;</li>
              <li>&ldquo;Find me a 30-minute slot this week&rdquo;</li>
              <li>&ldquo;How many meetings did I have last week?&rdquo;</li>
              <li>
                &ldquo;Do I have any conflicts next Tuesday at 3pm?&rdquo;
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
