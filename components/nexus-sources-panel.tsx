'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './ui/button';

interface Source {
  url: string;
  title: string;
  snippet?: string;
  content?: string;
  relevanceScore?: number;
}

interface NexusSourcesPanelProps {
  sources: Source[];
  isOpen: boolean;
  onClose: () => void;
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '/globe.svg';
  }
}

export function NexusSourcesPanel({
  sources,
  isOpen,
  onClose,
}: NexusSourcesPanelProps) {
  const [expandedSourceIndex, setExpandedSourceIndex] = useState<number | null>(
    null,
  );

  // Get unique domains for the preview
  const uniqueDomains = new Map<string, Source>();
  sources.forEach((source) => {
    try {
      const domain = new URL(source.url).hostname;
      if (!uniqueDomains.has(domain)) {
        uniqueDomains.set(domain, source);
      }
    } catch {}
  });
  const uniqueSources = Array.from(uniqueDomains.values());

  return (
    <>
      {/* Sources button with favicon preview */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex -space-x-2">
          {uniqueSources.slice(0, 5).map((source, i) => (
            <Image
              key={`favicon-${i}-${source.url}`}
              src={getFaviconUrl(source.url)}
              alt=""
              width={24}
              height={24}
              className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 bg-white"
              unoptimized
              style={{ zIndex: 5 - i }}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.src = '/globe.svg';
              }}
            />
          ))}
          {uniqueSources.length > 5 && (
            <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                +{uniqueSources.length - 5}
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onClose()}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-2"
        >
          <span>View {sources.length} sources & page contents</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Click-away overlay */}
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-transparent"
          onClick={onClose}
          aria-label="Close sources panel"
        />
      )}

      {/* Sources Panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out z-40',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-lg">Sources & References</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100%-4rem)]">
          {sources.map((source, index) => (
            <div
              key={`source-${index}-${source.url}`}
              className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedSourceIndex(
                    expandedSourceIndex === index ? null : index,
                  )
                }
                className="w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-start gap-3"
              >
                <Image
                  src={getFaviconUrl(source.url)}
                  alt=""
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded flex-shrink-0 mt-0.5"
                  unoptimized
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = '/globe.svg';
                  }}
                />
                <div className="flex-1 text-left">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-1">
                    {source.title}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                    {new URL(source.url).hostname}
                  </p>
                  {source.snippet && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">
                      {source.snippet}
                    </p>
                  )}
                </div>
                <svg
                  className={cn(
                    'w-4 h-4 text-gray-400 transition-transform flex-shrink-0',
                    expandedSourceIndex === index && 'rotate-90',
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              {expandedSourceIndex === index && source.content && (
                <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Page Content
                    </span>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Visit page →
                    </a>
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto">
                    {source.content}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
