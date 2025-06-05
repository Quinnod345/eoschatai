'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  Coffee,
  Briefcase,
  Target,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';

interface BriefingData {
  date: string;
  eventCount: number;
  events: Array<{
    time: string;
    duration: number | null;
    title: string;
    location?: string;
    attendeeCount: number;
    needsPrep?: boolean;
  }>;
  gaps: Array<{
    start: string;
    end: string;
    duration: number;
  }>;
  tomorrowPreview?: {
    count: number;
    firstEvent: string;
    firstEventTime: string;
  };
}

export function CalendarBriefing() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setTimeOfDay('morning');
    else if (hour < 17) setTimeOfDay('afternoon');
    else setTimeOfDay('evening');

    // Mock briefing data
    setBriefing({
      date: format(new Date(), 'EEEE, MMMM d, yyyy'),
      eventCount: 5,
      events: [
        {
          time: '9:00 AM',
          duration: 30,
          title: 'Daily Standup',
          location: 'Zoom',
          attendeeCount: 5,
          needsPrep: false,
        },
        {
          time: '10:00 AM',
          duration: 60,
          title: 'Quarterly Planning Review',
          location: 'Conference Room A',
          attendeeCount: 8,
          needsPrep: true,
        },
        {
          time: '2:00 PM',
          duration: 45,
          title: 'Client Demo',
          location: 'Zoom',
          attendeeCount: 4,
          needsPrep: true,
        },
        {
          time: '3:30 PM',
          duration: 30,
          title: '1:1 with Sarah',
          attendeeCount: 2,
          needsPrep: false,
        },
        {
          time: '4:30 PM',
          duration: 30,
          title: 'Team Retrospective',
          location: 'Conference Room B',
          attendeeCount: 6,
          needsPrep: false,
        },
      ],
      gaps: [
        { start: '11:00 AM', end: '2:00 PM', duration: 180 },
        { start: '4:00 PM', end: '4:30 PM', duration: 30 },
      ],
      tomorrowPreview: {
        count: 3,
        firstEvent: 'Leadership Team Meeting',
        firstEventTime: '8:30 AM',
      },
    });
    setLoading(false);
  }, []);

  if (loading || !briefing) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-pulse text-muted-foreground">
            Preparing your briefing...
          </div>
        </CardContent>
      </Card>
    );
  }

  const getGreeting = () => {
    switch (timeOfDay) {
      case 'morning':
        return "☀️ Good morning! Here's your day ahead:";
      case 'afternoon':
        return "🌤️ Good afternoon! Here's what's left today:";
      case 'evening':
        return "🌙 Good evening! Here's tomorrow's preview:";
      default:
        return "Here's your schedule:";
    }
  };

  const meetingsNeedingPrep = briefing.events.filter((e) => e.needsPrep);
  const longestGap = briefing.gaps.reduce(
    (max, gap) => (gap.duration > max.duration ? gap : max),
    briefing.gaps[0] || { duration: 0 },
  );

  return (
    <div className="space-y-4">
      {/* Main Briefing Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Your Daily Briefing
          </CardTitle>
          <CardDescription>{briefing.date}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="text-base">
              {getGreeting()}
            </AlertDescription>
          </Alert>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{briefing.eventCount}</p>
              <p className="text-sm text-muted-foreground">meetings today</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{meetingsNeedingPrep.length}</p>
              <p className="text-sm text-muted-foreground">need prep</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{longestGap.duration}</p>
              <p className="text-sm text-muted-foreground">min focus time</p>
            </div>
          </div>

          {/* Meetings Needing Preparation */}
          {meetingsNeedingPrep.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Meetings Requiring Preparation
              </div>
              {meetingsNeedingPrep.map((event, i) => (
                <div
                  key={`prep-${event.time}-${event.title}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-amber-600" />
                    <span className="text-sm font-medium">{event.time}</span>
                    <span className="text-sm">{event.title}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {event.attendeeCount} attendees
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Focus Time Blocks */}
          {briefing.gaps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Target className="h-4 w-4 text-green-600" />
                Available Focus Time
              </div>
              {briefing.gaps.map((gap, i) => (
                <div
                  key={`gap-${gap.start}-${gap.end}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20"
                >
                  <div className="flex items-center gap-2">
                    <Coffee className="h-3 w-3 text-green-600" />
                    <span className="text-sm">
                      {gap.start} - {gap.end}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs bg-green-100 dark:bg-green-900/50"
                  >
                    {gap.duration} minutes
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Tomorrow Preview */}
          {briefing.tomorrowPreview && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Briefcase className="h-4 w-4" />
                Tomorrow&apos;s Preview
              </div>
              <div className="text-sm text-muted-foreground">
                {briefing.tomorrowPreview.count} meetings scheduled • First:{' '}
                {briefing.tomorrowPreview.firstEvent} at{' '}
                {briefing.tomorrowPreview.firstEventTime}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Suggestions Card */}
      <Card>
        <CardHeader>
          <CardTitle>AI Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Use your 3-hour focus block wisely</p>
              <p className="text-muted-foreground">
                You have a long break from 11 AM to 2 PM. Perfect for deep work
                on your quarterly goals.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Prepare for your Client Demo</p>
              <p className="text-muted-foreground">
                Review the latest product updates and client requirements before
                your 2 PM demo.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Schedule a break</p>
              <p className="text-muted-foreground">
                You have back-to-back meetings from 2-5 PM. Consider
                rescheduling one to avoid fatigue.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
