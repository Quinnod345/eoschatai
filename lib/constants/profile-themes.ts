import {
  CalendarIcon,
  TargetIcon,
  RocketIcon,
  CompassIcon,
  SettingsIcon,
} from '@/components/icons';
import type { LucideIcon } from 'lucide-react';

export interface ProfileTheme {
  id: string;
  name: string;
  icon: LucideIcon;
  gradient: {
    from: string;
    to: string;
  };
  iconBg: string;
  iconColor: string;
  borderColor: string;
  hoverBg: string;
  description?: string;
}

export const PROFILE_THEMES: Record<string, ProfileTheme> = {
  // Default/General mode
  default: {
    id: 'default',
    name: 'General Mode',
    icon: SettingsIcon,
    gradient: {
      from: 'from-eos-navy',
      to: 'to-eos-navyLight',
    },
    iconBg: 'bg-gradient-to-br from-eos-navy to-eos-navyLight',
    iconColor: 'text-white',
    borderColor: 'border-eos-navy/20',
    hoverBg: 'hover:from-eos-navy/10 hover:to-eos-navyLight/5',
    description: 'Use the persona without a specific profile',
  },

  // Quarterly Session Facilitator
  'quarterly-session-facilitator': {
    id: 'quarterly-session-facilitator',
    name: 'Quarterly Session Facilitator',
    icon: CalendarIcon,
    gradient: {
      from: 'from-emerald-600',
      to: 'to-teal-500',
    },
    iconBg: 'bg-gradient-to-br from-emerald-600 to-teal-500',
    iconColor: 'text-white',
    borderColor: 'border-emerald-500/20',
    hoverBg: 'hover:from-emerald-600/10 hover:to-teal-500/5',
    description: 'Focus on quarterly planning sessions and Rock setting',
  },

  // Focus Day Facilitator
  'focus-day-facilitator': {
    id: 'focus-day-facilitator',
    name: 'Focus Day Facilitator',
    icon: TargetIcon,
    gradient: {
      from: 'from-purple-600',
      to: 'to-pink-500',
    },
    iconBg: 'bg-gradient-to-br from-purple-600 to-pink-500',
    iconColor: 'text-white',
    borderColor: 'border-purple-500/20',
    hoverBg: 'hover:from-purple-600/10 hover:to-pink-500/5',
    description: 'Focus on facilitating Focus Days for leadership teams',
  },

  // Vision Building Day 1
  'vision-building-day-1': {
    id: 'vision-building-day-1',
    name: 'Vision Building Day 1',
    icon: CompassIcon,
    gradient: {
      from: 'from-blue-600',
      to: 'to-cyan-500',
    },
    iconBg: 'bg-gradient-to-br from-blue-600 to-cyan-500',
    iconColor: 'text-white',
    borderColor: 'border-blue-500/20',
    hoverBg: 'hover:from-blue-600/10 hover:to-cyan-500/5',
    description:
      'Focus on the first day of Vision Building - People and Data components',
  },

  // Vision Building Day 2
  'vision-building-day-2': {
    id: 'vision-building-day-2',
    name: 'Vision Building Day 2',
    icon: RocketIcon,
    gradient: {
      from: 'from-orange-600',
      to: 'to-red-500',
    },
    iconBg: 'bg-gradient-to-br from-orange-600 to-red-500',
    iconColor: 'text-white',
    borderColor: 'border-orange-500/20',
    hoverBg: 'hover:from-orange-600/10 hover:to-red-500/5',
    description:
      'Focus on the second day of Vision Building - Vision, Issues, Process, and Traction',
  },
};

export function getProfileTheme(profileId: string | null): ProfileTheme {
  if (!profileId) return PROFILE_THEMES.default;
  return PROFILE_THEMES[profileId] || PROFILE_THEMES.default;
}
