import { Composer } from '@/components/create-composer';
import { CopyIcon, DownloadIcon, RedoIcon, UndoIcon } from '@/components/icons';
import { ImageEditor } from '@/components/image-editor';
import { toast } from 'sonner';

function extractBase64(content: string): string | null {
  try {
    const trimmed = (content || '').trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith('{')) return trimmed;
    const parsed = JSON.parse(trimmed) as any;
    const active = parsed.images?.[parsed.activeIndex || 0];
    const current = active?.versions?.[active.currentVersionIndex || 0];
    return current?.base64 || null;
  } catch {
    return (content || '').trim() || null;
  }
}

export const imageComposer = new Composer({
  kind: 'image',
  description: 'Useful for image generation',
  initialize: async ({ documentId, setMetadata }) => {
    setMetadata({ documentId });
  },
  onStreamPart: ({ streamPart, setComposer }) => {
    if ((streamPart as any).type === 'image-gallery') {
      setComposer((draft) => ({
        ...draft,
        content: String((streamPart as any).content || ''),
        isVisible: true,
        status: 'streaming',
      }));
      return;
    }
    if (streamPart.type === 'image-delta') {
      setComposer((draftComposer) => ({
        ...draftComposer,
        content: streamPart.content as string,
        isVisible: true,
        status: 'streaming',
      }));
    }
  },
  content: ImageEditor,
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy image to clipboard',
      onClick: ({ content }) => {
        const base64 = extractBase64(content || '');
        if (!base64) {
          toast.error('No image to copy');
          return;
        }
        const img = new Image();
        img.src = `data:image/png;base64,${base64}`;

        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
              ]);
            }
          }, 'image/png');
        };

        toast.success('Copied image to clipboard!');
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download image as PNG',
      onClick: ({ content, title }) => {
        const base64 = extractBase64(content || '');
        if (!base64) {
          toast.error('No image to download');
          return;
        }
        // Create an image to get dimensions and properly handle the download
        const img = new Image();
        img.src = `data:image/png;base64,${base64}`;

        img.onload = () => {
          // Use a canvas to ensure proper image formatting
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);

          // Convert canvas to blob and download
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;

              // Use the composer title for the filename, with fallback
              const safeTitle =
                title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'image';
              a.download = `${safeTitle}.png`;

              document.body.appendChild(a);
              a.click();

              // Clean up
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
          }, 'image/png');
        };

        toast.success(`Downloaded "${title}" as PNG`);
      },
    },
  ],
  toolbar: [],
});
