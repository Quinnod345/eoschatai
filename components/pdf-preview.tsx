import { cn } from '@/lib/utils';

interface PDFPreviewProps {
  name: string;
  pageCount: number;
  alignRight?: boolean;
}

export function PDFPreview({
  name,
  pageCount,
  alignRight = false,
}: PDFPreviewProps) {
  return (
    <div
      className={cn('flex flex-col gap-1 w-fit', alignRight ? 'ml-auto' : '')}
    >
      <div className="flex flex-col w-40 bg-muted rounded-md p-2 relative">
        <div className="h-28 flex items-center justify-center">
          <svg
            className="size-9 text-zinc-500"
            fill="none"
            height="24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M9 13h6" />
            <path d="M9 17h6" />
            <path d="M9 9h1" />
          </svg>
        </div>
        <div className="absolute bottom-2 right-2 bg-background text-foreground text-xs px-1.5 py-0.5 rounded-md font-medium">
          PDF
        </div>
      </div>
      <div className="text-xs text-zinc-500 max-w-40 truncate">{name}</div>
      <div className="text-xs text-zinc-400">
        {pageCount} {pageCount === 1 ? 'page' : 'pages'}
      </div>
    </div>
  );
}
