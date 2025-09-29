'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/lib/stores/account-store';
import type { NormalizedEntitlements } from '@/lib/entitlements/types';
import type { UpgradeFeature } from '@/types/upgrade';
import { trackClientEvent } from '@/lib/analytics/client';
import { PremiumFeaturesModal } from './premium-features-modal';

const FEATURE_COPY: Record<
  UpgradeFeature,
  {
    title: string;
    caption: string;
    bullets: string[];
    plan: 'pro' | 'business';
    video: string;
  }
> = {
  export: {
    title: 'Export Leadership-Ready Reports',
    caption: 'See how EOS AI assembles clean Level 10 outputs in seconds.',
    bullets: [
      'Instantly package Vision/Traction Organizer updates for your team',
      'Auto-format issues lists and to-dos into clean PDF and DOCX files',
      'Deliver professional recaps without spending extra hours editing',
    ],
    plan: 'pro',
    video: '/videos/chatexample.mp4',
  },
  calendar_connect: {
    title: 'Sync EOS Cadence to Your Calendar',
    caption: 'Connect Google Calendar and watch meetings sync automatically.',
    bullets: [
      'Keep Level 10 meetings aligned with real-time agendas',
      'Attach EOS AI notes directly to recurring sessions',
      'Never lose track of IDS topics between meetings again',
    ],
    plan: 'pro',
    video: '/videos/chatexample.mp4',
  },
  recordings: {
    title: 'Capture Every Leadership Conversation',
    caption: 'Record and transcribe EOS calls with AI summaries in minutes.',
    bullets: [
      'Upload voice memos and receive action-ready summaries',
      'Share highlights with your accountability chart instantly',
      'Unlock 10x more minutes for Voice + Level 10 recaps',
    ],
    plan: 'pro',
    video: '/videos/chatexample.mp4',
  },
  deep_research: {
    title: 'Unlock Deep Research for Leadership Teams',
    caption: 'Watch EOS AI explore markets and answer board-level questions.',
    bullets: [
      'Run 40-lookup research sessions with citations and context',
      'Compare competitors, KPIs, and EOS scorecards automatically',
      'Reserve up to two concurrent research seats per account',
      'Available exclusively with Business plan',
    ],
    plan: 'business',
    video: '/videos/chatexample.mp4',
  },
  premium: {
    title: 'Unlock EOS Chat AI Premium',
    caption: 'Get access to premium features for your EOS journey.',
    bullets: [
      'Pro Plan: AI Personas, Export, Calendar sync, Voice recordings',
      'Business Plan: Everything in Pro plus Deep Research mode',
      'Deep research with 40-lookup sessions for market analysis',
      'Team collaboration features and priority support',
      'Choose the plan that fits your leadership needs',
    ],
    plan: 'pro',
    video: '/videos/chatexample.mp4',
  },
};

const formatPrice = (amount: number | null, currency: string | null) => {
  if (!amount || !currency) return 'Contact us';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  });
  return formatter.format(amount / 100);
};

const hasFeatureAccess = (
  feature: UpgradeFeature,
  entitlements: NormalizedEntitlements | null,
) => {
  if (!entitlements) return false;
  const { features } = entitlements;

  switch (feature) {
    case 'export':
      return features.export;
    case 'calendar_connect':
      return features.calendar_connect;
    case 'recordings':
      return features.recordings.enabled;
    case 'deep_research':
      return features.deep_research.enabled;
    case 'premium':
      // For general premium, check if user has any premium features
      return (
        features.export ||
        features.calendar_connect ||
        features.recordings.enabled ||
        features.deep_research.enabled
      );
    default:
      return false;
  }
};

type BillingInterval = 'monthly' | 'annual';

type UpgradeModalProps = {
  feature: UpgradeFeature;
  open: boolean;
  onClose: () => void;
  onAutoRetry?: () => void;
};

