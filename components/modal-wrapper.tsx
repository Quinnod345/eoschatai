'use client';

import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import { PremiumFeaturesModal } from '@/components/premium-features-modal';

export function ModalWrapper() {
  const { open, closeModal } = useUpgradeStore();

  return <PremiumFeaturesModal open={open} onClose={closeModal} />;
}
