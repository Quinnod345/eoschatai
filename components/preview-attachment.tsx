'use client';

import type { Attachment } from './multimodal-input/types';
import { LoaderIcon, XIcon } from './icons';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BookMarked,
  Copy,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  MoreHorizontal,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type FileKind =
  | 'image'
  | 'pdf'
  | 'audio'
  | 'video'
  | 'sheet'
  | 'doc'
  | 'generic';

function detectFileKind(contentType?: string, name?: string): FileKind {
  const ext = name?.split('.').pop()?.toLowerCase();
  if (contentType?.startsWith('image/')) return 'image';
  if (contentType?.startsWith('audio/')) return 'audio';
  if (contentType?.startsWith('video/')) return 'video';
  if (contentType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (
    contentType?.includes('spreadsheet') ||
    contentType?.includes('excel') ||
    ['xlsx', 'xls', 'csv'].includes(ext || '')
  ) {
    return 'sheet';
  }
  if (
    contentType?.includes('word') ||
    contentType?.includes('officedocument.wordprocessingml') ||
    ['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext || '')
  ) {
    return 'doc';
  }
  return 'generic';
}

const kindSurface: Record<FileKind, string> = {
  image:
    'border-blue-200/90 bg-blue-50/50 dark:border-blue-800/55 dark:bg-blue-950/30',
  pdf: 'border-red-200/90 bg-red-50/45 dark:border-red-900/55 dark:bg-red-950/25',
  audio:
    'border-violet-200/90 bg-violet-50/45 dark:border-violet-800/55 dark:bg-violet-950/25',
  video:
    'border-fuchsia-200/90 bg-fuchsia-50/40 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/20',
  sheet:
    'border-emerald-200/90 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/22',
  doc: 'border-amber-200/90 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/22',
  generic:
    'border-zinc-200/90 bg-white dark:border-zinc-700/75 dark:bg-zinc-900/85',
};

const kindGlyph: Record<FileKind, string> = {
  image: 'text-blue-600 dark:text-blue-400',
  pdf: 'text-red-600 dark:text-red-400',
  audio: 'text-violet-600 dark:text-violet-400',
  video: 'text-fuchsia-600 dark:text-fuchsia-400',
  sheet: 'text-emerald-600 dark:text-emerald-400',
  doc: 'text-amber-600 dark:text-amber-400',
  generic: 'text-zinc-500 dark:text-zinc-400',
};

function FileGlyph({
  kind,
  className,
}: { kind: FileKind; className?: string }) {
  const c = cn('size-8 shrink-0', kindGlyph[kind], className);
  switch (kind) {
    case 'image':
      return <FileImage className={c} aria-hidden />;
    case 'audio':
      return <FileAudio className={c} aria-hidden />;
    case 'video':
      return <FileVideo className={c} aria-hidden />;
    case 'sheet':
      return <FileSpreadsheet className={c} aria-hidden />;
    default:
      return <FileText className={c} aria-hidden />;
  }
}

export type PreviewAttachmentProps = {
  attachment: Attachment;
  isUploading?: boolean;
  /** Shown under the tile while uploading (e.g. "Uploading…"). */
  uploadStatusLabel?: string;
  onRemove?: () => void;
  onDuplicate?: () => void;
  onRename?: (nextName: string) => void;
  onContextOnlyChange?: (contextOnly: boolean) => void;
};

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  uploadStatusLabel = 'Uploading…',
  onRemove,
  onDuplicate,
  onRename,
  onContextOnlyChange,
}: PreviewAttachmentProps) => {
  const { name, url, contentType, contextOnly } = attachment;
  const kind = detectFileKind(contentType, name);
  const showActionsMenu =
    !isUploading &&
    (onDuplicate !== undefined ||
      onRename !== undefined ||
      onContextOnlyChange !== undefined);

  const handleRename = () => {
    const next = window.prompt('File name', name || 'attachment');
    if (next?.trim()) onRename?.(next.trim());
  };

  return (
    <div
      data-testid="input-attachment-preview"
      className="group/prev relative flex w-[92px] shrink-0 snap-start flex-col gap-1.5"
    >
      <div
        className={cn(
          'relative flex h-[68px] w-full flex-col overflow-hidden rounded-xl border shadow-[0_1px_6px_rgba(0,0,0,0.06)] transition-shadow dark:shadow-[0_1px_8px_rgba(0,0,0,0.35)]',
          kindSurface[kind],
        )}
      >
        {contextOnly && !isUploading && (
          <span className="absolute left-1.5 top-1.5 z-[15] rounded bg-foreground/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground/80 backdrop-blur-sm">
            Ref
          </span>
        )}

        <div className="relative flex flex-1 items-center justify-center p-2">
          {contentType ? (
            contentType.startsWith('image') && url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={name ?? 'Attachment preview'}
                className="size-full max-h-[52px] rounded-md object-cover"
              />
            ) : (
              <FileGlyph kind={kind === 'image' ? 'generic' : kind} />
            )
          ) : (
            <LoaderIcon size={16} />
          )}

          {onRemove && !isUploading && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute -right-1 -top-1 z-20 size-5 rounded-full border bg-background shadow-sm hover:bg-destructive hover:text-destructive-foreground"
              onClick={onRemove}
              aria-label={`Remove ${name ?? 'attachment'}`}
            >
              <XIcon size={12} />
            </Button>
          )}

          {isUploading && (
            <div className="absolute inset-0 z-10 flex flex-col justify-end bg-background/75 dark:bg-background/80">
              <div className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1">
                <LoaderIcon size={16} />
                <span className="text-center text-[9px] font-medium text-muted-foreground">
                  {uploadStatusLabel}
                </span>
              </div>
              <div className="h-0.5 w-full overflow-hidden bg-muted">
                <div className="h-full w-[55%] animate-attachment-indeterminate bg-primary/75" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between gap-0.5 px-0.5">
        <p
          className="min-w-0 flex-1 truncate text-center text-[11px] leading-tight text-muted-foreground"
          title={name}
        >
          {name || 'File'}
        </p>
        {showActionsMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 transition hover:bg-muted hover:opacity-100"
                aria-label="Attachment actions"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onRename && (
                <DropdownMenuItem onClick={handleRename}>
                  <Pencil className="mr-2 size-4" />
                  Rename
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="mr-2 size-4" />
                  Duplicate
                </DropdownMenuItem>
              )}
              {onContextOnlyChange && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onContextOnlyChange(!contextOnly)}
                  >
                    <BookMarked className="mr-2 size-4" />
                    {contextOnly ? 'Use as full attachment' : 'Reference only'}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};
