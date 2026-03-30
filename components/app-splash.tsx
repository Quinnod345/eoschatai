'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Graceful full-screen splash — only shown on /chat routes.
 */
export function AppSplash() {
  const pathname = usePathname();
  const isChatRoute = pathname.startsWith('/chat');

  const [phase, setPhase] = useState<'enter' | 'exit' | 'gone'>(() => {
    if (!isChatRoute) return 'gone';
    if (typeof window !== 'undefined' && sessionStorage.getItem('eos-app-loaded')) return 'gone';
    return 'enter';
  });

  useEffect(() => {
    if (!isChatRoute) {
      setPhase('gone');
      return;
    }

    if (sessionStorage.getItem('eos-app-loaded')) {
      setPhase('gone');
      return;
    }
    sessionStorage.setItem('eos-app-loaded', '1');

    const t = setTimeout(() => setPhase('exit'), 800);
    return () => clearTimeout(t);
  }, [isChatRoute]);

  useEffect(() => {
    if (phase === 'exit') {
      const t = setTimeout(() => setPhase('gone'), 550);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      aria-hidden="true"
      className="eos-splash-root"
      data-phase={phase}
    >
      <div className="eos-splash-glow" />

      <div className="eos-splash-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/eos-logo.png"
          alt="EOS AI"
          width={128}
          height={52}
          className="eos-splash-logo block dark:hidden"
          style={{ height: 'auto', objectFit: 'contain' }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/eos-logo-dark-mode.png"
          alt="EOS AI"
          width={128}
          height={52}
          className="eos-splash-logo hidden dark:block"
          style={{ height: 'auto', objectFit: 'contain' }}
        />

        <div className="eos-splash-track" role="status" aria-label="Loading">
          <div className="eos-splash-shimmer" />
        </div>
      </div>

      <style>{`
        :root {
          --splash-bg:     #ffffff;
          --splash-glow:   rgba(249, 115, 22, 0.18);
          --splash-line:   rgba(249, 115, 22, 0.15);
          --splash-sweep:  rgba(249, 115, 22, 0.90);
        }
        .dark {
          --splash-bg:     hsl(210deg 50% 8%);
          --splash-glow:   rgba(249, 115, 22, 0.12);
          --splash-line:   rgba(249, 115, 22, 0.12);
          --splash-sweep:  rgba(251, 146, 60,  0.85);
        }

        .eos-splash-root {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: var(--splash-bg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          transition: opacity 500ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .eos-splash-root[data-phase="exit"] { opacity: 0; }
        .eos-splash-root[data-phase="enter"] { opacity: 1; }

        .eos-splash-glow {
          position: absolute;
          bottom: 30%;
          left: 50%;
          width: 520px;
          height: 320px;
          transform: translateX(-50%);
          background: radial-gradient(
            ellipse 100% 100% at 50% 85%,
            var(--splash-glow) 0%,
            transparent 70%
          );
          filter: blur(40px);
          animation: eos-glow-rise 1.4s cubic-bezier(0.16, 1, 0.3, 1) both;
          pointer-events: none;
        }
        @keyframes eos-glow-rise {
          from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.85); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1); }
        }

        .eos-splash-center {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
        }

        .eos-splash-logo {
          animation: eos-logo-rise 0.7s 0.12s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes eos-logo-rise {
          from {
            opacity: 0;
            transform: translateY(10px);
            filter: blur(3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0px);
          }
        }

        .eos-splash-track {
          width: 72px;
          height: 1.5px;
          border-radius: 9999px;
          background: var(--splash-line);
          overflow: hidden;
          animation: eos-track-in 0.4s 0.55s ease-out both;
          opacity: 0;
        }
        @keyframes eos-track-in {
          from { opacity: 0; transform: scaleX(0); }
          to   { opacity: 1; transform: scaleX(1); }
        }

        .eos-splash-shimmer {
          width: 36px;
          height: 100%;
          border-radius: 9999px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--splash-sweep),
            transparent
          );
          animation: eos-shimmer-sweep 1.6s 0.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes eos-shimmer-sweep {
          from { transform: translateX(-36px); }
          to   { transform: translateX(108px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .eos-splash-glow    { animation: none; opacity: 1; transform: translateX(-50%); }
          .eos-splash-logo    { animation: none; opacity: 1; filter: none; transform: none; }
          .eos-splash-track   { animation: none; opacity: 1; transform: none; }
          .eos-splash-shimmer { animation: none; }
        }
      `}</style>
    </div>
  );
}
