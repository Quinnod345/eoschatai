'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import type { UpgradeFeature } from '@/types/upgrade';
import { cn } from '@/lib/utils';
import { trackClientEvent } from '@/lib/analytics/client';
import { useAccountStore } from '@/lib/stores/account-store';

type UpgradePromptProps = {
  feature: UpgradeFeature;
  onAutoRetry?: () => void;
  cta?: string;
  children?: ReactNode;
  className?: string;
  placement?: string;
};

export function UpgradePrompt({
  feature,
  onAutoRetry,
  cta = 'Upgrade your Circle tier',
  children,
  className,
  placement = 'unspecified',
}: UpgradePromptProps) {
  const openModal = useUpgradeStore((state) => state.openModal);
  const plan = useAccountStore((state) => state.user?.plan ?? 'free');

  const handleClick = () => {
    // Only track analytics for valid analytics features (not 'premium')
    if (feature !== 'premium') {
      trackClientEvent({
        event: 'gate_click_upgrade',
        properties: {
          feature: feature as
            | 'export'
            | 'calendar_connect'
            | 'recordings'
            | 'deep_research',
          plan,
          placement,
          billing_choice: 'unknown',
        },
      }).catch(() => {});
    }
    openModal(feature, onAutoRetry);
  };

  if (children) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
          }
        }}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2',
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={className}
    >
      {cta}
    </Button>
  );
}
