'use client';

import { useState, useEffect, useCallback } from 'react';
import { getNewFeatures } from '@/lib/features/config';

interface UseFeaturesOptions {
  userId?: string;
  autoShow?: boolean;
}

export function useFeatures({
  userId,
  autoShow = true,
}: UseFeaturesOptions = {}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastSeenVersion, setLastSeenVersion] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  // Load the user's last seen features version
  useEffect(() => {
    const loadLastSeenVersion = async () => {
      try {
        if (userId) {
          // Try to fetch from the API
          const response = await fetch('/api/user-settings');
          if (response.ok) {
            const data = await response.json();
            setLastSeenVersion(data.lastFeaturesVersion);
          }
        } else {
          // For guests, use localStorage
          const stored = localStorage.getItem('lastFeaturesVersion');
          setLastSeenVersion(stored || undefined);
        }
      } catch (error) {
        console.error('Failed to load last seen features version:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLastSeenVersion();
  }, [userId]);

  // Check if we should auto-show the modal
  useEffect(() => {
    if (!isLoading && autoShow) {
      const newFeatures = getNewFeatures(lastSeenVersion);
      if (newFeatures.length > 0) {
        // Delay to avoid showing too early
        const timer = setTimeout(() => {
          setIsModalOpen(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, lastSeenVersion, autoShow]);

  const markAsSeen = useCallback(
    async (version: string) => {
      try {
        if (userId) {
          // Update via API
          await fetch('/api/user-settings', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              lastFeaturesVersion: version,
            }),
          });
        } else {
          // For guests, use localStorage
          localStorage.setItem('lastFeaturesVersion', version);
        }
        setLastSeenVersion(version);
      } catch (error) {
        console.error('Failed to update last seen features version:', error);
      }
    },
    [userId],
  );

  const showModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const hideModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const hasNewFeatures =
    !isLoading && getNewFeatures(lastSeenVersion).length > 0;

  return {
    isModalOpen,
    lastSeenVersion,
    isLoading,
    hasNewFeatures,
    markAsSeen,
    showModal,
    hideModal,
    newFeaturesCount: isLoading ? 0 : getNewFeatures(lastSeenVersion).length,
  };
}
