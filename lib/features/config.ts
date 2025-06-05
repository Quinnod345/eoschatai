export interface Feature {
  id: string;
  title: string;
  description: string;
  category: 'core' | 'productivity' | 'integration' | 'advanced' | 'eos' | 'ui';
  version: string;
  releaseDate: string;
  isNew?: boolean;
  icon: string;
  screenshot?: string;
  benefits: string[];
  learnMoreUrl?: string;
  detailedDescription?: string;
  examples?: string[];
  improveExperience?: string[];
  tags?: string[];
  demoVideo?: string;
}

export interface FeatureCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'core',
    title: 'Core Chat Features',
    description: 'Essential AI conversation capabilities',
    icon: 'MessageSquare',
    color: 'bg-blue-500',
  },
  {
    id: 'productivity',
    title: 'Productivity Tools',
    description: 'Features to boost your workflow',
    icon: 'Zap',
    color: 'bg-purple-500',
  },
  {
    id: 'integration',
    title: 'Integrations',
    description: 'Connect with your favorite tools',
    icon: 'Link',
    color: 'bg-green-500',
  },
  {
    id: 'advanced',
    title: 'Advanced Features',
    description: 'Powerful capabilities for power users',
    icon: 'Settings',
    color: 'bg-orange-500',
  },
  {
    id: 'eos',
    title: 'EOS Methodology',
    description: 'Specialized business tools',
    icon: 'Target',
    color: 'bg-red-500',
  },
  {
    id: 'ui',
    title: 'User Experience',
    description: 'Interface and experience enhancements',
    icon: 'Sparkles',
    color: 'bg-pink-500',
  },
];

