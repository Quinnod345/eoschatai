'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Brain,
  FileText,
  Mic,
  Search,
  PenTool,
  Users,
  Calendar,
  Sparkles,
  AtSign,
  BarChart3,
  Shield,
  Zap,
} from 'lucide-react';
import InfiniteMarquee from '@/components/marketing/infinite-marquee';

const topRow = [
  { icon: Brain, label: 'EOS Intelligence' },
  { icon: FileText, label: 'Document RAG' },
  { icon: Users, label: 'AI Personas' },
  { icon: Mic, label: 'Voice Capture' },
  { icon: Search, label: 'Deep Research' },
  { icon: PenTool, label: 'Composer Studio' },
  { icon: Calendar, label: 'Calendar Sync' },
  { icon: Sparkles, label: 'Smart Memory' },
];

const bottomRow = [
  { icon: AtSign, label: 'Mentions' },
  { icon: BarChart3, label: 'Scorecards' },
  { icon: Shield, label: 'V/TO Builder' },
  { icon: Zap, label: 'Accountability' },
  { icon: Users, label: 'Team Sharing' },
  { icon: Search, label: 'Semantic Search' },
  { icon: FileText, label: 'Rocks Tracking' },
  { icon: Brain, label: 'L10 Meetings' },
];

function MarqueeBadge({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-2.5 mx-2 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm shrink-0">
      <Icon className="w-3.5 h-3.5 text-eos-orange/80" strokeWidth={1.5} />
      <span className="font-mono text-xs tracking-wide text-white/50 whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

export default function SocialProof() {
  return (
    <section className="social-proof-section relative z-20 bg-black py-6 overflow-hidden">
      <div className="space-y-3">
        <InfiniteMarquee speed={50} direction="left" pauseOnHover>
          {topRow.map((item) => (
            <MarqueeBadge key={item.label} icon={item.icon} label={item.label} />
          ))}
        </InfiniteMarquee>

        <InfiniteMarquee speed={45} direction="right" pauseOnHover>
          {bottomRow.map((item) => (
            <MarqueeBadge key={item.label} icon={item.icon} label={item.label} />
          ))}
        </InfiniteMarquee>
      </div>
    </section>
  );
}
