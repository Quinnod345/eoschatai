'use client';

import LazyVideo from '@/components/LazyVideo';

export default function ProductShowcase() {
  return (
    <section
      id="showcase"
      className="relative z-20 scroll-mt-28 md:scroll-mt-32 bg-gradient-to-b from-black via-zinc-950 to-black py-24"
      aria-label="Product showcase"
    >
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto space-y-10">
          <article className="showcase-panel rounded-3xl border border-white/[0.15] bg-white/[0.06] backdrop-blur-sm p-6 md:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div data-animate-item>
                <p className="font-montserrat text-xs uppercase tracking-[0.14em] text-white/70 mb-3">
                  Core EOS intelligence
                </p>
                <h2 className="font-montserrat text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                  EOS Model and Tools Mastery
                </h2>
                <p className="font-montserrat text-base md:text-lg text-white/85 leading-relaxed">
                  Use AI that understands the Six Key Components and official EOS
                  tools including V/TO, Accountability Chart, and Scorecard.
                </p>
              </div>

              <div
                data-animate-item
                className="rounded-2xl overflow-hidden border border-white/[0.15] bg-black/30"
              >
                <LazyVideo
                  src="https://0a4naobicmxnlwbm.public.blob.vercel-storage.com/videos/what-is-eos-08HuP8fmZBiDE8KYpFhxIrxnHQT43u.mp4"
                  preload="metadata"
                />
              </div>
            </div>
          </article>

          <article className="showcase-panel rounded-3xl border border-white/[0.15] bg-white/[0.06] backdrop-blur-sm p-6 md:p-10">
            <div data-animate-item className="max-w-3xl mb-7">
              <p className="font-montserrat text-xs uppercase tracking-[0.14em] text-white/70 mb-3">
                Decision confidence
              </p>
              <h3 className="font-montserrat text-3xl md:text-4xl font-bold text-white mb-3">
                Unparalleled Intelligence
              </h3>
              <p className="font-montserrat text-base md:text-lg text-white/85 leading-relaxed">
                Keep every answer grounded in your company context and documents
                so teams can move faster with fewer blind spots.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div
                data-animate-item
                className="rounded-2xl border border-white/[0.15] bg-black/30 p-5"
              >
                <div className="rounded-xl overflow-hidden border border-white/10 mb-5">
                  <LazyVideo
                    src="https://0a4naobicmxnlwbm.public.blob.vercel-storage.com/videos/company-context-VHbjYvSVvwvlajVrJlrExn7WdjjkKc.mp4"
                    preload="none"
                  />
                </div>
                <h4 className="font-montserrat text-xl font-semibold text-white mb-2">
                  Company Context
                </h4>
                <p className="font-montserrat text-sm md:text-base text-white/85 leading-relaxed">
                  Configure your company details once and get more relevant
                  suggestions, plans, and responses in every chat.
                </p>
              </div>

              <div
                data-animate-item
                className="rounded-2xl border border-white/[0.15] bg-black/30 p-5"
              >
                <div className="rounded-xl overflow-hidden border border-white/10 mb-5">
                  <LazyVideo
                    src="https://0a4naobicmxnlwbm.public.blob.vercel-storage.com/videos/document-context-HE9zgUsVQjfTahOiFnOGCc5xCubFNa.mp4"
                    preload="none"
                  />
                </div>
                <h4 className="font-montserrat text-xl font-semibold text-white mb-2">
                  Document Context
                </h4>
                <p className="font-montserrat text-sm md:text-base text-white/85 leading-relaxed">
                  Bring your existing EOS materials into the workspace so AI
                  support reflects how your team actually operates.
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
