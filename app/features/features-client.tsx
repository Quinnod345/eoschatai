'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import {
  Brain,
  FileText,
  PenTool,
  Users,
  Telescope,
  Shield,
  MessageSquare,
  Mic,
  BarChart,
  Target,
  Calendar,
  Sparkles,
  Search,
  BookOpen,
  Share2,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import LandingNavbar from '@/components/marketing/landing-navbar';
import LandingFooter from '@/components/marketing/landing-footer';
import DemoInput from '@/components/marketing/demo-input';
import DemoComposer from '@/components/marketing/demo-composer';
import DemoPersonas from '@/components/marketing/demo-personas';
import DemoResearch from '@/components/marketing/demo-research';
import type { LucideIcon } from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface PillarBullet {
  icon: LucideIcon;
  text: string;
}

interface FeaturePillar {
  id: string;
  label: string;
  heading: string;
  description: string;
  bullets: PillarBullet[];
  accent: string;
  accentBorder: string;
  demoType: 'chat' | 'composer' | 'personas' | 'research' | 'static';
}

const pillars: FeaturePillar[] = [
  {
    id: 'intelligence',
    label: 'Core AI',
    heading: 'EOS Intelligence',
    description:
      'AI trained on the Six Key Components, every official EOS tool, and your company context. Ask about V/TOs, Scorecards, Rocks, or meeting prep and get methodology-grounded answers instantly.',
    bullets: [
      { icon: MessageSquare, text: 'Streaming chat with conversation memory across sessions' },
      { icon: Brain, text: 'Deep understanding of all Six Key Components and EOS tools' },
      { icon: Sparkles, text: 'Smart autocomplete and predictive suggestions' },
      { icon: Search, text: 'Semantic search across your entire conversation history' },
      { icon: BookOpen, text: 'V/TO, Scorecard, Rock, and L10 meeting guidance built in' },
    ],
    accent: 'rgba(255, 121, 0, 0.12)',
    accentBorder: 'rgba(255, 121, 0, 0.25)',
    demoType: 'chat',
  },
  {
    id: 'documents',
    label: 'Knowledge Base',
    heading: 'Document Intelligence',
    description:
      'Upload your V/TOs, Scorecards, process docs, and any business materials. Every AI response draws from your actual company data through retrieval-augmented generation.',
    bullets: [
      { icon: FileText, text: 'Upload PDF, DOCX, TXT, and Markdown files' },
      { icon: Search, text: 'Vector embeddings for semantic document search' },
      { icon: Target, text: 'Organize by type: V/TO, Scorecard, Rocks, Process, and more' },
      { icon: BarChart, text: 'Document analytics show which files are most referenced' },
    ],
    accent: 'rgba(59, 130, 246, 0.12)',
    accentBorder: 'rgba(59, 130, 246, 0.25)',
    demoType: 'static',
  },
  {
    id: 'composer',
    label: 'Artifacts',
    heading: 'Composer Studio',
    description:
      'Generate and edit professional documents, spreadsheets, charts, V/TOs, and accountability charts in real time. Seven composer types, all AI-powered with version history and export.',
    bullets: [
      { icon: PenTool, text: 'Rich text documents with inline AI editing and suggestions' },
      { icon: BarChart, text: 'Spreadsheets, charts, and data visualizations from your data' },
      { icon: Target, text: 'Dedicated V/TO builder with structured sections' },
      { icon: Users, text: 'Interactive accountability chart with drag-and-drop seats' },
      { icon: FileText, text: 'Export to PDF or DOCX with full version history' },
    ],
    accent: 'rgba(244, 63, 94, 0.12)',
    accentBorder: 'rgba(244, 63, 94, 0.25)',
    demoType: 'composer',
  },
  {
    id: 'personas',
    label: 'Role-Based AI',
    heading: 'Custom Personas',
    description:
      'Pre-built personas for Implementers, Integrators, and Visionaries, or create your own with custom instructions, documents, and personality. Share across your organization.',
    bullets: [
      { icon: Users, text: 'Pre-built EOS personas for every leadership role' },
      { icon: Sparkles, text: 'Custom personas with your own instructions and tone' },
      { icon: FileText, text: 'Attach documents to give each persona specialized knowledge' },
      { icon: Share2, text: 'Share personas across your organization for consistency' },
    ],
    accent: 'rgba(16, 185, 129, 0.12)',
    accentBorder: 'rgba(16, 185, 129, 0.25)',
    demoType: 'personas',
  },
  {
    id: 'research',
    label: 'Deep Research',
    heading: 'Nexus Research Engine',
    description:
      'Nexus scans 40+ real-time sources per query to deliver comprehensive, citation-backed research. Competitive analysis, market trends, and industry benchmarks with every claim linked to its source.',
    bullets: [
      { icon: Telescope, text: '40+ sources scanned per query with automatic citations' },
      { icon: Search, text: 'Multi-phase research: scanning, analyzing, synthesizing' },
      { icon: BarChart, text: 'Competitive analysis and market intelligence on demand' },
      { icon: BookOpen, text: 'Every finding linked to a verifiable source' },
    ],
    accent: 'rgba(147, 51, 234, 0.12)',
    accentBorder: 'rgba(147, 51, 234, 0.25)',
    demoType: 'research',
  },
  {
    id: 'teams',
    label: 'Platform',
    heading: 'Teams & Integrations',
    description:
      'Bring your whole leadership team into one workspace. Role-based access, shared knowledge, Google Calendar sync, voice recordings, and enterprise-grade security across everything.',
    bullets: [
      { icon: Users, text: 'Organizations with Owner, Admin, and Member roles' },
      { icon: Calendar, text: 'Google Calendar sync for meeting briefs and scheduling' },
      { icon: Mic, text: 'Voice mode and meeting recordings with AI transcription' },
      { icon: Shield, text: 'OAuth 2.0 authentication, encrypted data, PCI-compliant billing' },
      { icon: Lock, text: 'Privacy controls with right-to-delete at any time' },
    ],
    accent: 'rgba(14, 165, 233, 0.12)',
    accentBorder: 'rgba(14, 165, 233, 0.25)',
    demoType: 'static',
  },
];

