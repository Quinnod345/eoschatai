'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  FolderOpen,
  FileText,
  Database,
  Cpu,
  BarChart3,
  Key,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  apiCategories,
  chatRequestParameters,
  errorCodes,
  errorHandlingExamples,
  type ApiEndpoint,
  type ApiCategory,
} from '@/lib/api-docs-data';

const categoryIcons: Record<string, LucideIcon> = {
  chat: MessageSquare,
  conversations: FolderOpen,
  documents: FileText,
  embeddings: Database,
  models: Cpu,
  usage: BarChart3,
};

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="p-4 rounded-lg bg-[#0a0a0f] border border-white/10 overflow-x-auto">
        <code className="text-sm text-white/80 font-mono whitespace-pre">
          {code}
        </code>
      </pre>
      <button
        type="button"
        onClick={copyCode}
        className="absolute top-2 right-2 p-2 rounded-md bg-white/5 text-white/80 hover:text-white hover:bg-white/10 opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eos-orange/60 transition-all"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4 text-white/80" />
        )}
      </button>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors = {
    GET: 'bg-blue-500/20 text-blue-400',
    POST: 'bg-green-500/20 text-green-400',
    PUT: 'bg-amber-500/20 text-amber-400',
    PATCH: 'bg-amber-500/20 text-amber-400',
    DELETE: 'bg-red-500/20 text-red-400',
  };

  return (
    <span
      className={`px-2.5 py-1 text-xs font-bold rounded-md ${colors[method as keyof typeof colors] || 'bg-gray-500/20 text-gray-400'}`}
    >
      {method}
    </span>
  );
}

