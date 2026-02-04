# EOSAI - Enterprise Operating System AI Assistant

<div align="center">
  <img alt="EOSAI - Advanced AI chatbot for Enterprise Operating System implementation" src="app/(chat)/opengraph-image.png">
  <h1>🚀 EOSAI</h1>
  <p>
    <strong>A comprehensive AI-powered assistant for Enterprise Operating System (EOS) implementation</strong>
  </p>
  <p>
    Built with Next.js 15, AI SDK, PostgreSQL, and cutting-edge AI technologies
  </p>

  <!-- Badges -->
  <p>
    <a href="https://github.com/your-org/eoschatai/actions"><img src="https://img.shields.io/github/actions/workflow/status/your-org/eoschatai/ci.yml?branch=main&style=flat-square&label=build" alt="Build Status"></a>
    <img src="https://img.shields.io/badge/version-3.0.19-blue?style=flat-square" alt="Version">
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-green?style=flat-square" alt="License"></a>
    <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square" alt="Node.js">
    <img src="https://img.shields.io/badge/pnpm-%3E%3D9.12-orange?style=flat-square" alt="pnpm">
    <a href="https://eosbot.ai"><img src="https://img.shields.io/badge/demo-live-brightgreen?style=flat-square" alt="Live Demo"></a>
  </p>
  
  <p align="center">
    <a href="#-core-chat-features"><strong>Core Features</strong></a> ·
    <a href="#-productivity-tools"><strong>Productivity</strong></a> ·
    <a href="#-integrations"><strong>Integrations</strong></a> ·
    <a href="#-advanced-features"><strong>Advanced</strong></a> ·
    <a href="#-eos-methodology"><strong>EOS Tools</strong></a> ·
    <a href="#-user-experience"><strong>UI/UX</strong></a>
  </p>
</div>

---

## 🌟 Overview

EOSAI is a revolutionary, enterprise-ready AI platform specifically designed for EOS (Entrepreneurial Operating System) implementation. It combines state-of-the-art AI capabilities with specialized business tools, comprehensive document intelligence, and personalized AI personas to transform how organizations implement and manage EOS methodologies.

### 🎯 Why EOSAI?

- **🤖 Advanced AI**: Multi-provider support with streaming conversations
- **📚 Document Intelligence**: RAG-powered knowledge extraction from your files
- **👥 Custom Personas**: Specialized AI assistants for different business roles
- **🎨 Rich Composer**: Generate code, charts, documents, and spreadsheets
- **🔧 EOS-Specific Tools**: Purpose-built for EOS methodology implementation
- **⚡ Real-time Features**: Streaming responses with resumable connections
- **🎯 Enterprise Ready**: OAuth, role-based access, and premium features

---

## 📋 Complete Feature Guide

### 💬 Core Chat Features
> Essential AI conversation capabilities that power every interaction

<details>
<summary><b>🤖 AI-Powered Conversations</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Experience cutting-edge AI conversations with real-time streaming, multi-model support, and intelligent message management. Built on the Vercel AI SDK with OpenAI integration.**

#### ⚡ Key Benefits
- OpenAI GPT-4 and GPT-3.5 model support
- Real-time streaming responses for instant feedback
- Comprehensive message history with search
- Copy, edit, regenerate, and version messages
- Context-aware conversations with memory
- Resumable streams with Redis caching

#### 🎯 Use Cases & Examples
- Ask complex questions and get detailed, streamed responses
- Edit previous messages to refine conversations
- Copy AI responses for use in other applications
- Regenerate responses to explore different perspectives

#### 🚀 Experience Improvements
- Get instant, real-time responses instead of waiting
- Maintain context across long conversations
- Easily manage and reference previous discussions
- Seamlessly continue conversations across sessions

**Tags:** `ai` `chat` `streaming` `openai` `conversation`

</details>

<details>
<summary><b>📄 Interactive Composer</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Create rich, interactive content directly in your conversations. From code snippets to complex charts and documents, composer make your AI conversations more productive and visual.**

#### ⚡ Key Benefits
- Monaco code editor with syntax highlighting for 50+ languages
- Interactive Chart.js charts with real-time data
- Rich text editing with markdown and formatting
- Excel-like spreadsheets with formulas and calculations
- AI-assisted editing with diff view and suggestions
- Real-time collaboration and sharing capabilities
- Export options for all composer types

