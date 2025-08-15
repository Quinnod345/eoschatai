'use client';

import useSWR from 'swr';
import type { UIComposer } from '@/components/composer';
import { useCallback, useMemo } from 'react';

export const initialComposerData: UIComposer = {
  documentId: 'init',
  content: '',
  kind: 'text',
  title: '',
  status: 'idle',
  isVisible: false,
  boundingBox: {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  },
};

type Selector<T> = (state: UIComposer) => T;

export function useComposerSelector<Selected>(selector: Selector<Selected>) {
  const { data: localComposer } = useSWR<UIComposer>('composer', null, {
    fallbackData: initialComposerData,
  });

  const selectedValue = useMemo(() => {
    if (!localComposer) return selector(initialComposerData);
    return selector(localComposer);
  }, [localComposer, selector]);

  return selectedValue;
}

export function useComposer() {
  const { data: localComposer, mutate: setLocalComposer } = useSWR<UIComposer>(
    'composer',
    null,
    {
      fallbackData: initialComposerData,
    },
  );

  const composer = useMemo(() => {
    if (!localComposer) return initialComposerData;
    return localComposer;
  }, [localComposer]);

  const setComposer = useCallback(
    (updaterFn: UIComposer | ((currentComposer: UIComposer) => UIComposer)) => {
      setLocalComposer((currentComposer) => {
        const composerToUpdate = currentComposer || initialComposerData;

        if (typeof updaterFn === 'function') {
          return updaterFn(composerToUpdate);
        }

        return updaterFn;
      });
    },
    [setLocalComposer],
  );

  const { data: localComposerMetadata, mutate: setLocalComposerMetadata } =
    useSWR<any>(
      () =>
        composer.documentId ? `composer-metadata-${composer.documentId}` : null,
      null,
      {
        fallbackData: null,
      },
    );

  return useMemo(
    () => ({
      composer,
      setComposer,
      metadata: localComposerMetadata,
      setMetadata: setLocalComposerMetadata,
    }),
    [composer, setComposer, localComposerMetadata, setLocalComposerMetadata],
  );
}