function ParameterTable({
  parameters,
  title,
}: {
  parameters: {
    name: string;
    type: string;
    required: boolean;
    default?: string;
    description: string;
  }[];
  title: string;
}) {
  if (!parameters || parameters.length === 0) return null;

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold text-white mb-3">{title}</h4>
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                Parameter
              </th>
              <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                Type
              </th>
              <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                Required
              </th>
              <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {parameters.map((param) => (
              <tr key={param.name}>
                <td className="py-2.5 px-4">
                  <code className="text-sm text-eos-orange">{param.name}</code>
                </td>
                <td className="py-2.5 px-4">
                  <code className="text-xs text-white/80">{param.type}</code>
                </td>
                <td className="py-2.5 px-4">
                  {param.required ? (
                    <span className="text-xs text-amber-400">Yes</span>
                  ) : (
                    <span className="text-xs text-white/60">
                      No{param.default ? ` (${param.default})` : ''}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-sm text-white/80">
                  {param.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointSection({
  endpoint,
  isExpanded,
  onToggle,
}: { endpoint: ApiEndpoint; isExpanded: boolean; onToggle: () => void }) {
  const [activeTab, setActiveTab] = useState<'curl' | 'javascript' | 'python'>(
    'curl',
  );

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between bg-white/5 hover:bg-white/[0.07] transition-colors"
      >
        <div className="flex items-center gap-4">
          <MethodBadge method={endpoint.method} />
          <code className="text-white font-mono">{endpoint.path}</code>
          {endpoint.badge && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-eos-orange/20 text-eos-orange">
              {endpoint.badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/80 hidden md:block">
            {endpoint.summary}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-white/60" />
          ) : (
            <ChevronRight className="w-5 h-5 text-white/60" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-6 border-t border-white/10">
          {/* Description */}
          <p className="text-white/85 mb-6">{endpoint.description}</p>

          {/* Path Parameters */}
          {endpoint.pathParameters && (
            <ParameterTable
              parameters={endpoint.pathParameters}
              title="Path Parameters"
            />
          )}

          {/* Query Parameters */}
          {endpoint.queryParameters && (
            <ParameterTable
              parameters={endpoint.queryParameters}
              title="Query Parameters"
            />
          )}

          {/* Request Body */}
          {endpoint.requestBody && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-white mb-3">
                Request Body
              </h4>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <div className="p-3 bg-white/5 border-b border-white/10">
                  <code className="text-xs text-white/80">
                    {endpoint.requestBody.contentType}
                  </code>
                </div>
                <div className="p-4">
                  <h5 className="text-xs font-semibold text-white/70 uppercase mb-2">
                    Schema
                  </h5>
                  <div className="space-y-1">
                    {Object.entries(endpoint.requestBody.schema).map(
                      ([key, value]) => (
                        <div key={key} className="flex gap-3">
                          <code className="text-sm text-eos-orange">{key}</code>
                          <span className="text-sm text-white/70">
                            {String(value)}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                  <h5 className="text-xs font-semibold text-white/70 uppercase mt-4 mb-2">
                    Example
                  </h5>
                  <CodeBlock
                    code={JSON.stringify(endpoint.requestBody.example, null, 2)}
                    language="json"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Response */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-white mb-3">Response</h4>
            {endpoint.responses.map((response) => (
              <div
                key={`${response.status}-${response.description}`}
                className="rounded-lg border border-white/10 overflow-hidden"
              >
                <div className="p-3 bg-white/5 border-b border-white/10 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded ${
                      response.status < 300
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {response.status}
                  </span>
                  <span className="text-sm text-white/80">
                    {response.description}
                  </span>
                </div>
                <div className="p-4">
                  <CodeBlock
                    code={JSON.stringify(response.example, null, 2)}
                    language="json"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Code Examples */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-white mb-3">
              Code Examples
            </h4>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              {/* Tabs */}
              <div className="flex items-center gap-1 px-4 py-2 bg-white/5 border-b border-white/10">
                {(['curl', 'javascript', 'python'] as const).map((tab) => (
                  <button
                    type="button"
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === tab
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {tab === 'curl'
                      ? 'cURL'
                      : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <div className="p-4">
                <CodeBlock
                  code={endpoint.codeExamples[activeTab]}
                  language={activeTab}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategorySection({ category }: { category: ApiCategory }) {
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(
    new Set(),
  );
  const Icon = categoryIcons[category.id] || MessageSquare;

  const toggleEndpoint = (key: string) => {
    const newExpanded = new Set(expandedEndpoints);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedEndpoints(newExpanded);
  };

  return (
    <section id={category.id} className="scroll-mt-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-eos-orange/10">
          <Icon className="w-5 h-5 text-eos-orange" />
        </div>
        <div>
          <h2 className="font-montserrat text-xl font-bold text-white">
            {category.title}
          </h2>
          <p className="text-sm text-white/80">{category.description}</p>
        </div>
      </div>

      <div className="space-y-4">
        {category.endpoints.map((endpoint) => {
          const key = `${endpoint.method}-${endpoint.path}`;
          return (
            <EndpointSection
              key={key}
              endpoint={endpoint}
              isExpanded={expandedEndpoints.has(key)}
              onToggle={() => toggleEndpoint(key)}
            />
          );
        })}
      </div>
    </section>
  );
}

export default function ApiReferencePage() {
  const [activeSection, setActiveSection] = useState('chat');

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0d0d14] to-[#0a0a0f]">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Docs</span>
            </Link>
            <span className="text-white/50">|</span>
            <div className="flex items-center gap-2">
              <Image
                src="/images/eos-model-bulb.svg"
                alt="EOSAI"
                width={24}
                height={24}
                className="brightness-110"
              />
              <span className="font-montserrat text-sm font-semibold text-white">
                EOSAI API Reference
              </span>
            </div>
          </div>
          <Link href="/chat?settings=api-keys">
            <Button size="sm" className="bg-eos-orange hover:bg-eos-orange/90">
              <Key className="w-4 h-4 mr-2" />
              Get API Key
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex pt-14">
        {/* Sidebar */}
        <aside className="hidden lg:block fixed left-0 top-14 w-64 h-[calc(100vh-56px)] border-r border-white/10 bg-black/30 overflow-y-auto">
          <nav className="p-4 space-y-6">
            {/* Base URL */}
            <div className="pb-4 border-b border-white/10">
              <h3 className="text-xs font-semibold text-white/60 uppercase mb-2">
                Base URL
              </h3>
              <code className="text-sm text-eos-orange break-all">
                https://eosbot.ai/api
              </code>
            </div>

            {/* Categories */}
            <div>
              <h3 className="text-xs font-semibold text-white/60 uppercase mb-3">
                Endpoints
              </h3>
              <ul className="space-y-1">
                {apiCategories.map((category) => {
                  const Icon = categoryIcons[category.id] || MessageSquare;
                  return (
                    <li key={category.id}>
                      <a
                        href={`#${category.id}`}
                        onClick={() => setActiveSection(category.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeSection === category.id
                            ? 'bg-eos-orange/10 text-eos-orange'
                            : 'text-white/80 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {category.title}
                        <span className="ml-auto text-xs text-white/60">
                          {category.endpoints.length}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Quick Links */}
            <div className="pt-4 border-t border-white/10">
              <h3 className="text-xs font-semibold text-white/60 uppercase mb-3">
                Reference
              </h3>
              <ul className="space-y-1">
                <li>
                  <a
                    href="#authentication"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Key className="w-4 h-4" />
                    Authentication
                  </a>
                </li>
                <li>
                  <a
                    href="#errors"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Error Codes
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 px-6 py-8 max-w-5xl">
          {/* Hero */}
          <div className="mb-12">
            <h1 className="font-montserrat text-3xl font-bold text-white mb-3">
              EOSAI API Reference
            </h1>
            <p className="text-white/80 max-w-2xl">
              Complete reference documentation for the EOSAI API. Build
              applications with EOS methodology intelligence built-in.
            </p>
          </div>

          {/* Authentication Section */}
          <section id="authentication" className="mb-12 scroll-mt-20">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-eos-orange/10">
                  <Key className="w-5 h-5 text-eos-orange" />
                </div>
                <h2 className="font-montserrat text-xl font-bold text-white">
                  Authentication
                </h2>
              </div>
              <p className="text-white/85 mb-4">
                All API requests require authentication via API key. Include
                your key in the request header:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">
                    Bearer Token (Recommended)
                  </h4>
                  <CodeBlock
                    code={`Authorization: Bearer YOUR_API_KEY`}
                    language="text"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">
                    X-API-Key Header
                  </h4>
                  <CodeBlock code={`X-API-Key: YOUR_API_KEY`} language="text" />
                </div>
              </div>
            </div>
          </section>

          {/* Chat Request Parameters (detailed) */}
          <section className="mb-12">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h2 className="font-montserrat text-xl font-bold text-white mb-4">
                Chat Request Parameters
              </h2>
              <p className="text-white/80 mb-4">
                Complete list of parameters for the{' '}
                <code className="text-eos-orange">/v1/chat</code> endpoint:
              </p>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                        Parameter
                      </th>
                      <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                        Type
                      </th>
                      <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                        Required
                      </th>
                      <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                        Default
                      </th>
                      <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {chatRequestParameters.map((param) => (
                      <tr key={param.name}>
                        <td className="py-2.5 px-4">
                          <code className="text-sm text-eos-orange">
                            {param.name}
                          </code>
                        </td>
                        <td className="py-2.5 px-4">
                          <code className="text-xs text-white/80">
                            {param.type}
                          </code>
                        </td>
                        <td className="py-2.5 px-4">
                          {param.required ? (
                            <span className="text-xs text-amber-400">Yes</span>
                          ) : (
                            <span className="text-xs text-white/60">No</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <code className="text-xs text-white/60">
                            {param.default || '-'}
                          </code>
                        </td>
                        <td className="py-2.5 px-4 text-sm text-white/80">
                          {param.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* API Categories */}
          <div className="space-y-12">
            {apiCategories.map((category) => (
              <CategorySection key={category.id} category={category} />
            ))}
          </div>

          {/* Error Codes Section */}
          <section id="errors" className="mt-12 scroll-mt-20">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <h2 className="font-montserrat text-xl font-bold text-white">
                  Error Codes
                </h2>
              </div>
              <p className="text-white/85 mb-4">
                All errors follow a standard format with a message, type, code,
                and optional parameter field.
              </p>
              <CodeBlock
                code={JSON.stringify(
                  {
                    error: {
                      message: 'Invalid API key',
                      type: 'authentication_error',
                      code: 'invalid_api_key',
                      param: null,
                    },
                  },
                  null,
                  2,
                )}
                language="json"
              />
              <div className="mt-6 rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                        Status
                      </th>
                      <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                        Type
                      </th>
                      <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                        Code
                      </th>
                      <th className="text-left py-2 px-4 text-xs font-semibold text-white/70">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {errorCodes.map((error) => (
                      <tr key={error.code}>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 text-xs font-bold rounded ${
                              error.status < 500
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {error.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <code className="text-xs text-white/80">
                            {error.type}
                          </code>
                        </td>
                        <td className="py-2.5 px-4">
                          <code className="text-sm text-eos-orange">
                            {error.code}
                          </code>
                        </td>
                        <td className="py-2.5 px-4 text-sm text-white/80">
                          {error.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Error Handling Examples */}
          <section id="error-handling" className="mt-12 scroll-mt-20">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h2 className="font-montserrat text-xl font-bold text-white mb-4">
                Error Handling Best Practices
              </h2>
              <p className="text-white/80 mb-6">
                Always implement proper error handling with retry logic for rate
                limits and server errors. Here are production-ready examples:
              </p>

              {/* JavaScript Example */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white mb-3">
                  JavaScript / TypeScript
                </h3>
                <CodeBlock
                  code={errorHandlingExamples.javascript}
                  language="javascript"
                />
              </div>

              {/* Python Example */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">
                  Python
                </h3>
                <CodeBlock
                  code={errorHandlingExamples.python}
                  language="python"
                />
              </div>

              {/* Best Practices List */}
              <div className="mt-6 p-4 rounded-lg bg-eos-orange/10 border border-eos-orange/20">
                <h4 className="text-sm font-semibold text-eos-orange mb-3">
                  Key Best Practices
                </h4>
                <ul className="space-y-2 text-sm text-white/85">
                  <li className="flex items-start gap-2">
                    <span className="text-eos-orange">1.</span>
                    <span>
                      Always use exponential backoff for retries (double the
                      delay each attempt)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-eos-orange">2.</span>
                    <span>
                      Check the Retry-After header on 429 responses for exact
                      wait time
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-eos-orange">3.</span>
                    <span>
                      Set a maximum retry limit (3-5 attempts) to avoid infinite
                      loops
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-eos-orange">4.</span>
                    <span>Log error codes and messages for debugging</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-eos-orange">5.</span>
                    <span>
                      Use timeouts to prevent hanging requests (60s recommended)
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Rate Limits */}
          <section className="mt-12 mb-12">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h2 className="font-montserrat text-xl font-bold text-white mb-4">
                Rate Limits
              </h2>
              <p className="text-white/80 mb-4">
                API keys have per-minute and daily request limits. Rate limit
                headers are included in all responses.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Default Limits
                  </h4>
                  <ul className="space-y-2">
                    <li className="flex items-center justify-between">
                      <span className="text-white/80">Requests per minute</span>
                      <code className="text-eos-orange">60</code>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-white/80">Requests per day</span>
                      <code className="text-eos-orange">1,000</code>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Response Headers
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <code className="text-eos-orange">
                        X-RateLimit-Limit-RPM
                      </code>
                    </li>
                    <li>
                      <code className="text-eos-orange">
                        X-RateLimit-Remaining-RPM
                      </code>
                    </li>
                    <li>
                      <code className="text-eos-orange">
                        X-RateLimit-Limit-RPD
                      </code>
                    </li>
                    <li>
                      <code className="text-eos-orange">
                        X-RateLimit-Remaining-RPD
                      </code>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
