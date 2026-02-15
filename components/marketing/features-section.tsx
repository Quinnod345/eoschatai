'use client';

import {
  BarChart3,
  FileText,
  Mic,
  PenTool,
  Search,
  Users,
} from 'lucide-react';
import { LazyDotGrid as DotGrid } from '@/components/marketing/lazy-marketing';

const features = [
  {
    icon: FileText,
    name: 'Document Intelligence',
    description:
      'Upload V/TOs, Scorecards, and process docs to power context-aware answers.',
  },
  {
    icon: Users,
    name: 'Role-Based AI Personas',
    description:
      'Assistants for implementers, integrators, and leaders with focused guidance.',
  },
  {
    icon: Mic,
    name: 'Voice & Meeting Capture',
    description:
      'Record meetings and get transcripts, notes, and action items automatically.',
  },
  {
    icon: Search,
    name: 'Deep Research',
    description:
      'Citation-backed research from 40+ sources to support better EOS decisions.',
  },
  {
    icon: PenTool,
    name: 'Composer Studio',
    description:
      'Draft and refine EOS artifacts, docs, and strategic plans in one workspace.',
  },
  {
    icon: BarChart3,
    name: 'Team Insights & Integrations',
    description:
      'Connect calendars, track adoption, and keep teams aligned with shared context.',
  },
];

export default function FeaturesSection() {
  return (
    <section className="features-section relative z-20 py-28 overflow-hidden">
      {/* DotGrid background */}
      <div className="absolute inset-0 z-0">
        <DotGrid
          dotSize={2}
          gap={28}
          baseColor="#0B3E60"
          activeColor="#FF7900"
          proximity={120}
          shockRadius={200}
          shockStrength={4}
          resistance={900}
          returnDuration={2}
          speedTrigger={90}
          className="w-full h-full"
        />
      </div>

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 z-[1] bg-black/40" />

      <div className="container mx-auto px-6 lg:px-8 relative z-10">
        <div className="features-content max-w-4xl mx-auto">
          {/* Section heading */}
          <div className="text-center mb-16">
            <h2 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5">
              What EOS AI Does
            </h2>
            <p className="font-montserrat text-lg md:text-xl text-white/85 max-w-2xl mx-auto">
              Six focused capabilities to support your team from strategy
              through execution.
            </p>
          </div>

          {/* Feature list -- 2-column grid */}
          <div className="features-list grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.name} className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <Icon
                      className="w-5 h-5 text-eos-orange"
                      strokeWidth={2}
                    />
                  </div>
                  <div>
                    <h3 className="font-montserrat text-base md:text-lg font-semibold text-white mb-1">
                      {feature.name}
                    </h3>
                    <p className="font-montserrat text-sm md:text-base text-white/85 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