function SectionDivider() {
  return (
    <div className="relative py-1">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

function StaticVisual({ pillar }: { pillar: FeaturePillar }) {
  return (
    <div
      className="relative rounded-2xl border border-white/[0.06] overflow-hidden p-8 min-h-[280px] flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${pillar.accent}, rgba(0,0,0,0.7))` }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20400%20400%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22n%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.9%22%20numOctaves%3D%224%22%20stitchTiles%3D%22stitch%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23n)%22%2F%3E%3C%2Fsvg%3E')]" />
      <div className="relative z-10 grid grid-cols-2 gap-3 w-full max-w-sm">
        {pillar.bullets.slice(0, 4).map((bullet) => {
          const Icon = bullet.icon;
          return (
            <div key={bullet.text} className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-3 backdrop-blur-sm">
              <Icon className="w-4 h-4 text-white/40 mb-2" strokeWidth={1.5} />
              <p className="font-mono text-[10px] text-white/35 leading-snug line-clamp-2">
                {bullet.text.split(' ').slice(0, 4).join(' ')}
              </p>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 70% 50%, ${pillar.accentBorder}, transparent 60%)`, opacity: 0.3 }} />
    </div>
  );
}

function PillarSection({ pillar, index }: { pillar: FeaturePillar; index: number }) {
  const reversed = index % 2 === 1;
  const bg = index % 2 === 0 ? 'bg-black' : 'bg-[#050505]';
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const renderVisual = () => {
    switch (pillar.demoType) {
      case 'chat':
        return (
          <div className="relative" style={{ height: 360 }}>
            <div className="absolute left-0 right-0 bottom-[40%]">
              <DemoInput isActive={inView} />
            </div>
          </div>
        );
      case 'composer':
        return (
          <div className="relative overflow-hidden" style={{ height: 520 }}>
            <DemoComposer isActive={inView} />
          </div>
        );
      case 'personas':
        return (
          <div className="relative" style={{ height: 360 }}>
            <div className="absolute left-0 right-0 bottom-[40%]">
              <DemoPersonas isActive={inView} />
            </div>
          </div>
        );
      case 'research':
        return (
          <div className="relative" style={{ height: 360 }}>
            <div className="absolute left-0 right-0 bottom-[40%]">
              <DemoResearch isActive={inView} />
            </div>
          </div>
        );
      default:
        return <StaticVisual pillar={pillar} />;
    }
  };

  return (
    <section
      ref={sectionRef}
      id={pillar.id}
      className={`pillar-section relative z-20 py-20 md:py-28 ${bg} scroll-mt-24`}
    >
      <div className="container mx-auto px-6 lg:px-8">
        <div className={`max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center ${reversed ? 'lg:[direction:rtl]' : ''}`}>
          <div className={`pillar-text ${reversed ? 'lg:[direction:ltr]' : ''}`}>
            <p className="font-mono text-xs tracking-[0.2em] text-eos-orange/70 uppercase mb-4">
              {pillar.label}
            </p>
            <h2 className="font-montserrat text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-5">
              {pillar.heading}
            </h2>
            <p className="font-montserrat text-base text-white/55 leading-relaxed mb-8 max-w-lg">
              {pillar.description}
            </p>
            <ul className="space-y-3">
              {pillar.bullets.map((bullet) => {
                const Icon = bullet.icon;
                return (
                  <li key={bullet.text} className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      <Icon className="w-3.5 h-3.5 text-white/50" strokeWidth={1.5} />
                    </div>
                    <span className="font-montserrat text-sm text-white/50 leading-relaxed">{bullet.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className={`pillar-visual ${reversed ? 'lg:[direction:ltr]' : ''}`}>
            {renderVisual()}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function FeaturesClient() {
  const gsapInit = useRef(false);

  useEffect(() => {
    if (gsapInit.current) return;
    gsapInit.current = true;

    const ctx = gsap.context(() => {
      gsap.from('.features-hero-content', {
        opacity: 0, y: 30, filter: 'blur(8px)', duration: 0.8, ease: 'power2.out',
      });

      document.querySelectorAll('.pillar-section').forEach((section) => {
        const text = section.querySelector('.pillar-text');
        const visual = section.querySelector('.pillar-visual');
        if (text) {
          gsap.from(text, {
            opacity: 0, x: -30, filter: 'blur(6px)', duration: 0.7, ease: 'power2.out',
            scrollTrigger: { trigger: section, start: 'top 75%', once: true },
          });
        }
        if (visual) {
          gsap.from(visual, {
            opacity: 0, x: 30, filter: 'blur(6px)', duration: 0.7, delay: 0.15, ease: 'power2.out',
            scrollTrigger: { trigger: section, start: 'top 75%', once: true },
          });
        }
      });

      gsap.from('.features-cta-content', {
        opacity: 0, y: 24, filter: 'blur(6px)', duration: 0.7, ease: 'power2.out',
        scrollTrigger: { trigger: '.features-cta', start: 'top 80%', once: true },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative w-full bg-black overflow-x-hidden">
      <LandingNavbar />

      {/* Hero */}
      <section className="relative pt-36 pb-20 bg-gradient-to-b from-[#0B3E60]/20 via-black to-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,121,0,0.06),transparent_50%)] pointer-events-none" />
        <div className="features-hero-content container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <p className="font-mono text-xs tracking-[0.2em] text-eos-orange/70 uppercase mb-6">Features</p>
            <h1 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6">
              Try It Yourself
            </h1>
            <p className="font-montserrat text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
              Interactive demos of every major feature. Scroll down to see the chat, composer, personas, and Nexus research in action.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="font-montserrat font-semibold bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white px-10 py-6 rounded-full shadow-[0_10px_32px_rgba(255,121,0,0.35)] transition-all duration-300">
                  Get Started Free
                </Button>
              </Link>
              <a href="/?from=chat">
                <Button size="lg" variant="outline" className="font-montserrat border-white/20 text-white/80 hover:text-white hover:bg-white/10 hover:border-white/40 bg-white/[0.04] px-10 py-6 rounded-full transition-all duration-300">
                  Back to Home
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Quick nav */}
      <div className="relative z-20 bg-black py-6">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-2">
            {pillars.map((p) => (
              <a key={p.id} href={`#${p.id}`} className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.06] transition-all duration-200">
                <span className="font-montserrat text-xs text-white/45 hover:text-white/70">{p.heading}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <SectionDivider />

      {pillars.map((pillar, i) => (
        <div key={pillar.id}>
          <PillarSection pillar={pillar} index={i} />
          {i < pillars.length - 1 && <SectionDivider />}
        </div>
      ))}

      <SectionDivider />

      {/* CTA */}
      <section className="features-cta relative z-20 py-28 bg-gradient-to-b from-black via-[#050505] to-black">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,121,0,0.06),transparent_50%)]" />
        </div>
        <div className="features-cta-content container mx-auto px-6 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <p className="font-mono text-xs tracking-[0.2em] text-white/30 uppercase mb-6">Ready?</p>
            <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-white tracking-tight mb-5">
              Start Running Better on EOS
            </h2>
            <p className="font-montserrat text-lg text-white/50 max-w-xl mx-auto mb-10">
              Every feature above is available today. No credit card required to start.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/register">
                <Button size="lg" className="font-montserrat font-semibold bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white px-10 py-6 rounded-full shadow-[0_10px_32px_rgba(255,121,0,0.35)] transition-all duration-300">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="font-montserrat border-white/20 text-white/80 hover:text-white hover:bg-white/10 hover:border-white/40 bg-white/[0.04] px-10 py-6 rounded-full transition-all duration-300">
                  Sign In
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {['No credit card required', 'Setup in minutes', 'Free tier available'].map((t) => (
                <div key={t} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.02]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-eos-orange/60" />
                  <span className="font-montserrat text-sm text-white/40">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