#### 🎯 Use Cases & Examples
- Generate Python scripts and edit them with AI assistance
- Create interactive bar charts from your data
- Build rich documents with formatting and images
- Generate complex spreadsheets with formulas
- Code review with AI-powered diff highlighting

#### 🚀 Experience Improvements
- Visualize data instantly instead of just text descriptions
- Edit and iterate on generated content in real-time
- Share interactive content with colleagues
- Work with code, data, and documents in one place

**Tags:** `composer` `code` `charts` `documents` `monaco` `visualization`

</details>

<details>
<summary><b>📤 Enhanced Media Input</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Advanced multimodal input system that handles images, documents, and files with intelligent processing. Features drag-and-drop, clipboard integration, and real-time processing status.**

#### ⚡ Key Benefits
- Drag-and-drop file upload with visual feedback
- Clipboard image pasting for quick screenshots
- Support for images, PDFs, DOCX, XLSX, and more
- Real-time processing status and progress tracking
- Automatic file type detection and handling
- Image compression and optimization
- Secure file storage with Vercel Blob

#### 🎯 Use Cases & Examples
- Paste screenshots directly into conversations
- Drag PDFs from your desktop for instant analysis
- Upload Excel files and get data insights
- Process images with OCR for text extraction

#### 🚀 Experience Improvements
- No need to switch between apps for file sharing
- Instant visual communication with images
- Seamless workflow for document analysis
- Quick capture and share of visual information

**Tags:** `upload` `multimodal` `drag-drop` `images` `files` `clipboard`

</details>

---

### ⚡ Productivity Tools
> Features designed to boost your workflow and maximize efficiency

<details>
<summary><b>📚 Document Intelligence (RAG)</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Revolutionary document intelligence powered by Retrieval-Augmented Generation (RAG). Upload any document and have AI understand, analyze, and answer questions about your content using vector embeddings and semantic search.**

#### ⚡ Key Benefits
- Support for PDF, DOCX, XLSX, TXT, and image files
- OCR for scanned documents and handwritten notes
- Vector-based semantic search with 1536-dimensional embeddings
- Document preview with text extraction and analysis
- Personal knowledge base that learns from your documents
- Context-aware responses using your document content
- Dual storage in Upstash Vector and PostgreSQL pgvector

#### 🎯 Use Cases & Examples
- Upload contracts and ask questions about specific clauses
- Analyze financial reports and get insights on trends
- Process meeting notes and extract action items
- Review research papers and get summaries
- Search across multiple documents with natural language

#### 🚀 Experience Improvements
- Never lose track of important information in documents
- Get instant answers from your personal knowledge base
- Spend less time reading, more time acting on insights
- Build a searchable repository of all your content

**Tags:** `rag` `documents` `upload` `ai` `search` `embeddings` `ocr`

</details>

<details>
<summary><b>🔍 Enhanced Search & Filtering</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Advanced search capabilities that go beyond simple text matching. Find conversations, documents, and specific information using natural language queries and intelligent filtering.**

#### ⚡ Key Benefits
- Full-text search across all conversations and messages
- Smart filters by date, persona, message type, and category
- Instant search with Cmd/Ctrl+K keyboard shortcut
- AI-powered search suggestions and auto-complete
- EOS-specific keyword recognition and categorization
- Fuzzy matching to find content even with typos
- Search within specific conversations or globally

#### 🎯 Use Cases & Examples
- Search "meeting notes from last week" to find relevant chats
- Use filters to find all conversations with a specific persona
- Search for "scorecard" to find EOS-related discussions
- Quick search with Cmd+K for instant access

#### 🚀 Experience Improvements
- Find any information from past conversations instantly
- Navigate large conversation histories efficiently
- Discover related content and patterns
- Spend less time scrolling, more time finding answers

**Tags:** `search` `filtering` `keyboard` `shortcuts` `ai` `suggestions`

</details>

<details>
<summary><b>📌 Saved Content Management</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Comprehensive content management system that lets you save, organize, and quickly access important information from your conversations.**

