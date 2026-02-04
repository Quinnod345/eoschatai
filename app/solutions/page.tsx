import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Enterprise Solutions - Advanced AI Tools for Business Growth | EOS AI',
  description: 'Discover enterprise-grade AI solutions for deep research, content creation, and team collaboration. Nexus Research Engine, Composer Studio, and advanced analytics for scaling businesses.',
  keywords: [
    'enterprise AI solutions', 'business AI tools', 'Nexus research engine', 'AI composer studio',
    'team collaboration AI', 'enterprise analytics', 'business intelligence AI',
    'advanced AI features', 'B2B AI solutions', 'corporate AI assistant',
    'enterprise EOS tools', 'business automation platform', 'AI research tools'
  ],
  openGraph: {
    title: 'Enterprise Solutions - Advanced AI Tools for Business Growth | EOS AI',
    description: 'Discover enterprise-grade AI solutions for deep research, content creation, and team collaboration. Nexus Research Engine, Composer Studio, and advanced analytics.',
    url: 'https://eosbot.ai/solutions',
    type: 'website',
    images: [
      {
        url: '/images/og-solutions.jpg',
        width: 1200,
        height: 630,
        alt: 'EOS AI Enterprise Solutions - Advanced AI Tools for Business',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Enterprise Solutions - Advanced AI Tools for Business Growth | EOS AI',
    description: 'Discover enterprise-grade AI solutions for deep research, content creation, and team collaboration.',
    images: ['/images/twitter-solutions.jpg'],
  },
  alternates: {
    canonical: 'https://eosbot.ai/solutions',
  },
};

'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import LandingNavbar from '@/components/marketing/landing-navbar';
import LandingFooter from '@/components/marketing/landing-footer';
import Dither from '@/components/Dither';
import DotGrid from '@/components/DotGrid';
import ScrollFloat from '@/components/ScrollFloat';
import RotatingText from '@/components/RotatingText';
import Aurora from '@/components/Aurora';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Solution features data
const solutionFeatures = [
  {
    id: 'nexus',
    title: 'Nexus Deep Research Engine',
    subtitle: 'Real-Time Intelligence',
    description:
      'Access 40+ real-time sources per query. Get market analysis, competitor insights, and industry trends with automatic citation tracking and synthesis. Nexus combines web search, academic databases, and proprietary sources into comprehensive research reports.',
    longDescription:
      'Our Nexus engine revolutionizes how you gather intelligence. Whether you\'re analyzing competitors, researching market trends, or preparing for strategic planning sessions, Nexus delivers comprehensive, citation-backed research in minutes instead of hours.',
    highlights: [
      '40+ sources per query',
      'Automatic citation tracking',
      'Competitive analysis',
      'Industry trend synthesis',
      'Academic database access',
      'Real-time market data',
    ],
    useCases: [
      'Quarterly planning research',
      'Competitor SWOT analysis',
      'Market opportunity identification',
      'Industry benchmark reports',
    ],
    icon: (
      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    bgGradient: 'rgba(139, 92, 246, 0.15)',
    accentColor: '#8B5CF6',
  },
  {
    id: 'composer',
    title: 'Interactive Composer Studio',
    subtitle: 'Content Creation Powerhouse',
    description:
      'Create charts, diagrams, code, and documents in real-time. Export to PDF, DOCX, or generate EOS-specific templates like V/TOs and Scorecards. The composer integrates directly with AI for guided content creation.',
    longDescription:
      'The Composer Studio is your creative command center. From generating professional V/TO documents to creating data-driven charts and diagrams, every piece of content is AI-assisted and export-ready.',
    highlights: [
      'Real-time content generation',
      'Multiple export formats',
      'EOS template library',
      'Collaborative editing',
      'Version history',
      'Brand customization',
    ],
    useCases: [
      'V/TO document creation',
      'Scorecard generation',
      'Meeting agenda preparation',
      'Strategic planning documents',
    ],
    icon: (
      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    ),
    gradient: 'from-rose-500 via-pink-500 to-red-500',
    bgGradient: 'rgba(244, 63, 94, 0.15)',
    accentColor: '#F43F5E',
  },
  {
    id: 'collaboration',
    title: 'Team Collaboration Hub',
    subtitle: 'Enterprise Workspace',
    description:
      'Unified workspace for your entire organization. Share personas, documents, and conversations with role-based access. Google Calendar integration keeps everyone aligned on meetings and deadlines.',
    longDescription:
      'Break down silos and empower your entire leadership team with a shared AI workspace. From Integrators to department heads, everyone has access to the tools they need with appropriate permissions.',
    highlights: [
      'Role-based access control',
      'Shared persona library',
      'Google Calendar sync',
      'Team analytics dashboard',
      'Org-wide document sharing',
      'Activity audit logs',
    ],
    useCases: [
      'Leadership team alignment',
      'Cross-department collaboration',
      'Meeting preparation',
      'Knowledge sharing',
    ],
    icon: (
      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    bgGradient: 'rgba(14, 165, 233, 0.15)',
    accentColor: '#0EA5E9',
  },
];

// Solution Card Component - Full width showcase
function SolutionShowcase({
  solution,
  index,
}: {
  solution: (typeof solutionFeatures)[0];
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isReversed = index % 2 === 1;

  useEffect(() => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    const elements = card.querySelectorAll('.animate-in');

    gsap.fromTo(
      elements,
      {
        opacity: 0,
        y: 40,
        filter: 'blur(8px)',
      },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }, []);

  return (
    <section
      ref={cardRef}
      id={solution.id}
      className="relative min-h-screen py-24 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(ellipse at ${isReversed ? '80%' : '20%'} 50%, ${solution.bgGradient}, transparent 60%)`,
          }}
        />
        <DotGrid
          dotSize={2}
          gap={30}
          baseColor="rgba(255,255,255,0.05)"
          activeColor={solution.accentColor}
          proximity={120}
          shockRadius={250}
          shockStrength={6}
          resistance={700}
          returnDuration={1.6}
          speedTrigger={70}
          className="w-full h-full"
        />
      </div>

      <div className="container mx-auto px-6 lg:px-12 relative z-10">
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${
            isReversed ? 'lg:flex-row-reverse' : ''
          }`}
        >
          {/* Content Side */}
          <div className={`${isReversed ? 'lg:order-2' : 'lg:order-1'}`}>
            {/* Badge */}
            <div className="animate-in inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/10 border border-white/20 mb-8">
              <span className={`text-transparent bg-clip-text bg-gradient-to-r ${solution.gradient}`}>
                {solution.icon && <span className="w-5 h-5 block">{solution.icon}</span>}
              </span>
              <span className="font-montserrat text-sm font-semibold text-white/90">{solution.subtitle}</span>
            </div>

            {/* Title */}
            <h2 className="animate-in font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              {solution.title}
            </h2>

            {/* Description */}
            <p className="animate-in font-montserrat text-lg text-white/70 leading-relaxed mb-6">
              {solution.description}
            </p>
            <p className="animate-in font-montserrat text-base text-white/60 leading-relaxed mb-10">
              {solution.longDescription}
            </p>

            {/* Highlights Grid */}
            <div className="animate-in grid grid-cols-2 gap-4 mb-10">
              {solution.highlights.map((highlight) => (
                <div key={highlight} className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full bg-gradient-to-r ${solution.gradient} flex items-center justify-center flex-shrink-0`}
                  >
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="font-montserrat text-sm text-white/80">{highlight}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="animate-in">
              <Link href="/register">
                <Button
                  size="lg"
                  className={`font-montserrat bg-gradient-to-r ${solution.gradient} hover:opacity-90 text-white px-8 py-6 rounded-full shadow-lg`}
                >
                  Get Started with {solution.title.split(' ')[0]}
                </Button>
              </Link>
            </div>
          </div>

          {/* Visual Side */}
          <div className={`${isReversed ? 'lg:order-1' : 'lg:order-2'}`}>
            <div className="animate-in relative">
              {/* Main Visual Card */}
              <div
                className="relative aspect-square max-w-[550px] mx-auto rounded-3xl overflow-hidden border border-white/10"
                style={{ background: `linear-gradient(135deg, ${solution.bgGradient}, rgba(0,0,0,0.8))` }}
              >
                {/* Central Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`w-40 h-40 rounded-3xl bg-gradient-to-br ${solution.gradient} flex items-center justify-center shadow-2xl`}
                  >
                    <span className="text-white">{solution.icon}</span>
                  </div>
                </div>

                {/* Use Cases Cards */}
                <div className="absolute bottom-6 left-6 right-6 space-y-3">
                  {solution.useCases.slice(0, 3).map((useCase, i) => (
                    <motion.div
                      key={useCase}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="px-4 py-3 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10"
                    >
                      <span className="font-montserrat text-sm text-white/80">{useCase}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Floating Elements */}
                <motion.div
                  className="absolute top-8 right-8 w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20"
                  animate={{
                    y: [0, -15, 0],
                    rotate: [0, 8, 0],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                  }}
                />
                <motion.div
                  className="absolute top-24 left-8 w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20"
                  animate={{
                    y: [0, 12, 0],
                    rotate: [0, -6, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SolutionsPage() {
  const [mounted, setMounted] = useState(false);
  const { scrollY } = useScroll();
  const backgroundY = useTransform(scrollY, [0, 1000], ['0%', '20%']);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="relative w-full bg-black overflow-x-hidden">
      {/* Navbar */}
      <LandingNavbar />

      {/* Hero Section with Plasma Background */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Aurora Background */}
        <div className="absolute inset-0 z-0 opacity-70">
          <Aurora
            colorStops={['#8B5CF6', '#6366F1', '#0EA5E9']}
            amplitude={1.4}
            blend={0.5}
            speed={0.6}
          />
        </div>

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black z-10" />

        {/* Content */}
        <div className="relative z-20 text-center px-6 pt-32">
          <motion.div
            initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 border border-white/20 mb-8">
              <svg className="w-4 h-4 text-eos-orange" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>
              <span className="font-montserrat text-sm font-medium text-white">Enterprise Solutions</span>
            </div>
          </motion.div>

          <motion.h1
            className="font-montserrat text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
          >
            Advanced Solutions for
            <br />
            <RotatingText
              texts={['Deep Research', 'Content Creation', 'Team Collaboration', 'Enterprise Scale']}
              staggerFrom="last"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-120%' }}
              staggerDuration={0.025}
              splitLevelClassName="overflow-hidden pb-1"
              mainClassName="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 [-webkit-background-clip:text]"
              elementLevelClassName="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 [-webkit-background-clip:text]"
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 400,
              }}
              rotationInterval={3000}
            />
          </motion.h1>

          <motion.p
            className="font-montserrat text-lg md:text-xl text-white/70 max-w-3xl mx-auto mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          >
            Enterprise-grade tools designed to scale with your business. From AI-powered research to
            seamless team collaboration, transform how your organization implements EOS.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          >
            <Link href="/register">
              <Button
                size="lg"
                className="font-montserrat bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-500/90 hover:to-purple-600/90 text-white px-8 py-6 rounded-full shadow-[0_8px_32px_rgba(139,92,246,0.3)]"
              >
                Explore Solutions
              </Button>
            </Link>
            <Link href="/features">
              <Button
                size="lg"
                variant="outline"
                className="font-montserrat border-2 border-white/50 text-white hover:bg-white/20 hover:border-white/70 px-8 py-6 rounded-full backdrop-blur-md bg-white/10 shadow-[0_4px_16px_rgba(255,255,255,0.1)] hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition-all duration-300"
              >
                View All Features
              </Button>
            </Link>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            className="absolute bottom-12 left-1/2 -translate-x-1/2"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
          >
            <svg className="w-6 h-6 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.div>
        </div>
      </section>

      {/* Solutions Overview */}
      <section className="relative z-30 bg-gradient-to-b from-black via-zinc-950 to-zinc-900 py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <ScrollFloat
              animationDuration={1.2}
              ease="power3.inOut"
              scrollStart="top bottom-=10%"
              scrollEnd="center top+=5%"
              stagger={0.02}
              containerClassName="mb-4"
              textClassName="font-montserrat text-3xl md:text-4xl lg:text-5xl font-bold text-white"
            >
              Three Pillars of Success
            </ScrollFloat>
            <p className="font-montserrat text-lg text-white/60 max-w-2xl mx-auto">
              Each solution is designed to address a critical aspect of EOS implementation
            </p>
          </div>

          {/* Solution Cards Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {solutionFeatures.map((solution, index) => (
              <motion.a
                key={solution.id}
                href={`#${solution.id}`}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                className="group relative p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-500 overflow-hidden"
              >
                {/* Hover gradient */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `linear-gradient(135deg, ${solution.bgGradient}, transparent)` }}
                />

                <div className="relative z-10">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${solution.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <span className="text-white w-8 h-8">{solution.icon}</span>
                  </div>

                  <h3 className="font-montserrat text-xl font-bold text-white mb-3">{solution.title}</h3>
                  <p className="font-montserrat text-sm text-white/60 mb-6">{solution.description}</p>

                  <div className="flex items-center gap-2 text-white/50 group-hover:text-white transition-colors">
                    <span className="font-montserrat text-sm font-medium">Learn more</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* Individual Solution Showcases */}
      <div className="bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
        {solutionFeatures.map((solution, index) => (
          <SolutionShowcase key={solution.id} solution={solution} index={index} />
        ))}
      </div>

      {/* CTA Section */}
      <section className="relative z-30 py-32 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <Dither
            waveColor={[0.55, 0.36, 0.98]}
            disableAnimation={false}
            enableMouseInteraction={true}
            mouseRadius={0.4}
            colorNum={5}
            waveAmplitude={0.4}
            waveFrequency={2.5}
            waveSpeed={0.03}
          />
        </div>
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Ready to Scale Your EOS Implementation?
            </h2>
            <p className="font-montserrat text-lg md:text-xl text-white/70 max-w-3xl mx-auto mb-12">
              Get access to all three enterprise solutions and transform how your team works together.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/register">
                <Button
                  size="lg"
                  className="font-montserrat bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-500/90 hover:to-purple-600/90 text-white px-10 py-6 rounded-full shadow-[0_8px_32px_rgba(139,92,246,0.3)] font-semibold"
                >
                  Start Free Trial
                </Button>
              </Link>
              <Link href="/features">
                <Button
                  size="lg"
                  variant="outline"
                  className="font-montserrat border-2 border-white/50 text-white hover:bg-white/20 hover:border-white/70 px-10 py-6 rounded-full backdrop-blur-md bg-white/10 font-semibold shadow-[0_4px_16px_rgba(255,255,255,0.1)] hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition-all duration-300"
                >
                  Explore Features
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-white/60 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-montserrat">Enterprise-grade security</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-montserrat">Unlimited team members</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-montserrat">Priority support</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
