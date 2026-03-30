'use client';

import { ArrowRight, GraduationCap, Zap, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const tiers = [
  { circle: 'Discover', plan: 'Free', color: 'text-white/60' },
  { circle: 'Strengthen', plan: 'Pro', color: 'text-eos-orange' },
  { circle: 'Mastery', plan: 'Business', color: 'text-orange-400' },
];

const steps = [
  {
    icon: GraduationCap,
    title: 'Connect Your Academy',
    description:
      'Link your EOS Academy Circle membership with one click. Your tier syncs automatically to unlock the right EOSAI plan.',
  },
  {
    icon: Zap,
    title: 'Unlock Course AI',
    description:
      'Each enrolled course activates a dedicated AI assistant trained on the course material, with implementer and client perspectives.',
  },
  {
    icon: Users,
    title: 'Collaborate with Your Team',
    description:
      'Mastery members can create resource-sharing organizations with unlimited seats. Share personas, documents, and knowledge across your leadership team.',
  },
];

export default function AcademySection() {
  return (
    <section className="academy-section relative z-20 py-24 md:py-32 bg-gradient-to-b from-black via-zinc-950/50 to-black overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(255,121,0,0.06),transparent_60%)]" />
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="academy-header text-center mb-20">
            <p className="font-mono text-xs tracking-[0.2em] text-eos-orange/70 uppercase mb-4">
              EOS Academy Integration
            </p>
            <h2 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-5">
              Powered by Circle
            </h2>
            <p className="font-montserrat text-lg text-white/50 max-w-2xl mx-auto">
              Your EOS Academy membership unlocks AI-powered course assistants
              and syncs your plan automatically.
            </p>
          </div>

          {/* Tier mapping */}
          <div className="academy-tiers flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-20">
            {tiers.map((tier, i) => (
              <div key={tier.circle} className="flex items-center gap-3 sm:gap-4">
                <div className="text-center">
                  <p className="font-mono text-[10px] tracking-widest text-white/30 uppercase mb-1">
                    Circle
                  </p>
                  <p className="font-montserrat text-sm font-semibold text-white/70">
                    {tier.circle}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-white/20" />
                <div className="text-center">
                  <p className="font-mono text-[10px] tracking-widest text-white/30 uppercase mb-1">
                    EOSAI
                  </p>
                  <p className={`font-montserrat text-sm font-bold ${tier.color}`}>
                    {tier.plan}
                  </p>
                </div>
                {i < tiers.length - 1 && (
                  <div className="hidden sm:block w-px h-8 bg-white/[0.08] ml-4" />
                )}
              </div>
            ))}
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="academy-step relative group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
                >
                  {/* Numbered circle accent */}
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-eos-orange/15 border border-eos-orange/25 flex items-center justify-center">
                    <span className="font-mono text-xs font-bold text-eos-orange">{i + 1}</span>
                  </div>

                  <div className="flex items-center gap-4 mb-5">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-eos-orange/10 border border-eos-orange/20">
                      <Icon className="w-5 h-5 text-eos-orange" strokeWidth={1.5} />
                    </div>
                  </div>

                  <h3 className="font-montserrat text-lg font-semibold text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="font-montserrat text-sm text-white/50 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link href="/register">
              <Button
                size="lg"
                variant="outline"
                className="font-montserrat border-white/15 text-white/70 hover:text-white hover:bg-white/[0.06] hover:border-white/25 bg-transparent px-8 py-6 rounded-full transition-all duration-300"
              >
                Connect Your Academy Membership
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
