'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  FileText,
  Mail,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
] as const;

const stats: Array<{ label: string; value: string; description: string }> = [
  {
    label: 'Implementers onboarded',
    value: '250+',
    description: 'coaches building repeatable EOS experiences',
  },
  {
    label: 'Weekly hours saved',
    value: '12h',
    description: 'reclaimed from preparation and follow up',
  },
  {
    label: 'Scorecards automated',
    value: '94%',
    description: 'of Level 10® metrics tracked automatically',
  },
];

type FeatureCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
};

const featureCards: FeatureCard[] = [
  {
    icon: Bot,
    title: 'Intelligent EOS coach',
    description:
      'Give every leadership team an always-on assistant that knows their Vision/Traction Organizer, rocks, and open issues.',
    points: [
      'Understands EOS language and frameworks',
      'Answers context-aware questions instantly',
      'Captures IDS outcomes while you facilitate',
    ],
  },
  {
    icon: CalendarDays,
    title: 'Automated meeting flow',
    description:
      'Arrive prepared for Level 10s, quarterlies, and annual planning with suggested agendas and live facilitator prompts.',
    points: [
      'Pre-built agendas tailored to each client',
      'Live cues, timers, and facilitation notes',
      'Instant recaps with action items assigned',
    ],
  },
  {
    icon: FileText,
    title: 'Document co-pilot',
    description:
      'Transform notes, scorecards, and people headlines into polished summaries, to-dos, and follow-up communication.',
    points: [
      'Autofills scorecards and rocks updates',
      'Drafts recap emails and accountability notes',
      'Keeps documents versioned in one workspace',
    ],
  },
  {
    icon: Users,
    title: 'Client alignment hub',
    description:
      'Centralize every conversation, decision, and next step so leaders stay connected between sessions.',
    points: [
      'Shared workspace for each leadership team',
      'Secure guest access for clients and partners',
      'Real-time comment threads and notifications',
    ],
  },
  {
    icon: BarChart3,
    title: 'Insightful scorecards',
    description:
      'Spot trends and celebrate wins with dashboards that connect meeting conversations to measurable traction.',
    points: [
      'Automated KPI rollups across clients',
      'Health indicators for people, process, and profit',
      'Export-ready reports for leadership reviews',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise-grade security',
    description:
      'Protect sensitive data with the safeguards EOS Implementers and leadership teams expect.',
    points: [
      'Single sign-on and granular workspace roles',
      'Audit logs across conversations and files',
      'Encryption in transit and at rest',
    ],
  },
];

const workflowSteps: Array<{ title: string; description: string }> = [
  {
    title: 'Capture what matters',
    description:
      'Upload V/TOs, scorecards, and people issues to train an EOS-aware workspace for each client.',
  },
  {
    title: 'Run meetings with confidence',
    description:
      'Receive live prompts, IDS recommendations, and timers so every Level 10® stays on track.',
  },
  {
    title: 'Keep momentum between sessions',
    description:
      'Send summaries, assign owners, and answer follow-up questions instantly with AI that remembers the context.',
  },
];

type PricingTier = {
  name: string;
  price: string;
  priceSuffix?: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
};

const pricingTiers: PricingTier[] = [
  {
    name: 'Launch',
    price: '$49',
    priceSuffix: 'per seat / month',
    description: 'Everything a solo EOS Implementer needs to deliver consistent client experiences.',
    features: [
      'Up to 3 active client workspaces',
      'Automated Level 10® agendas & recaps',
      'Document assistant with 10 GB storage',
      'Email support within 1 business day',
    ],
    ctaLabel: 'Start free trial',
    ctaHref: '/register',
  },
  {
    name: 'Growth',
    price: '$99',
    priceSuffix: 'per seat / month',
    description: 'Built for growing EOS practices that need collaboration and deeper analytics.',
    features: [
      'Unlimited client workspaces',
      'Advanced scorecard automation',
      'Team commenting & guest access',
      'Priority chat and email support',
    ],
    ctaLabel: 'Start free trial',
    ctaHref: '/register',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Let’s chat',
    description: 'For corporate leadership teams rolling out EOS across multiple departments or regions.',
    features: [
      'Dedicated success manager',
      'Custom integrations & SLAs',
      'Security reviews and procurement support',
      'On-site launch and facilitator training',
    ],
    ctaLabel: 'Talk to sales',
    ctaHref: 'mailto:sales@eosbot.ai',
  },
];

type ContactCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
};

