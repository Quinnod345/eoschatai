'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import EntranceAnimation from '@/components/EntranceAnimation';
import {
  MessageSquare,
  Lightbulb,
  FileText,
  Users,
  BarChart,
  Calendar,
  Bot,
  Brain,
  Globe,
  Sparkles,
  ChevronRight,
  CheckCircle,
  ArrowRight,
  Star,
  Zap,
  Shield,
  Target,
  TrendingUp,
  Award,
  BookOpen,
  Workflow,
  Settings
} from 'lucide-react';

export default function HomeClient() {
  const [showEntrance, setShowEntrance] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const integrationRef = useRef<HTMLDivElement>(null);


  // Function to handle animation completion
  const handleAnimationComplete = () => {
    setShowEntrance(false);
  };


  return (
    <>
      {showEntrance && (
        <EntranceAnimation onAnimationComplete={handleAnimationComplete} />
      )}
      
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background/98 to-background/95 relative overflow-hidden" ref={containerRef}>
        {/* Global noise texture */}
        <div className="noise-texture" />
        
        {/* Navigation with glassmorphism */}
        <header className="sticky top-0 z-50 glass-morphism border-b border-border/20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                <Image
                  src="/images/eosai.png"
                  alt="EOS AI Logo"
                  width={120}
                  height={40}
                  priority
                  className="object-contain"
                />
              </div>
              <nav className="hidden md:flex items-center gap-8">
                <Link href="#features" className="text-sm font-medium hover:text-eos-orange transition-all duration-300 hover:scale-105">
                  Features
                </Link>
                <Link href="#benefits" className="text-sm font-medium hover:text-eos-orange transition-all duration-300 hover:scale-105">
                  Benefits
                </Link>
                <Link href="#how-it-works" className="text-sm font-medium hover:text-eos-orange transition-all duration-300 hover:scale-105">
                  How It Works
                </Link>
                <Link href="#pricing" className="text-sm font-medium hover:text-eos-orange transition-all duration-300 hover:scale-105">
                  Pricing
                </Link>
              </nav>
              <div className="flex items-center gap-4">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="hidden md:inline-flex glass-button">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-eos-orange hover:bg-eos-orange/90 shadow-glow">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1">
          {/* Hero Section with enhanced visuals */}
          <section className="relative overflow-hidden py-20 md:py-32" ref={heroRef}>
            <div className="parallax-bg absolute inset-0 -z-10">
              <div className="absolute top-20 left-10 w-72 h-72 bg-eos-orange/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-20 right-10 w-96 h-96 bg-eos-navy/20 rounded-full blur-3xl animate-pulse animation-delay-2000" />
              <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-gradient-radial from-eos-orange/10 to-transparent rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />
            </div>
            
            <div className="container mx-auto px-4 md:px-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-morphism text-eos-orange text-sm font-medium shadow-glow-sm">
                    <Sparkles className="w-4 h-4" />
                    Powered by Advanced AI
                  </div>
                  
                  <h1 className="hero-title text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight blur-text">
                    Your AI Assistant for{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-eos-orange to-eos-orange/70">
                      EOS Implementation
                    </span>
                  </h1>
                  
                  <p className="hero-subtitle text-lg md:text-xl text-muted-foreground max-w-lg blur-text">
                    Transform your business with AI-powered guidance on the Entrepreneurial Operating System. 
                    Get instant answers, automate processes, and achieve better results.
                  </p>
                  
                  <div className="hero-buttons flex flex-col sm:flex-row gap-4">
                    <Link href="/register">
                      <Button size="lg" className="bg-eos-orange hover:bg-eos-orange/90 gap-2 shadow-glow group">
                        Start Free Trial
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                    <Button size="lg" variant="outline" className="gap-2 glass-button group">
                      Watch Demo
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-8 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      No credit card required
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      14-day free trial
                    </div>
                  </div>
                </div>
                
                <div className="hero-image relative" style={{ opacity: 1 }}>
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-border/50 glass-morphism-dark bg-muted/50">
                    <Image
                      src="/images/chatexample.png"
                      alt="EOS AI Chat Interface"
                      fill
                      className="object-cover"
                      priority
                      style={{ opacity: 1 }}
                      onError={() => console.log('Hero image failed to load')}
                      onLoad={() => console.log('Hero image loaded successfully')}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                  </div>
                  
                  {/* Floating elements with glass morphism */}
                  <div className="floating-element absolute -top-4 -right-4 glass-morphism rounded-lg shadow-xl p-3 animate-float">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-eos-orange" />
                      <span className="text-sm font-medium">AI Assistant</span>
                    </div>
                  </div>
                  
                  <div className="floating-element absolute -bottom-4 -left-4 glass-morphism rounded-lg shadow-xl p-3 animate-float-delayed">
                    <div className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-eos-navy dark:text-eos-orange" />
                      <span className="text-sm font-medium">Smart Analysis</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Stats Section with glass morphism */}
          <section className="py-16 relative" ref={statsRef}>
            <div className="absolute inset-0 bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30" />
            <div className="container mx-auto px-4 md:px-6 relative z-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="stat-item text-center glass-morphism rounded-xl p-6 shadow-lg">
                  <div className="stat-number text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-eos-orange to-eos-orange/70 mb-2">
                    500+
                  </div>
                  <p className="text-sm text-muted-foreground">Companies Using EOS AI</p>
                </div>
                <div className="stat-item text-center glass-morphism rounded-xl p-6 shadow-lg">
                  <div className="stat-number text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-eos-orange to-eos-orange/70 mb-2">
                    10,000+
                  </div>
                  <p className="text-sm text-muted-foreground">Hours Saved Monthly</p>
                </div>
                <div className="stat-item text-center glass-morphism rounded-xl p-6 shadow-lg">
                  <div className="stat-number text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-eos-orange to-eos-orange/70 mb-2">
                    95%
                  </div>
                  <p className="text-sm text-muted-foreground">% User Satisfaction</p>
                </div>
                <div className="stat-item text-center glass-morphism rounded-xl p-6 shadow-lg">
                  <div className="stat-number text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-eos-orange to-eos-orange/70 mb-2">
                    24/7
                  </div>
                  <p className="text-sm text-muted-foreground">Support Available</p>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section with enhanced cards */}
          <section id="features" className="py-20 md:py-32" ref={featuresRef}>
            <div className="container mx-auto px-4 md:px-6">
              <div className="text-center mb-16">
                <h2 className="section-title text-3xl md:text-4xl font-bold mb-4 blur-text">
                  Everything You Need for EOS Success
                </h2>
                <p className="section-subtitle text-lg text-muted-foreground max-w-2xl mx-auto blur-text">
                  Our AI assistant provides comprehensive tools and guidance to help you implement 
                  and master the Entrepreneurial Operating System.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Feature cards with glass morphism */}
                <div className="feature-card glass-morphism rounded-2xl p-8 hover:shadow-2xl transition-all duration-500 group depth-shadow">
                  <div className="absolute inset-0 bg-gradient-to-br from-eos-orange/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex p-3 rounded-lg bg-eos-orange/10 text-eos-orange shadow-glow-sm">
                      <Lightbulb className="w-6 h-6" />
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-2">EOS Expertise</h3>
                    <p className="text-muted-foreground mb-4">
                      Deep knowledge of all Six Key Components® and EOS Tools® to guide your implementation.
                    </p>
                    
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Vision/Traction Organizer™
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Accountability Chart™
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Scorecard & Rocks
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="feature-card glass-morphism rounded-2xl p-8 hover:shadow-2xl transition-all duration-500 group depth-shadow">
                  <div className="absolute inset-0 bg-gradient-to-br from-eos-navy/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex p-3 rounded-lg bg-eos-navy/10 text-eos-navy dark:text-eos-orange shadow-glow-sm">
                      <FileText className="w-6 h-6" />
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-2">Smart Documents</h3>
                    <p className="text-muted-foreground mb-4">
                      Automatically generate and maintain all your EOS documents with AI precision.
                    </p>
                    
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Meeting agendas
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Issue tracking
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Progress reports
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="feature-card glass-morphism rounded-2xl p-8 hover:shadow-2xl transition-all duration-500 group depth-shadow">
                  <div className="absolute inset-0 bg-gradient-to-br from-eos-orange/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex p-3 rounded-lg bg-eos-orange/10 text-eos-orange shadow-glow-sm">
                      <Brain className="w-6 h-6" />
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-2">Personalized AI</h3>
                    <p className="text-muted-foreground mb-4">
                      AI that learns your company&apos;s unique context and provides tailored guidance.
                    </p>
                    
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Company memory
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Custom workflows
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Team insights
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="feature-card glass-morphism rounded-2xl p-8 hover:shadow-2xl transition-all duration-500 group depth-shadow">
                  <div className="absolute inset-0 bg-gradient-to-br from-eos-navy/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex p-3 rounded-lg bg-eos-navy/10 text-eos-navy dark:text-eos-orange shadow-glow-sm">
                      <Calendar className="w-6 h-6" />
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-2">Calendar Integration</h3>
                    <p className="text-muted-foreground mb-4">
                      Sync with Google Calendar for meeting prep and intelligent scheduling.
                    </p>
                    
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Meeting prep
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Auto reminders
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Smart scheduling
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="feature-card glass-morphism rounded-2xl p-8 hover:shadow-2xl transition-all duration-500 group depth-shadow">
                  <div className="absolute inset-0 bg-gradient-to-br from-eos-orange/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex p-3 rounded-lg bg-eos-orange/10 text-eos-orange shadow-glow-sm">
                      <BarChart className="w-6 h-6" />
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-2">Analytics & Insights</h3>
                    <p className="text-muted-foreground mb-4">
                      Track progress and get AI-powered insights to optimize your EOS implementation.
                    </p>
                    
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Performance metrics
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Trend analysis
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Predictive insights
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="feature-card glass-morphism rounded-2xl p-8 hover:shadow-2xl transition-all duration-500 group depth-shadow">
                  <div className="absolute inset-0 bg-gradient-to-br from-eos-navy/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex p-3 rounded-lg bg-eos-navy/10 text-eos-navy dark:text-eos-orange shadow-glow-sm">
                      <Users className="w-6 h-6" />
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-2">Team Collaboration</h3>
                    <p className="text-muted-foreground mb-4">
                      Break down silos and improve communication with shared AI assistance.
                    </p>
                    
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Shared knowledge
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Team alignment
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Role clarity
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Benefits Section - New */}
          <section id="benefits" className="py-20 md:py-32 relative" ref={benefitsRef}>
            <div className="parallax-bg absolute inset-0 -z-10">
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-eos-orange/10 rounded-full blur-3xl" />
              <div className="absolute top-0 right-0 w-72 h-72 bg-eos-navy/10 rounded-full blur-3xl" />
            </div>
            
            <div className="container mx-auto px-4 md:px-6">
              <div className="text-center mb-16">
                <h2 className="section-title text-3xl md:text-4xl font-bold mb-4 blur-text">
                  Transform Your Business with EOS AI
                </h2>
                <p className="section-subtitle text-lg text-muted-foreground max-w-2xl mx-auto blur-text">
                  Experience the power of AI-driven implementation and see measurable results in weeks, not months.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="benefit-card glass-morphism rounded-2xl p-8 text-center depth-shadow">
                  <div className="mb-4 inline-flex p-4 rounded-full bg-gradient-to-br from-eos-orange/20 to-eos-orange/10 shadow-glow">
                    <Zap className="w-8 h-8 text-eos-orange" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">10x Faster Implementation</h3>
                  <p className="text-muted-foreground">
                    Accelerate your EOS journey with AI that guides you through every step, reducing implementation time by 90%.
                  </p>
                </div>

                <div className="benefit-card glass-morphism rounded-2xl p-8 text-center depth-shadow">
                  <div className="mb-4 inline-flex p-4 rounded-full bg-gradient-to-br from-eos-navy/20 to-eos-navy/10 shadow-glow">
                    <Target className="w-8 h-8 text-eos-navy dark:text-eos-orange" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Perfect Alignment</h3>
                  <p className="text-muted-foreground">
                    Keep your entire team aligned with real-time updates, automated reminders, and crystal-clear accountability.
                  </p>
                </div>

                <div className="benefit-card glass-morphism rounded-2xl p-8 text-center depth-shadow">
                  <div className="mb-4 inline-flex p-4 rounded-full bg-gradient-to-br from-eos-orange/20 to-eos-orange/10 shadow-glow">
                    <TrendingUp className="w-8 h-8 text-eos-orange" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Measurable Growth</h3>
                  <p className="text-muted-foreground">
                    Track your progress with advanced analytics and see tangible improvements in productivity and profitability.
                  </p>
                </div>

                <div className="benefit-card glass-morphism rounded-2xl p-8 text-center depth-shadow">
                  <div className="mb-4 inline-flex p-4 rounded-full bg-gradient-to-br from-eos-navy/20 to-eos-navy/10 shadow-glow">
                    <Shield className="w-8 h-8 text-eos-navy dark:text-eos-orange" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Risk-Free Decisions</h3>
                  <p className="text-muted-foreground">
                    Make confident decisions with AI-powered insights that analyze patterns and predict outcomes.
                  </p>
                </div>

                <div className="benefit-card glass-morphism rounded-2xl p-8 text-center depth-shadow">
                  <div className="mb-4 inline-flex p-4 rounded-full bg-gradient-to-br from-eos-orange/20 to-eos-orange/10 shadow-glow">
                    <Award className="w-8 h-8 text-eos-orange" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Expert Guidance 24/7</h3>
                  <p className="text-muted-foreground">
                    Access decades of EOS expertise anytime, anywhere, with an AI assistant that never sleeps.
                  </p>
                </div>

                <div className="benefit-card glass-morphism rounded-2xl p-8 text-center depth-shadow">
                  <div className="mb-4 inline-flex p-4 rounded-full bg-gradient-to-br from-eos-navy/20 to-eos-navy/10 shadow-glow">
                    <BookOpen className="w-8 h-8 text-eos-navy dark:text-eos-orange" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Continuous Learning</h3>
                  <p className="text-muted-foreground">
                    Stay ahead with an AI that learns from your business and evolves with your needs.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Integration Section - New */}
          <section className="py-20 md:py-32 bg-gradient-to-b from-background to-muted/30" ref={integrationRef}>
            <div className="container mx-auto px-4 md:px-6">
              <div className="text-center mb-16">
                <h2 className="section-title text-3xl md:text-4xl font-bold mb-4 blur-text">
                  Seamlessly Integrates with Your Workflow
                </h2>
                <p className="section-subtitle text-lg text-muted-foreground max-w-2xl mx-auto blur-text">
                  Connect EOS AI with your favorite tools and platforms for a unified experience.
                </p>
              </div>

              <div className="flex flex-wrap justify-center items-center gap-8">
                <div className="integration-item glass-morphism rounded-2xl p-6 w-32 h-32 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
                  <Calendar className="w-12 h-12 text-muted-foreground" />
                </div>
                <div className="integration-item glass-morphism rounded-2xl p-6 w-32 h-32 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
                  <FileText className="w-12 h-12 text-muted-foreground" />
                </div>
                <div className="integration-item glass-morphism rounded-2xl p-6 w-32 h-32 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
                  <BarChart className="w-12 h-12 text-muted-foreground" />
                </div>
                <div className="integration-item glass-morphism rounded-2xl p-6 w-32 h-32 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
                  <Users className="w-12 h-12 text-muted-foreground" />
                </div>
                <div className="integration-item glass-morphism rounded-2xl p-6 w-32 h-32 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
                  <Workflow className="w-12 h-12 text-muted-foreground" />
                </div>
                <div className="integration-item glass-morphism rounded-2xl p-6 w-32 h-32 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
                  <Settings className="w-12 h-12 text-muted-foreground" />
                </div>
              </div>

              <div className="mt-12 text-center">
                <p className="text-muted-foreground mb-4">And many more integrations coming soon...</p>
                <Button variant="outline" className="glass-button">
                  View All Integrations
                </Button>
              </div>
            </div>
          </section>

          {/* How It Works Section with enhanced styling */}
          <section id="how-it-works" className="py-20 md:py-32 relative" ref={howItWorksRef}>
            <div className="container mx-auto px-4 md:px-6">
              <div className="text-center mb-16">
                <h2 className="section-title text-3xl md:text-4xl font-bold mb-4 blur-text">
                  Get Started in Minutes
                </h2>
                <p className="section-subtitle text-lg text-muted-foreground max-w-2xl mx-auto blur-text">
                  Our simple onboarding process gets you up and running with AI-powered EOS guidance quickly.
                </p>
              </div>

              <div className="max-w-4xl mx-auto">
                <div className="space-y-12">
                  <div className="step-item flex gap-8 items-center">
                    <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-eos-orange to-eos-orange/70 flex items-center justify-center shadow-glow">
                      <span className="text-2xl font-bold text-white">1</span>
                    </div>
                    <div className="flex-1 glass-morphism rounded-2xl p-6">
                      <h3 className="text-xl font-semibold mb-2">Create Your Account</h3>
                      <p className="text-muted-foreground">
                        Sign up in seconds and tell us about your company and EOS journey.
                      </p>
                    </div>
                    <div className="hidden md:block flex-shrink-0">
                      <div className="w-48 h-32 rounded-lg glass-morphism flex items-center justify-center">
                        <MessageSquare className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                    </div>
                  </div>

                  <div className="step-item flex gap-8 items-center">
                    <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-eos-orange to-eos-orange/70 flex items-center justify-center shadow-glow">
                      <span className="text-2xl font-bold text-white">2</span>
                    </div>
                    <div className="flex-1 glass-morphism rounded-2xl p-6">
                      <h3 className="text-xl font-semibold mb-2">Upload Your Documents</h3>
                      <p className="text-muted-foreground">
                        Import your existing EOS documents for personalized AI assistance.
                      </p>
                    </div>
                    <div className="hidden md:block flex-shrink-0">
                      <div className="w-48 h-32 rounded-lg glass-morphism flex items-center justify-center">
                        <FileText className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                    </div>
                  </div>

                  <div className="step-item flex gap-8 items-center">
                    <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-eos-orange to-eos-orange/70 flex items-center justify-center shadow-glow">
                      <span className="text-2xl font-bold text-white">3</span>
                    </div>
                    <div className="flex-1 glass-morphism rounded-2xl p-6">
                      <h3 className="text-xl font-semibold mb-2">Start Getting Answers</h3>
                      <p className="text-muted-foreground">
                        Ask questions and get instant, expert guidance on your EOS implementation.
                      </p>
                    </div>
                    <div className="hidden md:block flex-shrink-0">
                      <div className="w-48 h-32 rounded-lg glass-morphism flex items-center justify-center">
                        <Sparkles className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Testimonials Section with glass morphism */}
          <section className="py-20 md:py-32 bg-gradient-to-b from-muted/30 to-background" ref={testimonialsRef}>
            <div className="container mx-auto px-4 md:px-6">
              <div className="text-center mb-16">
                <h2 className="section-title text-3xl md:text-4xl font-bold mb-4 blur-text">
                  Trusted by EOS Companies Worldwide
                </h2>
                <p className="section-subtitle text-lg text-muted-foreground max-w-2xl mx-auto blur-text">
                  See how companies are transforming their EOS implementation with AI assistance.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="testimonial-card glass-morphism rounded-2xl p-6 depth-shadow">
                  <div className="flex gap-1 mb-4">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  </div>
                  <p className="text-muted-foreground mb-4 italic">
                    &quot;EOS AI has transformed how we run our Level 10 meetings. The AI prepares agendas, 
                    tracks our Rocks, and gives us insights we never had before.&quot;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-eos-orange/20 to-eos-orange/10" />
                    <div>
                      <p className="font-medium">Sarah Johnson</p>
                      <p className="text-sm text-muted-foreground">CEO, TechCorp</p>
                    </div>
                  </div>
                </div>

                <div className="testimonial-card glass-morphism rounded-2xl p-6 depth-shadow">
                  <div className="flex gap-1 mb-4">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  </div>
                  <p className="text-muted-foreground mb-4 italic">
                    &quot;The personalized guidance is incredible. It&apos;s like having an EOS Implementer 
                    available 24/7 who knows our company inside and out.&quot;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-eos-navy/20 to-eos-navy/10" />
                    <div>
                      <p className="font-medium">Mike Chen</p>
                      <p className="text-sm text-muted-foreground">COO, Growth Inc</p>
                    </div>
                  </div>
                </div>

                <div className="testimonial-card glass-morphism rounded-2xl p-6 depth-shadow">
                  <div className="flex gap-1 mb-4">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  </div>
                  <p className="text-muted-foreground mb-4 italic">
                    &quot;We&apos;ve cut our meeting prep time by 80% and our team is more aligned than ever. 
                    EOS AI is a game-changer for any company serious about EOS.&quot;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-eos-orange/20 to-eos-orange/10" />
                    <div>
                      <p className="font-medium">Lisa Park</p>
                      <p className="text-sm text-muted-foreground">VP Operations, Scale Up</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section with enhanced styling */}
          <section className="py-20 md:py-32 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-eos-orange/20 via-eos-navy/20 to-eos-orange/20" />
            <div className="absolute inset-0 noise-texture opacity-30" />
            
            <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 blur-text">
                Ready to Transform Your EOS Implementation?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 blur-text">
                Join hundreds of companies using AI to achieve better results with EOS. 
                Start your free trial today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button size="lg" className="bg-eos-orange hover:bg-eos-orange/90 gap-2 shadow-glow group">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="gap-2 glass-button group">
                  Schedule Demo
                  <Calendar className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </Button>
              </div>
            </div>
          </section>
        </main>

        {/* Footer with glass morphism */}
        <footer className="border-t border-border/20 py-12 glass-morphism">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              <div>
                <h3 className="font-semibold mb-4">Product</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="#features" className="hover:text-foreground transition-colors">Features</Link></li>
                  <li><Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">Integrations</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">API</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Company</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">Blog</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">Careers</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">Contact</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Resources</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="#" className="hover:text-foreground transition-colors">Documentation</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">Help Center</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">Community</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">Webinars</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Legal</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">Security</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">Compliance</Link></li>
                </ul>
              </div>
            </div>
            
            <div className="border-t border-border/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
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
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Globe className="w-5 h-5" />
                </Link>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <MessageSquare className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        /* Noise texture */
        .noise-texture {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0.02;
          z-index: 1;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        .noise-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0.03;
          z-index: 50;
          pointer-events: none;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        /* Glass morphism */
        .glass-morphism {
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          background: rgba(var(--background), 0.7);
          border: 1px solid rgba(var(--border), 0.2);
        }

        .glass-morphism-dark {
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .glass-button {
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          background: rgba(var(--background), 0.5);
          border: 1px solid rgba(var(--border), 0.3);
          transition: all 0.3s ease;
        }

        .glass-button:hover {
          background: rgba(var(--background), 0.7);
          border: 1px solid rgba(var(--border), 0.5);
          transform: translateY(-1px);
        }

        /* Shadows */
        .shadow-glow {
          box-shadow: 0 0 20px rgba(242, 99, 34, 0.3),
                      0 4px 16px rgba(0, 0, 0, 0.1);
        }

        .shadow-glow-sm {
          box-shadow: 0 0 10px rgba(242, 99, 34, 0.2),
                      0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .depth-shadow {
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.2),
                      0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        /* Animations */
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }

        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-1deg); }
        }

        .animate-float {
          animation: float 4s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 4s ease-in-out infinite;
          animation-delay: 0.5s;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        /* Gradient backgrounds */
        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }

        /* Ensure all hero elements are immediately visible */
        .hero-title,
        .hero-subtitle,
        .hero-buttons,
        .hero-image,
        .floating-element {
          opacity: 1 !important;
          visibility: visible !important;
        }
        
        .hero-image img {
          opacity: 1 !important;
          visibility: visible !important;
        }
        
        /* Ensure all text elements are always visible */
        .blur-text {
          opacity: 1 !important;
          transition: opacity 0.3s ease;
        }

        /* Perspective for 3D effects */
        #features {
          perspective: 1000px;
        }
        
        /* Force visibility of important content */
        .feature-card, .benefit-card, .testimonial-card, .stat-item {
          min-height: 1px; /* Ensure elements take space */
        }
        
        /* Fallback for any hidden elements */
        .section-title, .section-subtitle, .feature-card, .benefit-card {
          visibility: visible !important;
        }
      `}</style>
    </>
  );
}