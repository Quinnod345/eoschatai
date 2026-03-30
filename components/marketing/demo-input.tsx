'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ArrowUp,
  Plus,
  Calendar,
  BarChart,
  Target,
  Sparkles,
  X,
  Mic,
  Clock,
  FileText,
  Users,
  Square,
} from 'lucide-react';

const DEMO_TEXT = 'Help me prepare for our quarterly planning session @';
const SECOND_TEXT = ' include the V/TO and scorecard data';
const STREAMING_RESPONSE = "Based on your V/TO and scorecard, here's a structured agenda for your quarterly session...";

const MENTION_ITEMS = [
  { id: 'calendar', name: 'Calendar', icon: Calendar, shortcut: '@cal', category: 'Calendar' },
  { id: 'availability', name: 'Find Available Time', icon: Clock, shortcut: '@free', category: 'Calendar' },
  { id: 'documents', name: 'Documents', icon: FileText, shortcut: '@doc', category: 'Resource' },
  { id: 'scorecard', name: 'Scorecard', icon: BarChart, shortcut: '@score', category: 'Resource' },
  { id: 'vto', name: 'V/TO', icon: Target, shortcut: '@vto', category: 'Resource' },
  { id: 'accountability', name: 'Accountability Chart', icon: Users, shortcut: '@ac', category: 'Resource' },
];

type MentionItem = (typeof MENTION_ITEMS)[number];

