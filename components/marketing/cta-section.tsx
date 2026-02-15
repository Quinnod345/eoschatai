'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const highlights = [
  'No credit card required',
  'Setup in minutes',
  'AI-powered EOS insights',
];

export default function CTASection() {
  return (
    <section className="relative z-20 overflow-hidden bg-gradient-to-b from-zinc-950 via-black to-black py-28">
      <style jsx>{`
        .cta-enter {
          opacity: 0;
          animation: ctaFadeUp 0.8s ease-out 0.05s forwards;
        }

        @keyframes ctaFadeUp {
          0% {
            opacity: 0;
            transform: translateY(14px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,121,0,0.16),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(11,62,96,0.28),transparent_50%)]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="cta-enter max-w-4xl mx-auto text-center">
          <h2 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5">
            Start Your EOS AI Journey Today
          </h2>

          <p className="font-montserrat text-lg md:text-xl text-white/85 max-w-3xl mx-auto mb-10 leading-relaxed">
            Bring strategy, meetings, and execution into one AI-powered workflow
            designed for EOS teams.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
            <Link href="/register" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="font-montserrat bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white px-10 py-6 rounded-full shadow-[0_10px_32px_rgba(255,121,0,0.35)] w-full sm:w-auto"
              >
                Get Started
              </Button>
            </Link>

            <Link href="/login" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="font-montserrat border-white/30 text-white hover:text-white hover:bg-white/10 hover:border-white/50 bg-transparent backdrop-blur-sm px-10 py-6 rounded-full w-full sm:w-auto transition-colors"
              >
                Sign In
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-5 text-white/80 text-sm">
            {highlights.map((highlight) => (
              <div
                key={highlight}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.18] bg-white/[0.06] px-4 py-2"
              >
                <CheckCircle2 className="w-4 h-4 text-eos-orange" />
                <span className="font-montserrat">{highlight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
