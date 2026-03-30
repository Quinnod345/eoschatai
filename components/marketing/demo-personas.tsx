'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ArrowUp,
  Plus,
  Mic,
  Sparkles,
  X,
  Square,
  Target,
  BarChart,
} from 'lucide-react';

const PERSONAS = [
  { id: 'implementer', name: 'EOS Implementer', icon: Sparkles },
  { id: 'visionary', name: 'Visionary Coach', icon: Target },
  { id: 'integrator', name: 'Integrator Advisor', icon: BarChart },
];

const DEMO_TEXT = 'How should we structure our next annual planning session?';
const STREAMING_RESPONSES: Record<string, string> = {
  implementer: "Great question. For annual planning, I recommend starting with a State of the Company address, then moving into your V/TO review. Block out two full days...",
  visionary: "As your Visionary Coach, let's think big picture. Start by revisiting your 10-Year Target and work backwards to define this year's goals...",
  integrator: "From an operational standpoint, ensure every department head has submitted their scorecard data 48 hours before. Structure the day in three blocks...",
};

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('aborted')); return; }
    const id = setTimeout(() => resolve(), ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); reject(new Error('aborted')); }, { once: true });
  });

export default function DemoPersonas({ isActive = true }: { isActive?: boolean }) {
  const [typedLen, setTypedLen] = useState(0);
  const [streamLen, setStreamLen] = useState(0);
  const [activePersona, setActivePersona] = useState(0);
  const [personaVisible, setPersonaVisible] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [burst, setBurst] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [finished, setFinished] = useState(false);
  const personaIdxRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const triggerBurst = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.97)' }, { transform: 'scale(1)' }],
      { duration: 300, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
    );
    el.animate(
      [
        { filter: 'drop-shadow(0 0 0px rgba(249,115,22,0))' },
        { filter: 'drop-shadow(0 0 24px rgba(249,115,22,0.9))', offset: 0.15 },
        { filter: 'drop-shadow(0 0 48px rgba(249,115,22,0.4))', offset: 0.4 },
        { filter: 'drop-shadow(0 0 0px rgba(249,115,22,0))' },
      ],
      { duration: 700, delay: 30, easing: 'ease-out' },
    );
  }, []);

  useEffect(() => {
    if (!isActive) {
      abortRef.current?.abort();
      setTypedLen(0); setStreamLen(0);
      setPersonaVisible(false); setShowSelector(false);
      setBurst(false); setSent(false); setLoading(false);
      setStreaming(false); setFinished(false);
      return;
    }

    let dead = false;

    const typeChars = async (text: string, setter: (n: number) => void, speed: number, signal: AbortSignal) => {
      for (let i = 1; i <= text.length; i++) {
        if (dead) throw new Error('aborted');
        setter(i);
        await wait(speed, signal);
      }
    };

    const reset = () => {
      setTypedLen(0); setStreamLen(0);
      setPersonaVisible(false); setShowSelector(false);
      setBurst(false); setSent(false); setLoading(false);
      setStreaming(false); setFinished(false);
    };

    const runCycle = async () => {
      try {
        reset();
        abortRef.current = new AbortController();
        const signal = abortRef.current.signal;

        const pidx = personaIdxRef.current;
        const persona = PERSONAS[pidx];
        const response = STREAMING_RESPONSES[persona.id];

        await wait(800, signal);

        setShowSelector(true);
        await wait(1000, signal);

        for (let i = 0; i < PERSONAS.length; i++) {
          setActivePersona(i);
          await wait(700, signal);
        }
        setActivePersona(pidx);
        await wait(600, signal);
        setShowSelector(false);

        await wait(500, signal);
        setPersonaVisible(true);

        await wait(600, signal);
        triggerBurst();
        await wait(500, signal);

        await typeChars(DEMO_TEXT, setTypedLen, 40, signal);

        await wait(1200, signal);
        setBurst(true);
        setSent(true);
        triggerBurst();
        await wait(420, signal);
        setBurst(false);

        await wait(400, signal);
        setLoading(true);

        await wait(1600, signal);
        setLoading(false);
        setStreaming(true);
        await typeChars(response, setStreamLen, 20, signal);

        await wait(1000, signal);
        setStreaming(false);
        setFinished(true);

        await wait(4500, signal);
        reset();
        personaIdxRef.current = (pidx + 1) % PERSONAS.length;
        await wait(1200, signal);

        if (!dead) runCycle();
      } catch { /* aborted */ }
    };

    runCycle();
    return () => { dead = true; abortRef.current?.abort(); };
  }, [triggerBurst, isActive]);

  const persona = PERSONAS[activePersona];
  const PersonaIcon = persona.icon;
  const response = STREAMING_RESPONSES[persona.id];
  const showText = typedLen > 0;
  const hasContent = typedLen > 0;
  const showCursor = showText && !sent;

  return (
    <div className="w-full max-w-[540px] mx-auto relative flex flex-col justify-end">
      {/* AI response */}
      <div className={`absolute bottom-full left-0 right-0 mb-4 px-1 transition-all duration-500 ${
        streaming || finished ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        <div className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-4 backdrop-blur-sm shadow-xl">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-eos-orange to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
              <PersonaIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] text-zinc-500 mb-1.5">{persona.name}</p>
              <p className="text-sm text-white/70 leading-relaxed font-montserrat">
                {response.slice(0, streamLen)}
                {streaming && <span className="inline-block w-[2px] h-[14px] bg-eos-orange/60 ml-0.5 align-text-bottom animate-pulse" />}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-auto w-full">
        {/* Persona selector dropdown */}
        <div className={`absolute bottom-full left-0 right-0 mb-3 z-10 transition-all duration-300 ${showSelector ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="bg-zinc-900 shadow-xl rounded-lg border border-zinc-700/60 overflow-hidden">
            <div className="p-3 text-xs font-medium border-b border-zinc-700/40 bg-zinc-800/50 rounded-t-lg text-white/60">
              Select a persona
            </div>
            {PERSONAS.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={p.id} className={`flex items-center gap-3 px-3 py-3 transition-all duration-300 border-l-2 ${i === activePersona ? 'bg-eos-orange/10 border-eos-orange' : 'border-transparent'}`}>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-eos-orange/30 to-eos-orange/10 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-eos-orange" />
                  </div>
                  <span className="text-sm font-medium text-white/80">{p.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Input */}
        <div
          ref={containerRef}
          role="button"
          tabIndex={0}
          className={`transition-all duration-300 cursor-pointer ${loading || streaming ? 'input-loading-border' : ''} ${finished ? 'input-finish-border' : ''}`}
          style={{ borderRadius: 24 }}
          onClick={triggerBurst}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') triggerBurst(); }}
        >
          <div className="w-full relative z-[2] overflow-hidden rounded-3xl border border-zinc-700/60 bg-zinc-900/70 backdrop-blur-xl shadow-[0_4px_16px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.06),inset_0_-1px_0_0_rgba(255,255,255,0.03)] p-2">
            <div className={`grid w-full transition-all duration-200 ease-in-out ${
              personaVisible
                ? "grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] [grid-template-areas:'primary_primary_primary'_'leading_footer_trailing'] gap-y-2"
                : "grid-cols-[auto_1fr_auto] [grid-template-areas:'leading_primary_trailing'] items-center"
            }`}>
              <div style={{ gridArea: 'primary' }} className="relative w-full min-w-0">
                <div className="min-h-[40px] px-3 py-2 text-[15px] text-white/80 font-montserrat break-words">
                  {showText ? (
                    <>
                      <span>{DEMO_TEXT.slice(0, typedLen)}</span>
                      {showCursor && <span className="inline-block w-[2px] h-[16px] bg-white/60 ml-[1px] align-text-bottom animate-pulse" />}
                    </>
                  ) : (
                    <span className="text-zinc-500">Ask anything…</span>
                  )}
                </div>
              </div>

              <div style={{ gridArea: 'leading' }} className={`flex items-center gap-1.5 pl-2 z-20 ${personaVisible ? 'pb-1' : ''}`}>
                <div className="flex items-center gap-0.5 rounded-full border border-zinc-700/60 bg-zinc-800/25 p-0.5">
                  <div className="rounded-full p-2 h-9 w-9 flex items-center justify-center text-zinc-400"><Plus className="w-[18px] h-[18px]" /></div>
                </div>
              </div>

              {personaVisible && (
                <div style={{ gridArea: 'footer' }} className="min-w-0 flex items-center gap-2.5 overflow-x-auto ml-2">
                  <div className="inline-flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full bg-gradient-to-r from-eos-orange/25 to-eos-orange/10 text-eos-orange text-[13px] font-medium border border-eos-orange/35 shadow-sm"
                    style={{ animation: 'demoMentionIn 0.3s cubic-bezier(0.4,0,0.2,1) both' }}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-eos-orange to-orange-500 flex items-center justify-center shadow-sm text-white animate-[demoPersonaPulse_3s_ease-in-out_infinite]">
                        <PersonaIcon className="w-2.5 h-2.5" />
                      </span>
                      <span className="font-medium truncate">{persona.name}</span>
                    </span>
                    <span className="text-eos-orange/50 p-1"><X className="w-3 h-3" /></span>
                  </div>
                </div>
              )}

              <div style={{ gridArea: 'trailing' }} className={`flex items-center gap-1.5 pr-2 z-20 ${personaVisible ? 'pb-1' : ''}`}>
                {(loading || streaming) ? (
                  <div className="rounded-full p-2 h-10 w-10 flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-400">
                    <Square className="w-4 h-4 fill-current" />
                  </div>
                ) : (
                  <>
                    {!sent && <div className="rounded-full p-2 h-9 w-9 flex items-center justify-center text-zinc-500"><Mic className="w-[18px] h-[18px]" /></div>}
                    <div className="mx-0.5 hidden h-8 w-px shrink-0 bg-zinc-700/40 sm:block" aria-hidden />
                    <div className={`rounded-full p-2 h-10 w-10 flex items-center justify-center transition-[background-color,box-shadow,ring] duration-200 ${
                      hasContent ? 'bg-white text-black shadow-md ring-2 ring-white/30' : 'border border-zinc-700 bg-zinc-800 text-zinc-500'
                    } ${burst ? 'send-burst' : ''}`}>
                      <ArrowUp className="w-5 h-5" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-full left-0 right-0 pt-4">
          <p className="text-center font-mono text-[10px] tracking-widest text-white/15 uppercase">Click to interact</p>
        </div>
      </div>
    </div>
  );
}
