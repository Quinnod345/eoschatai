import { memo } from 'react';
import { CrossIcon } from './icons';
import { Button } from './ui/button';
import { initialArtifactData, useArtifact } from '@/hooks/use-composer';
import { useRouter, useSearchParams } from 'next/navigation';

function PureArtifactCloseButton() {
  const { setArtifact } = useArtifact();
  const router = useRouter();
  const params = useSearchParams();

  return (
    <Button
      data-testid="artifact-close-button"
      variant="outline"
      className="h-fit p-2 dark:hover:bg-zinc-700"
      onClick={() => {
        setArtifact((currentArtifact) => {
          const next =
            currentArtifact.status === 'streaming'
              ? { ...currentArtifact, isVisible: false }
              : { ...initialArtifactData, status: 'idle' };
          return next;
        });

        // If we arrived here from a dashboard open, restore dashboard param on close
        const url = new URL(window.location.href);
        const dash = params.get('artifactKind');
        if (dash) {
          url.searchParams.set('dashboard', dash);
          url.searchParams.delete('documentId');
          url.searchParams.delete('documentTitle');
          url.searchParams.delete('artifactKind');
          router.replace(url.toString());
        }
      }}
    >
      <CrossIcon size={18} />
    </Button>
  );
}

export const ArtifactCloseButton = memo(PureArtifactCloseButton, () => true);