export default function DemoInput({ isActive = true }: { isActive?: boolean }) {
  const [typedLen, setTypedLen] = useState(0);
  const [typed2Len, setTyped2Len] = useState(0);
  const [streamLen, setStreamLen] = useState(0);
  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownIdx, setDropdownIdx] = useState(0);
  const [persona, setPersona] = useState(false);
  const [burst, setBurst] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [finished, setFinished] = useState(false);

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
      setTypedLen(0); setTyped2Len(0); setStreamLen(0);
      setMentions([]); setDropdownVisible(false); setDropdownIdx(0);
      setPersona(false); setBurst(false); setSent(false);
      setLoading(false); setStreaming(false); setFinished(false);
      return;
    }

    let dead = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const ctrl = abortRef.current;
        if (dead || ctrl?.signal.aborted) { reject(new Error('aborted')); return; }
        const id = setTimeout(() => resolve(), ms);
        ctrl?.signal.addEventListener('abort', () => { clearTimeout(id); reject(new Error('aborted')); }, { once: true });
      });

    const typeChars = async (text: string, setter: (n: number) => void, speed: number) => {
      for (let i = 1; i <= text.length; i++) {
        if (dead) throw new Error('aborted');
        setter(i);
        await wait(speed);
      }
    };

    const reset = () => {
      setTypedLen(0); setTyped2Len(0); setStreamLen(0);
      setMentions([]); setDropdownVisible(false); setDropdownIdx(0);
      setPersona(false);
      setBurst(false); setSent(false); setLoading(false);
      setStreaming(false); setFinished(false);
    };

    const runCycle = async () => {
      try {
        reset();
        abortRef.current = new AbortController();

        await wait(500);
        triggerBurst();
        await wait(400);

        await typeChars(DEMO_TEXT, setTypedLen, 38);

        await wait(200);
        setDropdownVisible(true);

        for (let i = 0; i < 4; i++) {
          await wait(350);
          setDropdownIdx(i);
        }

        await wait(300);
        setDropdownVisible(false);
        setMentions([MENTION_ITEMS[0]]);

        await wait(500);
        setMentions([MENTION_ITEMS[0], MENTION_ITEMS[3]]);

        await wait(400);
        setMentions([MENTION_ITEMS[0], MENTION_ITEMS[3], MENTION_ITEMS[4]]);

        await wait(500);
        await typeChars(SECOND_TEXT, setTyped2Len, 38);

        await wait(400);
        setPersona(true);

        await wait(1800);

        setBurst(true);
        setSent(true);
        triggerBurst();
        await wait(420);
        setBurst(false);

        await wait(300);
        setLoading(true);

        await wait(1400);
        setLoading(false);
        setStreaming(true);
        await typeChars(STREAMING_RESPONSE, setStreamLen, 18);

        await wait(1200);
        setStreaming(false);
        setFinished(true);

        await wait(4500);
        reset();
        await wait(1200);
      } catch {
        // aborted, cycle will restart
      }
    };

    const loop = async () => {
      while (!dead) {
        await runCycle();
      }
    };

    loop();

    return () => {
      dead = true;
      abortRef.current?.abort();
    };
  }, [triggerBurst, isActive]);

  const showText = typedLen > 0;
  const hasContent = typedLen > 0 || mentions.length > 0;
  const isMultiLine = persona || mentions.length > 0;
  const showCursor = showText && !sent;

  const displayText = DEMO_TEXT.slice(0, typedLen);
  const displayText2 = SECOND_TEXT.slice(0, typed2Len);

  return (
    <div
      className="w-full max-w-[540px] mx-auto relative flex flex-col justify-end"
    >
      {/* AI response bubble */}
      <div className={`absolute bottom-full left-0 right-0 mb-4 px-1 transition-all duration-500 ${
        streaming || finished ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        <div className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-4 backdrop-blur-sm shadow-xl">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-eos-orange to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] text-zinc-500 mb-1.5">EOS AI</p>
              <p className="text-sm text-white/70 leading-relaxed font-montserrat">
                {STREAMING_RESPONSE.slice(0, streamLen)}
                {streaming && <span className="inline-block w-[2px] h-[14px] bg-eos-orange/60 ml-0.5 align-text-bottom animate-pulse" />}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-anchored input area */}
      <div className="relative mt-auto w-full">
        {/* Mention dropdown */}
        <div className={`absolute bottom-full left-0 right-0 mb-3 z-10 transition-all duration-200 ${dropdownVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="bg-zinc-900 shadow-xl rounded-lg border border-zinc-700/60 overflow-hidden">
            <div className="p-3 text-sm font-medium border-b border-zinc-700/40 bg-zinc-800/50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <span className="text-white/70">All Resources</span>
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{MENTION_ITEMS.length} results</span>
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">Type to filter &middot; @cal, @doc &middot; Enter to select</div>
            </div>
            {['Calendar', 'Resource'].map((cat) => (
              <div key={cat}>
                <div className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider ${cat === 'Calendar' ? 'text-sky-400 bg-sky-900/20' : 'text-purple-400 bg-purple-900/20'}`}>{cat}</div>
                {MENTION_ITEMS.filter(m => m.category === cat).map((item) => {
                  const gi = MENTION_ITEMS.indexOf(item);
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className={`flex items-center gap-3 px-3 py-2.5 transition-colors border-l-2 ${gi === dropdownIdx ? 'bg-blue-900/20 border-blue-500' : 'border-transparent'}`}>
                      <div className="p-1.5 rounded-md bg-zinc-800/60"><Icon className="w-3.5 h-3.5 text-zinc-400" /></div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white/80">{item.name}</span>
                        <span className="text-[10px] font-mono text-zinc-600">{item.shortcut}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Selected mentions strip */}
        <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${mentions.length > 0 && !sent ? 'max-h-24 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="flex items-center gap-2 mb-2 text-[11px] text-zinc-500">
            <Sparkles className="w-3 h-3" /><span>Selected resources — included in your message:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {mentions.map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={m.id} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-950/60 text-blue-200 text-sm font-medium border border-blue-800/70 shadow-sm"
                  style={{ animation: `demoMentionIn 0.3s cubic-bezier(0.4,0,0.2,1) ${i * 0.06}s both` }}>
                  <span className="flex items-center gap-2">
                    <span className="flex items-center justify-center bg-blue-800/50 text-blue-300 rounded-md p-1"><Icon className="w-3.5 h-3.5" /></span>
                    <span className="font-medium text-xs">{m.name}</span>
                  </span>
                  <span className="text-blue-500/60 p-0.5"><X className="w-3 h-3" /></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Input container */}
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
              isMultiLine
                ? "grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] [grid-template-areas:'primary_primary_primary'_'leading_footer_trailing'] gap-y-2"
                : "grid-cols-[auto_1fr_auto] [grid-template-areas:'leading_primary_trailing'] items-center"
            }`}>
              <div style={{ gridArea: 'primary' }} className="relative w-full min-w-0">
                <div className="min-h-[40px] px-3 py-2 text-[15px] text-white/80 font-montserrat break-words">
                  {showText ? (
                    <>
                      <span>{displayText.replace(/@$/, '')}</span>
                      {dropdownVisible && <span className="text-blue-400 font-semibold">@</span>}
                      {typed2Len > 0 && <span>{displayText2}</span>}
                      {showCursor && <span className="inline-block w-[2px] h-[16px] bg-white/60 ml-[1px] align-text-bottom animate-pulse" />}
                    </>
                  ) : (
                    <span className="text-zinc-500">Ask anything…</span>
                  )}
                </div>
              </div>

              <div style={{ gridArea: 'leading' }} className={`flex items-center gap-1.5 pl-2 z-20 ${isMultiLine ? 'pb-1' : ''}`}>
                <div className="flex items-center gap-0.5 rounded-full border border-zinc-700/60 bg-zinc-800/25 p-0.5">
                  <div className="rounded-full p-2 h-9 w-9 flex items-center justify-center text-zinc-400"><Plus className="w-[18px] h-[18px]" /></div>
                </div>
              </div>

              {isMultiLine && (
                <div style={{ gridArea: 'footer' }} className="min-w-0 flex items-center gap-2.5 overflow-x-auto ml-2">
                  <div className={`transition-all duration-300 ${persona ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} style={{ transformOrigin: 'left center' }}>
                    <div className="inline-flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full bg-gradient-to-r from-eos-orange/25 to-eos-orange/10 text-eos-orange text-[13px] font-medium border border-eos-orange/35 shadow-sm">
                      <span className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-eos-orange to-orange-500 flex items-center justify-center shadow-sm text-white animate-[demoPersonaPulse_3s_ease-in-out_infinite]">
                          <Sparkles className="w-2.5 h-2.5" />
                        </span>
                        <span className="font-medium truncate">EOS Implementer</span>
                      </span>
                      <span className="text-eos-orange/50 p-1"><X className="w-3 h-3" /></span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ gridArea: 'trailing' }} className={`flex items-center gap-1.5 pr-2 z-20 ${isMultiLine ? 'pb-1' : ''}`}>
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
