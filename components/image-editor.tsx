import { LoaderIcon } from './icons';
import cn from 'classnames';

type GalleryVersion = {
  id: string;
  base64: string;
  prompt?: string;
  createdAt: number;
};

type GalleryImage = {
  id: string;
  title?: string;
  prompt?: string;
  versions: GalleryVersion[];
  currentVersionIndex: number;
  createdAt: number;
};

type Gallery = {
  images: GalleryImage[];
  activeIndex: number;
};

function extractBase64(content: string): string | null {
  try {
    const trimmed = (content || '').trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith('{')) return trimmed;
    const parsed = JSON.parse(trimmed) as Gallery;
    const active = parsed.images?.[parsed.activeIndex || 0];
    const current = active?.versions?.[active.currentVersionIndex || 0];
    return current?.base64 || null;
  } catch {
    // Fallback to raw value if parsing fails
    return (content || '').trim() || null;
  }
}

interface ImageEditorProps {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline: boolean;
}

export function ImageEditor({
  title,
  content,
  status,
  isInline,
}: ImageEditorProps) {
  const base64 = extractBase64(content);
  return (
    <div
      className={cn('flex flex-row items-center justify-center w-full', {
        'h-[calc(100dvh-60px)]': !isInline,
        'h-[200px]': isInline,
      })}
    >
      {status === 'streaming' ? (
        <div className="flex flex-row gap-4 items-center">
          {!isInline && (
            <div className="animate-spin">
              <LoaderIcon />
            </div>
          )}
          <div>Generating Image...</div>
        </div>
      ) : base64 ? (
        <picture>
          <img
            className={cn('w-full h-fit max-w-[800px]', {
              'p-0 md:p-20': !isInline,
            })}
            src={`data:image/png;base64,${base64}`}
            alt={title}
          />
        </picture>
      ) : (
        <div className="text-sm text-muted-foreground">No image</div>
      )}
    </div>
  );
}
