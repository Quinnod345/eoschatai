'use client';

import { AccountProvider } from '@/components/account-provider';
import { PremiumFeaturesModal } from '@/components/premium-features-modal';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';

function ModalWrapper({ children }: { children: React.ReactNode }) {
  const { open, closeModal } = useUpgradeStore();

  return (
    <>
      {children}
      <PremiumFeaturesModal open={open} onClose={closeModal} />
    </>
  );
}

export default function TestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountProvider>
      <ModalWrapper>{children}</ModalWrapper>
    </AccountProvider>
  );
}