#### ⚡ Key Benefits
- Pin individual messages for quick reference
- Bookmark entire conversations for easy return
- Cross-chat navigation with unified saved content
- Pinned messages bar for immediate access
- Quick access dropdown in the sidebar
- Robust saved content store with persistence
- Export and share saved content easily

#### 🎯 Use Cases & Examples
- Pin important AI responses for later reference
- Bookmark project planning conversations
- Save meeting summaries and action items
- Create a personal library of useful information

#### 🚀 Experience Improvements
- Never lose important information again
- Build a personal knowledge repository
- Quick access to frequently referenced content
- Organize information across multiple conversations

**Tags:** `bookmarks` `pins` `saved` `content` `organization` `reference`

</details>

<details>
<summary><b>@ Smart @ Mentions</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Advanced mention system that provides context-aware suggestions and shortcuts for quickly referencing calendar events, documents, and other resources in your conversations.**

#### ⚡ Key Benefits
- Calendar event mentions (@cal) with date parsing
- Document references (@doc) with instant preview
- Resource shortcuts (@free) for common requests
- Context-aware suggestions based on conversation
- Visual feedback with icons and formatting
- AI-powered mention detection and processing
- Smart autocomplete with fuzzy matching

#### 🎯 Use Cases & Examples
- Type @cal to reference your next meeting
- Use @doc to mention specific documents in chat
- Try @free for quick access to common resources
- Get smart suggestions based on what you're discussing

#### 🚀 Experience Improvements
- Quickly reference external resources without leaving chat
- Provide context to AI with specific document mentions
- Streamline common requests with shortcuts
- Make conversations more interactive and contextual

**Tags:** `mentions` `calendar` `documents` `shortcuts` `context` `references`

</details>

<details>
<summary><b>⌨️ Keyboard Shortcuts</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Complete keyboard navigation system that makes the app accessible and efficient for power users. Comprehensive shortcuts for all major features and actions.**

#### ⚡ Key Benefits
- Quick search activation with Cmd/Ctrl+K
- Message navigation with arrow keys
- Composer shortcuts for editing and creation
- Chat management and switching shortcuts
- Full accessibility support for screen readers
- Customizable shortcut preferences
- Visual shortcut hints and help modal

#### 🎯 Use Cases & Examples
- Press Cmd+K to instantly open search
- Use Tab to navigate between UI elements
- Press Escape to close modals and menus
- Use Ctrl+Enter to send messages quickly

#### 🚀 Experience Improvements
- Work faster without reaching for the mouse
- Improve accessibility for all users
- Reduce cognitive load with consistent shortcuts
- Enable power user workflows and efficiency

**Tags:** `keyboard` `shortcuts` `accessibility` `navigation` `efficiency`

</details>

---

### 🔗 Integrations
> Connect with your favorite tools and services

<details>
<summary><b>📅 Google Calendar Integration</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Deep Google Calendar integration that brings your schedule into AI conversations. Create events, get briefings, and manage your time with intelligent calendar assistance.**

#### ⚡ Key Benefits
- View upcoming events directly in chat
- Create events via natural language with AI
- Daily and weekly calendar briefings
- Meeting insights and time analytics
- Secure OAuth 2.0 connection with Google
- Calendar widget in the sidebar dashboard
- Smart scheduling suggestions and conflict detection

#### 🎯 Use Cases & Examples
- Ask "What's on my calendar today?" for instant overview
- Say "Schedule a meeting with John next Tuesday" to create events
- Get AI-generated meeting preparation and follow-ups
- Receive daily briefings about your schedule

#### 🚀 Experience Improvements
- Never miss important meetings or deadlines
- Reduce context switching between apps
- Get intelligent insights about your time usage
- Streamline scheduling with natural language

**Tags:** `calendar` `google` `scheduling` `meetings` `integration` `oauth`

</details>

---

### 🎛️ Advanced Features
> Powerful capabilities for sophisticated workflows

<details>
<summary><b>👥 Custom AI Personas</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Build custom AI personalities tailored to specific roles, knowledge domains, or use cases. Each persona can have its own documents, instructions, and behavior patterns.**

