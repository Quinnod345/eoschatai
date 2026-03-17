'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  const [selectedRecordingId, setSelectedRecordingId] = useState<
    string | undefined
  >();
  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    isModalOpen,
    lastSeenVersion,
    hasNewFeatures,
    newFeaturesCount,
    markAsSeen,
    showModal,
    hideModal,
  } = useFeatures({
    userId: user?.id,
    autoShow: false, // Disabled to prevent auth conflicts and reduce hook execution
  });

  // Handle URL parameters to open recording modal
  useEffect(() => {
    const recordingId = searchParams.get('recordingId');
    const openRecordingModal = searchParams.get('openRecordingModal');

    if (recordingId) {
      setSelectedRecordingId(recordingId);
      setIsRecordingModalOpen(true);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('recordingId');
      router.replace(url.pathname + url.search);
    } else if (openRecordingModal === 'true') {
      setSelectedRecordingId(undefined);
      setIsRecordingModalOpen(true);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('openRecordingModal');
      router.replace(url.pathname + url.search);
    }
  }, [searchParams, router]);

  const handleOpenRecording = () => {
    setIsRecordingModalOpen(true);
  };

  const handleCloseRecording = () => {
    setIsRecordingModalOpen(false);
    setSelectedRecordingId(undefined);
  };

  return (
    <>
      {children}
      <WhatsNewBanner
        hasNewFeatures={hasNewFeatures}
        newFeaturesCount={newFeaturesCount}
        lastSeenVersion={lastSeenVersion}
        onExplore={showModal}
      />
      <RecordingSuiteBanner onOpenRecording={handleOpenRecording} />
      <WhatsNewModal
        isOpen={isModalOpen}
        onClose={hideModal}
        lastSeenVersion={lastSeenVersion}
        onMarkAsSeen={markAsSeen}
      />
      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={handleCloseRecording}
        selectedRecordingId={selectedRecordingId}
      />
    </>
  );
}
