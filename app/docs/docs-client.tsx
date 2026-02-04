'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  Book, 
  Code, 
  Key, 
  Zap, 
  MessageSquare, 
  Shield, 
  ArrowRight,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  Terminal,
  FileCode,
  Gauge,
  Lock,
  Sparkles,
} from 'lucide-react';

const codeExamples = {
  curl: `curl -X POST https://eosbot.ai/api/v1/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "eosai-v1",
    "messages": [
      {"role": "user", "content": "What is a Level 10 Meeting?"}
    ]
  }'`,
  javascript: `const response = await fetch('https://eosbot.ai/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'eosai-v1',
    messages: [
      { role: 'user', content: 'What is a Level 10 Meeting?' }
    ],
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);`,
  python: `import requests

response = requests.post(
    'https://eosbot.ai/api/v1/chat',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'model': 'eosai-v1',
        'messages': [
            {'role': 'user', 'content': 'What is a Level 10 Meeting?'}
        ],
    }
)

data = response.json()
print(data['choices'][0]['message']['content'])`,
};

const endpoints = [
  {
    method: 'POST',
    path: '/v1/chat',
    description: 'Create a chat completion with EOS context',
    badge: 'Core',
  },
  {
    method: 'GET',
    path: '/v1/models',
    description: 'List available models and EOS namespaces',
    badge: null,
  },
  {
    method: 'GET',
    path: '/v1/usage',
    description: 'Get API key usage statistics',
    badge: null,
  },
];