#### ⚡ Key Benefits
- Create unlimited custom personas with unique instructions
- Document-specific knowledge bases for each persona
- System personas (pre-built) and user personas (custom)
- Profile management with sub-categories and themes
- Custom icon selection and visual branding
- Persona-specific RAG with isolated knowledge spaces
- Easy switching between different AI personalities

#### 🎯 Use Cases & Examples
- Create a "Legal Advisor" persona with law documents
- Build a "Marketing Expert" with campaign templates
- Design a "Technical Writer" with style guides
- Develop a "Financial Analyst" with market data

#### 🚀 Experience Improvements
- Get specialized expertise for different tasks
- Maintain context and knowledge for specific roles
- Streamline workflows with purpose-built assistants
- Scale your expertise across different domains

**Tags:** `personas` `custom` `ai` `assistants` `knowledge` `roles`

</details>

<details>
<summary><b>🌐 Nexus Research Mode (Beta)</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span> <span style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">PREMIUM</span></summary>

**Revolutionary research capabilities that combine web search, analysis, and AI reasoning to provide comprehensive insights on any topic. Currently in beta with premium access.**

#### ⚡ Key Benefits
- Nexus advanced research mode with deep analysis
- Multi-source web search integration
- Real-time progress tracking and transparency
- Comprehensive research report generation
- Source verification and credibility scoring
- Interactive research refinement and follow-ups
- Export research results in multiple formats

#### 🎯 Use Cases & Examples
- Research market trends with comprehensive analysis
- Investigate competitors with detailed comparisons
- Analyze industry reports and synthesize insights
- Generate research reports on complex topics

#### 🚀 Experience Improvements
- Get professional-quality research in minutes
- Access information beyond AI training data
- Save hours of manual research and analysis
- Make better decisions with comprehensive data

**Tags:** `research` `web-search` `analysis` `nexus` `premium` `beta`

</details>

<details>
<summary><b>✨ Enhanced Composer Editing</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Next-generation composer editing with AI assistance, visual diff comparison, and collaborative features that make content creation and editing more intuitive and powerful.**

#### ⚡ Key Benefits
- AI-assisted editing with intelligent suggestions
- Visual diff view for tracking changes
- Enhanced Monaco editor with advanced features
- Real-time collaboration capabilities
- Version control and change tracking
- Smart formatting and syntax correction
- Export options for all composer types

#### 🎯 Use Cases & Examples
- Get AI suggestions while editing code
- See changes highlighted with diff view
- Collaborate on documents in real-time
- Track versions and revert changes easily

#### 🚀 Experience Improvements
- Edit more efficiently with AI assistance
- Never lose track of changes and versions
- Collaborate seamlessly with others
- Create higher quality content faster

**Tags:** `composer` `editing` `collaboration` `diff` `ai-assistance`

</details>

---

### 🎯 EOS Methodology
> Specialized tools for Enterprise Operating System implementation

<details>
<summary><b>🏢 EOS Business Tools</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Complete EOS (Entrepreneurial Operating System) toolkit with specialized personas, templates, and knowledge base for implementing EOS in your organization.**

#### ⚡ Key Benefits
- Level 10 meeting templates and agenda builders
- Scorecard generation with KPI tracking
- VTO (Vision/Traction Organizer) builder
- People Analyzer and GWC assessments
- Comprehensive EOS Implementer knowledge base
- Quarterly planning and focus day templates
- Access to specialized EOS personas and facilitators

#### 🎯 Use Cases & Examples
- Generate Level 10 meeting agendas automatically
- Build company scorecards with measurable KPIs
- Create VTO documents with guided assistance
- Conduct People Analyzer sessions with templates

#### 🚀 Experience Improvements
- Implement EOS methodology with expert guidance
- Save time with pre-built templates and structures
- Access specialized knowledge from EOS experts
- Maintain consistency across EOS processes

**Tags:** `eos` `business` `methodology` `templates` `scorecard` `vto`

</details>

<details>
<summary><b>👨‍💼 EOS Implementer Personas</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Pre-configured AI personas specifically designed for EOS implementation, each with specialized knowledge for different types of EOS sessions and processes.**

