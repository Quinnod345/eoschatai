'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink } from 'lucide-react';

/**
 * Interactive API Reference Page
 *
 * Uses Scalar to render the OpenAPI spec at /openapi.yaml with a modern UI.
 * This provides full endpoint documentation, try-it-out functionality, and schema explorer.
 */
export default function ApiReferencePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initialized.current) return;
    initialized.current = true;

    // Load Scalar script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.min.js';
    script.async = true;
    script.onload = () => {
      if (containerRef.current && (window as unknown as { Scalar?: { createApiReference: (el: HTMLElement, config: unknown) => void } }).Scalar) {
        (window as unknown as { Scalar: { createApiReference: (el: HTMLElement, config: unknown) => void } }).Scalar.createApiReference(containerRef.current, {
          spec: {
            url: '/openapi.yaml',
          },
          theme: 'purple',
          layout: 'modern',
          darkMode: true,
          hideDarkModeToggle: false,
          hideDownloadButton: false,
          hideModels: false,
          showSidebar: true,
          defaultHttpClient: {
            targetKey: 'javascript',
            clientKey: 'fetch',
          },
          authentication: {
            preferredSecurityScheme: 'BearerAuth',
          },
          customCss: `
            .scalar-app {
              --scalar-background-1: #0a0a0f;
              --scalar-background-2: #0d0d14;
              --scalar-background-3: #13131a;
              --scalar-color-accent: #f97316;
              --scalar-color-1: #ffffff;
              --scalar-color-2: rgba(255, 255, 255, 0.7);
              --scalar-color-3: rgba(255, 255, 255, 0.5);
              --scalar-border-color: rgba(255, 255, 255, 0.1);
            }
          `,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (script.parentNode) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Minimal Header */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/docs" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Docs</span>
            </Link>
            <span className="text-white/20">|</span>
            <div className="flex items-center gap-2">
              <Image
                src="/images/eos-model-bulb.svg"
                alt="EOSAI"
                width={24}
                height={24}
                className="brightness-110"
              />
              <span className="font-montserrat text-sm font-semibold text-white">
                API Reference
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="/openapi.yaml" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              OpenAPI Spec
            </a>
            <Link href="/chat?settings=api-keys">
              <Button size="sm" className="bg-eos-orange hover:bg-eos-orange/90">
                Get API Key
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Scalar Container - offset for fixed header */}
      <div ref={containerRef} className="pt-14" style={{ minHeight: 'calc(100vh - 56px)' }} />
    </div>
  );
}
