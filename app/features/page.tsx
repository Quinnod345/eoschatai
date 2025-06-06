'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  FileText,
  Users,
  BarChart,
  Calendar,
  Bot,
  Brain,
  Globe,
  Sparkles,
  ArrowRight,
  Shield,
  Target,
  Search,
  Download,
  Upload,
  Mic,
  Eye,
  Layers,
  Database,
  Lock,
  RefreshCw,
  Activity,
  Filter,
  GitBranch,
  CheckSquare,
  Hash,
  Settings,
  MousePointer,
  Keyboard,
  Languages,
  Moon,
  Palette,
  Type,
  Award,
  BookOpen,
  Workflow,
} from 'lucide-react';

const featureCategories = [
  {
    id: 'core-chat',
    title: 'Advanced AI Chat Interface',
    description:
      'Real-time AI responses with comprehensive conversation management',
    color: 'from-eos-orange to-eos-orangeLight',
    features: [
      {
        icon: MessageSquare,
        title: 'Streaming Responses',
        description: 'Real-time AI responses with token streaming',
      },
      {
        icon: RefreshCw,
        title: 'Multi-turn Conversations',
        description: 'Context-aware conversations with message history',
      },
      {
        icon: Settings,
        title: 'Message Actions',
        description: 'Copy, edit, regenerate, pin, and bookmark messages',
      },
      {
        icon: Sparkles,
        title: 'Smart Suggestions',
        description: 'Context-aware follow-up suggestions',
      },
      {
        icon: Keyboard,
        title: 'Keyboard Shortcuts',
        description: 'Comprehensive keyboard navigation (Cmd+K for search)',
      },
      {
        icon: Mic,
        title: 'Voice Input',
        description: 'Speech-to-text capabilities for hands-free interaction',
      },
      {
        icon: Upload,
        title: 'File Attachments',
        description: 'Upload images, PDFs, and documents for AI analysis',
      },
    ],
  },
  {
    id: 'ai-models',
    title: 'Multiple AI Model Support',
    description:
      'Leverage the best AI models with dynamic switching capabilities',
    color: 'from-eos-navy to-eos-navyLight',
    features: [
      {
        icon: Bot,
        title: 'OpenAI Integration',
        description: 'Advanced AI provider using the latest GPT models',
      },
      {
        icon: Brain,
        title: 'OpenAI Models',
        description: 'GPT-4, GPT-3.5-turbo support with seamless switching',
      },
      {
        icon: GitBranch,
        title: 'Provider Switching',
        description: 'Dynamic model selection per conversation',
      },
      {
        icon: Target,
        title: 'Custom System Prompts',
        description: 'Tailored prompts optimized for EOS expertise',
      },
    ],
  },
  {
    id: 'artifacts',
    title: 'Rich Artifact System',
    description:
      'Create and manipulate various content types with AI assistance',
    color: 'from-eos-orange to-eos-orangeLight',
    features: [
      {
        icon: FileText,
        title: 'Code Artifacts',
        description: 'Syntax-highlighted code with multiple language support',
      },
      {
        icon: BarChart,
        title: 'Chart Generation',
        description: 'Interactive charts using Chart.js with real-time data',
      },
      {
        icon: Layers,
        title: 'Spreadsheet Creation',
        description:
          'Excel-like spreadsheets with formulas and data manipulation',
      },
      {
        icon: BookOpen,
        title: 'Text Documents',
        description: 'Rich text editing with markdown support and formatting',
      },
      {
        icon: Eye,
        title: 'Image Handling',
        description: 'Image upload, preview, and advanced editing capabilities',
      },
    ],
  },
  {
    id: 'eos-specific',
    title: 'EOS-Specific Features',
    description: 'Specialized tools designed for EOS implementation success',
    color: 'from-eos-navy to-eos-navyLight',
    features: [
      {
        icon: Award,
        title: 'EOS Implementer Personas',
        description:
          'Pre-configured expert personas for different EOS components',
      },
      {
        icon: Target,
        title: 'Custom Instructions',
        description: 'Each persona has specialized knowledge and context',
      },
      {
        icon: Database,
        title: 'Document Context',
        description:
          'Personas access relevant EOS documents and best practices',
      },
      {
        icon: Workflow,
        title: 'Category Organization',
        description: 'Organized by Scorecard, VTO, Rocks, and Core Process',
      },
      {
        icon: CheckSquare,
        title: 'File Support',
        description: 'PDF, DOCX, TXT with automatic content extraction',
      },
      {
        icon: Activity,
        title: 'Version Control',
        description: 'Track document updates and changes over time',
      },
    ],
  },
  {
    id: 'knowledge-base',
    title: 'Knowledge Base Integration',
    description: 'Intelligent information retrieval and management system',
    color: 'from-eos-orange to-eos-orangeLight',
    features: [
      {
        icon: Search,
        title: 'Vector Search',
        description:
          'Semantic search across all documents with AI-powered relevance',
      },
      {
        icon: Brain,
        title: 'Contextual Retrieval',
        description:
          'AI automatically pulls relevant information for responses',
      },
      {
        icon: Hash,
        title: 'Namespace Isolation',
        description:
          'Separate knowledge bases for different contexts and teams',
      },
      {
        icon: Shield,
        title: 'Fallback Systems',
        description: 'PostgreSQL pgvector as backup to Upstash for reliability',
      },
    ],
  },
  {
    id: 'rag',
    title: 'Retrieval-Augmented Generation',
    description: 'Advanced document processing and knowledge extraction',
    color: 'from-eos-navy to-eos-navyLight',
    features: [
      {
        icon: Layers,
        title: 'Document Chunking',
        description: 'Intelligent text segmentation for optimal processing',
      },
      {
        icon: Sparkles,
        title: 'Embedding Generation',
        description:
          'OpenAI embeddings (1536 dimensions) for semantic understanding',
      },
      {
        icon: Database,
        title: 'Vector Storage',
        description:
          'Dual storage in Upstash Vector and PostgreSQL for redundancy',
      },
      {
        icon: Search,
        title: 'Semantic Search',
        description: 'Find relevant content across all documents intelligently',
      },
    ],
  },
  {
    id: 'personalization',
    title: 'User Profiles & Personalization',
    description: 'Tailored experience for every user and organization',
    color: 'from-eos-orange to-eos-orangeLight',
    features: [
      {
        icon: Globe,
        title: 'Company Context',
        description: 'Store company name, type, and detailed description',
      },
      {
        icon: Eye,
        title: 'Profile Pictures',
        description: 'Custom avatars with advanced image cropping tools',
      },
      {
        icon: Type,
        title: 'Display Names',
        description: 'Personalized user identification and branding',
      },
      {
        icon: Languages,
        title: 'Language Preferences',
        description: 'Multi-language support for global teams',
      },
      {
        icon: Palette,
        title: 'UI Customization',
        description: 'Font size, theme preferences, and interface density',
      },
    ],
  },
  {
    id: 'authentication',
    title: 'Authentication & Security',
    description: 'Enterprise-grade security and access control',
    color: 'from-eos-navy to-eos-navyLight',
    features: [
      {
        icon: Globe,
        title: 'Google OAuth',
        description: 'Seamless single sign-on with Google Workspace',
      },
      {
        icon: Lock,
        title: 'Email/Password Auth',
        description: 'Traditional authentication with secure password handling',
      },
      {
        icon: Users,
        title: 'Guest Access',
        description: 'Limited features for trial users and demonstrations',
      },
      {
        icon: Shield,
        title: 'Role-based Access',
        description: 'Guest, regular, and premium user tiers with permissions',
      },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar Integration',
    description: 'Seamless integration with your scheduling workflow',
    color: 'from-eos-orange to-eos-orangeLight',
    features: [
      {
        icon: Calendar,
        title: 'Google Calendar Sync',
        description:
          'Connect and sync with Google Calendar for comprehensive scheduling',
      },
      {
        icon: Settings,
        title: 'Event Management',
        description:
          'View and manage calendar events directly from the interface',
      },
      {
        icon: MessageSquare,
        title: 'Meeting Context',
        description:
          'Pull meeting information into conversations for better context',
      },
      {
        icon: BookOpen,
        title: 'Calendar Briefings',
        description: 'AI-generated daily and weekly summaries of your schedule',
      },
    ],
  },
  {
    id: 'ui-ux',
    title: 'Modern User Interface',
    description: 'Beautiful, responsive, and accessible design',
    color: 'from-eos-navy to-eos-navyLight',
    features: [
      {
        icon: MousePointer,
        title: 'Responsive Design',
        description: 'Optimized for mobile, tablet, and desktop devices',
      },
      {
        icon: Moon,
        title: 'Dark/Light Themes',
        description: 'System-aware theme switching with custom preferences',
      },
      {
        icon: Sparkles,
        title: 'Smooth Animations',
        description: 'Smooth animations for delightful interactions',
      },
      {
        icon: Activity,
        title: 'Loading States',
        description: 'Skeleton screens and progress indicators for better UX',
      },
    ],
  },
  {
    id: 'search',
    title: 'Enhanced Search',
    description: 'Powerful search capabilities across all content',
    color: 'from-eos-orange to-eos-orangeLight',
    features: [
      {
        icon: Search,
        title: 'Advanced Search Modal',
        description:
          'Full-text search across conversations with powerful filters',
      },
      {
        icon: Filter,
        title: 'Filter Options',
        description: 'Date ranges, message types, personas, and custom filters',
      },
      {
        icon: Sparkles,
        title: 'Search Suggestions',
        description: 'Auto-complete and recent searches for faster navigation',
      },
      {
        icon: Target,
        title: 'Fuzzy Matching',
        description: 'Find content even with typos and partial matches',
      },
    ],
  },
  {
    id: 'collaboration',
    title: 'Collaboration Features',
    description: 'Work together seamlessly across teams',
    color: 'from-eos-navy to-eos-navyLight',
    features: [
      {
        icon: Eye,
        title: 'Chat Sharing',
        description: 'Public/private visibility settings for conversations',
      },
      {
        icon: BookOpen,
        title: 'Bookmarks',
        description: 'Save important conversations for easy access',
      },
      {
        icon: Target,
        title: 'Pinned Messages',
        description: 'Highlight key information within conversations',
      },
      {
        icon: Download,
        title: 'Export Options',
        description: 'Download conversations and artifacts in multiple formats',
      },
    ],
  },
];

export default function FeaturesPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

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
                Complete Feature Overview
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Everything You Need for{' '}
                <span className="gradient-text">EOS Success</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                Discover the comprehensive suite of AI-powered tools and
                features designed specifically for Entrepreneurial Operating
                System implementation and mastery.
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

        {/* Feature Categories */}
        {featureCategories.map((category, categoryIndex) => (
          <section
            key={category.id}
            className="py-16 md:py-20 relative overflow-hidden"
          >
            {categoryIndex % 2 === 1 && (
              <div className="absolute inset-0 bg-muted/30" />
            )}

            <div className="container mx-auto px-4 md:px-6 relative z-10">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 gradient-text">
                  {category.title}
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  {category.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.features.map((feature, featureIndex) => {
                  const IconComponent = feature.icon;
                  return (
                    <div
                      key={`${category.id}-feature-${featureIndex}`}
                      className="glass-morphism rounded-2xl p-6 depth-shadow card-3d group hover:shadow-glow-sm transition-all duration-300"
                    >
                      <div
                        className={`mb-4 inline-flex p-3 rounded-lg bg-gradient-to-r ${category.color} text-white group-hover:scale-110 transition-transform duration-300`}
                      >
                        <IconComponent className="w-6 h-6" />
                      </div>

                      <h3 className="text-lg font-semibold mb-2 group-hover:text-eos-orange transition-colors duration-300">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}

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
