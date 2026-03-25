/**
 * Route-level loading UI for /chat
 * Graceful, minimal — matches AppSplash aesthetic.
 */
export default function Loading() {
  return (
    <div className="eos-loading-root" aria-hidden="true">
      <div className="eos-loading-glow" />

      <div className="eos-loading-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/eos-logo.png"
          alt="EOS AI"
          width={128}
          height={52}
          className="eos-loading-logo block dark:hidden"
          style={{ height: 'auto', objectFit: 'contain' }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/eos-logo-dark-mode.png"
          alt="EOS AI"
          width={128}
          height={52}
          className="eos-loading-logo hidden dark:block"
          style={{ height: 'auto', objectFit: 'contain' }}
        />

        <div className="eos-loading-track" role="status" aria-label="Loading">
          <div className="eos-loading-shimmer" />
        </div>
      </div>

      <style>{`
        :root {
          --splash-bg:    #ffffff;
          --splash-glow:  rgba(249, 115, 22, 0.18);
          --splash-line:  rgba(249, 115, 22, 0.15);
          --splash-sweep: rgba(249, 115, 22, 0.90);
        }
        .dark {
          --splash-bg:    hsl(210deg 50% 8%);
          --splash-glow:  rgba(249, 115, 22, 0.12);
          --splash-line:  rgba(249, 115, 22, 0.12);
          --splash-sweep: rgba(251, 146, 60,  0.85);
        }

        .eos-loading-root {
          position: fixed; inset: 0; z-index: 9998;
          background: var(--splash-bg);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          pointer-events: none;
        }
        .eos-loading-glow {
          position: absolute; bottom: 30%; left: 50%;
          width: 520px; height: 320px;
          transform: translateX(-50%);
          background: radial-gradient(ellipse 100% 100% at 50% 85%, var(--splash-glow) 0%, transparent 70%);
          filter: blur(40px);
          animation: eos-glow-rise 1.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        .eos-loading-center {
          position: relative; display: flex;
          flex-direction: column; align-items: center; gap: 28px;
        }
        .eos-loading-logo {
          animation: eos-logo-rise 0.7s 0.12s cubic-bezier(0.16,1,0.3,1) both;
        }
        .eos-loading-track {
          width: 72px; height: 1.5px; border-radius: 9999px;
          background: var(--splash-line); overflow: hidden;
          animation: eos-track-in 0.4s 0.55s ease-out both; opacity: 0;
        }
        .eos-loading-shimmer {
          width: 36px; height: 100%; border-radius: 9999px;
          background: linear-gradient(90deg, transparent, var(--splash-sweep), transparent);
          animation: eos-shimmer-sweep 1.6s 0.6s cubic-bezier(0.4,0,0.6,1) infinite;
        }
        @keyframes eos-glow-rise {
          from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.85); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes eos-logo-rise {
          from { opacity: 0; transform: translateY(10px); filter: blur(3px); }
          to   { opacity: 1; transform: translateY(0); filter: blur(0px); }
        }
        @keyframes eos-track-in {
          from { opacity: 0; transform: scaleX(0); }
          to   { opacity: 1; transform: scaleX(1); }
        }
        @keyframes eos-shimmer-sweep {
          from { transform: translateX(-36px); }
          to   { transform: translateX(108px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .eos-loading-glow    { animation: none; opacity: 1; transform: translateX(-50%); }
          .eos-loading-logo    { animation: none; opacity: 1; filter: none; transform: none; }
          .eos-loading-track   { animation: none; opacity: 1; transform: none; }
          .eos-loading-shimmer { animation: none; }
        }
      `}</style>
    </div>
  );
}
