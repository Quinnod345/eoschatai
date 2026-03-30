'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ArrowUp,
  Plus,
  Mic,
  X,
  Square,
  Telescope,
  ExternalLink,
  Search,
} from 'lucide-react';

const DEMO_TEXT = 'Research competitive landscape for EOS implementation software';
const STREAMING_RESPONSE = "Based on analysis of 43 sources, here are the key findings on the EOS implementation software market...";

const SOURCES = [
  { name: 'Harvard Business Review', url: 'hbr.org' },
  { name: 'Gartner Research', url: 'gartner.com' },
  { name: 'McKinsey Digital', url: 'mckinsey.com' },
  { name: 'TechCrunch', url: 'techcrunch.com' },
];

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('aborted')); return; }
    const id = setTimeout(() => resolve(), ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); reject(new Error('aborted')); }, { once: true });
  });

export default function DemoResearch({ isActive = true }: { isActive?: boolean }) {
  const [typedLen, setTypedLen] = useState(0);
  const [streamLen, setStreamLen] = useState(0);
  const [nexusActive, setNexusActive] = useState(false);
  const [burst, setBurst] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sourcesVisible, setSourcesVisible] = useState(0);
  const [searchingPhase, setSearchingPhase] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const triggerPurpleBurst = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.97)' }, { transform: 'scale(1)' }],
      { duration: 300, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
    );
    el.animate(
      [
        { filter: 'drop-shadow(0 0 0px rgba(147,51,234,0))' },
        { filter: 'drop-shadow(0 0 30px rgba(147,51,234,0.8))', offset: 0.15 },
        { filter: 'drop-shadow(0 0 60px rgba(147,51,234,0.4))', offset: 0.4 },
        { filter: 'drop-shadow(0 0 0px rgba(147,51,234,0))' },
      ],
      { duration: 700, delay: 30, easing: 'ease-out' },
    );
  }, []);

  useEffect(() => {
    if (!isActive) {
      abortRef.current?.abort();
      setTypedLen(0); setStreamLen(0); setNexusActive(false);
      setBurst(false); setSent(false); setLoading(false);
      setStreaming(false); setFinished(false);
      setSourcesVisible(0); setSearchingPhase(0);
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
      setNexusActive(false);
      setBurst(false); setSent(false); setLoading(false);
      setStreaming(false); setFinished(false);
      setSourcesVisible(0); setSearchingPhase(0);
    };

    const runCycle = async () => {
      try {
        reset();
        abortRef.current = new AbortController();
        const signal = abortRef.current.signal;

        await wait(500, signal);

        setNexusActive(true);
        triggerPurpleBurst();
        await wait(600, signal);

        await typeChars(DEMO_TEXT, setTypedLen, 34, signal);

        await wait(600, signal);
        setBurst(true);
        setSent(true);
        triggerPurpleBurst();
        await wait(420, signal);
        setBurst(false);

        await wait(300, signal);
        setLoading(true);

        for (let i = 1; i <= 3; i++) {
          setSearchingPhase(i);
          await wait(800, signal);
        }

        setLoading(false);
        setStreaming(true);
        setSearchingPhase(0);

        for (let i = 1; i <= SOURCES.length; i++) {
          setSourcesVisible(i);
          await wait(300, signal);
        }

        await typeChars(STREAMING_RESPONSE, setStreamLen, 18, signal);

        await wait(800, signal);
        setStreaming(false);
        setFinished(true);

        await wait(4500, signal);
        reset();
        await wait(1000, signal);

        if (!dead) runCycle();
      } catch { /* aborted */ }
    };

    runCycle();
    return () => { dead = true; abortRef.current?.abort(); };
  }, [triggerPurpleBurst, isActive]);

  const showText = typedLen > 0;
  const hasContent = typedLen > 0;
  const showCursor = showText && !sent;
  const searchLabels = ['Scanning 43 sources...', 'Analyzing results...', 'Synthesizing report...'];

  return (
    <div className="w-full max-w-[540px] mx-auto relative flex flex-col justify-end">
      {/* AI response with sources */}
      <div className={`absolute bottom-full left-0 right-0 mb-4 px-1 transition-all duration-500 ${
        streaming || finished ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        <div className="rounded-2xl border border-purple-500/20 bg-zinc-900/50 p-4 backdrop-blur-sm shadow-xl shadow-purple-500/5">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
              <Telescope className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[10px] text-purple-400">Nexus Research</span>
                <span className="font-mono text-[9px] text-zinc-600">{SOURCES.length} sources</span>
              </div>

              {/* Sources strip */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SOURCES.map((src, i) => (
                  <div
                    key={src.name}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950/40 border border-purple-800/30 text-[10px] text-purple-300 transition-all duration-300 ${
                      i < sourcesVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                    }`}
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span>{src.url}</span>
                  </div>
                ))}
              </div>

              <p className="text-sm text-white/70 leading-relaxed font-montserrat">
                {STREAMING_RESPONSE.slice(0, streamLen)}
                {streaming && <span className="inline-block w-[2px] h-[14px] bg-purple-400/60 ml-0.5 align-text-bottom animate-pulse" />}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-auto w-full">
        {/* Searching indicator */}
        <div className={`absolute bottom-full left-0 right-0 mb-3 transition-all duration-300 ${
          loading && searchingPhase > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-950/30 border border-purple-800/20">
            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Search className="w-3 h-3 text-purple-400 animate-pulse" />
            </div>
            <span className="font-mono text-xs text-purple-300/80">
              {searchingPhase > 0 ? searchLabels[searchingPhase - 1] : ''}
            </span>
          </div>
        </div>

        {/* Input */}
        <div
          ref={containerRef}
          role="button"
          tabIndex={0}
          className={`transition-all duration-300 cursor-pointer ${loading || streaming ? 'input-loading-border input-loading-border-nexus' : ''} ${finished ? 'input-finish-border' : ''} ${nexusActive ? 'ring-1 ring-purple-500/40 shadow-[0_0_15px_2px_rgba(147,51,234,0.12),0_0_30px_4px_rgba(147,51,234,0.06)]' : ''}`}
          style={{ borderRadius: 24 }}
          onClick={triggerPurpleBurst}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') triggerPurpleBurst(); }}
        >
          <div className="w-full relative z-[2] overflow-hidden rounded-3xl border border-zinc-700/60 bg-zinc-900/70 backdrop-blur-xl shadow-[0_4px_16px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.06),inset_0_-1px_0_0_rgba(255,255,255,0.03)] p-2">
            <div className="grid w-full grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] [grid-template-areas:'primary_primary_primary'_'leading_footer_trailing'] gap-y-2">
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

              <div style={{ gridArea: 'leading' }} className="flex items-center gap-1.5 pl-2 z-20 pb-1">
                <div className="flex items-center gap-0.5 rounded-full border border-zinc-700/60 bg-zinc-800/25 p-0.5">
                  <div className="rounded-full p-2 h-9 w-9 flex items-center justify-center text-zinc-400"><Plus className="w-[18px] h-[18px]" /></div>
                </div>
              </div>

              {/* Nexus mode indicator in footer */}
              <div style={{ gridArea: 'footer' }} className="min-w-0 flex items-center gap-2.5 overflow-x-auto ml-2">
                <div className={`transition-all duration-300 ${nexusActive ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                  style={{ transformOrigin: 'left center' }}>
                  <div className="inline-flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full bg-gradient-to-r from-purple-500/25 to-purple-500/10 text-purple-400 text-[13px] font-medium border border-purple-500/35 shadow-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-sm text-white animate-[demoPersonaPulse_3s_ease-in-out_infinite]">
                        <Telescope className="w-2.5 h-2.5" />
                      </span>
                      <span className="font-medium truncate">Nexus Research</span>
                    </span>
                    <span className="text-purple-500/50 p-1"><X className="w-3 h-3" /></span>
                  </div>
                </div>
              </div>

              <div style={{ gridArea: 'trailing' }} className="flex items-center gap-1.5 pr-2 z-20 pb-1">
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
