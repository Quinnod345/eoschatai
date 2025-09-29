'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/lib/stores/account-store';
import type { UpgradeFeature } from '@/types/upgrade';

const FEATURE_COPY: Record<
  UpgradeFeature,
  {
    title: string;
    caption: string;
    bullets: string[];
    plan: 'pro' | 'business';
    video?: string;
    demo?: string;
  }
> = {
  export: {
    title: 'Export Leadership-Ready Reports',
    caption: 'Export your chats and documents to PDF and DOCX formats.',
    bullets: [
      'Export chat history as clean PDFs',
      'Download DOCX files for editing',
      'Professional formatting included',
    ],
    plan: 'pro',
    video: '/videos/export-demo.mp4',
    demo: '/gifs/export-demo.gif',
  },
  calendar_connect: {
    title: 'Sync EOS Cadence to Your Calendar',
    caption: 'Connect Google Calendar for seamless meeting integration.',
    bullets: [
      'Sync Level 10 meetings automatically',
      'Attach notes to calendar events',
      'Track meetings and action items',
    ],
    plan: 'pro',
    video: '/videos/calendar-demo.mp4',
    demo: '/gifs/calendar-demo.gif',
  },
  recordings: {
    title: 'Capture Every Leadership Conversation',
    caption: 'Record and transcribe meetings with AI summaries.',
    bullets: [
      'Upload voice recordings',
      'Automatic transcription',
      '600 minutes per month included',
    ],
    plan: 'pro',
    video: '/videos/recordings-demo.mp4',
    demo: '/gifs/recordings-demo.gif',
  },
  deep_research: {
    title: 'Unlock Deep Research for Leadership Teams',
    caption: 'Advanced AI research with web access and citations.',
    bullets: [
      'Deep web research capabilities',
      'Up to 20 lookups per research session',
      'Complete citations and sources',
    ],
    plan: 'business',
    video: '/videos/research-demo.mp4',
    demo: '/gifs/research-demo.gif',
  },
  premium: {
    title: 'Unlock Premium Features',
    caption: 'Get access to all premium features and capabilities.',
    bullets: [
      'All Pro plan features',
      'Priority support',
      'Advanced integrations',
    ],
    plan: 'pro',
    video: '/videos/premium-demo.mp4',
    demo: '/gifs/premium-demo.gif',
  },
};

type SimpleUpgradeModalProps = {
  feature: UpgradeFeature;
  open: boolean;
  onClose: () => void;
  onAutoRetry?: () => void;
};

export function SimpleUpgradeModal({
  feature,
  open,
  onClose,
  onAutoRetry,
}: SimpleUpgradeModalProps) {
  const config = FEATURE_COPY[feature];
  // Use separate selectors to avoid creating new objects
  const entitlements = useAccountStore((state) => state.entitlements);
  const prices = useAccountStore((state) => state.prices);

  // Check if the feature is now enabled
  const featureEnabled = useMemo(() => {
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
        return true; // Premium is a general feature category
      default:
        return false;
    }
  }, [feature, entitlements]);

  // Auto-close and retry when feature becomes enabled
  useEffect(() => {
    if (open && featureEnabled) {
      console.log(
        `[SimpleUpgradeModal] Feature ${feature} now enabled, auto-closing and retrying`,
      );
      onClose();
      // Small delay to ensure modal closes before retry
      setTimeout(() => {
        onAutoRetry?.();
      }, 100);
    }
  }, [open, featureEnabled, feature, onClose, onAutoRetry]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);

  const handleCheckout = useCallback(async () => {
    try {
      // Get the price based on plan (defaulting to monthly for now)
      const price = prices.find(
        (p) => p.plan === config.plan && p.interval === 'monthly',
      );

      if (!price) {
        console.error(
          '[SimpleUpgradeModal] No price found for plan:',
          config.plan,
        );
        alert('Pricing information not available. Please try again later.');
        return;
      }

      // Create checkout session
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: config.plan,
          billing: 'monthly', // TODO: Add billing interval selector
          seats: config.plan === 'business' ? 1 : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();

      if (url) {
        // Redirect to Stripe checkout
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('[SimpleUpgradeModal] Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    }
  }, [config.plan, prices]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-[2147483646] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4">
        <div
          className={cn(
            'relative w-full max-w-2xl bg-background rounded-xl border shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-200',
          )}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-semibold">{config.title}</h2>
              <p className="text-muted-foreground mt-2">
                Elevate your EOS implementation with premium AI workflows
                tailored for leadership teams.
              </p>
            </div>

            {/* Feature preview */}
            <div className="space-y-4">
              {(config.video || config.demo) && (
                <figure className="overflow-hidden rounded-xl border border-white/20 bg-muted/40 shadow-inner">
                  {config.video ? (
                    <video
                      src={config.video}
                      className="aspect-video w-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                      onError={(e) => {
                        // Fallback to demo GIF if video fails
                        if (
                          config.demo &&
                          e.currentTarget.src !== config.demo
                        ) {
                          e.currentTarget.src = config.demo;
                        }
                      }}
                    />
                  ) : config.demo ? (
                    <img
                      src={config.demo}
                      alt={config.caption}
                      className="aspect-video w-full object-cover"
                    />
                  ) : null}
                  <figcaption className="sr-only">{config.caption}</figcaption>
                </figure>
              )}
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-sm">{config.caption}</p>
              </div>
            </div>

            {/* Benefits */}
            <ul className="space-y-2">
              {config.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm">{bullet}</span>
                </li>
              ))}
            </ul>

            {/* Pricing */}
            <div className="rounded-lg border bg-background/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {config.plan === 'pro' ? 'Pro Plan' : 'Business Plan'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {config.plan === 'pro' ? 'For individuals' : 'For teams'}
                  </p>
                </div>
                <div className="text-right">
                  {(() => {
                    const monthlyPrice = prices.find(
                      (p) => p.plan === config.plan && p.interval === 'monthly',
                    );
                    if (monthlyPrice && monthlyPrice.unitAmount) {
                      const formatter = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: monthlyPrice.currency || 'usd',
                        minimumFractionDigits: 0,
                      });
                      return (
                        <>
                          <p className="text-lg font-semibold">
                            {formatter.format(monthlyPrice.unitAmount / 100)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            per {config.plan === 'business' ? 'seat/' : ''}month
                          </p>
                        </>
                      );
                    }
                    return (
                      <>
                        <p className="text-lg font-semibold">Contact us</p>
                        <p className="text-xs text-muted-foreground">
                          for pricing
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Billing handled securely by Stripe
              </p>
              <Button onClick={handleCheckout} size="lg">
                {config.plan === 'business'
                  ? 'Talk to Sales'
                  : 'Upgrade to Pro'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
