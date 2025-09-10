'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  ArrowRight,
  Bot,
  Search as SearchIcon,
  Mic,
  Upload,
  Calendar,
  Globe,
  MessageSquare,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  FEATURE_CATEGORIES,
  getAllFeatures,
  type Feature,
} from '@/lib/features/config';

gsap.registerPlugin(ScrollTrigger);

export default function FeaturesPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const colorOverlayRef = useRef<HTMLDivElement>(null);

  const allFeatures = useMemo(() => getAllFeatures(), []);
  const [activeCatId, setActiveCatId] = useState<string | null>(
    FEATURE_CATEGORIES[0]?.id ?? null,
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // Pin the system map while scrolling steps
      if (mapSectionRef.current && mapRef.current) {
        ScrollTrigger.create({
          trigger: mapSectionRef.current,
          start: 'top top',
          end: '+=1500',
          pin: mapRef.current,
          pinSpacing: true,
        });
      }

      // Reveal steps and highlight nodes
      const stepEls = stepsRef.current?.querySelectorAll('[data-step]') ?? [];
      stepEls.forEach((el) => {
        const targetId = (el as HTMLElement).dataset.step as string;
        ScrollTrigger.create({
          trigger: el as Element,
          start: 'top 70%',
          onEnter: () => highlightNode(targetId),
          onEnterBack: () => highlightNode(targetId),
          onLeave: () =>
            (el as HTMLElement).classList.remove('ring-2', 'ring-eos-orange'),
          onToggle: (self) => {
            if (self.isActive)
              (el as HTMLElement).classList.add('ring-2', 'ring-eos-orange');
          },
        });
      });

      // Snap between steps
      if (stepsRef.current && stepEls.length > 1) {
        ScrollTrigger.create({
          trigger: stepsRef.current,
          start: 'top top',
          end: 'bottom bottom',
          snap: 1 / (stepEls.length - 1),
        });
      }

      // Float nodes subtly
      gsap.to('.node', {
        y: 8,
        repeat: -1,
        yoyo: true,
        duration: 2,
        ease: 'sine.inOut',
        stagger: 0.15,
      });

      // Vertical progress rail fill
      if (stepsRef.current) {
        const railFill = stepsRef.current.querySelector(
          '.rail-fill',
        ) as HTMLElement | null;
        if (railFill) {
          ScrollTrigger.create({
            trigger: stepsRef.current,
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

    function highlightNode(id: string) {
      const nodes = mapRef.current?.querySelectorAll('.node') ?? [];
      nodes.forEach((n) => n.classList.remove('ring-2', 'ring-eos-orange'));
      const active = mapRef.current?.querySelector(`[data-node="${id}"]`);
      if (active) {
        active.classList.add('ring-2', 'ring-eos-orange');
        gsap.fromTo(
          active,
          { scale: 1 },
          {
            scale: 1.06,
            duration: 0.4,
            ease: 'power2.out',
            yoyo: true,
            repeat: 1,
          },
        );
      }

      // Animate connector lines
      const lines = mapRef.current?.querySelectorAll('.connector-line') as
        | NodeListOf<SVGLineElement>
        | undefined;
      lines?.forEach((line) => {
        const total = Number.parseFloat(
          line.getAttribute('stroke-dasharray') || '0',
        );
        gsap.to(line, {
          strokeDashoffset: total,
          duration: 0.4,
          ease: 'power2.out',
        });
      });
      const activeLine = mapRef.current?.querySelector(
        `.connector-line[data-line="${id}"]`,
      ) as SVGLineElement | null;
      if (activeLine) {
        gsap.to(activeLine, {
          strokeDashoffset: 0,
          duration: 0.8,
          ease: 'power2.out',
        });
      }

      // Pulse dot from center to active node
      const idx = FEATURE_CATEGORIES.findIndex((c) => c.id === id);
      if (idx >= 0 && pulseRef.current) {
        gsap.fromTo(
          pulseRef.current,
          { x: 0, y: 0, opacity: 0.2, scale: 0.8 },
          {
            x: positions[idx].x,
            y: positions[idx].y,
            opacity: 1,
            scale: 1,
            duration: 0.6,
            ease: 'power3.out',
          },
        );
      }

      // Dynamic color overlay tint per category
      if (colorOverlayRef.current) {
        const tint = getTintForCategory(id);
        gsap.to(colorOverlayRef.current, {
          background: tint,
          duration: 0.4,
          ease: 'power2.out',
        });
      }

      setActiveCatId(id);
    }

    function getTintForCategory(catId: string): string {
      switch (catId) {
        case 'core':
          return 'linear-gradient(135deg, rgba(255,118,0,0.12), rgba(0,0,0,0))';
        case 'productivity':
          return 'linear-gradient(135deg, rgba(0,46,93,0.12), rgba(0,0,0,0))';
        case 'integration':
          return 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(0,0,0,0))';
        case 'advanced':
          return 'linear-gradient(135deg, rgba(250,204,21,0.12), rgba(0,0,0,0))';
        case 'eos':
          return 'linear-gradient(135deg, rgba(244,63,94,0.12), rgba(0,0,0,0))';
        case 'ui':
          return 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(0,0,0,0))';
        default:
          return 'linear-gradient(135deg, rgba(255,118,0,0.08), rgba(0,0,0,0))';
      }
    }

    return () => ctx.revert();
  }, []);

  // Precompute positions for category nodes around the center
  const positions = useMemo(() => {
    const r = 220; // radius
    const cx = 0;
    const cy = 0;
    const total = FEATURE_CATEGORIES.length;
    return FEATURE_CATEGORIES.map((_, i) => {
      const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      return { x, y };
    });
  }, []);

  return (
    <div
      className="flex min-h-screen flex-col bg-gradient-to-b from-background to-background/95"
      ref={containerRef}
    >
      {/* Fixed background elements */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-eos-orange/10 rounded-full blur-3xl floating-blob" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-eos-navy/10 rounded-full blur-3xl floating-blob" />
        <div className="absolute inset-0 noise-texture opacity-20" />
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border/40">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/">
                <Image
                  src="/images/eosai.png"
                  alt="EOS AI Logo"
                  width={120}
                  height={40}
                  priority
                  className="object-contain"
                />
              </Link>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <Link
                href="/"
                className="text-sm font-medium hover:text-eos-orange transition-colors"
              >
                Home
              </Link>
              <Link
                href="/features"
                className="text-sm font-medium text-eos-orange"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="text-sm font-medium hover:text-eos-orange transition-colors"
              >
                Pricing
              </Link>
            </nav>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden md:inline-flex"
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="bg-eos-orange hover:bg-eos-orange/90"
                >
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section
          className="relative overflow-hidden py-20 md:py-32"
          ref={heroRef}
        >
          <div className="container mx-auto px-4 md:px-6 text-center">
            <div className="max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-eos-orange/10 text-eos-orange text-sm font-medium mb-8 glass-morphism">
                <Sparkles className="w-4 h-4" />
                System Map & Capabilities
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Explore How <span className="gradient-text">EOS AI</span> Fits
                Together
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                A cohesive view of chat, composer, RAG, voice, search, personas,
                calendar and more—without the grid of cards.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="bg-eos-orange hover:bg-eos-orange/90 gap-2 shadow-glow"
                  >
                    Start Free Trial
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/">
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 glass-morphism"
                  >
                    Back to Home
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* System Map + Scrollytelling */}
        <section ref={mapSectionRef} className="py-16 md:py-24 relative">
          <div className="container mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Pinned Map */}
            <div ref={mapRef} className="map-pin lg:sticky lg:top-24">
              <div className="relative h-[520px] glass-morphism rounded-3xl border border-border/40 flex items-center justify-center overflow-hidden">
                {/* dynamic color overlay */}
                <div
                  ref={colorOverlayRef}
                  className="absolute inset-0 pointer-events-none"
                />
                {/* center */}
                <div className="relative z-10 w-40 h-40 rounded-full glass-morphism flex items-center justify-center shadow-glow">
                  <Image
                    src="/images/eosai.png"
                    alt="EOS AI"
                    width={96}
                    height={32}
                    className="object-contain"
                  />
                </div>

                {/* orbiting nodes + connectors */}
                <svg className="absolute inset-0" viewBox="-320 -320 640 640">
                  <circle
                    cx="0"
                    cy="0"
                    r="220"
                    className="stroke-eos-orange/20 fill-transparent"
                    strokeWidth="1"
                  />
                  {FEATURE_CATEGORIES.map((cat, i) => (
                    <line
                      key={`line-${cat.id}`}
                      data-line={cat.id}
                      x1={0}
                      y1={0}
                      x2={positions[i].x}
                      y2={positions[i].y}
                      stroke="currentColor"
                      className="connector-line text-eos-orange/30"
                      strokeWidth="1.5"
                      strokeDasharray="240"
                      strokeDashoffset="240"
                    />
                  ))}
                </svg>

                {FEATURE_CATEGORIES.map((cat, i) => (
                  <div
                    key={cat.id}
                    data-node={cat.id}
                    className="node absolute w-28 h-28 rounded-2xl glass-morphism border border-border/40 flex items-center justify-center text-center px-3"
                    style={{
                      transform: `translate(${positions[i].x}px, ${positions[i].y}px)`,
                    }}
                  >
                    <span className="text-xs font-medium">{cat.title}</span>
                  </div>
                ))}

                {/* pulse dot */}
                <div
                  ref={pulseRef}
                  className="absolute z-20 w-3 h-3 rounded-full bg-eos-orange shadow-glow"
                  style={{ transform: 'translate(0px, 0px)' }}
                />
                {/* Active overlay */}
                <div className="absolute bottom-4 left-4 right-4 glass-morphism rounded-2xl border border-border/40 p-4">
                  <p className="text-xs text-muted-foreground">
                    {
                      FEATURE_CATEGORIES.find((c) => c.id === activeCatId)
                        ?.description
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Scroll Steps */}
            <div ref={stepsRef} className="relative space-y-12">
              {/* Progress rail */}
              <div className="absolute left-[-12px] top-0 bottom-0 w-0.5 bg-border/50 rounded-full" />
              <div className="rail-fill absolute left-[-12px] top-0 w-0.5 bg-eos-orange rounded-full h-0" />
              {FEATURE_CATEGORIES.map((cat) => {
                const items: Feature[] = allFeatures.filter(
                  (f) => f.category === (cat.id as Feature['category']),
                );
                return (
                  <div
                    key={cat.id}
                    data-step={cat.id}
                    className="glass-morphism rounded-3xl p-8 border border-border/40"
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-eos-orange/10 text-eos-orange text-xs font-medium mb-4">
                      <Sparkles className="w-3.5 h-3.5" /> Category
                    </div>
                    <h3 className="text-2xl font-semibold mb-2">{cat.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {cat.description}
                    </p>
                    {items.length > 0 && (
                      <ul className="text-sm text-muted-foreground space-y-2">
                        {items.slice(0, 5).map((f) => (
                          <li key={f.id} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-eos-orange/70" />{' '}
                            {f.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}

              {/* Quick capability strip */}
              <div className="glass-morphism rounded-3xl p-6 border border-border/40">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50">
                    <Bot className="w-4 h-4" /> Streaming Chat
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50">
                    <Upload className="w-4 h-4" /> RAG Uploads
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50">
                    <SearchIcon className="w-4 h-4" /> Global Search
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50">
                    <Mic className="w-4 h-4" /> Voice Mode
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-eos-orange/20 via-eos-navy/20 to-eos-orange/20" />
          <div className="absolute inset-0 noise-texture opacity-30" />

          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <div className="max-w-3xl mx-auto glass-morphism rounded-3xl p-12 depth-shadow">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 gradient-text">
                Ready to Experience All These Features?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join hundreds of companies already using EOS AI to transform
                their business operations with comprehensive AI-powered guidance
                and tools.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="bg-eos-orange hover:bg-eos-orange/90 gap-2 shadow-glow"
                  >
                    Start Free Trial
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 glass-morphism"
                >
                  Schedule Demo
                  <Calendar className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/features" className="hover:text-foreground">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="hover:text-foreground">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Integrations
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    API
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#" className="hover:text-foreground">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Community
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Webinars
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link
                    href="/privacy-policy"
                    className="hover:text-foreground"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Security
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Compliance
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Image
                src="/images/eos-logo.png"
                alt="EOS Logo"
                width={30}
                height={30}
                className="rounded"
              />
              <span className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} EOS AI. All rights reserved.
              </span>
            </div>

            <div className="flex gap-6">
              <Link
                href="#"
                className="text-muted-foreground hover:text-foreground"
              >
                <Globe className="w-5 h-5" />
              </Link>
              <Link
                href="#"
                className="text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