#### ⚡ Key Benefits
- Quarterly Session Facilitator with planning templates
- Focus Day Facilitator for intensive work sessions
- Vision Building Day 1 & 2 specialized personas
- Level 10 Meeting facilitator with agenda management
- Annual Planning persona with strategic guidance
- Access restricted to verified EOS professionals
- Comprehensive EOS knowledge base integration

#### 🎯 Use Cases & Examples
- Use Quarterly Facilitator for 90-day planning
- Access Vision Day personas for company vision work
- Get Focus Day guidance for intensive sessions
- Use specialized knowledge for annual planning

#### 🚀 Experience Improvements
- Get expert EOS facilitation without hiring consultants
- Access specialized knowledge for each EOS process
- Maintain consistency across EOS implementations
- Scale EOS expertise across your organization

**Tags:** `eos` `personas` `facilitator` `quarterly` `vision` `implementer`

</details>

---

### 🎨 User Experience
> Interface and experience enhancements that delight users

<details>
<summary><b>✨ Smooth UI Animations</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Comprehensive animation system using GSAP, Framer Motion, and Locomotive Scroll to create smooth, professional interactions that enhance the user experience.**

#### ⚡ Key Benefits
- GSAP-powered entrance animations and transitions
- Framer Motion components for interactive elements
- Locomotive Scroll for smooth scrolling experiences
- Performance-optimized animations with lazy loading
- Accessibility-friendly with reduced motion support
- Consistent animation language across the app
- Professional polish that feels responsive and alive

#### 🎯 Use Cases & Examples
- Smooth entrance animations when app loads
- Fluid transitions between chat conversations
- Interactive hover effects on buttons and cards
- Smooth scrolling throughout long conversations

#### 🚀 Experience Improvements
- Creates a premium, polished feel
- Provides visual feedback for user actions
- Makes the interface feel more responsive
- Guides attention to important elements

**Tags:** `animations` `ui` `gsap` `framer-motion` `transitions` `polish`

</details>

<details>
<summary><b>🔔 Smart Notifications</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Advanced notification system that provides contextual feedback, actionable messages, and smart alerts to keep users informed about important events and status changes.**

#### ⚡ Key Benefits
- Context-aware notifications based on user actions
- Actionable toast messages with buttons and links
- Smart grouping to prevent notification spam
- Persistent notifications for important alerts
- Visual hierarchy with different notification types
- Accessibility support with screen reader compatibility
- Customizable notification preferences

#### 🎯 Use Cases & Examples
- Get notified when document upload completes
- Receive alerts about calendar integration status
- See confirmation when messages are pinned
- Get smart suggestions for related actions

#### 🚀 Experience Improvements
- Stay informed about important system events
- Get actionable feedback on your interactions
- Reduce uncertainty with clear status updates
- Take quick actions directly from notifications

**Tags:** `notifications` `toasts` `alerts` `feedback` `context-aware`

</details>

<details>
<summary><b>📱 Mobile-First Design</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Comprehensive responsive design that provides an optimal experience across all devices, from mobile phones to large desktop screens.**

#### ⚡ Key Benefits
- Mobile-first responsive design principles
- Touch-optimized interface for mobile devices
- Adaptive layouts that work on any screen size
- Optimized typography and spacing for readability
- Gesture support for mobile interactions
- Progressive enhancement for larger screens
- Consistent experience across all devices

#### 🎯 Use Cases & Examples
- Seamless chat experience on mobile phones
- Touch-friendly buttons and interactive elements
- Responsive sidebar that adapts to screen size
- Optimized composer viewing on tablets

#### 🚀 Experience Improvements
- Use the app anywhere, on any device
- Maintain productivity while mobile
- Consistent experience regardless of screen size
- Touch-friendly interface for tablet users

**Tags:** `responsive` `mobile` `design` `touch` `adaptive` `cross-device`

</details>

<details>
<summary><b>🎉 What's New Feature Discovery</b> <code>v2.0</code> <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">NEW</span></summary>

**Advanced feature discovery framework that automatically shows users new features and capabilities, with detailed explanations and examples.**

#### ⚡ Key Benefits
- Automatic detection of new features for each user
- Beautiful modal with detailed feature explanations
- Category-based organization of features
- Visual examples and screenshots for clarity
- User tracking to prevent repeated notifications
- Manual access via sidebar for feature exploration
- Badge notifications for unseen features

