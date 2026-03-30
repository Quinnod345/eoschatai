'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import {
  PenTool,
  Users,
  Search,
  FileText,
  BarChart,
  Calendar,
  Share2,
  Shield,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Telescope,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import LandingNavbar from '@/components/marketing/landing-navbar';
import LandingFooter from '@/components/marketing/landing-footer';
import type { LucideIcon } from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface SolutionStep {
  label: string;
  description: string;
  icon: LucideIcon;
}

interface Solution {
  id: string;
  label: string;
  heading: string;
  scenario: string;
  description: string;
  steps: SolutionStep[];
  result: string;
  accent: string;
  accentBorder: string;
}

const solutions: Solution[] = [
  {
    id: 'nexus',
    label: 'Deep Research',
    heading: 'Nexus Research Engine',
    scenario:
      'Your quarterly planning session is in two weeks. The leadership team needs competitive intelligence, market sizing data, and industry benchmarks — but manually researching across dozens of sources would take days.',
    description:
      'Nexus scans 40+ real-time sources per query, synthesizes findings, and delivers citation-backed reports in minutes. Every claim links to its source so your team can verify and trust the data.',
    steps: [
      { label: 'Ask', description: 'Type your research question in Nexus mode', icon: Telescope },
      { label: 'Scan', description: 'Nexus searches 40+ sources simultaneously', icon: Search },
      { label: 'Synthesize', description: 'Results are analyzed and cross-referenced', icon: BarChart },
      { label: 'Report', description: 'Citation-backed report delivered with source links', icon: ExternalLink },
    ],
    result: 'Your team walks into quarterly planning with comprehensive, verified market intelligence prepared in under 10 minutes.',
    accent: 'rgba(147, 51, 234, 0.10)',
    accentBorder: 'rgba(147, 51, 234, 0.20)',
  },
  {
    id: 'composer',
    label: 'Content Creation',
    heading: 'Composer Studio',
    scenario:
      'Your Integrator needs an updated V/TO for the board meeting on Friday, a new scorecard spreadsheet for Q2 measurables, and an accountability chart reflecting recent hires. Three different document types, one deadline.',
    description:
      'Composer Studio handles all seven artifact types in one workspace. Ask the AI to generate each document, edit inline, track version history, and export to PDF or DOCX when ready.',
    steps: [
      { label: 'Request', description: 'Ask AI to create any document type', icon: PenTool },
      { label: 'Generate', description: 'AI builds the artifact in real time', icon: Clock },
      { label: 'Refine', description: 'Edit inline with AI suggestions and version history', icon: FileText },
      { label: 'Export', description: 'Download as PDF, DOCX, or share directly', icon: ArrowRight },
    ],
    result: 'Three professional EOS documents — V/TO, scorecard, and accountability chart — generated, refined, and exported in a single session.',
    accent: 'rgba(244, 63, 94, 0.10)',
    accentBorder: 'rgba(244, 63, 94, 0.20)',
  },
  {
    id: 'collaboration',
    label: 'Enterprise',
    heading: 'Team Collaboration',
    scenario:
      'Your leadership team is spread across three offices. The Visionary, Integrator, and department heads all need access to the same AI workspace, but with different permission levels and personalized personas.',
    description:
      'A shared workspace where the entire team collaborates with role-based access. Share personas, documents, and knowledge. Google Calendar sync keeps everyone prepared for meetings.',
    steps: [
      { label: 'Invite', description: 'Add team members via email or shareable invite codes', icon: Users },
      { label: 'Configure', description: 'Set Owner, Admin, and Member roles per person', icon: Shield },
      { label: 'Share', description: 'Distribute personas, documents, and knowledge org-wide', icon: Share2 },
      { label: 'Align', description: 'Calendar sync and shared context keeps everyone prepared', icon: Calendar },
    ],
    result: 'Your entire leadership team operates from one AI workspace with consistent EOS guidance, shared context, and appropriate access controls.',
    accent: 'rgba(14, 165, 233, 0.10)',
    accentBorder: 'rgba(14, 165, 233, 0.20)',
  },
];

