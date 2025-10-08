'use client';

import { memo } from 'react';
import { CrossIcon } from './icons';
import { Button } from './ui/button';
import { initialComposerData, useComposer } from '@/hooks/use-composer';
import { useRouter, useSearchParams } from 'next/navigation';

interface PureComposerCloseButtonProps {
  stop?: () => void;
}

function PureComposerCloseButton({ stop }: PureComposerCloseButtonProps) {
  const { composer, setComposer } = useComposer();
  const router = useRouter();
  const params = useSearchParams();

  return (
    <Button
      data-testid="composer-close-button"
      variant="outline"
      className="h-fit p-2 dark:hover:bg-zinc-700"
      onClick={() => {
        // If composer is streaming, abort the stream first
        if (composer.status === 'streaming' && stop) {
          console.log('[Composer Close] Aborting active stream');
          stop();
        }

        setComposer((currentComposer) => {
          const next =
            currentComposer.status === 'streaming'
              ? {
                  ...currentComposer,
                  isVisible: false,
                  status: 'idle' as const,
                }
              : { ...initialComposerData, status: 'idle' as const };
          return next;
        });

        // If we arrived here from a dashboard open, restore dashboard param on close
        const url = new URL(window.location.href);
        const dash = params.get('composerKind');
        if (dash) {
          url.searchParams.set('dashboard', dash);
          url.searchParams.delete('documentId');
          url.searchParams.delete('documentTitle');
          url.searchParams.delete('composerKind');
          router.replace(url.toString());
        }
      }}
    >
      <CrossIcon size={18} />
    </Button>
  );
}

export const ComposerCloseButton = memo(PureComposerCloseButton, () => true);
