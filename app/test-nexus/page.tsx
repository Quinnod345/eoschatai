'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { NexusResearchSelector } from '@/components/nexus-research-selector';
import { useAccountStore } from '@/lib/stores/account-store';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';

export default function TestNexusPage() {
  const [researchMode, setResearchMode] = useState<'off' | 'nexus'>('off');
  const [mounted, setMounted] = useState(false);

  const { user, entitlements, ready } = useAccountStore();
  const { open: modalOpen, feature: modalFeature } = useUpgradeStore();
  const openModal = useUpgradeStore((state) => state.openModal);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log('[TestNexus] Store state:', {
      ready,
      user,
      entitlements,
      modalOpen,
      modalFeature,
    });
  }, [ready, user, entitlements, modalOpen, modalFeature]);

  if (!mounted) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Nexus Research Selector Test</h1>

      {/* Account Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Account Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="font-semibold">Ready:</span>{' '}
              {ready ? 'Yes' : 'No'}
            </div>
            <div>
              <span className="font-semibold">Plan:</span>{' '}
              {user?.plan || 'Not loaded'}
            </div>
            <div>
              <span className="font-semibold">Deep Research Enabled:</span>{' '}
              {entitlements?.features.deep_research.enabled ? 'Yes' : 'No'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nexus Selector */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Nexus Research Selector</CardTitle>
          <CardDescription>
            Click to test the selector. Should open upgrade modal if not
            entitled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <NexusResearchSelector
              chatId="test-chat-123"
              selectedResearchMode={researchMode}
              onResearchModeChange={(mode) => {
                console.log('[TestNexus] Research mode changed to:', mode);
                setResearchMode(mode);
              }}
            />
            <span>Current mode: {researchMode}</span>
          </div>
        </CardContent>
      </Card>

      {/* Direct Modal Test */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Direct Modal Test</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              console.log('[TestNexus] Opening modal directly');
              openModal('deep_research');
            }}
          >
            Open Deep Research Upgrade Modal
          </Button>
        </CardContent>
      </Card>

      {/* Modal State */}
      <Card>
        <CardHeader>
          <CardTitle>Modal State</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs">
            {JSON.stringify({ modalOpen, modalFeature }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