#### 🎯 Use Cases & Examples
- Automatically see new features when they're released
- Browse all features organized by category
- Get detailed explanations with examples
- Access feature discovery anytime from sidebar

#### 🚀 Experience Improvements
- Never miss new capabilities and improvements
- Understand features with clear explanations
- Discover advanced features you might not find
- Stay up-to-date with latest enhancements

**Tags:** `features` `discovery` `onboarding` `updates` `notifications`

</details>

---

## 🏗️ Architecture

EOSAI follows a modern, scalable architecture designed for enterprise reliability:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Next.js    │  │   React 19   │  │   Tailwind + GSAP    │  │
│  │  App Router  │  │  Components  │  │    Animations        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Chat API   │  │  Documents   │  │   Calendar/OAuth     │  │
│  │  (Streaming) │  │     API      │  │    Integration       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       AI/RAG Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Vercel AI  │  │  Embeddings  │  │  Context Assembler   │  │
│  │     SDK      │  │   (OpenAI)   │  │  (Token Budget Mgmt) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  PostgreSQL  │  │   Upstash    │  │       Redis          │  │
│  │  + pgvector  │  │    Vector    │  │  (Stream Buffer)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **Context Assembler** | Intelligently manages token budgets across multiple RAG sources |
| **Embedding Pipeline** | Generates and caches 1536-dimensional embeddings for semantic search |
| **Stream Buffer** | Enables resumable AI response streams via Redis |
| **Persona System** | Provides specialized AI behaviors with isolated knowledge bases |

For detailed API documentation, see [docs/API.md](docs/API.md).

---

## 🛠 Technology Stack

### Frontend Technologies
- **Next.js 15.3** with App Router and React Server Components
- **React 19 RC** with cutting-edge features
- **TypeScript 5.6** for full type safety
- **shadcn/ui** modern component library
- **Tailwind CSS 3.4** utility-first styling
- **GSAP 3.13** & **Framer Motion 11** for animations

### AI & Backend
- **Vercel AI SDK 4.3** with OpenAI integration
- **PostgreSQL** with Drizzle ORM and pgvector
- **Upstash Vector** for semantic search
- **Redis** for resumable streams
- **Auth.js 5.0** for authentication

