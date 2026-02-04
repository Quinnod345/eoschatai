'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import LandingNavbar from '@/components/marketing/landing-navbar';
import LandingFooter from '@/components/marketing/landing-footer';
import GradientBlinds from '@/components/GradientBlinds';
import { LazyAurora as Aurora } from '@/components/lazy-components';
import { LazyDither as Dither } from '@/components/lazy-components';
import ScrollFloat from '@/components/ScrollFloat';
import RotatingText from '@/components/RotatingText';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Comprehensive feature categories
const featureCategories = [
  {
    id: 'ai-chat',
    title: 'AI Chat & Conversation',
    subtitle: 'Intelligent Conversations',
    description: 'Engage with advanced AI assistants trained on EOS methodology for instant guidance and support.',
    gradient: 'from-eos-orange via-orange-500 to-amber-500',
    bgGradient: 'rgba(255, 121, 0, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    features: [
      { name: 'Multi-Model AI Chat', description: 'Choose between GPT-4, GPT-4o, Claude 3.5, and other leading AI models' },
      { name: 'Streaming Responses', description: 'Real-time streaming with typing indicators for natural conversation flow' },
      { name: 'Conversation Memory', description: 'AI remembers context across conversations for personalized assistance' },
      { name: 'Context Retention', description: 'Maintains conversation history and references previous discussions' },
      { name: 'Predictive Suggestions', description: 'Smart autocomplete and suggested prompts based on your usage patterns' },
      { name: 'Message Search', description: 'Search through your conversation history to find past discussions' },
    ],
  },
  {
    id: 'document-intelligence',
    title: 'Document Intelligence & RAG',
    subtitle: 'Knowledge Base',
    description: 'Transform your business documents into an intelligent knowledge base with advanced retrieval-augmented generation.',
    gradient: 'from-blue-500 via-indigo-500 to-purple-500',
    bgGradient: 'rgba(59, 130, 246, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    features: [
      { name: 'Document Upload', description: 'Support for PDF, DOCX, TXT, MD, and more file formats' },
      { name: 'Smart Chunking', description: 'Intelligent document splitting for optimal retrieval accuracy' },
      { name: 'Vector Embeddings', description: 'Advanced embedding using OpenAI text-embedding-3-small model' },
      { name: 'Semantic Search', description: 'Find relevant content based on meaning, not just keywords' },
      { name: 'Context-Aware Responses', description: 'AI responses grounded in your actual business documents' },
      { name: 'Document Versioning', description: 'Track changes and maintain history of document updates' },
      { name: 'Bulk Upload', description: 'Upload multiple documents at once with progress tracking' },
      { name: 'Document Analytics', description: 'See which documents are most referenced and useful' },
      { name: 'Category Organization', description: 'Organize documents by type: V/TO, Scorecards, Process docs, etc.' },
    ],
  },
  {
    id: 'personas',
    title: 'Custom AI Personas',
    subtitle: 'Role-Based AI',
    description: 'Create specialized AI assistants tailored to specific EOS roles, each with unique knowledge and personality.',
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    bgGradient: 'rgba(16, 185, 129, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    features: [
      { name: 'Pre-Built EOS Personas', description: 'Ready-to-use personas for Implementers, Integrators, and Visionaries' },
      { name: 'Custom Persona Creation', description: 'Build your own AI assistants with custom instructions and behavior' },
      { name: 'Document-Specific Knowledge', description: 'Attach specific documents to each persona for specialized expertise' },
      { name: 'Personality Customization', description: 'Define tone, communication style, and response preferences' },
      { name: 'Icon & Branding', description: 'Upload custom icons and colors for each persona' },
      { name: 'Shared Personas', description: 'Share personas across your organization for consistent experiences' },
      { name: 'Profile Switching', description: 'Quickly switch between different profiles and persona combinations' },
    ],
  },
  {
    id: 'voice',
    title: 'Voice Mode & Recordings',
    subtitle: 'Hands-Free AI',
    description: 'Talk naturally with AI and record your meetings for automatic transcription and analysis.',
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    bgGradient: 'rgba(139, 92, 246, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    features: [
      { name: 'Real-Time Voice Chat', description: 'Speak naturally with AI using WebRTC voice technology' },
      { name: 'Meeting Recording', description: 'Record Level 10, quarterly, and one-on-one meetings' },
      { name: 'Automatic Transcription', description: 'Convert recordings to searchable text automatically' },
      { name: 'Action Item Extraction', description: 'AI identifies action items, decisions, and follow-ups' },
      { name: 'Recording Analysis', description: 'Get AI-powered insights and summaries from your meetings' },
      { name: 'Send to Chat', description: 'Send recording transcripts to chat for further discussion' },
      { name: 'Recording History', description: 'Access and manage all your past recordings' },
    ],
  },
  {
    id: 'composer',
    title: 'Composer Studio',
    subtitle: 'Content Creation',
    description: 'Create professional documents, charts, and code with AI-powered assistance and real-time collaboration.',
    gradient: 'from-rose-500 via-pink-500 to-red-500',
    bgGradient: 'rgba(244, 63, 94, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    features: [
      { name: 'Text Documents', description: 'Create and edit rich text documents with AI assistance' },
      { name: 'Code Generation', description: 'Generate and edit code with syntax highlighting and formatting' },
      { name: 'Chart Creation', description: 'Build line, bar, pie, and other chart types from your data' },
      { name: 'Spreadsheet Generation', description: 'Create structured data tables and spreadsheets' },
      { name: 'V/TO Builder', description: 'Dedicated Vision/Traction Organizer creation tool' },
      { name: 'Accountability Chart', description: 'Visual org chart builder with drag-and-drop editing' },
      { name: 'Export Options', description: 'Export to PDF, DOCX, and other formats' },
      { name: 'Version History', description: 'Track changes with undo/redo and version management' },
      { name: 'Real-Time Updates', description: 'See AI edits appear as they are generated' },
    ],
  },
  {
    id: 'nexus',
    title: 'Nexus Deep Research',
    subtitle: 'Research Engine',
    description: 'Access comprehensive research capabilities with multi-source intelligence gathering and synthesis.',
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    bgGradient: 'rgba(14, 165, 233, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    features: [
      { name: 'Multi-Source Research', description: 'Access 40+ real-time sources per query' },
      { name: 'Web Search Integration', description: 'Real-time web search for current information' },
      { name: 'Citation Tracking', description: 'Automatic source attribution and citation management' },
      { name: 'Research Synthesis', description: 'AI combines multiple sources into coherent reports' },
      { name: 'Competitor Analysis', description: 'Gather market intelligence and competitive insights' },
      { name: 'Industry Trends', description: 'Stay updated on industry developments and trends' },
    ],
  },
  {
    id: 'eos-tools',
    title: 'EOS Tools & Templates',
    subtitle: 'EOS Toolkit',
    description: 'Access a complete library of EOS tools and templates designed to accelerate your implementation.',
    gradient: 'from-amber-500 via-yellow-500 to-lime-500',
    bgGradient: 'rgba(245, 158, 11, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    features: [
      { name: 'V/TO Templates', description: 'Vision/Traction Organizer templates with guided completion' },
      { name: 'Scorecard Builder', description: 'Create and track measurables with Scorecard templates' },
      { name: 'Level 10 Support', description: 'AI assistance for running effective Level 10 Meetings' },
      { name: 'Issues Tracking', description: 'Track and prioritize issues with IDS methodology' },
      { name: 'To-Dos Management', description: 'Manage 7-day action items and accountability' },
      { name: 'Rocks Tracking', description: 'Quarterly rocks and goal tracking' },
      { name: 'Meeting Agendas', description: 'Generate meeting agendas and templates' },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar & Scheduling',
    subtitle: 'Time Management',
    description: 'Integrate with your calendar for intelligent meeting preparation and scheduling support.',
    gradient: 'from-teal-500 via-cyan-500 to-sky-500',
    bgGradient: 'rgba(20, 184, 166, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    features: [
      { name: 'Google Calendar Sync', description: 'Two-way sync with Google Calendar' },
      { name: 'Meeting Briefings', description: 'AI-generated preparation briefs before meetings' },
      { name: 'Event Awareness', description: 'AI knows your schedule and upcoming commitments' },
      { name: 'Schedule Analysis', description: 'Insights into your time allocation and patterns' },
    ],
  },
  {
    id: 'team',
    title: 'Team & Collaboration',
    subtitle: 'Enterprise',
    description: 'Collaborate across your organization with shared workspaces and role-based access control.',
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    bgGradient: 'rgba(99, 102, 241, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    features: [
      { name: 'Organization Management', description: 'Create and manage organizations with multiple members' },
      { name: 'Role-Based Access', description: 'Owner, admin, and member permission levels' },
      { name: 'Team Invitations', description: 'Invite team members via email or shareable invite codes' },
      { name: 'Shared Personas', description: 'Share AI personas across your organization' },
      { name: 'Document Sharing', description: 'Share documents with team members for collaborative RAG' },
      { name: 'Seat Management', description: 'Manage subscription seats and team capacity' },
      { name: 'Activity Tracking', description: 'Monitor team usage and engagement' },
    ],
  },
  {
    id: 'account',
    title: 'Account & Settings',
    subtitle: 'Personalization',
    description: 'Customize your experience with comprehensive account settings and preference controls.',
    gradient: 'from-slate-500 via-gray-500 to-zinc-500',
    bgGradient: 'rgba(100, 116, 139, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    features: [
      { name: 'Model Selection', description: 'Choose your preferred AI model for conversations' },
      { name: 'Custom Profiles', description: 'Create multiple profiles for different use cases' },
      { name: 'Company Context', description: 'Set up company details for personalized responses' },
      { name: 'Usage Tracking', description: 'Monitor your message usage and limits' },
      { name: 'Data Export', description: 'Export your conversations and documents' },
      { name: 'Privacy Controls', description: 'Manage data retention and privacy settings' },
      { name: 'UI Preferences', description: 'Customize interface density, font size, and theme' },
      { name: 'Keyboard Shortcuts', description: 'Efficient navigation with customizable shortcuts' },
    ],
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    subtitle: 'Enterprise-Grade',
    description: 'Your data is protected with industry-leading security measures and privacy controls.',
    gradient: 'from-green-500 via-emerald-500 to-teal-500',
    bgGradient: 'rgba(34, 197, 94, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    features: [
      { name: 'Data Encryption', description: 'All data encrypted in transit and at rest' },
      { name: 'Secure Authentication', description: 'OAuth 2.0 with Google and secure credentials' },
      { name: 'Payment Security', description: 'PCI-compliant payment processing via Stripe' },
      { name: 'Access Controls', description: 'Fine-grained permissions and role management' },
      { name: 'Data Deletion', description: 'Right to delete all your data at any time' },
      { name: 'Audit Logs', description: 'Track account activity and changes' },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    subtitle: 'Connected Workflow',
    description: 'Connect EOSAI with your existing tools and workflows for seamless productivity.',
    gradient: 'from-orange-500 via-red-500 to-rose-500',
    bgGradient: 'rgba(249, 115, 22, 0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    features: [
      { name: 'Google Calendar', description: 'Full calendar integration for scheduling and briefings' },
      { name: 'Google OAuth', description: 'Sign in with your Google account' },
      { name: 'Stripe Billing', description: 'Secure subscription management and payments' },
      { name: 'Circle Integration', description: 'Course content access for EOS Implementers' },
      { name: 'File Storage', description: 'Vercel Blob storage for document management' },
      { name: 'Email Notifications', description: 'Resend integration for transactional emails' },
    ],
  },
];

