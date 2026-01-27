'use client';

import useSWR from 'swr';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLoading } from '@/hooks/use-loading';
import { useSession } from 'next-auth/react';
import { sanitizeHtml } from '@/lib/sanitize';
import type { ComposerKind } from '@/components/composer';
import { Button } from '@/components/ui/button';
import { fetcher } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast-system';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import { useAccountStore } from '@/lib/stores/account-store';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Users, Mic, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChartPreview } from '@/components/chart-preview';
import { ComposerCountPill } from '@/components/composer-count-pill';

// Extend settings shape for primary IDs
type UserSettings = {
  primaryVtoId?: string | null;
  primaryScorecardId?: string | null;
  primaryAccountabilityId?: string | null;
  contextDocumentIds?: string[] | null;
};

type Row = { id: string; title: string; kind: ComposerKind; createdAt: string };

export function ComposerDashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const kind = (params.get('dashboard') || 'text') as ComposerKind;
  const { setLoading } = useLoading();
  const { data: session } = useSession();
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'business'>('free');
  const { openModal } = useUpgradeStore();
  const accountEntitlements = useAccountStore((state) => state.entitlements);
  const accountUser = useAccountStore((state) => state.user);

  // Fetch user plan for composer count pill (client-safe)
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/me/plan')
        .then((res) => res.json())
        .then((data) => {
          if (data.plan) {
            setUserPlan(data.plan);
          }
        })
        .catch((error) => {
          console.error('Failed to fetch user plan:', error);
        });
    }
  }, [session?.user?.id]);

  // Recordings view support
  const isRecordings = params.get('dashboard') === 'recordings';
  const { data: recordingsData, isLoading: recordingsLoading } = useSWR<any>(
    isRecordings ? '/api/voice/recordings' : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data, mutate, isLoading, isValidating, error } = useSWR<{
    documents: Row[];
  }>(
    !isRecordings && kind ? `/api/documents?composerKind=${kind}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 4000,
      revalidateIfStale: true,
      revalidateOnReconnect: true,
      onError: (err) => {
        console.error('Error fetching documents:', err);
      },
    },
  );

  const rows = useMemo(() => {
    if (isRecordings) {
      return []; // Recordings handled separately
    }
    const filtered = (data?.documents ?? []).filter(
      (d) => !/^User Note:/i.test(d.title || ''),
    );
    console.log(
      `[ComposerDashboard] kind=${kind}, documents fetched:`,
      data?.documents?.length ?? 0,
      'after filtering:',
      filtered.length,
      'user plan:',
      accountUser?.plan,
      'composer types allowed:',
      accountEntitlements?.features.composer.types,
    );
    return filtered;
  }, [data, isRecordings, kind, accountUser, accountEntitlements]);

  // Transform recordings data for display
  const recordingRows = useMemo(() => {
    if (!isRecordings || !recordingsData?.recordings) return [];
    return recordingsData.recordings.map((item: any) => ({
      id: item.recording.id,
      title: item.recording.title || 'Untitled Recording',
      kind: 'recording' as ComposerKind,
      createdAt: item.recording.createdAt,
      audioUrl: item.recording.audioUrl,
      duration: item.recording.duration,
      hasTranscript: Boolean(item.transcript?.id),
      meetingType: item.recording.meetingType,
      tags: item.recording.tags || [],
      hasError: item.transcript?.content?.startsWith('ERROR:'),
    }));
  }, [isRecordings, recordingsData]);

  const [cachedRows, setCachedRows] = useState<Row[]>([]);
  const [cachedKind, setCachedKind] = useState<ComposerKind | null>(null);
  
  // Clear cache when kind changes to prevent stale data from showing
  useEffect(() => {
    if (kind !== cachedKind) {
      setCachedRows([]);
      setCachedKind(kind);
    }
  }, [kind, cachedKind]);
  
  useEffect(() => {
    if (rows && rows.length > 0 && kind === cachedKind) {
      setCachedRows(rows);
    }
  }, [rows, kind, cachedKind]);

  const displayRows = isRecordings
    ? recordingRows
    : (rows.length > 0 ? rows : cachedRows).filter(
        (d) => !/^User Note:/i.test(d.title || ''),
      );

  const isInitialLoading =
    (isLoading || recordingsLoading) && displayRows.length === 0;
  const isRefreshing = !isLoading && isValidating;

  // Load user settings to identify primary doc per kind
  const { data: settings, mutate: mutateSettings } = useSWR<UserSettings>(
    '/api/user-settings',
    fetcher,
  );

  // Close global loading overlay once initial list is available or after a short safety timeout
  useEffect(() => {
    if (!isInitialLoading && !recordingsLoading) {
      setLoading(false);
    }
  }, [isInitialLoading, recordingsLoading, setLoading]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, [setLoading]);

  const handleCreate = useCallback(() => {
    if (isRecordings) {
      router.push('/chat?openRecordingModal=true');
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('dashboard');
      url.searchParams.set('newComposerKind', kind);
      router.replace(url.toString());
    }
  }, [router, kind, isRecordings]);

  const handleOpen = useCallback(
    async (doc: Row | any) => {
      if (isRecordings) {
        // Open recording modal with this recording
        router.push(`/chat?recordingId=${doc.id}`);
      } else {
        // Find the chat associated with this document
        try {
          const chatRes = await fetch(`/api/chats/by-document?id=${doc.id}`);
          const { chatId } = await chatRes.json();

          if (chatId) {
            // Navigate to the existing chat and open the composer
            router.push(
              `/chat/${chatId}?documentId=${doc.id}&documentTitle=${encodeURIComponent(doc.title || 'Untitled')}&composerKind=${doc.kind}`,
            );
          } else {
            // No existing chat, open in new chat
            const url = new URL(window.location.href);
            url.searchParams.delete('dashboard');
            url.searchParams.set('documentId', doc.id);
            url.searchParams.set('documentTitle', doc.title || 'Untitled');
            url.searchParams.set('composerKind', doc.kind);
            router.replace(url.toString());
          }
        } catch (error) {
          console.error('Failed to find chat for document:', error);
          // Fallback: open in current chat
          const url = new URL(window.location.href);
          url.searchParams.delete('dashboard');
          url.searchParams.set('documentId', doc.id);
          url.searchParams.set('documentTitle', doc.title || 'Untitled');
          url.searchParams.set('composerKind', doc.kind);
          router.replace(url.toString());
        }
      }
    },
    [router, isRecordings],
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
    async (doc: Row | any) => {
      try {
        if (isRecordings) {
          const res = await fetch(`/api/voice/recordings/${doc.id}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('Failed');
          toast.success('Recording deleted');
          mutate();
        } else {
          const res = await fetch(`/api/document?id=${doc.id}&all=true`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('Failed');
          toast.success('Deleted');
          mutate();
        }
      } catch {
        toast.error('Delete failed');
      }
    },
    [mutate, isRecordings],
  );

  const setAsPrimary = useCallback(async (doc: Row) => {
    try {
      const payload: Partial<UserSettings> = {};
      if (doc.kind === 'vto') payload.primaryVtoId = doc.id;
      else if (doc.kind === 'sheet') payload.primaryScorecardId = doc.id;
      else if (doc.kind === 'accountability')
        payload.primaryAccountabilityId = doc.id;
      const res = await fetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Set as primary');
    } catch (e) {
      console.error(e);
      toast.error('Failed to set as primary');
    }
  }, []);

  const displayName: string = useMemo(() => {
    if (isRecordings) return 'Recording';
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
        return 'Vision/Traction Organizer';
      case 'accountability':
        return 'Accountability Chart';
      default:
        return String(kind).toUpperCase();
    }
  }, [kind, isRecordings]);

  const displayPlural: string = useMemo(() => {
    if (isRecordings) return 'Recordings';
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
        return 'Vision/Traction Organizers';
      case 'accountability':
        return 'Accountability Charts';
      default:
        return `${displayName}s`;
    }
  }, [kind, displayName, isRecordings]);

  const primaryId = useMemo(() => {
    if (kind === 'vto') return settings?.primaryVtoId || null;
    if (kind === 'sheet') return settings?.primaryScorecardId || null;
    if (kind === 'accountability')
      return settings?.primaryAccountabilityId || null;
    return null;
  }, [settings, kind]);

  return (
    <motion.div
      className="composer-dashboard w-full h-full px-2 md:px-2 pt-4 pb-6"
      data-testid="composer"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {/* Top bar with composer count pill */}
      <motion.header
        className="absolute top-1 left-0 right-0 pt-2.5 pb-3 px-2 md:px-2 z-40 bg-transparent pointer-events-none no-mesh-override"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 26 }}
      >
        <div className="flex items-center gap-1 md:gap-2 w-full justify-end">
          {/* Right: composer count pill */}
          <div className="flex items-center gap-1 md:gap-2 pointer-events-auto">
            {session?.user && userPlan === 'business' && (
              <ComposerCountPill
                userId={session.user.id}
                userPlan={userPlan}
                className="pointer-events-auto"
              />
            )}
          </div>
        </div>
      </motion.header>

      {/* Section title + create button */}
      <div className="flex items-center justify-between mt-16 mb-6 px-2 md:px-2">
        <div className="text-base font-semibold">{displayPlural}</div>
        <Button size="sm" onClick={handleCreate}>
          {displayName === 'Document'
            ? 'Create Document'
            : `Create ${displayName}`}
        </Button>
      </div>

      {error ? (
        <div className="text-sm text-muted-foreground">
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
            <p className="font-medium text-red-900 dark:text-red-200 mb-2">
              {(error as any)?.info?.code === 'FEATURE_LOCKED'
                ? `${displayPlural} require ${(error as any)?.info?.requiredPlan || 'Pro'} plan`
                : `Error loading ${displayPlural.toLowerCase()}`}
            </p>
            <p className="text-red-700 dark:text-red-300 text-xs">
              {(error as any)?.info?.error ||
                error?.message ||
                'Failed to fetch documents. Please try again.'}
            </p>
            <div className="flex gap-2 mt-3">
              {(error as any)?.info?.code === 'FEATURE_LOCKED' ? (
                <>
                  <Button size="sm" onClick={() => openModal('premium')}>
                    Upgrade Plan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      // Refresh account data to sync entitlements
                      try {
                        const res = await fetch('/api/me', {
                          cache: 'no-store',
                        });
                        if (res.ok) {
                          const data = await res.json();
                          useAccountStore.getState().setBootstrap(data);
                          toast.success('Account refreshed');
                          // Retry fetching documents
                          mutate();
                        }
                      } catch {
                        toast.error('Failed to refresh');
                      }
                    }}
                  >
                    Refresh Account
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => mutate()}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : isInitialLoading ? (
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
          {displayRows.map((row: any, i: number) => {
            const isPrimary = primaryId === row.id;
            const isContext = Array.isArray(settings?.contextDocumentIds)
              ? (settings?.contextDocumentIds || []).includes(row.id)
              : false;
            return (
              <motion.article
                key={row.id}
                className={`group rounded-lg border overflow-hidden bg-card transition-all duration-200 ${
                  row.kind === 'vto'
                    ? 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                } ${isPrimary ? 'ring-2 ring-blue-500' : ''} ${
                  isContext
                    ? isPrimary
                      ? 'ring-[3px] ring-offset-2 ring-emerald-500'
                      : 'ring-2 ring-emerald-500'
                    : ''
                }`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 24,
                  delay: Math.min(i * 0.03, 0.24),
                }}
                whileHover={{
                  y: -3,
                  boxShadow:
                    row.kind === 'vto'
                      ? '0 12px 24px rgba(100, 116, 139, 0.15)'
                      : '0 8px 20px rgba(0,0,0,0.08)',
                  transition: { duration: 0.2 },
                }}
                whileTap={{ scale: 0.98 }}
              >
                <button
                  type="button"
                  aria-label={`Open ${row.title || 'Untitled'}`}
                  className="relative aspect-[4/3] w-full bg-muted/40 cursor-pointer"
                  onClick={() => handleOpen(row)}
                >
                  {isRecordings ? (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800">
                      <div className="p-2 h-full flex flex-col">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-slate-700 dark:bg-slate-600 flex items-center justify-center">
                            <Mic className="w-3 h-3 text-white" />
                          </div>
                          <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                            Recording
                          </div>
                        </div>

                        {/* Central content */}
                        <div className="flex-1 flex flex-col items-center justify-center">
                          {/* Large mic icon */}
                          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                            <Mic className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                          </div>

                          {/* Duration */}
                          {(row as any).duration > 0 && (
                            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 mb-2">
                              <Clock className="w-4 h-4" />
                              <span className="font-medium">
                                {Math.floor((row as any).duration / 60)}:
                                {String((row as any).duration % 60).padStart(
                                  2,
                                  '0',
                                )}
                              </span>
                            </div>
                          )}

                          {/* Status badge */}
                          <div className="mt-auto mb-2">
                            {(row as any).hasError ? (
                              <div className="px-2.5 py-1 rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-semibold flex items-center gap-1.5 border border-red-200 dark:border-red-800">
                                <AlertCircle className="w-3 h-3" />
                                Error
                              </div>
                            ) : (row as any).hasTranscript ? (
                              <div className="px-2.5 py-1 rounded-md bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[10px] font-semibold border border-green-200 dark:border-green-800">
                                Transcribed
                              </div>
                            ) : (
                              <div className="px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-semibold animate-pulse border border-amber-200 dark:border-amber-800">
                                Processing...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <PreviewBlock kind={row.kind} id={row.id} />
                  )}
                  {/* Top left badges */}
                  {isPrimary && (
                    <div className="absolute top-2 left-2 text-[11px] rounded-md px-2 py-0.5 bg-blue-600 text-white shadow-sm">
                      Primary
                    </div>
                  )}
                  {/* Top right badges - stack vertically to avoid overlap */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    {isRefreshing && (
                      <div className="text-[11px] rounded-md px-2 py-0.5 bg-background/90 border border-zinc-200 dark:border-zinc-700 shadow-sm backdrop-blur-sm">
                        Refreshing…
                      </div>
                    )}
                    {isContext && (
                      <div className="text-[11px] rounded-md px-2 py-0.5 bg-emerald-600 text-white shadow-sm">
                        Context
                      </div>
                    )}
                  </div>
                </button>
                <div className="flex items-center justify-between p-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {row.title || 'Untitled'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleDateString()}
                      {isRecordings && (row as any).meetingType && (
                        <span className="text-primary font-medium">
                          {' '}
                          • {(row as any).meetingType}
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="z-[150] max-h-[500px] overflow-y-auto"
                      collisionPadding={{
                        top: 8,
                        right: 8,
                        bottom: 80,
                        left: 8,
                      }}
                    >
                      {!isRecordings && (
                        <InlineRenameMenuItem
                          initialValue={row.title}
                          onSave={(t) => handleRename(row, t)}
                        />
                      )}
                      {!isRecordings &&
                        (row.kind === 'vto' ||
                          row.kind === 'sheet' ||
                          row.kind === 'accountability') && (
                          <DropdownMenuItem onClick={() => setAsPrimary(row)}>
                            Set as Primary
                          </DropdownMenuItem>
                        )}
                      {!isRecordings && (
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              // Fetch current settings
                              const res = await fetch('/api/user-settings');
                              const s = res.ok ? await res.json() : {};
                              const current: string[] = Array.isArray(
                                s?.contextDocumentIds,
                              )
                                ? s.contextDocumentIds
                                : [];
                              const next = current.includes(row.id)
                                ? current.filter((id: string) => id !== row.id)
                                : [...current, row.id];
                              const save = await fetch('/api/user-settings', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  contextDocumentIds: next,
                                }),
                              });
                              if (!save.ok) throw new Error('Failed');
                              toast.success(
                                current.includes(row.id)
                                  ? 'Removed from context'
                                  : 'Added to context',
                              );
                              mutateSettings();
                            } catch (e) {
                              console.error(e);
                              toast.error('Failed to update context');
                            }
                          }}
                        >
                          Use as Context
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDelete(row)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.article>
            );
          })}
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

// Helper functions for accountability charts
function getTotalSeats(node: any): number {
  if (!node) return 0;
  let count = 1; // Count this node
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      count += getTotalSeats(child);
    }
  }
  return count;
}