const features = [
  {
    icon: Sparkles,
    title: 'EOS Knowledge Built-In',
    description: 'Every request includes EOS methodology context from our knowledge base.',
  },
  {
    icon: Zap,
    title: 'OpenAI Compatible',
    description: 'Drop-in replacement for OpenAI API. Use existing SDKs and tools.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'API keys with scopes, rate limiting, and usage tracking.',
  },
  {
    icon: Gauge,
    title: 'Streaming Support',
    description: 'Real-time streaming responses via Server-Sent Events.',
  },
];

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<'curl' | 'javascript' | 'python'>('curl');
  const [copied, setCopied] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();

  const copyCode = () => {
    navigator.clipboard.writeText(codeExamples[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGetApiKey = () => {
    if (session?.user) {
      // User is logged in - go to settings with API keys tab
      router.push('/chat?settings=api-keys');
    } else {
      // User is not logged in - go to login
      router.push('/login?redirect=/chat?settings=api-keys');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0d0d14] to-[#0a0a0f]">
      {/* Navigation */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/eos-model-bulb.svg"
              alt="EOSAI"
              width={32}
              height={32}
              className="brightness-110"
            />
            <span className="font-montserrat text-lg font-bold text-white">
              EOSAI
            </span>
            <span className="text-white/40 mx-2">/</span>
            <span className="font-montserrat text-lg text-white/80">
              API Docs
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/chat">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                Try Chat
              </Button>
            </Link>
            <Button size="sm" className="bg-eos-orange hover:bg-eos-orange/90" onClick={handleGetApiKey}>
              Get API Key
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-eos-orange/10 border border-eos-orange/20 mb-6">
              <Code className="w-4 h-4 text-eos-orange" />
              <span className="text-sm font-medium text-eos-orange">Public API v1</span>
            </div>
            <h1 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Build with{' '}
              <span className="bg-gradient-to-r from-eos-orange to-amber-400 bg-clip-text text-transparent">
                EOS Intelligence
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-8">
              OpenAI-compatible REST API with built-in EOS methodology knowledge. 
              Add EOS expertise to any application in minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="bg-eos-orange hover:bg-eos-orange/90 gap-2" onClick={handleGetApiKey}>
                <Key className="w-4 h-4" />
                Get Your API Key
              </Button>
              <a href="#quickstart">
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 gap-2">
                  <Book className="w-4 h-4" />
                  View Documentation
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6 border-y border-white/5">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
              >
                <feature.icon className="w-8 h-8 text-eos-orange mb-4" />
                <h3 className="font-montserrat font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/60">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section id="quickstart" className="py-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="font-montserrat text-3xl font-bold text-white mb-4">Quick Start</h2>
            <p className="text-white/60">Get up and running in under a minute</p>
          </div>

          {/* Code Example */}
          <div className="rounded-2xl bg-[#0d0d14] border border-white/10 overflow-hidden">
            {/* Tabs */}
            <div className="flex items-center gap-1 px-4 pt-4 border-b border-white/10">
              {(['curl', 'javascript', 'python'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {tab === 'curl' ? 'cURL' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
              <div className="flex-1" />
              <button
                onClick={copyCode}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/50 hover:text-white transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Code */}
            <pre className="p-6 overflow-x-auto">
              <code className="text-sm text-white/80 font-mono whitespace-pre">
                {codeExamples[activeTab]}
              </code>
            </pre>
          </div>

          {/* Steps */}
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-eos-orange/20 flex items-center justify-center">
                <span className="font-montserrat font-bold text-eos-orange">1</span>
              </div>
              <div>
                <h3 className="font-montserrat font-semibold text-white mb-1">Get an API Key</h3>
                <p className="text-sm text-white/60">Sign up and generate your API key from the dashboard settings.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-eos-orange/20 flex items-center justify-center">
                <span className="font-montserrat font-bold text-eos-orange">2</span>
              </div>
              <div>
                <h3 className="font-montserrat font-semibold text-white mb-1">Make a Request</h3>
                <p className="text-sm text-white/60">Send a POST request to the chat endpoint with your message.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-eos-orange/20 flex items-center justify-center">
                <span className="font-montserrat font-bold text-eos-orange">3</span>
              </div>
              <div>
                <h3 className="font-montserrat font-semibold text-white mb-1">Get EOS Insights</h3>
                <p className="text-sm text-white/60">Receive AI responses powered by EOS methodology knowledge.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section className="py-20 px-6 bg-white/[0.02]">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="font-montserrat text-3xl font-bold text-white mb-4">API Endpoints</h2>
            <p className="text-white/60">All endpoints use base URL: <code className="text-eos-orange">https://eosbot.ai/api</code></p>
          </div>

          <div className="space-y-4">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.path}
                className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 text-xs font-bold rounded-md ${
                      endpoint.method === 'POST' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {endpoint.method}
                    </span>
                    <code className="text-white font-mono">{endpoint.path}</code>
                    {endpoint.badge && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-eos-orange/20 text-eos-orange">
                        {endpoint.badge}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
                </div>
                <p className="mt-3 text-sm text-white/60">{endpoint.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Models */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="font-montserrat text-3xl font-bold text-white mb-4">Available Models</h2>
            <p className="text-white/60">Choose the right model for your use case</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Terminal className="w-6 h-6 text-eos-orange" />
                <h3 className="font-montserrat font-semibold text-white">eosai-v1</h3>
              </div>
              <p className="text-sm text-white/60 mb-4">Default model. Best balance of speed and quality for EOS guidance.</p>
              <div className="text-xs text-white/40">
                <div>Context: 200K tokens</div>
                <div>Max output: 4,096 tokens</div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-6 h-6 text-amber-400" />
                <h3 className="font-montserrat font-semibold text-white">eosai-v1-fast</h3>
              </div>
              <p className="text-sm text-white/60 mb-4">Optimized for quick responses. Great for real-time applications.</p>
              <div className="text-xs text-white/40">
                <div>Context: 200K tokens</div>
                <div>Max output: 4,096 tokens</div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-eos-orange/20 to-eos-orange/5 border border-eos-orange/20">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-eos-orange" />
                <h3 className="font-montserrat font-semibold text-white">eosai-v1-pro</h3>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-eos-orange/20 text-eos-orange">Pro</span>
              </div>
              <p className="text-sm text-white/60 mb-4">Enhanced reasoning for complex EOS scenarios.</p>
              <div className="text-xs text-white/40">
                <div>Context: 200K tokens</div>
                <div>Max output: 16,384 tokens</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Authentication */}
      <section className="py-20 px-6 bg-white/[0.02]">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-montserrat text-3xl font-bold text-white mb-4">Authentication</h2>
              <p className="text-white/60 mb-6">
                All API requests require authentication via API key. Include your key in the Authorization header.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-eos-orange mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Bearer Token</h4>
                    <p className="text-sm text-white/60">Include as <code className="text-eos-orange">Authorization: Bearer YOUR_KEY</code></p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Key className="w-5 h-5 text-eos-orange mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">X-API-Key Header</h4>
                    <p className="text-sm text-white/60">Alternative: <code className="text-eos-orange">X-API-Key: YOUR_KEY</code></p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-[#0d0d14] border border-white/10 p-6">
              <pre className="text-sm text-white/80 font-mono overflow-x-auto">
{`# Using Bearer token
curl https://eosbot.ai/api/v1/chat \\
  -H "Authorization: Bearer eosai_sk_..."

# Using X-API-Key header  
curl https://eosbot.ai/api/v1/chat \\
  -H "X-API-Key: eosai_sk_..."`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Rate Limits */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="font-montserrat text-3xl font-bold text-white mb-4">Rate Limits</h2>
            <p className="text-white/60">API keys have per-minute and daily request limits</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-6 font-montserrat font-semibold text-white">Limit Type</th>
                  <th className="text-left py-4 px-6 font-montserrat font-semibold text-white">Default</th>
                  <th className="text-left py-4 px-6 font-montserrat font-semibold text-white">Header</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-4 px-6 text-white/80">Requests per minute</td>
                  <td className="py-4 px-6 text-white/60">60</td>
                  <td className="py-4 px-6"><code className="text-eos-orange text-sm">X-RateLimit-Remaining-RPM</code></td>
                </tr>
                <tr>
                  <td className="py-4 px-6 text-white/80">Requests per day</td>
                  <td className="py-4 px-6 text-white/60">1,000</td>
                  <td className="py-4 px-6"><code className="text-eos-orange text-sm">X-RateLimit-Remaining-RPD</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="font-montserrat text-3xl font-bold text-white mb-4">Ready to Build?</h2>
          <p className="text-white/60 mb-8">
            Get your API key and start integrating EOS intelligence into your applications today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="bg-eos-orange hover:bg-eos-orange/90 gap-2" onClick={handleGetApiKey}>
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Link href="/chat">
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 gap-2">
                <MessageSquare className="w-4 h-4" />
                Try the Chat
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="container mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/images/eos-model-bulb.svg"
              alt="EOSAI"
              width={24}
              height={24}
              className="brightness-110"
            />
            <span className="text-sm text-white/60">© {new Date().getFullYear()} EOSAI. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-white/60 hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-white/60 hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/" className="text-sm text-white/60 hover:text-white transition-colors">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