function SectionDivider() {
  return (
    <div className="relative py-1">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

function SolutionSection({ solution, index }: { solution: Solution; index: number }) {
  const reversed = index % 2 === 1;
  const bg = index % 2 === 0 ? 'bg-black' : 'bg-[#050505]';

  return (
    <section
      id={solution.id}
      className={`solution-section relative z-20 py-20 md:py-28 ${bg} scroll-mt-24`}
    >
      <div className="container mx-auto px-6 lg:px-8">
        <div className={`max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start ${reversed ? 'lg:[direction:rtl]' : ''}`}>
          {/* Text side */}
          <div className={`solution-text ${reversed ? 'lg:[direction:ltr]' : ''}`}>
            <p className="font-mono text-xs tracking-[0.2em] text-eos-orange/70 uppercase mb-4">
              {solution.label}
            </p>
            <h2 className="font-montserrat text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-6">
              {solution.heading}
            </h2>

            {/* Scenario callout */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8">
              <p className="font-mono text-[10px] tracking-widest text-white/25 uppercase mb-2">Scenario</p>
              <p className="font-montserrat text-sm text-white/50 leading-relaxed italic">
                {solution.scenario}
              </p>
            </div>

            <p className="font-montserrat text-base text-white/55 leading-relaxed mb-8 max-w-lg">
              {solution.description}
            </p>

            <Link href="/register">
              <Button
                size="lg"
                className="font-montserrat font-semibold bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white px-8 py-5 rounded-full shadow-[0_8px_24px_rgba(255,121,0,0.25)] transition-all duration-300"
              >
                Try It Free
              </Button>
            </Link>
          </div>

          {/* Visual side: stepped flow */}
          <div className={`solution-visual ${reversed ? 'lg:[direction:ltr]' : ''}`}>
            <div
              className="relative rounded-2xl border border-white/[0.06] overflow-hidden p-6 md:p-8"
              style={{ background: `linear-gradient(160deg, ${solution.accent}, rgba(0,0,0,0.6))` }}
            >
              <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20400%20400%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22n%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.9%22%20numOctaves%3D%224%22%20stitchTiles%3D%22stitch%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23n)%22%2F%3E%3C%2Fsvg%3E')]" />

              <p className="font-mono text-[10px] tracking-widest text-white/20 uppercase mb-6 relative z-10">How it works</p>

              <div className="relative z-10 space-y-0">
                {solution.steps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className="flex gap-4">
                      {/* Timeline */}
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3.5 h-3.5 text-white/50" strokeWidth={1.5} />
                        </div>
                        {i < solution.steps.length - 1 && (
                          <div className="w-px flex-1 min-h-[32px] bg-gradient-to-b from-white/[0.08] to-transparent" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="pb-6">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[10px] text-white/25">{String(i + 1).padStart(2, '0')}</span>
                          <span className="font-montserrat text-sm font-semibold text-white/80">{step.label}</span>
                        </div>
                        <p className="font-montserrat text-xs text-white/40 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Result */}
              <div className="relative z-10 mt-2 pt-4 border-t border-white/[0.06]">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500/60 flex-shrink-0 mt-0.5" />
                  <p className="font-montserrat text-xs text-emerald-400/60 leading-relaxed">
                    {solution.result}
                  </p>
                </div>
              </div>

              <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at ${reversed ? '30%' : '70%'} 80%, ${solution.accentBorder}, transparent 60%)`, opacity: 0.2 }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SolutionsClient() {
  const gsapInit = useRef(false);

  useEffect(() => {
    if (gsapInit.current) return;
    gsapInit.current = true;

    const ctx = gsap.context(() => {
      gsap.from('.solutions-hero-content', {
        opacity: 0, y: 30, filter: 'blur(8px)', duration: 0.8, ease: 'power2.out',
      });

      document.querySelectorAll('.solution-section').forEach((section) => {
        const text = section.querySelector('.solution-text');
        const visual = section.querySelector('.solution-visual');
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

      gsap.from('.solutions-cta-content', {
        opacity: 0, y: 24, filter: 'blur(6px)', duration: 0.7, ease: 'power2.out',
        scrollTrigger: { trigger: '.solutions-cta', start: 'top 80%', once: true },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative w-full bg-black overflow-x-hidden">
      <LandingNavbar />

      {/* Hero */}
      <section className="relative pt-36 pb-20 bg-gradient-to-b from-[#1a0a2e]/30 via-black to-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_20%,rgba(147,51,234,0.06),transparent_50%)] pointer-events-none" />
        <div className="solutions-hero-content container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <p className="font-mono text-xs tracking-[0.2em] text-eos-orange/70 uppercase mb-6">Solutions</p>
            <h1 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6">
              How Teams Use EOSAI
            </h1>
            <p className="font-montserrat text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
              Real scenarios showing how leadership teams use deep research, AI-powered
              content creation, and shared workspaces to run better on EOS.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="font-montserrat font-semibold bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white px-10 py-6 rounded-full shadow-[0_10px_32px_rgba(255,121,0,0.35)] transition-all duration-300">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/features">
                <Button size="lg" variant="outline" className="font-montserrat border-white/20 text-white/80 hover:text-white hover:bg-white/10 hover:border-white/40 bg-white/[0.04] px-10 py-6 rounded-full transition-all duration-300">
                  Try Interactive Demos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick nav */}
      <div className="relative z-20 bg-black py-6">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-2">
            {solutions.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.06] transition-all duration-200">
                <span className="font-montserrat text-xs text-white/45 hover:text-white/70">{s.heading}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <SectionDivider />

      {solutions.map((solution, i) => (
        <div key={solution.id}>
          <SolutionSection solution={solution} index={i} />
          {i < solutions.length - 1 && <SectionDivider />}
        </div>
      ))}

      <SectionDivider />

      {/* CTA */}
      <section className="solutions-cta relative z-20 py-28 bg-gradient-to-b from-black via-[#050505] to-black">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(147,51,234,0.05),transparent_50%)]" />
        </div>
        <div className="solutions-cta-content container mx-auto px-6 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <p className="font-mono text-xs tracking-[0.2em] text-white/30 uppercase mb-6">Ready?</p>
            <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-white tracking-tight mb-5">
              Your Team Deserves Better Tools
            </h2>
            <p className="font-montserrat text-lg text-white/50 max-w-xl mx-auto mb-10">
              Every solution above is available today. Start free and see the difference.
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
