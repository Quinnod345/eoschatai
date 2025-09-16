'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ComposerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  composerDocs: Record<string, { id: string; title: string; kind: string }[]>;
  composerContext: { [key: string]: boolean };
  setComposerContext: React.Dispatch<
    React.SetStateAction<{ [key: string]: boolean }>
  >;
  composerLoading: boolean;
  composerError: string | null;
  pickerFilter: string;
  setPickerFilter: React.Dispatch<React.SetStateAction<any>>;
  onSave: () => void;
}

export function ComposerPickerModal({
  isOpen,
  onClose,
  composerDocs,
  composerContext,
  setComposerContext,
  composerLoading,
  composerError,
  pickerFilter,
  setPickerFilter,
  onSave,
}: ComposerPickerModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const stopEvent = (e: any) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
  };

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200 cursor-default"
        style={{ zIndex: 2147483649 }}
        onClick={(e) => {
          stopEvent(e);
          onClose();
        }}
        onMouseDownCapture={stopEvent}
        onPointerDownCapture={stopEvent}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{ zIndex: 2147483650 }}
        onMouseDownCapture={stopEvent}
        onPointerDownCapture={stopEvent}
      >
        <div
          className="bg-background border rounded-2xl shadow-2xl w-full max-w-[1100px] max-h-[90vh] flex flex-col animate-in zoom-in-95 fade-in-0 duration-200 pointer-events-auto"
          onMouseDownCapture={stopEvent}
          onPointerDownCapture={stopEvent}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h3 className="text-xl font-semibold">Choose Composers</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Select composers to use as persona context. Click to toggle.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Selections are saved per persona when used in the Persona
                Wizard.
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                stopEvent(e);
                onClose();
              }}
              className="rounded-md p-1 hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col p-6">
            <Tabs
              value={pickerFilter}
              onValueChange={(v) => setPickerFilter(v as any)}
              className="w-full"
            >
              <TabsList className="w-full grid grid-cols-4 lg:grid-cols-8 mb-6">
                <TabsTrigger value="all" className="text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger value="scorecard" className="text-xs">
                  Scorecard
                </TabsTrigger>
                <TabsTrigger value="vto" className="text-xs">
                  V/TO
                </TabsTrigger>
                <TabsTrigger value="accountability" className="text-xs">
                  A/C
                </TabsTrigger>
                <TabsTrigger value="text" className="text-xs">
                  Document
                </TabsTrigger>
                <TabsTrigger value="code" className="text-xs">
                  Code
                </TabsTrigger>
                <TabsTrigger value="image" className="text-xs">
                  Image
                </TabsTrigger>
                <TabsTrigger value="chart" className="text-xs">
                  Chart
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {composerError && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                {composerError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pr-2">
                {composerLoading ? (
                  <div className="col-span-full flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-3 mx-auto" />
                      <p className="text-sm text-muted-foreground">
                        Loading composers...
                      </p>
                    </div>
                  </div>
                ) : (
                  (pickerFilter === 'all'
                    ? ([
                        'sheet',
                        'vto',
                        'accountability',
                        'text',
                        'code',
                        'image',
                        'chart',
                      ] as const)
                    : pickerFilter === 'scorecard'
                      ? (['sheet'] as const)
                      : pickerFilter === 'vto'
                        ? (['vto'] as const)
                        : pickerFilter === 'accountability'
                          ? (['accountability'] as const)
                          : pickerFilter === 'text'
                            ? (['text'] as const)
                            : pickerFilter === 'code'
                              ? (['code'] as const)
                              : pickerFilter === 'image'
                                ? (['image'] as const)
                                : pickerFilter === 'chart'
                                  ? (['chart'] as const)
                                  : []
                  )
                    .flatMap((k) =>
                      (composerDocs[k] || []).map((d) => ({ ...d, k })),
                    )
                    .map((d) => {
                      const picked = Boolean(composerContext[d.id]);
                      const isEOS = ['sheet', 'vto', 'accountability'].includes(
                        d.k,
                      );

                      const getPreviewIcon = () =>
                        d.k === 'sheet'
                          ? '📊'
                          : d.k === 'vto'
                            ? '🎯'
                            : d.k === 'accountability'
                              ? '👥'
                              : d.k === 'text'
                                ? '📝'
                                : d.k === 'code'
                                  ? '💻'
                                  : d.k === 'image'
                                    ? '🎨'
                                    : d.k === 'chart'
                                      ? '📈'
                                      : '📄';

                      const getTypeName = () =>
                        d.k === 'sheet'
                          ? 'Scorecard'
                          : d.k === 'vto'
                            ? 'V/TO'
                            : d.k === 'accountability'
                              ? 'A/C'
                              : d.k === 'text'
                                ? 'Document'
                                : d.k === 'code'
                                  ? 'Code'
                                  : d.k === 'image'
                                    ? 'Image'
                                    : d.k === 'chart'
                                      ? 'Chart'
                                      : d.k;

                      return (
                        <button
                          key={`${d.k}-${d.id}`}
                          type="button"
                          onClick={() =>
                            setComposerContext((m) => ({
                              ...m,
                              [d.id]: !picked,
                            }))
                          }
                          className={cn(
                            'rounded-lg border p-4 text-left hover:shadow-md transition-all duration-200 group relative overflow-hidden',
                            picked
                              ? 'border-emerald-500/70 bg-emerald-500/5 shadow-sm'
                              : 'hover:bg-muted/40 hover:border-foreground/20',
                          )}
                          aria-pressed={picked}
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <div
                              className={cn(
                                'flex items-center justify-center w-12 h-12 rounded-lg text-2xl',
                                isEOS ? 'bg-primary/10' : 'bg-secondary/10',
                              )}
                            >
                              {getPreviewIcon()}
                            </div>
                            <div className="flex-1">
                              <div
                                className={cn(
                                  'text-xs font-medium uppercase tracking-wider mb-1',
                                  isEOS
                                    ? 'text-primary/70'
                                    : 'text-secondary/70',
                                )}
                              >
                                {getTypeName()}
                              </div>
                              <div className="text-sm font-semibold line-clamp-2">
                                {d.title || 'Untitled'}
                              </div>
                            </div>
                          </div>
                          <div
                            className={cn(
                              'text-xs mt-2 flex items-center gap-1',
                              picked
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-muted-foreground',
                            )}
                          >
                            <div
                              className={cn(
                                'w-2 h-2 rounded-full',
                                picked
                                  ? 'bg-emerald-500'
                                  : 'bg-muted-foreground/30',
                              )}
                            />
                            {picked ? 'Selected as context' : 'Click to select'}
                          </div>
                        </button>
                      );
                    })
                )}

                {!composerLoading &&
                  (pickerFilter === 'all'
                    ? ([
                        'sheet',
                        'vto',
                        'accountability',
                        'text',
                        'code',
                        'image',
                        'chart',
                      ] as const)
                    : pickerFilter === 'scorecard'
                      ? (['sheet'] as const)
                      : pickerFilter === 'vto'
                        ? (['vto'] as const)
                        : pickerFilter === 'accountability'
                          ? (['accountability'] as const)
                          : pickerFilter === 'text'
                            ? (['text'] as const)
                            : pickerFilter === 'code'
                              ? (['code'] as const)
                              : pickerFilter === 'image'
                                ? (['image'] as const)
                                : pickerFilter === 'chart'
                                  ? (['chart'] as const)
                                  : []
                  ).flatMap((k) =>
                    (composerDocs[k] || []).map((d) => ({ ...d, k })),
                  ).length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      <p className="text-sm">
                        No documents found for this filter.
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="min-w-[100px]"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                onSave();
                onClose();
              }}
              className="min-w-[140px]"
            >
              Save Selection
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