// Category Card Component
function CategoryCard({ category, index }: { category: typeof featureCategories[0]; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;

    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        delay: index * 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: cardRef.current,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      }
    );
  }, [index]);

  return (
    <div
      ref={cardRef}
      id={category.id}
      className="group relative p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-500 overflow-hidden"
    >
      {/* Hover gradient */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `linear-gradient(135deg, ${category.bgGradient}, transparent)` }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}
          >
            <span className="text-white">{category.icon}</span>
          </div>
          <div>
            <span className="font-montserrat text-xs font-medium text-white/50 uppercase tracking-wider">
              {category.subtitle}
            </span>
            <h3 className="font-montserrat text-xl font-bold text-white">{category.title}</h3>
          </div>
        </div>

        {/* Description */}
        <p className="font-montserrat text-sm text-white/60 mb-6">{category.description}</p>

        {/* Features List */}
        <div className="space-y-3">
          {category.features.map((feature) => (
            <div key={feature.name} className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full bg-gradient-to-r ${category.gradient} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <span className="font-montserrat text-sm font-medium text-white">{feature.name}</span>
                <p className="font-montserrat text-xs text-white/50">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [backgroundY, setBackgroundY] = useState('0%');

  // Initialize scroll hooks after mounting
  useEffect(() => {
    if (!mounted) return;
    
    const initializeScrollEffects = async () => {
      const { useScroll, useTransform } = await import('motion/react');
      // Note: This is a simplified approach - in a real implementation,
      // you'd want to use the hooks in a separate component or with a different pattern
    };
    
    initializeScrollEffects();
  }, [mounted]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Calculate total features
  const totalFeatures = featureCategories.reduce((acc, cat) => acc + cat.features.length, 0);

  return (
    <div className="relative w-full bg-black overflow-x-hidden">
      {/* Navbar */}
      <LandingNavbar />

      {/* Hero Section with Aurora Background */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Aurora Background */}
        <div className="absolute inset-0 z-0">
          <Aurora
            colorStops={['#0B3E60', '#1B9066', '#FF7900']}
            amplitude={1.2}
            blend={0.6}
            speed={0.5}
          />
        </div>

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black z-10" />

        {/* Content */}
        <div className="relative z-20 text-center px-6 pt-32">
          <motion.div
            initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 border border-white/20 mb-8">
              <svg className="w-4 h-4 text-eos-orange" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <span className="font-montserrat text-sm font-medium text-white">{totalFeatures}+ Features</span>
            </div>
          </motion.div>

          <motion.h1
            className="font-montserrat text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
          >
            Everything You Need for
            <br />
            <RotatingText
              texts={['EOS Mastery', 'Team Alignment', 'Business Growth', 'AI Excellence']}
              staggerFrom="last"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-120%' }}
              staggerDuration={0.025}
              splitLevelClassName="overflow-hidden pb-1"
              mainClassName="text-transparent bg-clip-text bg-gradient-to-r from-eos-orange via-orange-400 to-amber-500 [-webkit-background-clip:text]"
              elementLevelClassName="text-transparent bg-clip-text bg-gradient-to-r from-eos-orange via-orange-400 to-amber-500 [-webkit-background-clip:text]"
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              rotationInterval={3000}
            />
          </motion.h1>

          <motion.p
            className="font-montserrat text-lg md:text-xl text-white/70 max-w-3xl mx-auto mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          >
            The complete AI-powered platform for EOS implementation. {featureCategories.length} feature categories,
            {totalFeatures}+ capabilities designed to accelerate your business.
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
                className="font-montserrat bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white px-8 py-6 rounded-full shadow-[0_8px_32px_rgba(255,121,0,0.3)] hover:shadow-[0_12px_48px_rgba(255,121,0,0.4)] transition-all duration-300"
              >
                Start Free Trial
              </Button>
            </Link>
            <Link href="/chat">
              <Button
                size="lg"
                variant="outline"
                className="font-montserrat border-2 border-white/50 text-white hover:bg-white/20 hover:border-white/70 px-8 py-6 rounded-full backdrop-blur-md bg-white/10 shadow-[0_4px_16px_rgba(255,255,255,0.1)] hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition-all duration-300"
              >
                Try Demo
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

      {/* Quick Navigation */}
      <section className="relative z-30 bg-gradient-to-b from-black to-zinc-950 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-3">
            {featureCategories.map((category) => (
              <a
                key={category.id}
                href={`#${category.id}`}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all duration-200"
              >
                <span className="font-montserrat text-sm text-white/70 hover:text-white">{category.title}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* All Features Grid */}
      <section className="relative z-30 bg-zinc-950 py-24">
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
              Complete Feature Set
            </ScrollFloat>
            <p className="font-montserrat text-lg text-white/60 max-w-2xl mx-auto">
              Every tool you need for AI-powered EOS implementation, organized by category
            </p>
          </div>

          {/* Feature Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {featureCategories.map((category, index) => (
              <CategoryCard key={category.id} category={category} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Solutions CTA Banner */}
      <section className="relative h-[300px] overflow-hidden">
        <div className="absolute inset-0">
          <Dither
            waveColor={[0.04, 0.24, 0.38]}
            disableAnimation={false}
            enableMouseInteraction={true}
            mouseRadius={0.4}
            colorNum={5}
            waveAmplitude={0.4}
            waveFrequency={2.5}
            waveSpeed={0.03}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-transparent to-zinc-950" />
        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="text-center px-6">
            <h3 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
              Looking for Enterprise Solutions?
            </h3>
            <p className="font-montserrat text-white/60 max-w-xl mx-auto mb-6">
              Explore our advanced tools for deep research, content creation, and team collaboration
            </p>
            <Link href="/solutions">
              <Button
                size="lg"
                className="font-montserrat bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-500/90 hover:to-purple-600/90 text-white px-8 py-5 rounded-full shadow-[0_8px_32px_rgba(139,92,246,0.3)]"
              >
                Explore Solutions
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-30 py-32 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <GradientBlinds
            gradientColors={['#0B3E60', '#0B3E60', '#1B9066', '#FF7900', '#FF7900']}
            angle={45}
            noise={0.4}
            blindCount={12}
            blindMinWidth={80}
            spotlightRadius={0.6}
            spotlightSoftness={1}
            spotlightOpacity={0.8}
            mouseDampening={0.2}
            distortAmount={0}
            shineDirection="right"
            mixBlendMode="lighten"
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
              Ready to Transform Your EOS Journey?
            </h2>
            <p className="font-montserrat text-lg md:text-xl text-white/70 max-w-3xl mx-auto mb-12">
              Join thousands of businesses using EOSAI to streamline their implementation and achieve Traction faster.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/register">
                <Button
                  size="lg"
                  className="font-montserrat bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white px-10 py-6 rounded-full shadow-[0_8px_32px_rgba(255,121,0,0.4)] hover:shadow-[0_12px_48px_rgba(255,121,0,0.5)] font-semibold transition-all duration-300"
                >
                  Get Started Free
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="font-montserrat border-2 border-white/50 text-white hover:bg-white/20 hover:border-white/70 px-10 py-6 rounded-full backdrop-blur-md bg-white/10 font-semibold shadow-[0_4px_16px_rgba(255,255,255,0.1)] hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition-all duration-300"
                >
                  Sign In
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-white/60 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-eos-orange" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-montserrat">No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-eos-orange" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-montserrat">Setup in minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-eos-orange" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-montserrat">Cancel anytime</span>
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
