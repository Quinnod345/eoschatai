'use client';

import {
  Calendar,
  BarChart,
  Target,
  Mountain,
  Users,
  Search,
  TrendingUp,
  List,
  Clock,
} from 'lucide-react';
import type { MentionResource } from './types';

// Static mention resources — dynamic items (individual documents, recordings)
// are fetched live and merged in at runtime.
export const DEFAULT_MENTION_RESOURCES: MentionResource[] = [
  // EOS Resources
  {
    id: 'scorecard',
    name: 'Scorecard',
    type: 'scorecard',
    category: 'resource',
    description: 'View your EOS Scorecard metrics & KPIs',
    icon: <BarChart className="size-4" />,
    color: 'orange',
    aliases: ['metrics', 'kpis', 'score'],
    shortcut: '@score',
  },
  {
    id: 'vto',
    name: 'V/TO',
    type: 'vto',
    category: 'resource',
    description: 'Vision/Traction Organizer',
    icon: <Target className="size-4" />,
    color: 'indigo',
    aliases: ['vision', 'traction', 'strategy'],
    shortcut: '@vto',
  },
  {
    id: 'rocks',
    name: 'Rocks',
    type: 'rocks',
    category: 'resource',
    description: 'Quarterly rocks & priorities',
    icon: <Mountain className="size-4" />,
    color: 'teal',
    aliases: ['priorities', 'quarterly'],
    shortcut: '@rocks',
  },
  {
    id: 'accountability',
    name: 'Accountability Chart',
    type: 'accountability',
    category: 'resource',
    description: 'Org chart with roles & seats',
    icon: <Users className="size-4" />,
    color: 'indigo',
    aliases: ['ac', 'orgchart', 'organization', 'roles', 'seats'],
    shortcut: '@ac',
  },
  {
    id: 'people',
    name: 'People Analyzer',
    type: 'people',
    category: 'resource',
    description: 'Right person, right seat analysis',
    icon: <Users className="size-4" />,
    color: 'pink',
    aliases: ['gwo', 'analyzer'],
    shortcut: '@people',
  },
  // Calendar
  {
    id: 'calendar',
    name: 'Calendar',
    type: 'calendar',
    category: 'calendar',
    description: 'Events & schedule',
    icon: <Calendar className="size-4" />,
    color: 'blue',
    aliases: ['cal', 'schedule', 'events'],
    shortcut: '@cal',
  },
  {
    id: 'availability',
    name: 'Find Available Time',
    type: 'availability',
    category: 'calendar',
    description: 'Free time slots',
    icon: <Clock className="size-4" />,
    color: 'green',
    aliases: ['free', 'available', 'slots'],
    shortcut: '@free',
  },
  // Tools
  {
    id: 'search',
    name: 'Search',
    type: 'search',
    category: 'tool',
    description: 'Search all content',
    icon: <Search className="size-4" />,
    color: 'gray',
    aliases: ['find', 'lookup'],
    shortcut: '@search',
  },
  {
    id: 'analyze',
    name: 'Analyze',
    type: 'analyze',
    category: 'tool',
    description: 'Data analysis & insights',
    icon: <TrendingUp className="size-4" />,
    color: 'red',
    aliases: ['analytics', 'insights'],
    shortcut: '@analyze',
  },
  // Templates
  {
    id: 'agenda',
    name: 'Meeting Agenda',
    type: 'agenda',
    category: 'template',
    description: 'L10 meeting agenda template',
    icon: <List className="size-4" />,
    color: 'purple',
    aliases: ['meeting', 'l10'],
    shortcut: '@agenda',
  },
];

// CSS for drag-and-drop animation
export const pulseDragDropStyle = `
  @keyframes pulse {
    0% {
      opacity: 0.6;
    }
    50% {
      opacity: 0.8;
    }
    100% {
      opacity: 0.6;
    }
  }
`;

// Utility function to generate UUIDs
export function generateUUID(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}


