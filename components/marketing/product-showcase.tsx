'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  MessageSquare,
  PenTool,
  Users,
  Search,
} from 'lucide-react';
import DemoInput from '@/components/marketing/demo-input';
import DemoComposer from '@/components/marketing/demo-composer';
import DemoPersonas from '@/components/marketing/demo-personas';
import DemoResearch from '@/components/marketing/demo-research';

const tabs = [
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    heading: 'EOS-native conversations',
    bullets: [
      'Ask about the Six Key Components, V/TO, Scorecard, and every core EOS tool',
      'Responses grounded in your company context and uploaded documents',
      '@mention your calendar, scorecard, or V/TO to pull live data into the conversation',
      'Conversation memory learns your patterns and preferences over time',
    ],
  },
  {
    id: 'composer',
    label: 'Composer',
    icon: PenTool,
    heading: 'Artifacts built in real-time',
    bullets: [
      'Generate V/TOs, accountability charts, scorecards, spreadsheets, and rich documents',
      'Edit inline with full version history and undo/redo support',
      'Export to PDF or DOCX when ready for your team',
      'Seven composer types: text, code, chart, sheet, image, V/TO, and accountability',
    ],
  },
  {
    id: 'personas',
    label: 'Personas',
    icon: Users,
    heading: 'Role-specific AI assistants',
    bullets: [
      'Pre-built personas for Implementers, Integrators, and Visionaries',
      'Create custom personas with your own instructions, tone, and knowledge base',
      'Attach documents to give each persona specialized expertise',
      'Share personas across your organization for consistent team-wide guidance',
    ],
  },
  {
    id: 'research',
    label: 'Research',
    icon: Search,
    heading: 'Nexus deep research',
    bullets: [
      'Nexus pulls from 40+ real-time sources per query with automatic citation tracking',
      'Competitive analysis, market trends, and industry benchmarks on demand',
      'Multi-phase research: scanning, analyzing, and synthesizing into coherent reports',
      'Every claim is backed by a source link you can verify',
    ],
  },
];

export default function ProductShowcase() {
  const [activeTab, setActiveTab] = useState(0);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const current = tabs[activeTab];

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isRunning = (tabIdx: number) => inView && activeTab === tabIdx;

  return (
    <section
      ref={sectionRef}
      id="showcase"
      className="relative z-20 scroll-mt-28 bg-[#050505] py-16 md:py-24 lg:py-32"
      aria-label="Product showcase"
    >
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="showcase-header text-center mb-16">
            <p className="font-mono text-xs tracking-[0.2em] text-eos-orange/70 uppercase mb-4">
              Product
            </p>
            <h2 className="font-montserrat text-3xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight">
              See It in Action
            </h2>
          </div>

          {/* Tab bar */}
          <div className="showcase-tabs flex justify-center mb-12">
            <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
              {tabs.map((tab, i) => {
                const Icon = tab.icon;
                const isActive = i === activeTab;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(i)}
                    className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-montserrat font-medium transition-colors duration-200 ${
                      isActive
                        ? 'text-white'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeShowcaseTab"
                        className="absolute inset-0 rounded-xl bg-white/[0.08] border border-white/[0.12]"
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      />
                    )}
                    <Icon className="w-4 h-4 relative z-10" strokeWidth={1.5} />
                    <span className="relative z-10 hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="showcase-body grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-start">
            {/* Text side */}
            <div className="lg:col-span-2 order-2 lg:order-1 lg:pt-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <p className="font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase mb-3">
                    0{activeTab + 1} / 0{tabs.length}
                  </p>
                  <h3 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-5 tracking-tight">
                    {current.heading}
                  </h3>
                  <ul className="space-y-3">
                    {current.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5">
                        <span className="w-1 h-1 rounded-full bg-eos-orange/60 mt-2.5 flex-shrink-0" />
                        <span className="font-montserrat text-sm text-white/55 leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Visual side */}
            <div className="lg:col-span-3 order-1 lg:order-2 relative h-[350px] sm:h-[420px] lg:h-[560px]">
              <div className={`absolute left-0 right-0 bottom-[48%] transition-opacity duration-300 ${activeTab === 0 ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}`}>
                <DemoInput isActive={isRunning(0)} />
              </div>

              <div className={`absolute inset-0 transition-opacity duration-300 overflow-hidden ${activeTab === 1 ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}`}>
                <DemoComposer isActive={isRunning(1)} />
              </div>

              <div className={`absolute left-0 right-0 bottom-[48%] transition-opacity duration-300 ${activeTab === 2 ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}`}>
                <DemoPersonas isActive={isRunning(2)} />
              </div>

              <div className={`absolute left-0 right-0 bottom-[48%] transition-opacity duration-300 ${activeTab === 3 ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}`}>
                <DemoResearch isActive={isRunning(3)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