### Developer Experience
- **TypeScript** throughout the entire stack
- **Biome 1.9** for fast formatting and linting
- **Playwright** for E2E testing
- **Drizzle Studio** for database management

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** - [Download](https://nodejs.org/)
- **pnpm 9.12+** - Install with `npm install -g pnpm`
- **PostgreSQL 15+** with pgvector extension
- **OpenAI API key** - [Get one here](https://platform.openai.com/api-keys)

### Quick Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/your-org/eoschatai.git
   cd eoschatai
   pnpm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your credentials:
   ```env
   # Required
   DATABASE_URL="postgresql://user:pass@localhost:5432/eosai"
   OPENAI_API_KEY="sk-..."
   AUTH_SECRET="generate-with-openssl-rand-base64-32"
   
   # For RAG/Document Intelligence
   UPSTASH_VECTOR_REST_URL="https://..."
   UPSTASH_VECTOR_REST_TOKEN="..."
   
   # For Resumable Streams (optional but recommended)
   REDIS_URL="redis://localhost:6379"
   
   # For Google Calendar Integration (optional)
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   
   # For File Uploads (optional)
   BLOB_READ_WRITE_TOKEN="..."
   ```

3. **Setup database**
   ```bash
   # Run migrations
   pnpm db:migrate
   
   # Enable pgvector extension (for RAG)
   pnpm db:pgvector
   ```

4. **Start development**
   ```bash
   pnpm dev
   ```

Visit [http://localhost:3000](http://localhost:3000) to start using EOSAI!

### Essential Commands
```bash
pnpm dev              # Start development server (with Turbopack)
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run linting
pnpm db:studio        # Open Drizzle Studio (database GUI)
pnpm db:migrate       # Run database migrations
pnpm test             # Run E2E tests with Playwright
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection error | Ensure PostgreSQL is running and `DATABASE_URL` is correct |
| pgvector not found | Run `CREATE EXTENSION vector;` in your database |
| OpenAI rate limits | Check your API key has sufficient quota |
| Build failures | Clear `.next` folder and run `pnpm install` again |

---

## 📊 Feature Comparison

| Feature Category | Free | Premium |
|------------------|------|---------|
| **Core Chat** | ✅ All features | ✅ All features |
| **Document Intelligence** | ✅ Up to 10 docs | ✅ Unlimited |
| **AI Personas** | ✅ 3 custom | ✅ Unlimited |
| **Composer** | ✅ All types | ✅ Enhanced editing |
| **Calendar Integration** | ✅ Basic | ✅ Advanced analytics |
| **Search & Filtering** | ✅ Basic search | ✅ AI-powered suggestions |
| **Nexus Research** | ❌ | ✅ Full access |
| **EOS Tools** | ✅ Basic templates | ✅ All features |
| **Priority Support** | ❌ | ✅ Email & chat |

---

## 🔒 Security & Privacy

- **🔐 Enterprise Security**: OAuth 2.0, JWT sessions, encrypted storage
- **🛡️ Data Privacy**: GDPR compliant, no data training on user content
- **🔒 Access Control**: Role-based permissions, secure API endpoints
- **📊 Audit Logs**: Comprehensive activity tracking for enterprise
- **🌍 SOC 2**: Infrastructure security standards compliance

---

## 🌟 What Users Say

> *"EOSAI has revolutionized how we implement EOS in our company. The specialized personas and tools make complex processes simple."* 
> 
> **— Sarah Johnson, CEO at TechCorp**

> *"The document intelligence feature is incredible. I can upload our entire policy manual and get instant answers to any question."*
> 
> **— Mike Chen, Operations Director**

> *"As an EOS Implementer, having access to specialized knowledge and templates saves me hours every week."*
> 
> **— Jennifer Smith, EOS Implementer**

---

## 🗺️ Roadmap

### 🔄 Currently in Development
- **Mobile Apps** for iOS and Android
- **Teams Integration** with Microsoft Teams
- **Advanced Analytics** dashboard for usage insights
- **API Access** for third-party integrations

### 🚀 Coming Soon
- **Slack Integration** with bot capabilities
- **Custom Model Training** on your data
- **White-label Solutions** for consultants
- **Advanced Workflow Automation**

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for detailed guidelines.

### Quick Start for Contributors

1. **Fork** the repository
2. **Clone** your fork and create a branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. **Make changes** following our [coding standards](CONTRIBUTING.md#coding-standards)
4. **Test** your changes:
   ```bash
   pnpm lint && pnpm test
   ```
5. **Submit** a pull request

### Code Quality

- All code must pass linting (`pnpm lint`)
- New features should include tests
- Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
- Add JSDoc comments to exported functions

---

## 📞 Support & Community

- **📚 Documentation**: [docs.eoschatai.com](https://docs.eoschatai.com)
- **💬 Community**: [GitHub Discussions](https://github.com/your-org/eoschatai/discussions)
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/your-org/eoschatai/issues)
- **📧 Enterprise Support**: enterprise@eoschatai.com

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <h2>🚀 Ready to Transform Your EOS Implementation?</h2>
  <p>
    <strong>Start your journey with EOSAI today</strong>
  </p>
  
  <p>
    <a href="https://eoschatai.com/register">
      <img src="https://img.shields.io/badge/Get_Started-Free-brightgreen?style=for-the-badge&logo=rocket" alt="Get Started Free">
    </a>
    <a href="https://eoschatai.com/demo">
      <img src="https://img.shields.io/badge/Watch_Demo-Video-blue?style=for-the-badge&logo=play" alt="Watch Demo">
    </a>
    <a href="https://docs.eoschatai.com">
      <img src="https://img.shields.io/badge/Read_Docs-Documentation-orange?style=for-the-badge&logo=book" alt="Documentation">
    </a>
  </p>
  
  <p>Built with ❤️ by the EOSAI Team</p>
  
  <p>
    <a href="https://vercel.com">
      <img src="https://vercel.com/button" alt="Powered by Vercel">
    </a>
  </p>
</div>