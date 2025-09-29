'use client';

import { AccountProvider } from '@/components/account-provider';
import { SimpleUpgradeModal } from '@/components/simple-upgrade-modal';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import type { UpgradeFeature } from '@/types/upgrade';

function ModalWrapper({ children }: { children: React.ReactNode }) {
  const { open, feature, onAutoRetry, closeModal } = useUpgradeStore();

  return (
    <>
      {children}
      {feature && (
        <SimpleUpgradeModal
          feature={feature as UpgradeFeature}
          open={open}
          onClose={closeModal}
          onAutoRetry={onAutoRetry ?? undefined}
        />
      )}
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