function getTotalPeople(node: any): number {
  if (!node) return 0;
  let count = node.holder?.trim() ? 1 : 0;
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      count += getTotalPeople(child);
    }
  }
  return count;
}

function PreviewBlock({ kind, id }: { kind: ComposerKind; id: string }) {
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
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownHtml) }}
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

        // Calculate completion percentage
        let filledSections = 0;
        const totalSections = 8;

        // Check each section for content
        if (vto?.coreValues?.some((v: string) => v?.trim())) filledSections++;
        if (vto?.coreFocus?.purpose?.trim() || vto?.coreFocus?.niche?.trim())
          filledSections++;
        if (vto?.tenYearTarget?.trim()) filledSections++;
        if (
          vto?.marketingStrategy?.targetMarket?.trim() ||
          vto?.marketingStrategy?.threeUniques?.some((u: string) => u?.trim())
        )
          filledSections++;
        if (
          vto?.threeYearPicture?.futureDate?.trim() ||
          vto?.threeYearPicture?.revenue?.trim() ||
          vto?.threeYearPicture?.bullets?.some((b: string) => b?.trim())
        )
          filledSections++;
        if (
          vto?.oneYearPlan?.futureDate?.trim() ||
          vto?.oneYearPlan?.revenue?.trim() ||
          vto?.oneYearPlan?.goals?.some((g: string) => g?.trim())
        )
          filledSections++;
        if (vto?.rocks?.rocks?.some((r: string) => r?.trim())) filledSections++;
        if (vto?.issuesList?.some((i: string) => i?.trim())) filledSections++;

        const completionPercent = Math.round(
          (filledSections / totalSections) * 100,
        );

        return (
          <div className="absolute inset-0 p-2 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800">
            {/* Header with completion indicator */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-700 dark:bg-slate-600 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  V/TO
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="text-[9px] text-muted-foreground">
                  {completionPercent}%
                </div>
                <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-2 gap-1.5 text-[9px]">
              {/* Core Values & Focus */}
              <div className="bg-white/70 dark:bg-zinc-800/70 rounded p-1.5">
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  Core
                </div>
                <div className="text-muted-foreground truncate">
                  {vto?.coreFocus?.purpose ? (
                    <span
                      className="block truncate"
                      title={vto.coreFocus.purpose}
                    >
                      {vto.coreFocus.purpose}
                    </span>
                  ) : (
                    <span className="opacity-50">No purpose</span>
                  )}
                </div>
                <div className="text-muted-foreground">
                  {vto?.coreValues?.filter((v: string) => v?.trim()).length ||
                    0}{' '}
                  values
                </div>
              </div>

              {/* 10 Year Target */}
              <div className="bg-white/70 dark:bg-zinc-800/70 rounded p-1.5">
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                  10-Year
                </div>
                <div
                  className="text-muted-foreground truncate"
                  title={vto?.tenYearTarget}
                >
                  {vto?.tenYearTarget?.trim() ? (
                    vto.tenYearTarget
                  ) : (
                    <span className="opacity-50">Not set</span>
                  )}
                </div>
              </div>

              {/* 3 Year Picture */}
              <div className="bg-white/70 dark:bg-zinc-800/70 rounded p-1.5">
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  3-Year
                </div>
                <div className="text-muted-foreground">
                  {vto?.threeYearPicture?.futureDate || (
                    <span className="opacity-50">-</span>
                  )}
                </div>
                {vto?.threeYearPicture?.revenue && (
                  <div className="text-muted-foreground text-[8px]">
                    ${vto.threeYearPicture.revenue}
                  </div>
                )}
              </div>

              {/* 1 Year Plan */}
              <div className="bg-white/70 dark:bg-zinc-800/70 rounded p-1.5">
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  1-Year
                </div>
                <div className="text-muted-foreground">
                  {vto?.oneYearPlan?.futureDate || (
                    <span className="opacity-50">-</span>
                  )}
                </div>
                {vto?.oneYearPlan?.revenue && (
                  <div className="text-muted-foreground text-[8px]">
                    ${vto.oneYearPlan.revenue}
                  </div>
                )}
              </div>
            </div>

            {/* Rocks Section */}
            {vto?.rocks?.rocks?.filter((r: any) =>
              typeof r === 'string' ? r?.trim() : r?.title?.trim(),
            ).length > 0 && (
              <div className="mt-1.5 bg-white/70 dark:bg-zinc-800/70 rounded p-1.5">
                <div className="font-semibold text-slate-700 dark:text-slate-300 text-[9px] mb-0.5 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Rocks (
                  {
                    vto.rocks.rocks.filter((r: any) =>
                      typeof r === 'string' ? r?.trim() : r?.title?.trim(),
                    ).length
                  }
                  )
                </div>
                <div className="text-[8px] text-muted-foreground space-y-0.5">
                  {vto.rocks.rocks
                    .filter((r: any) =>
                      typeof r === 'string' ? r?.trim() : r?.title?.trim(),
                    )
                    .slice(0, 2)
                    .map((rock: any, idx: number) => {
                      const text =
                        typeof rock === 'string' ? rock : rock?.title || '';
                      return (
                        <div
                          key={`${id}-rock-${idx}-${text.slice(0, 10)}`}
                          className="truncate"
                          title={text}
                        >
                          • {text}
                        </div>
                      );
                    })}
                  {vto.rocks.rocks.filter((r: any) =>
                    typeof r === 'string' ? r?.trim() : r?.title?.trim(),
                  ).length > 2 && (
                    <div className="opacity-60">
                      +
                      {vto.rocks.rocks.filter((r: any) =>
                        typeof r === 'string' ? r?.trim() : r?.title?.trim(),
                      ).length - 2}{' '}
                      more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      }
    } catch {}
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-muted-foreground bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-200">
            <svg
              className="w-6 h-6 text-slate-500 dark:text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
        <div className="font-medium group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors duration-200">
          V/TO
        </div>
        <div className="text-[10px] opacity-60">Vision/Traction Organizer</div>
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
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-2">
        {base64Content ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="preview"
              src={`data:image/png;base64,${base64Content}`}
              className="max-w-full max-h-full object-contain rounded shadow-sm"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center mb-2">
              <svg
                className="w-6 h-6 text-slate-500 dark:text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="text-xs text-muted-foreground">No Image</div>
          </div>
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

    const hasContent = rows.length > 0 && rows[0].length > 0 && rows[0][0];

    return (
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 p-2 overflow-hidden">
        {hasContent ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-slate-700 dark:bg-slate-600 flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                Spreadsheet
              </div>
            </div>
            <div className="bg-white/70 dark:bg-zinc-800/70 rounded overflow-hidden">
              <table className="w-full border-collapse text-[10px]">
                <tbody>
                  {rows.map((r, rowIndex) => {
                    const sig = r.join('|');
                    const rowKey = `${id}-r-${rowIndex}-${sig}`;
                    return (
                      <tr
                        key={rowKey}
                        className={
                          rowIndex === 0 ? 'bg-slate-100 dark:bg-zinc-700' : ''
                        }
                      >
                        {r.map((c, colIndex) => {
                          const cellKey = `${id}-c-${rowIndex}-${colIndex}-${sig}-${String(c)}`;
                          return (
                            <td
                              key={cellKey}
                              className={`px-1.5 py-1 truncate max-w-[4rem] border-r border-b border-slate-200 dark:border-zinc-600 ${
                                rowIndex === 0
                                  ? 'font-semibold text-slate-700 dark:text-slate-300'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {c || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center mb-2">
              <svg
                className="w-6 h-6 text-slate-500 dark:text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="text-xs text-muted-foreground">
              Empty Spreadsheet
            </div>
          </div>
        )}
      </div>
    );
  }

  if (kind === 'accountability') {
    try {
      const hasBegin = content.includes('AC_DATA_BEGIN');
      const hasEnd = content.includes('AC_DATA_END');
      let jsonStr = '';
      if (hasBegin && hasEnd) {
        const start = content.indexOf('AC_DATA_BEGIN') + 'AC_DATA_BEGIN'.length;
        const end = content.indexOf('AC_DATA_END');
        jsonStr = content.substring(start, end).trim();
      } else {
        // Try to parse if it's raw JSON
        const s = content.indexOf('{');
        const e = content.lastIndexOf('}') + 1;
        if (s >= 0 && e > s) jsonStr = content.substring(s, e);
      }

      if (jsonStr) {
        const acData = JSON.parse(jsonStr);
        if (acData?.root) {
          // Render accountability chart preview
          return (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800">
              {/* Render hierarchy preview */}
              <div className="p-2 space-y-1.5 h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-slate-700 dark:bg-slate-600 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                    Accountability
                  </div>
                </div>

                {/* Root seat */}
                <div className="bg-white/70 dark:bg-zinc-800/70 rounded p-2 shadow-sm">
                  <div className="flex items-start gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0"
                      style={{
                        backgroundColor: acData.root.accent || '#64748b',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {acData.root.name || 'Root'}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {acData.root.holder || 'No holder'}
                      </div>
                      {acData.root.roles?.length > 0 && (
                        <div className="text-[9px] text-muted-foreground mt-0.5">
                          {acData.root.roles.length} role
                          {acData.root.roles.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Child seats preview */}
                {acData.root.children && acData.root.children.length > 0 && (
                  <div className="flex-1 overflow-hidden space-y-1">
                    {acData.root.children
                      .slice(0, 2)
                      .map((child: any, idx: number) => (
                        <div key={child.id || idx} className="ml-3 relative">
                          {/* Connection line */}
                          <div className="absolute -left-2 top-0 bottom-0 w-2">
                            <div className="absolute left-0 top-3 w-2 h-px bg-slate-300 dark:bg-zinc-600" />
                            <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-300 dark:bg-zinc-600" />
                          </div>

                          <div className="bg-white/50 dark:bg-zinc-800/50 rounded p-1.5">
                            <div className="flex items-start gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
                                style={{
                                  backgroundColor: child.accent || '#64748b',
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                                  {child.name}
                                </div>
                                <div className="text-[9px] text-muted-foreground truncate">
                                  {child.holder || 'Empty'}
                                </div>
                                {child.children &&
                                  child.children.length > 0 && (
                                    <div className="text-[8px] text-muted-foreground mt-0.5">
                                      +{child.children.length} sub
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                    {acData.root.children.length > 2 && (
                      <div className="ml-3 text-[9px] text-muted-foreground">
                        +{acData.root.children.length - 2} more
                      </div>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="mt-auto pt-1 flex gap-2 justify-end">
                  <div className="bg-slate-100 dark:bg-zinc-800 rounded px-2 py-0.5 text-[9px] font-medium text-slate-600 dark:text-slate-400">
                    {getTotalSeats(acData.root)} seats
                  </div>
                  <div className="bg-slate-100 dark:bg-zinc-800 rounded px-2 py-0.5 text-[9px] font-medium text-slate-600 dark:text-slate-400">
                    {getTotalPeople(acData.root)} people
                  </div>
                </div>
              </div>
            </div>
          );
        }
      }
    } catch (e) {
      console.error('Failed to parse AC data:', e);
    }

    // Fallback
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-muted-foreground bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800">
        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-200">
          <Users className="w-6 h-6 text-slate-500 dark:text-zinc-400" />
        </div>
        <div className="font-medium group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors duration-200">
          Accountability
        </div>
        <div className="text-[10px] opacity-60">Organizational Chart</div>
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
      <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-muted-foreground bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800">
        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center mb-2">
          <svg
            className="w-6 h-6 text-slate-500 dark:text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <div className="font-medium">Chart</div>
        <div className="text-[10px] opacity-60">Data Visualization</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-muted-foreground bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800">
      <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center mb-2">
        <svg
          className="w-6 h-6 text-slate-500 dark:text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </div>
      <div className="font-medium">Preview</div>
      <div className="text-[10px] opacity-60">Document preview</div>
    </div>
  );
}
