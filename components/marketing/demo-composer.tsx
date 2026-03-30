'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  FileText,
  Table,
  Target,
  Users,
  Sparkles,
} from 'lucide-react';

const COMPOSER_TABS = [
  { id: 'text', label: 'Text', icon: FileText, color: 'blue', request: 'Draft a Q1 strategic plan for our team', title: 'Q1 Strategic Plan' },
  { id: 'sheet', label: 'Sheet', icon: Table, color: 'purple', request: 'Build a scorecard tracking our key measurables', title: 'Team Scorecard' },
  { id: 'vto', label: 'V/TO', icon: Target, color: 'red', request: 'Create a Vision/Traction Organizer for our company', title: 'V/TO Builder' },
  { id: 'accountability', label: 'Org Chart', icon: Users, color: 'cyan', request: 'Build our accountability chart with all seats', title: 'Accountability Chart' },
];

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('aborted')); return; }
    const id = setTimeout(() => resolve(), ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); reject(new Error('aborted')); }, { once: true });
  });

function TextContent({ step }: { step: number }) {
  const lines = [
    { type: 'h1', text: 'Q1 Strategic Plan' },
    { type: 'h2', text: 'Goals' },
    { type: 'li', text: 'Launch new product dashboard by end of February' },
    { type: 'li', text: 'Increase active user retention by 15%' },
    { type: 'li', text: 'Complete hiring for 3 open engineering roles' },
    { type: 'h2', text: 'Timeline' },
    { type: 'p', text: 'Phase 1 kicks off next week. All department heads should review the scorecard metrics before our Level 10 on Thursday.' },
    { type: 'h2', text: 'Key Rocks' },
    { type: 'li', text: 'Ship v2.0 core features (Owner: Engineering)' },
    { type: 'li', text: 'Reach $1.2M ARR milestone (Owner: Sales)' },
  ];

  return (
    <div className="p-6 md:p-8 font-montserrat space-y-1">
      {lines.map((line, i) => {
        const visible = i < step;
        const cls = `transition-all duration-400 ${visible ? 'opacity-100 translate-y-0 blur-none' : 'opacity-0 translate-y-2 blur-[3px]'}`;
        const key = `${line.type}-${line.text.slice(0, 20)}`;

        if (line.type === 'h1') return <h1 key={key} className={`text-xl font-bold text-white mb-3 ${cls}`}>{line.text}</h1>;
        if (line.type === 'h2') return <h2 key={key} className={`text-sm font-semibold text-white/80 mt-5 mb-2 uppercase tracking-wide ${cls}`}>{line.text}</h2>;
        if (line.type === 'li') return (
          <div key={key} className={`flex items-start gap-2.5 pl-1 ${cls}`}>
            <span className="text-blue-400 mt-0.5 text-xs">&#9679;</span>
            <span className="text-sm text-white/60 leading-relaxed">{line.text}</span>
          </div>
        );
        return <p key={key} className={`text-sm text-white/60 leading-relaxed ${cls}`}>{line.text}</p>;
      })}
    </div>
  );
}

