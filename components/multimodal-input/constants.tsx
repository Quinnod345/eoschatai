'use client';

import {
  Calendar,
  FileText,
  BarChart,
  Target,
  Mountain,
  Users,
  Search,
  TrendingUp,
  HelpCircle,
  List,
  Clock,
  Mic,
} from 'lucide-react';
import type { MentionResource } from './types';

// Enhanced mention resources with categories
export const DEFAULT_MENTION_RESOURCES: MentionResource[] = [
  // Calendar category
  {
    id: 'calendar',
    name: 'Calendar',
    type: 'calendar',
    category: 'calendar',
    description: 'Access your calendar events and schedule',
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
    description: 'Find free time slots in your calendar',
    icon: <Clock className="size-4" />,
    color: 'green',
    aliases: ['free', 'available', 'slots'],
    shortcut: '@free',
  },
  // Resource category
  {
    id: 'documents',
    name: 'Documents',
    type: 'document',
    category: 'resource',
    description: 'Access your documents and files',
    icon: <FileText className="size-4" />,
    color: 'purple',
    aliases: ['docs', 'files'],
    shortcut: '@doc',
    isDynamic: true,
  },
  {
    id: 'recordings',
    name: 'Vocal Recordings',
    type: 'recording',
    category: 'resource',
    description: 'Use voice recordings and transcripts as context',
    icon: <Mic className="size-4" />,
    color: 'pink',
    aliases: ['audio', 'voice', 'transcript'],
    shortcut: '@rec',
    isDynamic: true,
  },
  {
    id: 'scorecard',
    name: 'Scorecard',
    type: 'scorecard',
    category: 'resource',
    description: 'View your EOS Scorecard metrics',
    icon: <BarChart className="size-4" />,
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
    icon: <Target className="size-4" />,
    color: 'indigo',
    aliases: ['vision', 'traction', 'strategy'],
    shortcut: '@vto',
  },
  {
    id: 'accountability',
    name: 'Accountability Chart',
    type: 'accountability',
    category: 'resource',
    description: 'Build or view your EOS Accountability Chart',
    icon: <Users className="size-4" />,
    color: 'indigo',
    aliases: ['ac', 'orgchart', 'organization', 'roles', 'seats'],
    shortcut: '@ac',
  },
  {
    id: 'rocks',
    name: 'Rocks',
    type: 'rocks',
    category: 'resource',
    description: 'Check your quarterly rocks and priorities',
    icon: <Mountain className="size-4" />,
    color: 'teal',
    aliases: ['priorities', 'quarterly'],
  },
  {
    id: 'people',
    name: 'People Analyzer',
    type: 'people',
    category: 'resource',
    description: 'Access your people analyzer data',
    icon: <Users className="size-4" />,
    color: 'pink',
  },
  // People category
  {
    id: 'team',
    name: 'Team Members',
    type: 'team',
    category: 'person',
    description: 'Mention team members',
    icon: <Users className="size-4" />,
    color: 'teal',
    aliases: ['people', 'members'],
    shortcut: '@team',
    isDynamic: true,
  },
  // Tool category
  {
    id: 'search',
    name: 'Search',
    type: 'search',
    category: 'tool',
    description: 'Search through all your content',
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
    description: 'Analyze data and provide insights',
    icon: <TrendingUp className="size-4" />,
    color: 'red',
    aliases: ['analytics', 'insights'],
    shortcut: '@analyze',
  },
  // Command category
  {
    id: 'help',
    name: 'Help',
    type: 'help',
    category: 'command',
    description: 'Get help with using the system',
    icon: <HelpCircle className="size-4" />,
    color: 'blue',
    aliases: ['?', 'guide'],
    shortcut: '@help',
  },
  // Template category
  {
    id: 'agenda',
    name: 'Meeting Agenda',
    type: 'agenda',
    category: 'template',
    description: 'Create a meeting agenda template',
    icon: <List className="size-4" />,
    color: 'purple',
    aliases: ['meeting'],
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