export function UpgradeModal({
  feature,
  open,
  onClose,
  onAutoRetry,
}: UpgradeModalProps) {
  // If feature is 'premium', show the premium features modal instead
  if (feature === 'premium') {
    return <PremiumFeaturesModal open={open} onClose={onClose} />;
  }

  const [billing, setBilling] = useState<BillingInterval>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business'>(
    FEATURE_COPY[feature].plan,
  );
  const [seatCount, setSeatCount] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use separate selectors to avoid returning a new object each render
  const entitlements = useAccountStore((state) => state.entitlements);
  const prices = useAccountStore((state) => state.prices);
  const org = useAccountStore((state) => state.org);

  const config = FEATURE_COPY[feature];

  useEffect(() => {
    if (open) {
      setBilling('monthly');
      setSeatCount(org?.seatCount ?? 1);
      setSelectedPlan(FEATURE_COPY[feature].plan);
      setError(null);
    }
  }, [open, org?.seatCount, feature]);

  const accessGranted = useMemo(
    () => hasFeatureAccess(feature, entitlements),
    [feature, entitlements],
  );

  useEffect(() => {
    if (open && accessGranted) {
      onClose();
      onAutoRetry?.();
    }
  }, [open, accessGranted, onAutoRetry, onClose]);

  const price = useMemo(
    () =>
      prices.find(
        (entry) => entry.plan === selectedPlan && entry.interval === billing,
      ) ?? null,
    [prices, selectedPlan, billing],
  );

  const priceLabel = formatPrice(
    price?.unitAmount ?? null,
    price?.currency ?? null,
  );
  const priceSuffix =
    selectedPlan === 'business'
      ? 'per seat'
      : billing === 'annual'
        ? 'per year'
        : 'per month';
  const ctaLabel =
    selectedPlan === 'business' ? 'Upgrade to Business' : 'Upgrade to Pro';

  const handleCheckout = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const billingChoice = selectedPlan === 'business' ? 'seat' : billing;
      trackClientEvent({
        event: 'gate_click_upgrade',
        properties: {
          feature,
          plan: selectedPlan,
          placement: 'upgrade-modal',
          billing_choice: billingChoice,
        },
      }).catch(() => {});

      trackClientEvent({
        event: 'checkout_started',
        properties: {
          price_id: price?.id ?? 'unknown',
          plan: selectedPlan,
          billing,
          seats: selectedPlan === 'business' ? seatCount : undefined,
        },
      }).catch(() => {});

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          billing,
          seats: selectedPlan === 'business' ? seatCount : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          (data as { error?: string } | null)?.error ?? 'Checkout failed',
        );
      }

      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        throw new Error('Checkout link unavailable');
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      console.error('[upgrade-modal] Checkout failed', checkoutError);
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Checkout failed',
      );
    } finally {
      setSubmitting(false);
    }
  }, [billing, selectedPlan, seatCount]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl space-y-5">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-semibold">
            {config.title}
          </DialogTitle>
          <DialogDescription>
            Elevate your EOS implementation with premium AI workflows tailored
            for leadership teams.
          </DialogDescription>
        </DialogHeader>

        <figure className="overflow-hidden rounded-xl border border-white/20 bg-muted/40 shadow-inner">
          <video
            src={config.video}
            className="aspect-video w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
          <figcaption className="sr-only">{config.caption}</figcaption>
        </figure>

        <ul className="space-y-2 text-sm">
          {config.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2">
              <span
                className="mt-[6px] inline-block h-2 w-2 rounded-full bg-primary"
                aria-hidden
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-xl border border-white/10 bg-background/60 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full bg-muted px-1 py-1 text-xs font-medium">
              <button
                type="button"
                className={cn(
                  'rounded-full px-3 py-1 transition-colors',
                  selectedPlan === 'pro'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground',
                )}
                onClick={() => setSelectedPlan('pro')}
              >
                Pro
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-full px-3 py-1 transition-colors',
                  selectedPlan === 'business'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground',
                )}
                onClick={() => setSelectedPlan('business')}
              >
                Business
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-muted px-1 py-1 text-xs font-medium">
              <button
                type="button"
                className={cn(
                  'rounded-full px-3 py-1 transition-colors',
                  billing === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground',
                )}
                onClick={() => setBilling('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-full px-3 py-1 transition-colors',
                  billing === 'annual'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground',
                )}
                onClick={() => setBilling('annual')}
              >
                Annual
              </button>
            </div>

            <div className="text-right">
              <p className="text-lg font-semibold">{priceLabel}</p>
              <p className="text-xs text-muted-foreground">{priceSuffix}</p>
            </div>
          </div>

          {selectedPlan === 'business' && (
            <div className="mt-4 flex items-center justify-between gap-4">
              <label htmlFor="seat-count" className="text-sm font-medium">
                Seats Needed
              </label>
              <input
                id="seat-count"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={seatCount}
                onChange={(event) =>
                  setSeatCount(
                    Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                  )
                }
                className="w-24 rounded-md border border-input bg-background px-3 py-2 text-right text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Billing handled securely by Stripe. You&apos;ll be redirected to
            confirm your subscription.
          </div>
          <Button onClick={handleCheckout} disabled={submitting} size="lg">
            {submitting ? 'Redirecting…' : ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
