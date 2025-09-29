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
import { Badge } from '@/components/ui/badge';
import { Gate } from '@/components/gate';
import { UpgradePrompt } from '@/components/upgrade-prompt';
import { useAccountStore } from '@/lib/stores/account-store';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import type { UpgradeFeature } from '@/types/upgrade';

export default function TestPremiumPage() {
  const [mounted, setMounted] = useState(false);
  const { user, entitlements, prices } = useAccountStore();
  const openModal = useUpgradeStore((state) => state.openModal);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="p-8">Loading...</div>;
  }

  const features: Array<{
    feature: UpgradeFeature;
    label: string;
    description: string;
  }> = [
    {
      feature: 'export',
      label: 'Export',
      description: 'Export chats to PDF/DOCX',
    },
    {
      feature: 'calendar_connect',
      label: 'Calendar',
      description: 'Connect Google Calendar',
    },
    {
      feature: 'recordings',
      label: 'Recordings',
      description: 'Voice recording & transcription',
    },
    {
      feature: 'deep_research',
      label: 'Nexus Research',
      description: 'Deep web research',
    },
  ];

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Premium Features Test Page</h1>

      {/* Current Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Account Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="font-semibold">Email:</span>{' '}
              {user?.email || 'Not loaded'}
            </div>
            <div>
              <span className="font-semibold">Plan:</span>{' '}
              <Badge variant={user?.plan === 'free' ? 'secondary' : 'default'}>
                {user?.plan || 'Unknown'}
              </Badge>
            </div>
            <div>
              <span className="font-semibold">Prices Loaded:</span>{' '}
              {prices.length > 0 ? 'Yes' : 'No'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Direct Upgrade Buttons */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Direct Upgrade Modal Test</CardTitle>
          <CardDescription>
            Click any button to open the upgrade modal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {features.map(({ feature, label }) => (
              <Button
                key={feature}
                onClick={() => openModal(feature)}
                variant="outline"
                className="w-full"
              >
                Open {label} Upgrade
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gate Component Tests */}
      <Card>
        <CardHeader>
          <CardTitle>Gate Component Tests</CardTitle>
          <CardDescription>
            These should show upgrade prompts when on free plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {features.map(({ feature, label, description }) => (
              <div key={feature} className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">{label}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {description}
                </p>
                <Gate
                  feature={feature}
                  fallback={
                    <UpgradePrompt
                      feature={feature}
                      cta={`Unlock ${label}`}
                      placement="test-premium"
                    />
                  }
                >
                  <div className="p-4 bg-green-100 dark:bg-green-900 rounded">
                    ✓ {label} is enabled (you have premium)
                  </div>
                </Gate>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Debug Info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto">
            {JSON.stringify({ user, entitlements, prices }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
