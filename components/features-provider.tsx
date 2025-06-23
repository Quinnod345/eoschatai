'use client';
import { useState } from 'react';
import { useFeatures } from '@/hooks/use-features';
import { WhatsNewModal } from '@/components/whats-new-modal';
import { WhatsNewBanner } from '@/components/whats-new-banner';
import { RecordingSuiteBanner } from '@/components/recording-suite-banner';
import RecordingModal from '@/components/recording-modal';
import type { User } from 'next-auth';

interface FeaturesProviderProps {
  user?: User;
  children: React.ReactNode;
}

export function FeaturesProvider({ user, children }: FeaturesProviderProps) {
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);

  const {
    isModalOpen,
    lastSeenVersion,
    hasNewFeatures,
    markAsSeen,
    hideModal,
  } = useFeatures({
    userId: user?.id,
    autoShow: false, // Disabled to prevent auth conflicts and reduce hook execution
  });

  const handleOpenRecording = () => {
    setIsRecordingModalOpen(true);
  };

  return (
    <>
      {children}
      <WhatsNewBanner user={user} />
      <RecordingSuiteBanner onOpenRecording={handleOpenRecording} />
      <WhatsNewModal
        isOpen={isModalOpen}
        onClose={hideModal}
        lastSeenVersion={lastSeenVersion}
        onMarkAsSeen={markAsSeen}
      />
      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={() => setIsRecordingModalOpen(false)}
      />
    </>
  );
}