function SheetContent({ step }: { step: number }) {
  const headers = ['Measurable', 'Owner', 'Goal', 'Actual', 'Status'];
  const data = [
    ['Revenue', 'Sales', '$1.2M', '$1.15M', 'Off Track'],
    ['New Leads', 'Marketing', '450', '520', 'On Track'],
    ['Churn Rate', 'CS', '< 2%', '1.8%', 'On Track'],
    ['NPS Score', 'Product', '> 50', '62', 'On Track'],
  ];

  return (
    <div className="font-mono text-[11px]">
      <div className="flex border-b border-zinc-700/80 bg-zinc-800/60 text-zinc-400 font-semibold">
        <div className="w-8 border-r border-zinc-700/60 py-2" />
        {headers.map((h) => (
          <div key={h} className="flex-1 px-3 py-2 border-r border-zinc-700/60 truncate">{h}</div>
        ))}
      </div>
      {data.map((row, rIdx) => (
        <div key={row[0]} className="flex border-b border-zinc-800/40 text-zinc-300">
          <div className="w-8 border-r border-zinc-700/60 flex items-center justify-center py-2 text-zinc-600 bg-zinc-900/30">{rIdx + 1}</div>
          {row.map((cell, cIdx) => {
            const cellNum = rIdx * 5 + cIdx;
            const visible = cellNum < step;
            const isStatus = cIdx === 4;
            return (
              <div key={`${row[0]}-${cIdx}`} className="flex-1 px-3 py-2 border-r border-zinc-800/40">
                <span className={`inline-block transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-0'} ${isStatus && cell === 'On Track' ? 'text-emerald-400' : ''} ${isStatus && cell === 'Off Track' ? 'text-amber-400' : ''}`}>
                  {visible ? cell : ''}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      {[5, 6].map((n) => (
        <div key={`e-${n}`} className="flex border-b border-zinc-800/20 h-8">
          <div className="w-8 border-r border-zinc-700/60 flex items-center justify-center text-zinc-700 bg-zinc-900/20 text-[10px]">{n}</div>
          {headers.map((h) => <div key={`${n}-${h}`} className="flex-1 border-r border-zinc-800/20" />)}
        </div>
      ))}
    </div>
  );
}

function VtoContent({ step }: { step: number }) {
  const sections = [
    { title: 'Core Values', items: ['Do the right thing', 'Grow or die', 'Help first'] },
    { title: 'Core Focus', items: ['Purpose: Empower leadership teams', 'Niche: B2B SaaS for EOS'] },
    { title: '10-Year Target', items: ['100,000 active organizations running on the platform'] },
    { title: 'Rocks (Q1)', items: ['Ship v2.0 features', 'Close 15 new enterprise deals', 'Hire VP of Engineering'] },
  ];

  return (
    <div className="p-4 space-y-3 font-montserrat">
      {sections.map((s, i) => (
        <div
          key={s.title}
          className={`rounded-lg overflow-hidden border border-zinc-700/40 bg-zinc-900/80 transition-all duration-500 ${i < step ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
        >
          <div className="bg-slate-700 text-white px-4 py-2 text-[11px] font-semibold tracking-wide">{s.title}</div>
          <div className="p-3 space-y-1.5">
            {s.items.map((item) => (
              <div key={item} className="px-3 py-1.5 rounded bg-zinc-800/40 border border-zinc-700/20 text-[11px] text-white/65">{item}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AccountabilityContent({ step }: { step: number }) {
  const NodeCard = ({ title, name, visible, width = 'w-[130px]' }: { title: string; name: string; visible: boolean; width?: string }) => (
    <div className={`${width} border border-zinc-700/40 rounded-lg overflow-hidden bg-zinc-900/80 transition-all duration-500 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
      <div className="bg-slate-700 text-white px-3 py-1.5 text-[10px] font-semibold tracking-wide truncate">{title}</div>
      <div className="p-2">
        <div className="text-[11px] text-white/85 font-medium truncate">{name}</div>
        <div className="flex gap-0.5 mt-1.5">
          <div className="h-[3px] flex-1 bg-blue-500/25 rounded-full" />
          <div className="h-[3px] flex-1 bg-blue-500/25 rounded-full" />
          <div className="h-[3px] flex-1 bg-blue-500/25 rounded-full" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 flex flex-col items-center gap-0 font-montserrat">
      <NodeCard title="Visionary" name="Sarah Connor" visible={step >= 1} width="w-[140px]" />
      <div className={`w-px h-5 bg-zinc-700 transition-all duration-400 origin-top ${step >= 2 ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`} />
      <NodeCard title="Integrator" name="James Lee" visible={step >= 2} width="w-[140px]" />
      <div className={`w-px h-5 bg-zinc-700 transition-all duration-400 origin-top ${step >= 3 ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`} />
      <div className={`w-[320px] h-px bg-zinc-700 transition-all duration-400 ${step >= 3 ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'}`} />
      <div className="flex gap-3">
        {[
          { t: 'Sales/Mktg', n: 'John Smith', s: 3 },
          { t: 'Operations', n: 'Mike Johnson', s: 4 },
          { t: 'Finance', n: 'Emily Chen', s: 5 },
        ].map((c) => (
          <div key={c.t} className="flex flex-col items-center">
            <div className={`w-px h-5 bg-zinc-700 transition-all duration-400 origin-top ${step >= c.s ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`} />
            <NodeCard title={c.t} name={c.n} visible={step >= c.s} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ComposerDemo({ tabIndex, isActive }: { tabIndex: number; isActive: boolean }) {
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'generating' | 'done'>('idle');
  const [contentStep, setContentStep] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const tab = COMPOSER_TABS[tabIndex];

  useEffect(() => {
    if (!isActive) { setPhase('idle'); setContentStep(0); return; }

    let dead = false;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const run = async () => {
      try {
        setPhase('idle');
        setContentStep(0);

        await wait(600, signal);
        setPhase('requesting');

        await wait(2000, signal);
        setPhase('generating');

        const maxSteps = tabIndex === 0 ? 10 : tabIndex === 1 ? 20 : tabIndex === 2 ? 4 : 5;
        for (let i = 1; i <= maxSteps; i++) {
          if (dead) return;
          setContentStep(i);
          const speed = tabIndex === 1 ? 100 : tabIndex === 0 ? 350 : 500;
          await wait(speed, signal);
        }

        setPhase('done');
        await wait(4000, signal);
        setPhase('idle');
        setContentStep(0);
        await wait(800, signal);

        if (!dead) run();
      } catch { /* aborted */ }
    };

    run();
    return () => { dead = true; abortRef.current?.abort(); };
  }, [isActive, tabIndex]);

  const showRequest = phase === 'requesting' || phase === 'generating' || phase === 'done';
  const showComposer = phase === 'generating' || phase === 'done';

  return (
    <div className="w-full flex flex-col gap-4">
      {/* User request bubble */}
      <div className={`flex justify-end transition-all duration-500 ${showRequest ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-800 border border-zinc-700/50 px-4 py-3">
          <p className="text-sm text-white/80 font-montserrat">{tab.request}</p>
        </div>
      </div>

      {/* AI generating indicator */}
      <div className={`flex items-start gap-3 transition-all duration-500 ${showComposer ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-eos-orange to-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[10px] text-zinc-500">EOS AI</span>
            {phase === 'generating' && (
              <span className="font-mono text-[10px] text-eos-orange/60 animate-pulse">generating...</span>
            )}
            {phase === 'done' && (
              <span className="font-mono text-[10px] text-emerald-500/60">complete</span>
            )}
          </div>

          {/* Composer artifact panel */}
          <div className={`rounded-xl border overflow-hidden transition-all duration-500 ${
            phase === 'generating' ? 'border-eos-orange/20 shadow-[0_0_20px_rgba(255,118,0,0.06)]' : 'border-zinc-700/40'
          } bg-zinc-900/90`}>
            {/* Composer header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-700/30 bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <tab.icon className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                <span className="font-montserrat text-xs font-medium text-white/70">{tab.title}</span>
              </div>
              <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-wider">{tab.label}</span>
            </div>

            {/* Composer content */}
            <div className="bg-zinc-950/80 h-[300px] overflow-hidden">
              {tabIndex === 0 && <TextContent step={contentStep} />}
              {tabIndex === 1 && <SheetContent step={contentStep} />}
              {tabIndex === 2 && <VtoContent step={contentStep} />}
              {tabIndex === 3 && <AccountabilityContent step={contentStep} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DemoComposer({ isActive: parentActive = true }: { isActive?: boolean }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="w-full max-w-[560px] mx-auto flex flex-col">
      {/* Sub-tab bar */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {COMPOSER_TABS.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = i === activeTab;

            const colorClasses: Record<string, string> = {
              blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
              purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
              red: 'text-red-400 bg-red-500/10 border-red-500/20',
              cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
            };

            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(i)}
                className={`relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-montserrat font-medium transition-colors duration-200 ${
                  isActive ? 'text-white' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeComposerSubTab"
                    className={`absolute inset-0 rounded-lg border ${colorClasses[tab.color]}`}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" strokeWidth={1.5} />
                <span className="relative z-10 hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Demo content area -- fixed height so switching tabs never shifts layout */}
      <div className="relative h-[480px]">
        {COMPOSER_TABS.map((tab, i) => (
          <div
            key={tab.id}
            className={`absolute inset-0 transition-opacity duration-300 ${i === activeTab ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}`}
          >
            <ComposerDemo tabIndex={i} isActive={parentActive && i === activeTab} />
          </div>
        ))}
      </div>
    </div>
  );
}
