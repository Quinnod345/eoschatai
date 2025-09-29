'use client';

import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import { UpgradeModal } from '@/components/upgrade-modal';
import type { UpgradeFeature } from '@/types/upgrade';

export function ModalWrapper() {
  const { open, feature, onAutoRetry, closeModal } = useUpgradeStore();

  if (!feature) return null;

  return (
    <UpgradeModal
      feature={feature as UpgradeFeature}
      open={open}
      onClose={closeModal}
      onAutoRetry={onAutoRetry ?? undefined}
    />
  );
}
