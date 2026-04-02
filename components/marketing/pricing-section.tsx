'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Check, Minus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Discovery',
    tagline: 'Explore EOS AI',
    highlight: false,
    features: [
      { label: '20 chats per day', included: true },
      { label: '5 document uploads', included: true },
      { label: 'Text composer', included: true },
      { label: '100 MB storage', included: true },
      { label: '1 session at a time', included: true },
      { label: 'AI Personas', included: false },
      { label: 'Deep Research', included: false },
      { label: 'Team features', included: false },
    ],
  },
  {
    name: 'Strengthen',
    tagline: 'For serious implementers',
    highlight: true,
    features: [
      { label: '200 chats per day', included: true },
      { label: '100 document uploads', included: true },
      { label: 'All 7 composer types', included: true },
      { label: '1 GB storage', included: true },
      { label: '3 concurrent sessions', included: true },
      { label: '25 custom personas', included: true },
      { label: 'Memory & semantic search', included: true },
      { label: 'Calendar integration', included: true },
    ],
  },
  {
    name: 'Mastery',
    tagline: 'For leadership teams',
    highlight: false,
    features: [
      { label: '1,000 chats per day', included: true },
      { label: '1,000 document uploads', included: true },
      { label: 'All composers + exports', included: true },
      { label: '10 GB storage', included: true },
      { label: '10 concurrent sessions', included: true },
      { label: 'Unlimited personas + sharing', included: true },
      { label: 'Nexus Deep Research', included: true },
      { label: 'Org up to 50 members + API', included: true },
    ],
  },
];

function PricingCard({ plan }: { plan: (typeof plans)[number] }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--glow-x', `${x}%`);
    card.style.setProperty('--glow-y', `${y}%`);
    card.style.setProperty('--glow-vis', '1');
  }, []);

  const handleMouseLeave = useCallback(() => {
    cardRef.current?.style.setProperty('--glow-vis', '0');
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <div
      ref={cardRef}
      className={`relative rounded-2xl p-px overflow-hidden transition-transform duration-300 hover:-translate-y-1 ${
        plan.highlight ? 'lg:-mt-4 lg:mb-4' : ''
      }`}
      style={{
        ['--glow-x' as string]: '50%',
        ['--glow-y' as string]: '50%',
        ['--glow-vis' as string]: '0',
      }}
    >
      {/* Glow border */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300"
        style={{
          background: plan.highlight
            ? `radial-gradient(500px circle at var(--glow-x) var(--glow-y), rgba(255,121,0,0.3), transparent 50%)`
            : `radial-gradient(500px circle at var(--glow-x) var(--glow-y), rgba(255,255,255,0.08), transparent 50%)`,
          opacity: 'var(--glow-vis)',
        }}
      />

      {/* Card inner */}
      <div
        className={`relative rounded-2xl p-8 h-full flex flex-col ${
          plan.highlight
            ? 'bg-gradient-to-b from-eos-orange/[0.06] to-black border border-eos-orange/20'
            : 'bg-white/[0.02] border border-white/[0.06]'
        }`}
      >
        {plan.highlight && (
          <>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-eos-orange to-transparent" />
            <div className="absolute -top-px left-1/2 -translate-x-1/2 px-4 py-1 rounded-b-lg bg-eos-orange">
              <span className="font-mono text-[10px] font-bold tracking-widest text-white uppercase">
                Popular
              </span>
            </div>
          </>
        )}

        <div className="mb-8">
          <h3 className="font-montserrat text-xl font-bold text-white mb-1">
            {plan.name}
          </h3>
          <p className="font-montserrat text-sm text-white/40">
            {plan.tagline}
          </p>
        </div>

        <div className="space-y-3 flex-1">
          {plan.features.map((feature) => (
            <div key={feature.label} className="flex items-center gap-3">
              {feature.included ? (
                <Check className="w-3.5 h-3.5 text-eos-orange/80 flex-shrink-0" strokeWidth={2} />
              ) : (
                <Minus className="w-3.5 h-3.5 text-white/15 flex-shrink-0" strokeWidth={2} />
              )}
              <span
                className={`font-montserrat text-sm ${
                  feature.included ? 'text-white/70' : 'text-white/25'
                }`}
              >
                {feature.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link href="/register" className="block">
            <Button
              className={`w-full font-montserrat py-5 rounded-xl transition-all duration-300 ${
                plan.highlight
                  ? 'bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white shadow-[0_8px_24px_rgba(255,121,0,0.25)]'
                  : 'bg-white/[0.06] border border-white/[0.1] text-white/70 hover:bg-white/[0.1] hover:text-white'
              }`}
            >
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PricingSection() {
  return (
    <section className="pricing-section relative z-20 py-16 md:py-24 lg:py-32 bg-black overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(255,121,0,0.04),transparent_50%)]" />
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="pricing-header text-center mb-16">
            <p className="font-mono text-xs tracking-[0.2em] text-eos-orange/70 uppercase mb-4">
              Pricing
            </p>
            <h2 className="font-montserrat text-3xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-5">
              Choose Your Plan
            </h2>
            <p className="font-montserrat text-lg text-white/50 max-w-xl mx-auto">
              Start free. Scale as your team grows.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-4 mb-12">
            {plans.map((plan) => (
              <div key={plan.name} className="pricing-card">
                <PricingCard plan={plan} />
              </div>
            ))}
          </div>

          {/* Circle callout */}
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-white/[0.03] border border-white/[0.06]">
              <div className="w-1.5 h-1.5 rounded-full bg-eos-orange/60" />
              <span className="font-montserrat text-sm text-white/40">
                EOS Academy members get their plan synced automatically from Circle
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