export const FEATURES: Feature[] = [
  // Core Chat Features
  {
    id: 'ai-chat',
    title: 'AI-Powered Conversations',
    description: 'Stream real-time conversations with multiple AI providers',
    category: 'core',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'MessageSquare',
    detailedDescription:
      'Experience cutting-edge AI conversations with real-time streaming, multi-model support, and intelligent message management. Built on the Vercel AI SDK with OpenAI integration.',
    benefits: [
      'OpenAI GPT-4 and GPT-3.5 model support',
      'Real-time streaming responses for instant feedback',
      'Comprehensive message history with search',
      'Copy, edit, regenerate, and version messages',
      'Context-aware conversations with memory',
      'Resumable streams with Redis caching',
    ],
    examples: [
      'Ask complex questions and get detailed, streamed responses',
      'Edit previous messages to refine conversations',
      'Copy AI responses for use in other applications',
      'Regenerate responses to explore different perspectives',
    ],
    improveExperience: [
      'Get instant, real-time responses instead of waiting',
      'Maintain context across long conversations',
      'Easily manage and reference previous discussions',
      'Seamlessly continue conversations across sessions',
    ],
    tags: ['ai', 'chat', 'streaming', 'openai', 'conversation'],
  },
  {
    id: 'artifacts',
    title: 'Interactive Artifacts',
    description:
      'Create and edit code, documents, charts, and spreadsheets with AI assistance',
    category: 'productivity',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'FileCode',
    detailedDescription:
      'Create rich, interactive content directly in your conversations. From code snippets to complex charts and documents, artifacts make your AI conversations more productive and visual.',
    benefits: [
      'Monaco code editor with syntax highlighting for 50+ languages',
      'Interactive Chart.js charts with real-time data',
      'Rich text editing with markdown and formatting',
      'Excel-like spreadsheets with formulas and calculations',
      'AI-assisted editing with diff view and suggestions',
      'Real-time collaboration and sharing capabilities',
      'Export options for all artifact types',
    ],
    examples: [
      'Generate Python scripts and edit them with AI assistance',
      'Create interactive bar charts from your data',
      'Build rich documents with formatting and images',
      'Generate complex spreadsheets with formulas',
      'Code review with AI-powered diff highlighting',
    ],
    improveExperience: [
      'Visualize data instantly instead of just text descriptions',
      'Edit and iterate on generated content in real-time',
      'Share interactive content with colleagues',
      'Work with code, data, and documents in one place',
    ],
    tags: [
      'artifacts',
      'code',
      'charts',
      'documents',
      'monaco',
      'visualization',
    ],
  },
  {
    id: 'document-rag',
    title: 'Document Intelligence (RAG)',
    description:
      'Upload documents and get AI insights with advanced RAG technology',
    category: 'productivity',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'FileText',
    detailedDescription:
      'Revolutionary document intelligence powered by Retrieval-Augmented Generation (RAG). Upload any document and have AI understand, analyze, and answer questions about your content using vector embeddings and semantic search.',
    benefits: [
      'Support for PDF, DOCX, XLSX, TXT, and image files',
      'OCR for scanned documents and handwritten notes',
      'Vector-based semantic search with 1536-dimensional embeddings',
      'Document preview with text extraction and analysis',
      'Personal knowledge base that learns from your documents',
      'Context-aware responses using your document content',
      'Dual storage in Upstash Vector and PostgreSQL pgvector',
    ],
    examples: [
      'Upload contracts and ask questions about specific clauses',
      'Analyze financial reports and get insights on trends',
      'Process meeting notes and extract action items',
      'Review research papers and get summaries',
      'Search across multiple documents with natural language',
    ],
    improveExperience: [
      'Never lose track of important information in documents',
      'Get instant answers from your personal knowledge base',
      'Spend less time reading, more time acting on insights',
      'Build a searchable repository of all your content',
    ],
    tags: ['rag', 'documents', 'upload', 'ai', 'search', 'embeddings', 'ocr'],
  },
  {
    id: 'multimodal-input',
    title: 'Enhanced Media Input',
    description:
      'Upload and process images, documents, and files seamlessly with drag-and-drop',
    category: 'core',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Upload',
    detailedDescription:
      'Advanced multimodal input system that handles images, documents, and files with intelligent processing. Features drag-and-drop, clipboard integration, and real-time processing status.',
    benefits: [
      'Drag-and-drop file upload with visual feedback',
      'Clipboard image pasting for quick screenshots',
      'Support for images, PDFs, DOCX, XLSX, and more',
      'Real-time processing status and progress tracking',
      'Automatic file type detection and handling',
      'Image compression and optimization',
      'Secure file storage with Vercel Blob',
    ],
    examples: [
      'Paste screenshots directly into conversations',
      'Drag PDFs from your desktop for instant analysis',
      'Upload Excel files and get data insights',
      'Process images with OCR for text extraction',
    ],
    improveExperience: [
      'No need to switch between apps for file sharing',
      'Instant visual communication with images',
      'Seamless workflow for document analysis',
      'Quick capture and share of visual information',
    ],
    tags: ['upload', 'multimodal', 'drag-drop', 'images', 'files', 'clipboard'],
  },

  // Productivity Tools
  {
    id: 'personas',
    title: 'Custom AI Personas',
    description:
      'Create specialized AI assistants with unique knowledge bases and custom instructions',
    category: 'advanced',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Users',
    detailedDescription:
      'Build custom AI personalities tailored to specific roles, knowledge domains, or use cases. Each persona can have its own documents, instructions, and behavior patterns.',
    benefits: [
      'Create unlimited custom personas with unique instructions',
      'Document-specific knowledge bases for each persona',
      'System personas (pre-built) and user personas (custom)',
      'Profile management with sub-categories and themes',
      'Custom icon selection and visual branding',
      'Persona-specific RAG with isolated knowledge spaces',
      'Easy switching between different AI personalities',
    ],
    examples: [
      'Create a "Legal Advisor" persona with law documents',
      'Build a "Marketing Expert" with campaign templates',
      'Design a "Technical Writer" with style guides',
      'Develop a "Financial Analyst" with market data',
    ],
    improveExperience: [
      'Get specialized expertise for different tasks',
      'Maintain context and knowledge for specific roles',
      'Streamline workflows with purpose-built assistants',
      'Scale your expertise across different domains',
    ],
    tags: ['personas', 'custom', 'ai', 'assistants', 'knowledge', 'roles'],
  },
  {
    id: 'calendar-integration',
    title: 'Google Calendar Integration',
    description:
      'Seamlessly manage your calendar within chat conversations with AI assistance',
    category: 'integration',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Calendar',
    detailedDescription:
      'Deep Google Calendar integration that brings your schedule into AI conversations. Create events, get briefings, and manage your time with intelligent calendar assistance.',
    benefits: [
      'View upcoming events directly in chat',
      'Create events via natural language with AI',
      'Daily and weekly calendar briefings',
      'Meeting insights and time analytics',
      'Secure OAuth 2.0 connection with Google',
      'Calendar widget in the sidebar dashboard',
      'Smart scheduling suggestions and conflict detection',
    ],
    examples: [
      'Ask "What\'s on my calendar today?" for instant overview',
      'Say "Schedule a meeting with John next Tuesday" to create events',
      'Get AI-generated meeting preparation and follow-ups',
      'Receive daily briefings about your schedule',
    ],
    improveExperience: [
      'Never miss important meetings or deadlines',
      'Reduce context switching between apps',
      'Get intelligent insights about your time usage',
      'Streamline scheduling with natural language',
    ],
    tags: [
      'calendar',
      'google',
      'scheduling',
      'meetings',
      'integration',
      'oauth',
    ],
  },
  {
    id: 'advanced-search',
    title: 'Enhanced Search & Filtering',
    description:
      'Powerful AI-enhanced search across all conversations and documents',
    category: 'productivity',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Search',
    detailedDescription:
      'Advanced search capabilities that go beyond simple text matching. Find conversations, documents, and specific information using natural language queries and intelligent filtering.',
    benefits: [
      'Full-text search across all conversations and messages',
      'Smart filters by date, persona, message type, and category',
      'Instant search with Cmd/Ctrl+K keyboard shortcut',
      'AI-powered search suggestions and auto-complete',
      'EOS-specific keyword recognition and categorization',
      'Fuzzy matching to find content even with typos',
      'Search within specific conversations or globally',
    ],
    examples: [
      'Search "meeting notes from last week" to find relevant chats',
      'Use filters to find all conversations with a specific persona',
      'Search for "scorecard" to find EOS-related discussions',
      'Quick search with Cmd+K for instant access',
    ],
    improveExperience: [
      'Find any information from past conversations instantly',
      'Navigate large conversation histories efficiently',
      'Discover related content and patterns',
      'Spend less time scrolling, more time finding answers',
    ],
    tags: ['search', 'filtering', 'keyboard', 'shortcuts', 'ai', 'suggestions'],
  },
  {
    id: 'saved-content',
    title: 'Saved Content Management',
    description:
      'Pin messages and bookmark conversations for quick access and reference',
    category: 'productivity',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Bookmark',
    detailedDescription:
      'Comprehensive content management system that lets you save, organize, and quickly access important information from your conversations.',
    benefits: [
      'Pin individual messages for quick reference',
      'Bookmark entire conversations for easy return',
      'Cross-chat navigation with unified saved content',
      'Pinned messages bar for immediate access',
      'Quick access dropdown in the sidebar',
      'Robust saved content store with persistence',
      'Export and share saved content easily',
    ],
    examples: [
      'Pin important AI responses for later reference',
      'Bookmark project planning conversations',
      'Save meeting summaries and action items',
      'Create a personal library of useful information',
    ],
    improveExperience: [
      'Never lose important information again',
      'Build a personal knowledge repository',
      'Quick access to frequently referenced content',
      'Organize information across multiple conversations',
    ],
    tags: [
      'bookmarks',
      'pins',
      'saved',
      'content',
      'organization',
      'reference',
    ],
  },
  {
    id: 'enhanced-mentions',
    title: 'Smart @ Mentions',
    description:
      'Intelligent mention system for calendar events, documents, and resources',
    category: 'productivity',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'AtSign',
    detailedDescription:
      'Advanced mention system that provides context-aware suggestions and shortcuts for quickly referencing calendar events, documents, and other resources in your conversations.',
    benefits: [
      'Calendar event mentions (@cal) with date parsing',
      'Document references (@doc) with instant preview',
      'Resource shortcuts (@free) for common requests',
      'Context-aware suggestions based on conversation',
      'Visual feedback with icons and formatting',
      'AI-powered mention detection and processing',
      'Smart autocomplete with fuzzy matching',
    ],
    examples: [
      'Type @cal to reference your next meeting',
      'Use @doc to mention specific documents in chat',
      'Try @free for quick access to common resources',
      "Get smart suggestions based on what you're discussing",
    ],
    improveExperience: [
      'Quickly reference external resources without leaving chat',
      'Provide context to AI with specific document mentions',
      'Streamline common requests with shortcuts',
      'Make conversations more interactive and contextual',
    ],
    tags: [
      'mentions',
      'calendar',
      'documents',
      'shortcuts',
      'context',
      'references',
    ],
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description:
      'Navigate and control the app efficiently with comprehensive keyboard shortcuts',
    category: 'productivity',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Keyboard',
    detailedDescription:
      'Complete keyboard navigation system that makes the app accessible and efficient for power users. Comprehensive shortcuts for all major features and actions.',
    benefits: [
      'Quick search activation with Cmd/Ctrl+K',
      'Message navigation with arrow keys',
      'Artifact shortcuts for editing and creation',
      'Chat management and switching shortcuts',
      'Full accessibility support for screen readers',
      'Customizable shortcut preferences',
      'Visual shortcut hints and help modal',
    ],
    examples: [
      'Press Cmd+K to instantly open search',
      'Use Tab to navigate between UI elements',
      'Press Escape to close modals and menus',
      'Use Ctrl+Enter to send messages quickly',
    ],
    improveExperience: [
      'Work faster without reaching for the mouse',
      'Improve accessibility for all users',
      'Reduce cognitive load with consistent shortcuts',
      'Enable power user workflows and efficiency',
    ],
    tags: [
      'keyboard',
      'shortcuts',
      'accessibility',
      'navigation',
      'efficiency',
    ],
  },

  // Advanced Features
  {
    id: 'deep-research',
    title: 'Nexus Research Mode (Beta)',
    description:
      'Advanced web research and comprehensive analysis capabilities',
    category: 'advanced',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Globe',
    detailedDescription:
      'Revolutionary research capabilities that combine web search, analysis, and AI reasoning to provide comprehensive insights on any topic. Currently in beta.',
    benefits: [
      'Nexus advanced research mode with deep analysis',
      'Multi-source web search integration',
      'Real-time progress tracking and transparency',
      'Comprehensive research report generation',
      'Source verification and credibility scoring',
      'Interactive research refinement and follow-ups',
      'Export research results in multiple formats',
    ],
    examples: [
      'Research market trends with comprehensive analysis',
      'Investigate competitors with detailed comparisons',
      'Analyze industry reports and synthesize insights',
      'Generate research reports on complex topics',
    ],
    improveExperience: [
      'Get professional-quality research in minutes',
      'Access information beyond AI training data',
      'Save hours of manual research and analysis',
      'Make better decisions with comprehensive data',
    ],
    tags: ['research', 'web-search', 'analysis', 'nexus', 'beta'],
  },
  {
    id: 'enhanced-artifacts',
    title: 'Enhanced Artifact Editing',
    description:
      'AI-assisted editing with diff view, suggestions, and collaborative features',
    category: 'advanced',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'FileCode',
    detailedDescription:
      'Next-generation artifact editing with AI assistance, visual diff comparison, and collaborative features that make content creation and editing more intuitive and powerful.',
    benefits: [
      'AI-assisted editing with intelligent suggestions',
      'Visual diff view for tracking changes',
      'Enhanced Monaco editor with advanced features',
      'Real-time collaboration capabilities',
      'Version control and change tracking',
      'Smart formatting and syntax correction',
      'Export options for all artifact types',
    ],
    examples: [
      'Get AI suggestions while editing code',
      'See changes highlighted with diff view',
      'Collaborate on documents in real-time',
      'Track versions and revert changes easily',
    ],
    improveExperience: [
      'Edit more efficiently with AI assistance',
      'Never lose track of changes and versions',
      'Collaborate seamlessly with others',
      'Create higher quality content faster',
    ],
    tags: ['artifacts', 'editing', 'collaboration', 'diff', 'ai-assistance'],
  },

  // EOS Methodology Tools
  {
    id: 'eos-tools',
    title: 'EOS Business Tools',
    description:
      'Comprehensive suite of tools for EOS methodology implementation',
    category: 'eos',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Target',
    detailedDescription:
      'Complete EOS (Entrepreneurial Operating System) toolkit with specialized personas, templates, and knowledge base for implementing EOS in your organization.',
    benefits: [
      'Level 10 meeting templates and agenda builders',
      'Scorecard generation with KPI tracking',
      'VTO (Vision/Traction Organizer) builder',
      'People Analyzer and GWC assessments',
      'Comprehensive EOS Implementer knowledge base',
      'Quarterly planning and focus day templates',
      'Access to specialized EOS personas and facilitators',
    ],
    examples: [
      'Generate Level 10 meeting agendas automatically',
      'Build company scorecards with measurable KPIs',
      'Create VTO documents with guided assistance',
      'Conduct People Analyzer sessions with templates',
    ],
    improveExperience: [
      'Implement EOS methodology with expert guidance',
      'Save time with pre-built templates and structures',
      'Access specialized knowledge from EOS experts',
      'Maintain consistency across EOS processes',
    ],
    tags: ['eos', 'business', 'methodology', 'templates', 'scorecard', 'vto'],
  },
  {
    id: 'eos-personas',
    title: 'EOS Implementer Personas',
    description:
      'Specialized AI personas for different EOS session types and methodologies',
    category: 'eos',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Users',
    detailedDescription:
      'Pre-configured AI personas specifically designed for EOS implementation, each with specialized knowledge for different types of EOS sessions and processes.',
    benefits: [
      'Quarterly Session Facilitator with planning templates',
      'Focus Day Facilitator for intensive work sessions',
      'Vision Building Day 1 & 2 specialized personas',
      'Level 10 Meeting facilitator with agenda management',
      'Annual Planning persona with strategic guidance',
      'Access restricted to verified EOS professionals',
      'Comprehensive EOS knowledge base integration',
    ],
    examples: [
      'Use Quarterly Facilitator for 90-day planning',
      'Access Vision Day personas for company vision work',
      'Get Focus Day guidance for intensive sessions',
      'Use specialized knowledge for annual planning',
    ],
    improveExperience: [
      'Get expert EOS facilitation without hiring consultants',
      'Access specialized knowledge for each EOS process',
      'Maintain consistency across EOS implementations',
      'Scale EOS expertise across your organization',
    ],
    tags: [
      'eos',
      'personas',
      'facilitator',
      'quarterly',
      'vision',
      'implementer',
    ],
  },

  // User Interface Enhancements
  {
    id: 'enhanced-animations',
    title: 'Smooth UI Animations',
    description:
      'Professional-grade animations and transitions throughout the interface',
    category: 'ui',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Sparkles',
    detailedDescription:
      'Comprehensive animation system using GSAP, Framer Motion, and Locomotive Scroll to create smooth, professional interactions that enhance the user experience.',
    benefits: [
      'GSAP-powered entrance animations and transitions',
      'Framer Motion components for interactive elements',
      'Locomotive Scroll for smooth scrolling experiences',
      'Performance-optimized animations with lazy loading',
      'Accessibility-friendly with reduced motion support',
      'Consistent animation language across the app',
      'Professional polish that feels responsive and alive',
    ],
    examples: [
      'Smooth entrance animations when app loads',
      'Fluid transitions between chat conversations',
      'Interactive hover effects on buttons and cards',
      'Smooth scrolling throughout long conversations',
    ],
    improveExperience: [
      'Creates a premium, polished feel',
      'Provides visual feedback for user actions',
      'Makes the interface feel more responsive',
      'Guides attention to important elements',
    ],
    tags: [
      'animations',
      'ui',
      'gsap',
      'framer-motion',
      'transitions',
      'polish',
    ],
  },
  {
    id: 'enhanced-toast-system',
    title: 'Smart Notifications',
    description: 'Context-aware notification system with actionable messages',
    category: 'ui',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'MessageSquare',
    detailedDescription:
      'Advanced notification system that provides contextual feedback, actionable messages, and smart alerts to keep users informed about important events and status changes.',
    benefits: [
      'Context-aware notifications based on user actions',
      'Actionable toast messages with buttons and links',
      'Smart grouping to prevent notification spam',
      'Persistent notifications for important alerts',
      'Visual hierarchy with different notification types',
      'Accessibility support with screen reader compatibility',
      'Customizable notification preferences',
    ],
    examples: [
      'Get notified when document upload completes',
      'Receive alerts about calendar integration status',
      'See confirmation when messages are pinned',
      'Get smart suggestions for related actions',
    ],
    improveExperience: [
      'Stay informed about important system events',
      'Get actionable feedback on your interactions',
      'Reduce uncertainty with clear status updates',
      'Take quick actions directly from notifications',
    ],
    tags: ['notifications', 'toasts', 'alerts', 'feedback', 'context-aware'],
  },
  {
    id: 'responsive-design',
    title: 'Mobile-First Design',
    description:
      'Fully responsive interface optimized for all devices and screen sizes',
    category: 'ui',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Smartphone',
    detailedDescription:
      'Comprehensive responsive design that provides an optimal experience across all devices, from mobile phones to large desktop screens.',
    benefits: [
      'Mobile-first responsive design principles',
      'Touch-optimized interface for mobile devices',
      'Adaptive layouts that work on any screen size',
      'Optimized typography and spacing for readability',
      'Gesture support for mobile interactions',
      'Progressive enhancement for larger screens',
      'Consistent experience across all devices',
    ],
    examples: [
      'Seamless chat experience on mobile phones',
      'Touch-friendly buttons and interactive elements',
      'Responsive sidebar that adapts to screen size',
      'Optimized artifact viewing on tablets',
    ],
    improveExperience: [
      'Use the app anywhere, on any device',
      'Maintain productivity while mobile',
      'Consistent experience regardless of screen size',
      'Touch-friendly interface for tablet users',
    ],
    tags: [
      'responsive',
      'mobile',
      'design',
      'touch',
      'adaptive',
      'cross-device',
    ],
  },
  {
    id: 'whats-new-framework',
    title: "What's New Feature Discovery",
    description:
      'Comprehensive feature discovery system that highlights new capabilities',
    category: 'ui',
    version: '2.0',
    releaseDate: '2024-12-01',
    isNew: true,
    icon: 'Sparkles',
    detailedDescription:
      'Advanced feature discovery framework that automatically shows users new features and capabilities, with detailed explanations and examples.',
    benefits: [
      'Automatic detection of new features for each user',
      'Beautiful modal with detailed feature explanations',
      'Category-based organization of features',
      'Visual examples and screenshots for clarity',
      'User tracking to prevent repeated notifications',
      'Manual access via sidebar for feature exploration',
      'Badge notifications for unseen features',
    ],
    examples: [
      "Automatically see new features when they're released",
      'Browse all features organized by category',
      'Get detailed explanations with examples',
      'Access feature discovery anytime from sidebar',
    ],
    improveExperience: [
      'Never miss new capabilities and improvements',
      'Understand features with clear explanations',
      'Discover advanced features you might not find',
      'Stay up-to-date with latest enhancements',
    ],
    tags: ['features', 'discovery', 'onboarding', 'updates', 'notifications'],
  },
];

export const getNewFeatures = (lastSeenVersion?: string): Feature[] => {
  if (!lastSeenVersion) {
    return FEATURES.filter((f) => f.isNew);
  }

  return FEATURES.filter((f) => {
    if (!f.isNew) return false;
    const featureDate = new Date(f.releaseDate);
    const lastSeenDate = new Date(lastSeenVersion);
    return featureDate > lastSeenDate;
  });
};

export const getFeaturesByCategory = (categoryId: string): Feature[] => {
  return FEATURES.filter((f) => f.category === categoryId);
};

export const getAllFeatures = (): Feature[] => {
  return FEATURES;
};
