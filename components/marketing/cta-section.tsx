'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const highlights = [
  'No credit card required',
  'Setup in minutes',
  'Free tier available',
];

export default function CTASection() {
  return (
    <section className="cta-section relative z-20 overflow-hidden py-32 md:py-40">
      {/* Lightweight CSS gradient background instead of WebGL */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#0B3E60]/40 via-black to-[#FF7900]/10" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_20%_30%,rgba(255,121,0,0.12),transparent_50%)]" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_80%_70%,rgba(11,62,96,0.2),transparent_50%)]" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="cta-content max-w-4xl mx-auto text-center">
          <p className="font-mono text-xs tracking-[0.2em] text-white/40 uppercase mb-6">
            Ready?
          </p>

          <h2 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-5">
            Start Running Better
            <br />
            on EOS Today
          </h2>

          <p className="font-montserrat text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
            Strategy, meetings, and execution in one AI-powered workspace
            designed for EOS teams.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-10">
            <Link href="/register" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="font-montserrat font-semibold bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white px-10 py-6 rounded-full shadow-[0_10px_32px_rgba(255,121,0,0.35)] hover:shadow-[0_14px_40px_rgba(255,121,0,0.45)] transition-all duration-300 w-full sm:w-auto"
              >
                Get Started Free
              </Button>
            </Link>

            <Link href="/login" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="font-montserrat border-white/20 text-white/80 hover:text-white hover:bg-white/10 hover:border-white/40 bg-white/[0.04] backdrop-blur-sm px-10 py-6 rounded-full w-full sm:w-auto transition-all duration-300"
              >
                Sign In
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {highlights.map((highlight) => (
              <div
                key={highlight}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.03]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-eos-orange/70" />
                <span className="font-montserrat text-sm text-white/50">
                  {highlight}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/register"
              className="font-montserrat text-sm text-white/30 hover:text-white/50 transition-colors"
            >
              EOS Academy member? Connect your Circle membership after sign-up &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
