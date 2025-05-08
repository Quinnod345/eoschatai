import type { Attachment } from 'ai';
import { LoaderIcon, XIcon } from './icons';
import { Button } from './ui/button';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;

  return (
    <div
      data-testid="input-attachment-preview"
      className="flex flex-col gap-2 relative"
    >
      <div className="w-20 h-16 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center">
        {contentType ? (
          contentType.startsWith('image') ? (
            // NOTE: it is recommended to use next/image for images
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={name ?? 'An image attachment'}
              className="rounded-md size-full object-cover"
            />
          ) : (
            // Default file icon for non-image attachments
            <svg
              className="size-8 text-zinc-500"
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
          )
        ) : (
          // Loading icon for when there's no content type yet
          <LoaderIcon size={16} />
        )}

        {onRemove && !isUploading && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-1 -right-1 size-5 rounded-full bg-background border shadow-sm hover:bg-destructive hover:text-destructive-foreground"
            onClick={onRemove}
          >
            <XIcon size={12} />
          </Button>
        )}

        {isUploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
            <LoaderIcon size={16} />
          </div>
        )}
      </div>
      <div className="text-xs text-zinc-500 max-w-16 truncate">{name}</div>
    </div>
  );
};