const contactCards: ContactCard[] = [
  {
    icon: CalendarDays,
    title: 'Book a strategy session',
    description: 'See how EOS Bot fits your rollout in a 30-minute conversation with our product team.',
    actionLabel: 'Schedule a call',
    href: 'mailto:sales@eosbot.ai',
  },
  {
    icon: Mail,
    title: 'Email us anytime',
    description: 'Questions, ideas, or partnership requests? Drop us a note and we’ll reply within one business day.',
    actionLabel: 'hello@eosbot.ai',
    href: 'mailto:hello@eosbot.ai',
  },
  {
    icon: MessageSquare,
    title: 'Support for your team',
    description: 'Active clients receive in-app chat plus a shared inbox so every issue reaches the right specialist.',
    actionLabel: 'support@eosbot.ai',
    href: 'mailto:support@eosbot.ai',
  },
];

export default function MarketingHome() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 32);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleAnchorClick = (hash: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.querySelector<HTMLElement>(hash);

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-white/98 to-white/95 text-foreground dark:from-zinc-950 dark:via-zinc-950/95 dark:to-zinc-950">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="noise-texture absolute inset-0 opacity-20" />
        <div className="absolute -top-40 -left-32 size-96 rounded-full bg-eos-orange/20 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] size-[28rem] rounded-full bg-eos-navy/20 blur-3xl" />
      </div>

      <header
        className={cn(
          'fixed left-0 right-0 z-50 transition-all duration-500 ease-in-out',
          isScrolled ? 'top-4 px-4' : 'top-0 px-0',
        )}
      >
        <div
          className={cn(
            'glass-morphism flex flex-col gap-4 backdrop-blur-xl transition-all duration-500 md:flex-row md:items-center md:justify-between',
            isScrolled
              ? 'mx-auto max-w-5xl rounded-full border border-white/30 px-6 py-4 shadow-2xl dark:border-white/10'
              : 'w-full rounded-none border-0 border-b border-white/40 px-6 py-6 shadow-none dark:border-white/10 md:px-8',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Image src="/images/eos-logo.png" alt="EOS Bot" width={36} height={36} className="size-9" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight">EOS Bot</span>
                <span className="text-xs text-muted-foreground">AI workspace for EOS Implementers</span>
              </div>
            </div>
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-eos-orange md:hidden"
            >
              Launch app
            </Link>
          </div>

          <nav className="flex items-center gap-4 overflow-x-auto text-sm text-muted-foreground md:gap-6 md:justify-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={handleAnchorClick(link.href)}
                className="whitespace-nowrap font-medium transition-colors hover:text-eos-orange"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-eos-orange">
              Launch app
            </Link>
            <Link href="/register">
              <Button size="sm" className="gap-2 bg-eos-orange hover:bg-eos-orange/90">
                Get started
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>

          <Link href="/register" className="md:hidden">
            <Button size="sm" className="w-full gap-2 bg-eos-orange hover:bg-eos-orange/90">
              Get started
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative pt-32">
        <section id="home" className="scroll-mt-32 pb-24 pt-16">
          <div className="container mx-auto max-w-6xl px-6">
            <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="space-y-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/80 px-4 py-2 text-sm font-medium shadow-glow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <Sparkles className="size-4 text-eos-orange" />
                  Elevate every EOS conversation
                </div>
                <div className="space-y-6">
                  <h1 className="text-4xl font-semibold leading-tight tracking-tight text-zinc-900 md:text-5xl lg:text-6xl dark:text-white">
                    Build unstoppable leadership teams with an EOS-ready AI partner
                  </h1>
                  <p className="text-lg text-muted-foreground md:text-xl">
                    EOS Bot combines your client playbooks, meeting rhythms, and data into a single workspace. Prepare faster,
                    facilitate with confidence, and keep momentum strong between sessions.
                  </p>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link href="/register">
                    <Button size="lg" className="gap-2 bg-eos-orange p-6 text-base font-semibold hover:bg-eos-orange/90">
                      Start free trial
                      <ArrowRight className="size-5" />
                    </Button>
                  </Link>
                  <Link href="/features">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-white/40 bg-white/50 p-6 text-base font-semibold text-zinc-900 backdrop-blur hover:bg-white/70 dark:border-white/10 dark:bg-white/10 dark:text-white"
                    >
                      Explore features
                    </Button>
                  </Link>
                </div>
                <div className="grid gap-6 sm:grid-cols-3">
                  {stats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/30 bg-white/60 px-5 py-6 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                      <p className="text-3xl font-semibold text-zinc-900 dark:text-white">{stat.value}</p>
                      <p className="mt-1 font-medium text-zinc-900/80 dark:text-white/80">{stat.label}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{stat.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -top-10 -left-6 size-32 rounded-3xl bg-eos-orange/20 blur-2xl" />
                <div className="absolute -bottom-10 -right-10 size-32 rounded-full bg-eos-navy/20 blur-2xl" />
                <div className="relative overflow-hidden rounded-[32px] border border-white/30 bg-white/70 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent dark:from-white/10" />
                  <Image
                    src="/images/chatexample.png"
                    alt="EOS Bot conversation interface"
                    width={1180}
                    height={840}
                    className="relative z-10 h-auto w-full"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-32 bg-gradient-to-b from-transparent via-white/60 to-white/30 py-24 dark:via-white/10 dark:to-white/5">
          <div className="container mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-eos-orange backdrop-blur dark:border-white/10 dark:bg-white/10">
                Built for EOS Implementers
              </span>
              <h2 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-white">
                Everything you need to guide teams from vision to execution
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Orchestrate meetings, surface the right context, and keep every stakeholder aligned inside one secure platform.
              </p>
            </div>

            <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featureCards.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="glass-morphism flex h-full flex-col gap-5 rounded-3xl border border-white/40 p-6 shadow-lg backdrop-blur-lg transition-transform hover:-translate-y-1 hover:shadow-2xl dark:border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="flex size-12 items-center justify-center rounded-2xl bg-eos-orange/15 text-eos-orange">
                        <Icon className="size-6" />
                      </span>
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{feature.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                    <ul className="space-y-3 text-sm">
                      {feature.points.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-left text-zinc-900/90 dark:text-white/80">
                          <CheckCircle2 className="mt-0.5 size-4 text-eos-orange" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="mt-16 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="glass-morphism rounded-3xl border border-white/40 p-8 shadow-xl backdrop-blur dark:border-white/10">
                <h3 className="text-2xl font-semibold text-zinc-900 dark:text-white">Built around the EOS journey</h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  EOS Bot mirrors the rhythm of your engagements—from Focus Days to annual planning—so facilitators can stay
                  present while AI handles the heavy lifting.
                </p>
                <div className="mt-8 space-y-5">
                  {workflowSteps.map((step, index) => (
                    <div key={step.title} className="flex gap-4 rounded-2xl border border-white/30 bg-white/50 p-5 backdrop-blur dark:border-white/10 dark:bg-white/10">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-eos-orange/20 font-semibold text-eos-orange">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">{step.title}</p>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <div className="glass-morphism rounded-3xl border border-white/40 p-8 shadow-xl backdrop-blur dark:border-white/10">
                  <h4 className="text-lg font-semibold text-zinc-900 dark:text-white">Why teams choose EOS Bot</h4>
                  <ul className="mt-4 space-y-3 text-sm text-zinc-900/90 dark:text-white/80">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 text-eos-orange" />
                      <span>White-labeled client portals with your brand and onboarding flow.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 text-eos-orange" />
                      <span>Integrated document storage, clips, and knowledge answers in one search.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 text-eos-orange" />
                      <span>Works with the tools you already use—from Google Workspace to Slack.</span>
                    </li>
                  </ul>
                </div>
                <div className="glass-morphism rounded-3xl border border-white/40 p-8 shadow-xl backdrop-blur dark:border-white/10">
                  <h4 className="text-lg font-semibold text-zinc-900 dark:text-white">Launch quickly with guided onboarding</h4>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Import your existing agendas, scorecards, and leadership team rosters. Our success team sets up the first two
                    workspaces with you.
                  </p>
                  <Link href="/register" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-eos-orange">
                    Claim your onboarding session
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-32 py-24">
          <div className="container mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-eos-orange backdrop-blur dark:border-white/10 dark:bg-white/10">
                Pricing
              </span>
              <h2 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-white">
                Simple plans for every stage of your EOS journey
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Start with a free trial, invite your first leadership team, and upgrade when you are ready to scale.
              </p>
            </div>

            <div className="mt-16 grid gap-8 lg:grid-cols-3">
              {pricingTiers.map((tier) => (
                <div
                  key={tier.name}
                  className={cn(
                    'flex h-full flex-col rounded-3xl border border-white/40 bg-white/70 p-8 text-left shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/5',
                    tier.highlight && 'ring-2 ring-eos-orange',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">{tier.name}</h3>
                    {tier.highlight ? (
                      <span className="rounded-full bg-eos-orange/20 px-3 py-1 text-xs font-semibold text-eos-orange">
                        Most popular
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-6">
                    <p className="text-4xl font-semibold text-zinc-900 dark:text-white">{tier.price}</p>
                    {tier.priceSuffix ? (
                      <p className="mt-1 text-sm text-muted-foreground">{tier.priceSuffix}</p>
                    ) : null}
                  </div>
                  <p className="mt-6 text-sm text-muted-foreground">{tier.description}</p>
                  <ul className="mt-8 space-y-3 text-sm text-zinc-900/90 dark:text-white/80">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 text-eos-orange" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-10">
                    {tier.ctaHref.startsWith('mailto:') ? (
                      <a
                        href={tier.ctaHref}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-eos-orange px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-eos-orange/90"
                      >
                        {tier.ctaLabel}
                        <ArrowRight className="size-4" />
                      </a>
                    ) : (
                      <Link href={tier.ctaHref} className="inline-flex w-full">
                        <Button className="w-full gap-2 bg-eos-orange py-6 text-base font-semibold hover:bg-eos-orange/90">
                          {tier.ctaLabel}
                          <ArrowRight className="size-5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-32 bg-gradient-to-b from-white/70 via-white/60 to-transparent pb-28 pt-24 dark:from-white/10 dark:via-white/5">
          <div className="container mx-auto max-w-6xl px-6">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="glass-morphism rounded-3xl border border-white/40 p-10 shadow-2xl backdrop-blur dark:border-white/10">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-eos-orange backdrop-blur dark:border-white/10 dark:bg-white/10">
                  Ready to get started?
                </span>
                <h2 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-white">
                  Partner with EOS Bot and transform every leadership team you serve
                </h2>
                <p className="mt-4 text-sm text-muted-foreground">
                  Our specialists will guide your first rollout, migrate your documents, and share best practices gathered from
                  hundreds of EOS implementations.
                </p>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <a
                    href="mailto:sales@eosbot.ai"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-eos-orange px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-eos-orange/90"
                  >
                    Talk with sales
                    <ArrowRight className="size-4" />
                  </a>
                  <Link href="/login" className="inline-flex flex-1">
                    <Button
                      variant="outline"
                      className="w-full border-white/40 bg-white/60 text-sm font-semibold text-zinc-900 hover:bg-white/80 dark:border-white/10 dark:bg-white/10 dark:text-white"
                    >
                      Launch the app
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="grid gap-4">
                {contactCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.title} className="glass-morphism flex flex-col gap-4 rounded-3xl border border-white/40 p-6 shadow-xl backdrop-blur dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-2xl bg-eos-orange/15 text-eos-orange">
                          <Icon className="size-5" />
                        </span>
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{card.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{card.description}</p>
                      <a
                        href={card.href}
                        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-eos-orange"
                      >
                        {card.actionLabel}
                        <ArrowRight className="size-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/40 bg-white/70 py-10 text-sm text-muted-foreground backdrop-blur dark:border-white/10 dark:bg-white/10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 text-center md:flex-row md:text-left">
          <p>&copy; {new Date().getFullYear()} EOS Bot. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy-policy" className="hover:text-eos-orange">
              Privacy policy
            </Link>
            <Link href="/terms" className="hover:text-eos-orange">
              Terms of service
            </Link>
            <Link href="/features" className="hover:text-eos-orange">
              Product roadmap
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
