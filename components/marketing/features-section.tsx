'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  Brain,
  FileText,
  Mic,
  PenTool,
  Search,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'EOS Intelligence',
    description:
      'AI trained on the Six Key Components, V/TO, Scorecard, and every core EOS tool. Answers grounded in methodology, not guesswork.',
    accent: 'rgba(255, 121, 0, 0.15)',
    accentBorder: 'rgba(255, 121, 0, 0.25)',
    large: true,
  },
  {
    icon: PenTool,
    title: 'Composer Studio',
    description:
      'Draft documents, charts, code, V/TOs, and accountability charts in one AI-powered workspace. Export to PDF or DOCX.',
    accent: 'rgba(244, 63, 94, 0.12)',
    accentBorder: 'rgba(244, 63, 94, 0.22)',
    large: true,
  },
  {
    icon: FileText,
    title: 'Document RAG',
    description:
      'Upload your EOS materials. Every response draws from your actual company context.',
    accent: 'rgba(59, 130, 246, 0.12)',
    accentBorder: 'rgba(59, 130, 246, 0.22)',
    large: false,
  },
  {
    icon: Mic,
    title: 'Voice & Meetings',
    description:
      'Record meetings. Get transcripts, action items, and AI summaries automatically.',
    accent: 'rgba(139, 92, 246, 0.12)',
    accentBorder: 'rgba(139, 92, 246, 0.22)',
    large: false,
  },
  {
    icon: Search,
    title: 'Nexus Deep Research',
    description:
      'Citation-backed research from 40+ sources for better EOS decisions.',
    accent: 'rgba(14, 165, 233, 0.12)',
    accentBorder: 'rgba(14, 165, 233, 0.22)',
    large: false,
  },
  {
    icon: Sparkles,
    title: 'Smart Memory',
    description:
      'AI remembers your patterns, preferences, and past conversations across sessions.',
    accent: 'rgba(16, 185, 129, 0.12)',
    accentBorder: 'rgba(16, 185, 129, 0.22)',
    large: false,
  },
];

function FeatureCard({
  feature,
}: {
  feature: (typeof features)[number];
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--spot-x', `${x}%`);
    card.style.setProperty('--spot-y', `${y}%`);
    card.style.setProperty('--spot-opacity', '1');
  }, []);

  const handleMouseLeave = useCallback(() => {
    cardRef.current?.style.setProperty('--spot-opacity', '0');
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  const Icon = feature.icon;

  return (
    <div
      ref={cardRef}
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 md:p-8 transition-all duration-300 hover:border-white/[0.15] hover:-translate-y-0.5 h-full ${
        feature.large ? 'min-h-[200px] lg:min-h-[220px]' : 'min-h-[180px]'
      }`}
      style={{
        background: `linear-gradient(135deg, ${feature.accent}, rgba(0,0,0,0.7))`,
        ['--spot-x' as string]: '50%',
        ['--spot-y' as string]: '50%',
        ['--spot-opacity' as string]: '0',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at var(--spot-x) var(--spot-y), ${feature.accentBorder}, transparent 60%)`,
          opacity: 'var(--spot-opacity)',
        }}
      />

      <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20400%20400%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22n%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.9%22%20numOctaves%3D%224%22%20stitchTiles%3D%22stitch%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23n)%22%2F%3E%3C%2Fsvg%3E')]" />

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08]">
            <Icon className="w-5 h-5 text-white/70" strokeWidth={1.5} />
          </div>
          <span className="font-mono text-[10px] tracking-widest text-white/30 uppercase">
            {feature.large ? 'Core' : 'Feature'}
          </span>
        </div>

        <div className="mt-auto">
          <h3 className="font-montserrat text-lg md:text-xl font-semibold text-white mb-2 tracking-tight">
            {feature.title}
          </h3>
          <p className="font-montserrat text-sm text-white/60 leading-relaxed">
            {feature.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  return (
    <section className="features-section relative z-20 py-24 md:py-32 bg-black">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="features-content max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="font-mono text-xs tracking-[0.2em] text-eos-orange/70 uppercase mb-4">
              Capabilities
            </p>
            <h2 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight">
              What EOS AI Does
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Row 1: Two large cards, each spanning 2 of 4 columns */}
            <div className="lg:col-span-2">
              <FeatureCard feature={features[0]} />
            </div>
            <div className="lg:col-span-2">
              <FeatureCard feature={features[1]} />
            </div>

            {/* Row 2: Four smaller cards, one per column */}
            {features.slice(2).map((feature) => (
              <div key={feature.title} className="lg:col-span-1">
                <FeatureCard feature={feature} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
