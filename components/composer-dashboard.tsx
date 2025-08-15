'use client';

import useSWR from 'swr';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLoading } from '@/hooks/use-loading';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { useSidebar } from '@/components/ui/sidebar';
import { AdvancedSearch } from '@/components/advanced-search';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { useWindowSize } from 'usehooks-ts';
import { useSession } from 'next-auth/react';
import type { ArtifactKind } from '@/components/composer';
import { Button } from '@/components/ui/button';
import { fetcher } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChartPreview } from '@/components/chart-preview';

type Row = { id: string; title: string; kind: ArtifactKind; createdAt: string };

export function ArtifactDashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const kind = (params.get('dashboard') || 'text') as ArtifactKind;
  const { setLoading } = useLoading();
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const { data: session } = useSession();

  const { data, mutate, isLoading, isValidating } = useSWR<{
    documents: Row[];
  }>(kind ? `/api/documents?artifactKind=${kind}` : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 4000,
    revalidateIfStale: true,
    revalidateOnReconnect: true,
  });

  const rows = useMemo(() => data?.documents ?? [], [data]);
  const [cachedRows, setCachedRows] = useState<Row[]>([]);
  useEffect(() => {
    if (rows && rows.length > 0) setCachedRows(rows);
  }, [rows]);
  const displayRows = rows.length > 0 ? rows : cachedRows;
  const isInitialLoading = isLoading && displayRows.length === 0;
  const isRefreshing = !isLoading && isValidating;

  // Close global loading overlay once initial list is available or after a short safety timeout
  useEffect(() => {
    if (!isInitialLoading) {
      setLoading(false);
    }
  }, [isInitialLoading, setLoading]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, [setLoading]);

  const handleCreate = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('dashboard');
    url.searchParams.set('newArtifactKind', kind);
    router.replace(url.toString());
  }, [router, kind]);

  const handleOpen = useCallback(
    (doc: Row) => {
      const url = new URL(window.location.href);
      url.searchParams.delete('dashboard');
      url.searchParams.set('documentId', doc.id);
      url.searchParams.set('documentTitle', doc.title || 'Untitled');
      url.searchParams.set('artifactKind', doc.kind);
      router.replace(url.toString());
    },
    [router],
  );

  const handleRename = useCallback(
    async (doc: Row, newTitle: string) => {
      try {
        const res = await fetch(`/api/document?id=${doc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });
        if (!res.ok) throw new Error('Failed');
        toast.success('Renamed');
        mutate();
      } catch {
        toast.error('Rename failed');
      }
    },
    [mutate],
  );

  const handleDelete = useCallback(
    async (doc: Row) => {
      try {
        const res = await fetch(`/api/document?id=${doc.id}&all=true`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed');
        toast.success('Deleted');
        mutate();
      } catch {
        toast.error('Delete failed');
      }
    },
    [mutate],
  );

  const displayName: string = useMemo(() => {
    switch (kind) {
      case 'text':
        return 'Document';
      case 'sheet':
        return 'Spreadsheet';
      case 'chart':
        return 'Chart';
      case 'image':
        return 'Image';
      case 'code':
        return 'Code';
      case 'vto':
        return 'VTO';
      default:
        return String(kind).toUpperCase();
    }
  }, [kind]);

  const displayPlural: string = useMemo(() => {
    switch (kind) {
      case 'text':
        return 'Documents';
      case 'sheet':
        return 'Spreadsheets';
      case 'chart':
        return 'Charts';
      case 'image':
        return 'Images';
      case 'code':
        return 'Code';
      case 'vto':
        return "VTO's";
      default:
        return `${displayName}s`;
    }
  }, [kind, displayName]);

  return (
    <motion.div
      className="w-full h-full px-2 md:px-2 pt-0 pb-3"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {/* Top bar mirroring chat header */}
      <motion.header
        className="flex sticky top-0 bg-background pt-1.5 pb-3 items-center px-2 md:px-2 gap-1 md:gap-2 z-40"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 26 }}
      >
        {/* Left: sidebar toggle */}
        <div className="flex items-center gap-1 md:gap-2">
          <SidebarToggle />
        </div>

        {/* Center: search + new chat when sidebar is closed or on mobile */}
        {(!open || (windowWidth ?? 0) < 768) && (
          <div className="flex items-center gap-1 md:gap-2">
            <AdvancedSearch />
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-2 md:px-3"
              onClick={() => {
                router.push('/chat');
                router.refresh();
              }}
            >
              <MoreHorizontal className="hidden" />
              <span className="hidden md:inline">New Chat</span>
            </Button>
          </div>
        )}

        {/* Right: user avatar */}
        <div className="flex items-center gap-1 md:gap-2 ml-auto">
          {session?.user && (
            <SidebarUserNav user={session.user} className="header-user-nav" />
          )}
        </div>
      </motion.header>

      {/* Section title + create button */}
      <div className="flex items-center justify-between mt-2 px-2 md:px-2">
        <div className="text-base font-semibold">{displayPlural}</div>
        <Button size="sm" onClick={handleCreate}>
          {displayName === 'Document'
            ? 'Create Document'
            : `Create ${displayName}`}
        </Button>
      </div>

      {isInitialLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.article
              key={`skeleton-${i}-${displayName}`}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.24) }}
            >
              <div className="relative aspect-[4/3] w-full bg-muted/40 overflow-hidden">
                <div className="absolute inset-0 animate-pulse bg-zinc-200/40 dark:bg-zinc-700/30" />
              </div>
              <div className="p-2 space-y-1">
                <div className="h-3 w-2/3 rounded-md bg-zinc-200/60 dark:bg-zinc-700/50 animate-pulse" />
                <div className="h-3 w-1/3 rounded-md bg-zinc-200/40 dark:bg-zinc-700/30 animate-pulse" />
              </div>
            </motion.article>
          ))}
        </div>
      ) : displayRows.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No {displayName.toLowerCase()}s yet.
          <Button size="sm" className="ml-2" onClick={handleCreate}>
            {displayName === 'Document'
              ? 'Create Document'
              : `Create ${displayName}`}
          </Button>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        >
          {displayRows.map((row, i) => (
            <motion.article
              key={row.id}
              className="group rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 24,
                delay: Math.min(i * 0.03, 0.24),
              }}
              whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
              whileTap={{ scale: 0.98 }}
            >
              <button
                type="button"
                aria-label={`Open ${row.title || 'Untitled'}`}
                className="relative aspect-[4/3] w-full bg-muted/40 cursor-pointer"
                onClick={() => handleOpen(row)}
              >
                <PreviewBlock kind={row.kind} id={row.id} />
                {isRefreshing && (
                  <div className="absolute top-2 right-2 text-[11px] rounded-md px-2 py-0.5 bg-background/80 border border-zinc-200 dark:border-zinc-700">
                    Refreshing…
                  </div>
                )}
              </button>
              <div className="flex items-center justify-between p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {row.title || 'Untitled'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <InlineRenameMenuItem
                      initialValue={row.title}
                      onSave={(t) => handleRename(row, t)}
                    />
                    <DropdownMenuItem onClick={() => handleDelete(row)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.article>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

function InlineRenameMenuItem({
  initialValue,
  onSave,
}: { initialValue: string; onSave: (t: string) => void }) {
  return (
    <div className="px-2 py-1.5">
      <div className="text-xs mb-1">Rename</div>
      <Input
        defaultValue={initialValue}
        placeholder="New title"
        className="h-8"
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        onBlur={(e) => {
          const t = e.currentTarget.value.trim();
          if (t && t !== initialValue) onSave(t);
        }}
      />
    </div>
  );
}

function PreviewBlock({ kind, id }: { kind: ArtifactKind; id: string }) {
  const { data } = useSWR<any[]>(`/api/document?id=${id}`, fetcher);
  const content: string = data?.[data.length - 1]?.content || '';
  const [markdownHtml, setMarkdownHtml] = useState<string>('');

  // Render markdown for text previews
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (kind !== 'text' && kind !== 'code' && kind !== 'vto') return;
      try {
        const marked = await import('marked');
        const text = (content || '').toString();
        const snippet = text.length > 800 ? `${text.slice(0, 800)}…` : text;
        const html = marked.parse(snippet);
        if (!cancelled) setMarkdownHtml(String(html));
      } catch {
        if (!cancelled) setMarkdownHtml('');
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [content, kind]);

  if (kind === 'text' || kind === 'code') {
    return (
      <div className="absolute inset-0 p-3 overflow-hidden text-xs leading-5 text-left">
        {markdownHtml ? (
          <div
            className="prose prose-sm dark:prose-invert max-h-full overflow-hidden"
            dangerouslySetInnerHTML={{ __html: markdownHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words opacity-80 text-muted-foreground">
            {(content || '').slice(0, 240) || '—'}
          </pre>
        )}
      </div>
    );
  }

  if (kind === 'vto') {
    try {
      const hasBegin = content.includes('VTO_DATA_BEGIN');
      const hasEnd = content.includes('VTO_DATA_END');
      let jsonStr = '';
      if (hasBegin && hasEnd) {
        const start =
          content.indexOf('VTO_DATA_BEGIN') + 'VTO_DATA_BEGIN'.length;
        const end = content.indexOf('VTO_DATA_END');
        jsonStr = content.substring(start, end).trim();
      } else {
        const s = content.indexOf('{');
        const e = content.lastIndexOf('}') + 1;
        if (s >= 0 && e > s) jsonStr = content.substring(s, e);
      }
      if (jsonStr) {
        const vto = JSON.parse(jsonStr);
        const rockCounts: Record<string, number> = {};
        return (
          <div className="absolute inset-0 p-3 overflow-hidden text-[11px] leading-5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="font-semibold text-xs">1-Year Plan</div>
                <div className="text-muted-foreground">
                  {vto?.oneYearPlan?.futureDate || '-'}
                </div>
                <div className="text-muted-foreground">
                  Rev: {vto?.oneYearPlan?.revenue || '-'}
                </div>
                <div className="text-muted-foreground">
                  Profit: {vto?.oneYearPlan?.profit || '-'}
                </div>
              </div>
              <div>
                <div className="font-semibold text-xs">Rocks</div>
                <ul className="list-disc list-inside text-muted-foreground">
                  {(vto?.rocks?.rocks || []).slice(0, 3).map((r: string) => {
                    const val = r || '-';
                    const prev = rockCounts[val] || 0;
                    const next = prev + 1;
                    rockCounts[val] = next;
                    return <li key={`${id}-rock-${val}-${next}`}>{val}</li>;
                  })}
                </ul>
              </div>
            </div>
          </div>
        );
      }
    } catch {}
    return (
      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
        VTO
      </div>
    );
  }

  if (kind === 'image') {
    // Parse the content which might be JSON gallery or raw base64
    let base64Content: string | null = null;

    if (content) {
      const trimmedContent = content.trim();
      // Check if it's JSON gallery format
      if (trimmedContent.startsWith('{')) {
        try {
          const gallery = JSON.parse(trimmedContent);
          if (gallery?.images?.length > 0) {
            const activeImage = gallery.images[gallery.activeIndex || 0];
            if (activeImage?.versions?.length > 0) {
              const currentVersion =
                activeImage.versions[activeImage.currentVersionIndex || 0];
              base64Content = currentVersion?.base64 || null;
            }
          }
        } catch {
          // If parsing fails, assume it's raw base64
          base64Content = trimmedContent;
        }
      } else {
        // Raw base64
        base64Content = trimmedContent;
      }
    }

    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {base64Content ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="preview"
            src={`data:image/png;base64,${base64Content}`}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-xs text-muted-foreground">No Image</div>
        )}
      </div>
    );
  }

  if (kind === 'sheet') {
    // Render a mini table from CSV (first 5x5)
    const rows = (content || '')
      .split('\n')
      .slice(0, 5)
      .map((line) => line.split(',').slice(0, 5));
    return (
      <div className="absolute inset-0 p-3 overflow-hidden text-[11px]">
        <div className="w-full h-full overflow-hidden">
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {rows.map((r, rowIndex) => {
                const sig = r.join('|');
                const rowKey = `${id}-r-${rowIndex}-${sig}`;
                return (
                  <tr
                    key={rowKey}
                    className="border-b border-zinc-200 dark:border-zinc-800"
                  >
                    {r.map((c, colIndex) => {
                      const cellKey = `${id}-c-${rowIndex}-${colIndex}-${sig}-${String(c)}`;
                      return (
                        <td
                          key={cellKey}
                          className="px-2 py-1 truncate max-w-[6rem] border-r border-zinc-200 dark:border-zinc-800"
                        >
                          {c}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (kind === 'chart') {
    try {
      const hasBegin = content.includes('CHART_DATA_BEGIN');
      const hasEnd = content.includes('CHART_DATA_END');
      let jsonStr = '';
      if (hasBegin && hasEnd) {
        const start =
          content.indexOf('CHART_DATA_BEGIN') + 'CHART_DATA_BEGIN'.length;
        const end = content.indexOf('CHART_DATA_END');
        jsonStr = content.substring(start, end).trim();
      } else {
        const s = content.indexOf('{');
        const e = content.lastIndexOf('}') + 1;
        if (s >= 0 && e > s) jsonStr = content.substring(s, e);
      }
      if (jsonStr) {
        return (
          <div className="absolute inset-0 flex items-center justify-center">
            <ChartPreview chartConfig={jsonStr} />
          </div>
        );
      }
    } catch {}
    return (
      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
        Chart
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
      Preview
    </div>
  );
}
