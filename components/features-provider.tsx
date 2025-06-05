'use client';
import { useFeatures } from '@/hooks/use-features';
import { WhatsNewModal } from '@/components/whats-new-modal';
import { WhatsNewBanner } from '@/components/whats-new-banner';
import type { User } from 'next-auth';

interface FeaturesProviderProps {
  user?: User;
  children: React.ReactNode;
}

export function FeaturesProvider({ user, children }: FeaturesProviderProps) {
  const {
    isModalOpen,
    lastSeenVersion,
    hasNewFeatures,
    markAsSeen,
    hideModal,
  } = useFeatures({
    userId: user?.id,
    autoShow: false, // Temporarily disable auto-show to prevent auth conflicts
  });

  return (
    <>
      {children}
      <WhatsNewBanner user={user} />
      <WhatsNewModal
        isOpen={isModalOpen}
        onClose={hideModal}
        lastSeenVersion={lastSeenVersion}
        onMarkAsSeen={markAsSeen}
      />
    </>
  );
}
