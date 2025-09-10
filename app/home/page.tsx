'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '@/components/ui/button';
import {
  Users,
  BarChart,
  Bot,
  Sparkles,
  Search as SearchIcon,
  Mic,
  Upload,
  ArrowRight,
} from 'lucide-react';
// unique narrative: no direct feature grid import

gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement[]>([]);
  const storySectionRef = useRef<HTMLDivElement>(null);
  const storyPinRef = useRef<HTMLDivElement>(null);
  const storyStepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // Hero intro
      if (heroRef.current) {
        const tl = gsap.timeline();
        tl.fromTo(
          heroRef.current.querySelectorAll(
            '.hero-badge, .hero-title, .hero-subtitle, .hero-cta, .hero-media, .hero-float',
          ),
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            stagger: 0.08,
            ease: 'power3.out',
          },
        );
      }

      // Parallax blobs
      gsap.utils.toArray('.parallax-blob').forEach((el, i) => {
        gsap.to(el as Element, {
          yPercent: i % 2 === 0 ? 20 : -20,
          ease: 'none',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.6,
          },
        });
      });

      // Section entrances
      sectionsRef.current.forEach((section) => {
        if (!section) return;
        gsap.fromTo(
          section.querySelectorAll(
            '.section-title, .section-subtitle, .card, .stat, .cta',
          ),
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.06,
            ease: 'power3.out',
            scrollTrigger: { trigger: section, start: 'top 80%' },
          },
        );
      });

      // Pinned story section
      if (storySectionRef.current && storyPinRef.current) {
        ScrollTrigger.create({
          trigger: storySectionRef.current,
          start: 'top top',
          end: '+=1400',
          pin: storyPinRef.current,
          pinSpacing: true,
        });
      }

      // Vertical progress rail fill
      if (storyStepsRef.current) {
        const railFill = storyStepsRef.current.querySelector(
          '.rail-fill',
        ) as HTMLElement | null;
        if (railFill) {
          ScrollTrigger.create({
            trigger: storyStepsRef.current,
            start: 'top 80%',
            end: 'bottom 20%',
            scrub: true,
            onUpdate: (self) => {
              railFill.style.height = `${Math.max(0, Math.min(1, self.progress)) * 100}%`;
            },
          });
        }
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Removed auto features/categories to keep a distinctive home experience

  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background/98 to-background/95 relative overflow-hidden"
      ref={containerRef}
    >
      {/* Decorative background */}
      <div className="noise-texture pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute -top-20 -left-10 w-[36rem] h-[36rem] rounded-full blur-3xl parallax-blob bg-eos-orange/10" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 w-[42rem] h-[42rem] rounded-full blur-3xl parallax-blob bg-eos-navy/10" />

      {/* Toolbar / Navbar */}
      <header className="sticky top-0 z-50 glass-morphism border-b border-border/20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/eosai.png" alt="EOS AI" width={36} height={36} />
              <span className="font-semibold tracking-tight">EOS Chat AI</span>
              <span className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full glass-morphism hero-badge">
                <Sparkles className="w-3.5 h-3.5 text-eos-orange" />
                Live
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a
                href="#features"
                className="text-sm hover:text-eos-orange transition-colors"
              >
                Features
              </a>
              <a
                href="#composer"
                className="text-sm hover:text-eos-orange transition-colors"
              >
                Composer
              </a>
              <a
                href="#search"
                className="text-sm hover:text-eos-orange transition-colors"
              >
                Search
              </a>
              <a
                href="#voice"
                className="text-sm hover:text-eos-orange transition-colors"
              >
                Voice
              </a>
              <a
                href="/features"
                className="text-sm hover:text-eos-orange transition-colors"
              >
                Full List
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="glass-button">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="bg-eos-orange hover:bg-eos-orange/90 shadow-glow"
                >
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section
          ref={heroRef}
          className="relative py-20 md:py-28 overflow-hidden"
        >
          <div className="container mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-morphism text-eos-orange text-sm font-medium shadow-glow-sm hero-badge">
                <Sparkles className="w-4 h-4" />
                Advanced EOS AI Platform
              </div>
              <h1 className="hero-title text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mt-6">
                Transform Your EOS Implementation with{' '}
                <span className="gradient-text">AI</span>
              </h1>
              <p className="hero-subtitle text-lg md:text-xl text-muted-foreground max-w-xl mt-4">
                Streaming chat, rich composer, RAG document intelligence, voice
                mode, advanced search, personas, calendar, and more.
              </p>
              <div className="hero-cta flex flex-col sm:flex-row gap-4 mt-8">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="bg-eos-orange hover:bg-eos-orange/90 gap-2 shadow-glow group"
                  >
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/features">
                  <Button size="lg" variant="outline" className="glass-button">
                    Explore Features
                  </Button>
                </Link>
              </div>
              <div className="mt-6 flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-eos-orange" /> Streaming chat
                </div>
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-eos-orange" /> RAG uploads
                </div>
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-eos-orange" /> Voice mode
                </div>
              </div>
            </div>
            <div className="relative hero-media">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-border/50 glass-morphism-dark bg-muted/50">
                <Image
                  src="/images/chatexample.png"
                  alt="Chat UI"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              </div>
              {/* Floating stats */}
              <div className="hero-float absolute -top-4 -right-4 glass-morphism rounded-lg shadow-xl p-3">
                <div className="flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-eos-orange" /> Insights
                </div>
              </div>
              <div className="hero-float absolute -bottom-4 -left-4 glass-morphism rounded-lg shadow-xl p-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-eos-navy dark:text-eos-orange" />{' '}
                  Teams
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section
          ref={(el) => {
            if (el) sectionsRef.current[0] = el as HTMLDivElement;
          }}
          className="py-14 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30" />
          <div className="container mx-auto px-4 md:px-6 relative z-10 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { n: '500+', t: 'Companies Using EOS AI' },
              { n: '10,000+', t: 'Hours Saved Monthly' },
              { n: '95%', t: '% User Satisfaction' },
              { n: '24/7', t: 'Support Available' },
            ].map((s) => (
              <div
                key={s.t}
                className="stat glass-morphism rounded-xl p-6 text-center shadow-lg"
              >
                <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-eos-orange to-eos-orange/70 mb-1">
                  {s.n}
                </div>
                <p className="text-sm text-muted-foreground">{s.t}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Narrative scrollytelling (pinned) */}
        <section id="features" ref={storySectionRef} className="py-20 md:py-28">
          <div className="container mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Pinned visual */}
            <div ref={storyPinRef} className="lg:sticky lg:top-24">
              <div className="relative h-[480px] glass-morphism rounded-3xl border border-border/40 overflow-hidden flex items-center justify-center">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-eos-orange/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] bg-eos-navy/10 rounded-full blur-3xl" />
                <div className="relative z-10 text-center px-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-eos-orange/10 text-eos-orange text-xs font-medium mb-4">
                    <Sparkles className="w-3.5 h-3.5" /> Guided Journey
                  </div>
                  <h3 className="text-3xl font-bold mb-2">
                    From Question → Outcome
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Ask. Upload context. Search broadly. Speak naturally. Get
                    actionable results.
                  </p>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div ref={storyStepsRef} className="relative space-y-10">
              <div className="absolute left-[-12px] top-0 bottom-0 w-0.5 bg-border/50 rounded-full" />
              <div className="rail-fill absolute left-[-12px] top-0 w-0.5 bg-eos-orange rounded-full h-0" />
              <div className="glass-morphism rounded-2xl p-6 border border-border/40">
                <h4 className="text-xl font-semibold mb-1">
                  1. Ask and Explore
                </h4>
                <p className="text-sm text-muted-foreground">
                  Start a streaming conversation. Get suggestions and iterate
                  quickly.
                </p>
              </div>
              <div className="glass-morphism rounded-2xl p-6 border border-border/40">
                <h4 className="text-xl font-semibold mb-1">2. Add Context</h4>
                <p className="text-sm text-muted-foreground">
                  Upload documents for RAG-powered answers grounded in your
                  content.
                </p>
              </div>
              <div className="glass-morphism rounded-2xl p-6 border border-border/40">
                <h4 className="text-xl font-semibold mb-1">3. Find Anything</h4>
                <p className="text-sm text-muted-foreground">
                  Use Advanced Search with filters and relevance to jump
                  anywhere.
                </p>
              </div>
              <div className="glass-morphism rounded-2xl p-6 border border-border/40">
                <h4 className="text-xl font-semibold mb-1">4. Go Hands‑Free</h4>
                <p className="text-sm text-muted-foreground">
                  Voice Mode for realtime speech—to listen, talk, and move
                  faster.
                </p>
              </div>
              <div className="flex gap-4">
                <Link href="/register">
                  <Button className="bg-eos-orange hover:bg-eos-orange/90 shadow-glow">
                    Start Free Trial
                  </Button>
                </Link>
                <Link href="/features">
                  <Button variant="outline" className="glass-button">
                    See the full system
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Highlighted deep sections */}
        <section
          id="composer"
          ref={(el) => {
            if (el) sectionsRef.current[2] = el as HTMLDivElement;
          }}
          className="py-20 md:py-28 bg-gradient-to-b from-muted/30 to-background"
        >
          <div className="container mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h3 className="section-title text-3xl font-bold mb-3">
                Interactive Composer
              </h3>
              <p className="section-subtitle text-muted-foreground mb-6">
                Code, charts, documents, and spreadsheets—created and edited
                with AI.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Code editing',
                  'Charts & data',
                  'Docs & export',
                  'Diff & review',
                ].map((t) => (
                  <div
                    key={t}
                    className="card glass-morphism rounded-xl p-4 text-sm"
                  >
                    {t}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <Link href="/chat">
                  <Button className="bg-eos-orange hover:bg-eos-orange/90 shadow-glow">
                    Try in chat
                  </Button>
                </Link>
                <Link href="/features">
                  <Button variant="outline" className="glass-button">
                    Learn more
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden border border-border/50 glass-morphism-dark aspect-[4/3]">
                <Image
                  src="/images/features/document-generation.png"
                  alt="Composer"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        <section
          id="search"
          ref={(el) => {
            if (el) sectionsRef.current[3] = el as HTMLDivElement;
          }}
          className="py-20 md:py-28"
        >
          <div className="container mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="rounded-2xl overflow-hidden border border-border/50 glass-morphism-dark aspect-[4/3]">
                <Image
                  src="/images/features/knowledge-base.png"
                  alt="Advanced Search"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="section-title text-3xl font-bold mb-3">
                Advanced Search
              </h3>
              <p className="section-subtitle text-muted-foreground mb-6">
                Global search with smart filters, relevance scoring, and
                Cmd/Ctrl+K anywhere.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Global search',
                  'Smart filters',
                  'RAG results',
                  'Relevance scoring',
                ].map((t) => (
                  <div
                    key={t}
                    className="card glass-morphism rounded-xl p-4 text-sm flex items-center gap-2"
                  >
                    <SearchIcon className="w-4 h-4" /> {t}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <Link href="/features">
                  <Button className="bg-eos-orange hover:bg-eos-orange/90 shadow-glow">
                    See details
                  </Button>
                </Link>
                <a href="#features">
                  <Button variant="outline" className="glass-button">
                    All features
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section
          id="voice"
          ref={(el) => {
            if (el) sectionsRef.current[4] = el as HTMLDivElement;
          }}
          className="py-20 md:py-28 bg-gradient-to-b from-muted/30 to-background"
        >
          <div className="container mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h3 className="section-title text-3xl font-bold mb-3">
                Voice Mode
              </h3>
              <p className="section-subtitle text-muted-foreground mb-6">
                Hands-free conversations using OpenAI Realtime with WebRTC and
                transcripts.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Realtime speech',
                  'Transcriptions',
                  'Audio levels',
                  'Hands-free',
                ].map((t) => (
                  <div
                    key={t}
                    className="card glass-morphism rounded-xl p-4 text-sm flex items-center gap-2"
                  >
                    <Mic className="w-4 h-4" /> {t}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <Link href="/chat">
                  <Button className="bg-eos-orange hover:bg-eos-orange/90 shadow-glow">
                    Start chatting
                  </Button>
                </Link>
                <Link href="/features">
                  <Button variant="outline" className="glass-button">
                    Learn more
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden border border-border/50 glass-morphism-dark aspect-[4/3]">
                <Image
                  src="/images/features/integrations.png"
                  alt="Voice Mode"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section
          ref={(el) => {
            if (el) sectionsRef.current[5] = el as HTMLDivElement;
          }}
          className="py-20 md:py-28 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-eos-orange/20 via-eos-navy/20 to-eos-orange/20" />
          <div className="absolute inset-0 noise-texture opacity-30" />
          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <h2 className="section-title text-3xl md:text-4xl font-bold mb-3">
              Ready to experience EOS AI?
            </h2>
            <p className="section-subtitle text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Start your free trial and explore the full capability set.
            </p>
            <div className="cta flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-eos-orange hover:bg-eos-orange/90 gap-2 shadow-glow group"
                >
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/features">
                <Button size="lg" variant="outline" className="glass-button">
                  View Features
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
