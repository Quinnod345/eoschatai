'use client';

import { create } from 'zustand';

import type { UpgradeFeature } from '@/types/upgrade';

type UpgradeState = {
  open: boolean;
  feature: UpgradeFeature | null;
  onAutoRetry?: (() => void) | null;
  openModal: (feature: UpgradeFeature, onAutoRetry?: () => void) => void;
  closeModal: () => void;
};

export const useUpgradeStore = create<UpgradeState>((set) => ({
  open: false,
  feature: null,
  onAutoRetry: null,
  openModal: (feature, onAutoRetry) => {
    console.log(`[UpgradeStore] Opening modal for feature: ${feature}`, {
      time: new Date().toISOString(),
      stack: new Error().stack,
    });
    set({
      open: true,
      feature,
      onAutoRetry: onAutoRetry ?? null,
    });
  },
  closeModal: () => {
    console.log('[UpgradeStore] Closing modal', {
      time: new Date().toISOString(),
    });
    set({ open: false, feature: null, onAutoRetry: null });
  },
}));
