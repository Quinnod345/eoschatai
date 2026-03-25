'use client';

import { useEffect, useState } from 'react';

/**
 * Graceful full-screen splash.
 *
 * Aesthetic: the logo is the hero. Everything else is supporting light.
 *
 * Sequence:
 *   0ms   — soft warm glow pools in behind the logo
 *   120ms — logo fades up gently (minimal blur → sharp)
 *   500ms — shimmer line appears below
 *   ~700ms— React hydrates → everything fades out in a single breath
 */
export function AppSplash() {
  const [phase, setPhase] = useState<'enter' | 'exit' | 'gone'>('enter');

  useEffect(() => {
    if (sessionStorage.getItem('eos-app-loaded')) {
      setPhase('gone');
      return;
    }
    sessionStorage.setItem('eos-app-loaded', '1');

    // Hold long enough for the logo entrance, then exhale
    const t = setTimeout(() => setPhase('exit'), 800);
    return () => clearTimeout(t);
  }, []);

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
      {/* Warm ambient light — pools up from below like a sunrise */}
      <div className="eos-splash-glow" />

      {/* Logo */}
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

        {/* Shimmer line — a single delicate progress sweep */}
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

        /* ── Root ── */
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
          /* Exit: single smooth exhale */
          transition: opacity 500ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .eos-splash-root[data-phase="exit"] { opacity: 0; }
        .eos-splash-root[data-phase="enter"] { opacity: 1; }

        /* ── Warm glow ──
           A soft radial pool of orange warmth that breathes slowly —
           like candlelight or sunrise light on a surface.
           Positioned slightly below center so it looks like the logo
           is sitting in front of a warm light source. */
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

        /* ── Center content ── */
        .eos-splash-center {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
        }

        /* ── Logo ──
           Fades up cleanly — barely any blur, no overshoot.
           The warmth in the background does the heavy lifting. */
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

        /* ── Shimmer track ──
           A hairline that sweeps repeatedly — refined, not playful. */
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

        /* ── Reduced motion ── */
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
