'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Check,
  Sparkles,
  Crown,
  Users,
  FileText,
  Calendar,
  Mic,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/lib/stores/account-store';
import { trackClientEvent } from '@/lib/analytics/client';
import { Badge } from '@/components/ui/badge';

interface PremiumFeaturesModalProps {
  open: boolean;
  onClose: () => void;
}

const PLAN_FEATURES = {
  free: {
    name: 'Free',
    price: '$0',
    features: [
      { name: 'Basic EOS AI assistance', included: true },
      { name: '20 chats per day', included: true },
      { name: '5 document uploads', included: true },
      { name: 'System personas only', included: true },
      { name: 'Text composer only', included: true },
      { name: 'Custom AI Personas', included: false },
      { name: 'Advanced composers (code, chart, VTO)', included: false },
      { name: 'Export to PDF/DOCX', included: false },
      { name: 'Calendar integration', included: false },
      { name: 'Voice transcription', included: false },
      { name: 'Long-term memory', included: false },
      { name: 'Message pinning & bookmarking', included: false },
      { name: 'Deep research mode', included: false },
    ],
  },
  pro: {
    name: 'Pro',
    price: '$49',
    priceInterval: 'per month',
    badge: 'Most Popular',
    features: [
      { name: 'Everything in Free', included: true },
      { name: '200 chats per day', included: true },
      { name: '100 document uploads', included: true },
      { name: '25 custom AI personas', included: true },
      { name: 'Advanced composers (code, chart, sheet)', included: true },
      { name: 'Export to PDF/DOCX', included: true },
      { name: 'Google Calendar sync', included: true },
      { name: 'Voice transcription (600 min/month)', included: true },
      { name: 'Long-term memory (100 memories)', included: true },
      { name: 'Message pinning & bookmarking', included: true },
      { name: 'Version history (50 versions)', included: true },
      { name: 'Advanced search & analytics', included: true },
      { name: 'Priority support', included: true },
      { name: 'Deep research mode', included: false },
      { name: 'Team features', included: false },
    ],
  },
  business: {
    name: 'Business',
    price: '$99',
    priceInterval: 'per seat/month',
    badge: 'Best for Teams',
    features: [
      { name: 'Everything in Pro', included: true },
      { name: '1000 chats per day per seat', included: true },
      { name: 'Unlimited personas & memories', included: true },
      { name: 'All composers (VTO, A/C Chart)', included: true },
      { name: 'Deep research with 40 lookups', included: true },
      { name: 'Voice transcription (3000 min/month)', included: true },
      { name: 'Team collaboration & sharing', included: true },
      { name: 'Shared personas across org', included: true },
      { name: 'L10 meeting management', included: true },
      { name: 'Unlimited version history', included: true },
      { name: 'Team analytics & insights', included: true },
      { name: 'API access', included: true },
      { name: 'Dedicated account manager', included: true },
      { name: 'SSO & enhanced security', included: true },
    ],
  },
};

export function PremiumFeaturesModal({
  open,
  onClose,
}: PremiumFeaturesModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business'>('pro');
  const [loading, setLoading] = useState(false);
  const prices = useAccountStore((state) => state.prices);
  const userPlan = useAccountStore((state) => state.user?.plan ?? 'free');
  const org = useAccountStore((state) => state.org);

  // Use organization's plan if user belongs to an organization, otherwise use user's plan
  const currentPlan = org?.plan ?? userPlan;

  // Debug org loading
  useEffect(() => {
    console.log('[PremiumModal] Organization state:', {
      org,
      hasOrg: !!org,
      orgId: org?.id,
      orgName: org?.name,
    });
  }, [org]);

  // Debug modal state
  useEffect(() => {
    console.log('[PremiumModal] Modal states:', {
      open,
      selectedPlan,
    });
  }, [open, selectedPlan]);

  // Automatically select business plan if user is coming from Nexus feature
  // and is currently on Pro plan
  useEffect(() => {
    if (open && currentPlan === 'pro') {
      setSelectedPlan('business');
    }
  }, [open, currentPlan]);

  useEffect(() => {
    if (open) {
      trackClientEvent({
        event: 'premium_modal_opened',
        properties: {
          plan: currentPlan,
          source: 'premium_modal',
          feature: undefined,
        },
      }).catch(() => {});
    }
  }, [open, currentPlan]);

  const handleCheckout = useCallback(async () => {
    console.log('[PremiumModal] Checkout clicked:', {
      selectedPlan,
      hasOrg: !!org,
      orgId: org?.id,
      orgName: org?.name,
    });

    // For business plan, use the dedicated flow
    if (selectedPlan === 'business') {
      console.log('[PremiumModal] Opening business flow via event');
      // Close the premium modal first
      onClose();
      // Dispatch event to open business flow
      setTimeout(() => {
        const event = new Event('open-business-flow');
        window.dispatchEvent(event);
      }, 100);
      return;
    }

    // For Pro plan, proceed directly to checkout
    setLoading(true);
    try {
      trackClientEvent({
        event: 'premium_checkout_initiated',
        properties: {
          plan: selectedPlan,
          billing_cycle: 'monthly',
          source: 'premium_modal',
        },
      }).catch(() => {});

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          billing: 'monthly',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);

      // Check if the error is about organization already having a subscription
      if (error?.message?.includes('organization already has')) {
        alert(error.message);
      } else {
        alert('Failed to start checkout. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedPlan, currentPlan, org]);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent size="2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Crown className="w-6 h-6 text-yellow-500" />
              {currentPlan === 'free'
                ? 'Unlock EOSAI Premium'
                : 'Upgrade Your Plan'}
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              {currentPlan === 'free'
                ? 'Choose the plan that best fits your EOS journey'
                : currentPlan === 'pro'
                  ? 'Upgrade to Business for advanced features like Deep Research'
                  : 'Manage your Business subscription'}
            </DialogDescription>
          </DialogHeader>

          {/* Show organization subscription status */}
          {org && org.plan !== 'free' && (
            <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-900 dark:text-green-100">
                <strong>Organization Subscription Active:</strong> Your
                organization "{org.name}" has a {org.plan} subscription. All
                members have access to {org.plan} features.
              </p>
            </div>
          )}

          {/* Show a helpful message for Pro users trying to access Business features */}
          {currentPlan === 'pro' && !org && (
            <div className="mb-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>You're on the Pro plan.</strong> Upgrade to Business to
                unlock Deep Research and advanced team features.
              </p>
            </div>
          )}

          <div className="grid gap-6 py-6 md:grid-cols-3">
            {/* Free Plan */}
            <div className="relative rounded-xl border p-6 bg-muted/30">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">
                  {PLAN_FEATURES.free.name}
                </h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">
                    {PLAN_FEATURES.free.price}
                  </span>
                </div>
              </div>
              <ul className="space-y-3">
                {PLAN_FEATURES.free.features.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-2">
                    {feature.included ? (
                      <Check className="w-4 h-4 text-green-500 mt-0.5" />
                    ) : (
                      <div className="w-4 h-4 mt-0.5" />
                    )}
                    <span
                      className={cn(
                        'text-sm',
                        !feature.included &&
                          'text-muted-foreground line-through',
                      )}
                    >
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
              {currentPlan === 'free' && (
                <Badge className="absolute top-4 right-4" variant="secondary">
                  Current Plan
                </Badge>
              )}
            </div>

            {/* Pro Plan */}
            <div
              className={cn(
                'relative rounded-xl border-2 p-6 cursor-pointer transition-all',
                selectedPlan === 'pro'
                  ? 'border-primary bg-primary/5 shadow-lg scale-105'
                  : 'border-border hover:border-primary/50',
                currentPlan === 'pro' && 'ring-2 ring-primary/20',
              )}
              onClick={() => setSelectedPlan('pro')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedPlan('pro');
                }
              }}
            >
              {currentPlan === 'pro' ? (
                <Badge className="absolute top-4 right-4" variant="secondary">
                  Current Plan
                </Badge>
              ) : PLAN_FEATURES.pro.badge ? (
                <Badge
                  className="absolute -top-3 left-1/2 -translate-x-1/2"
                  variant="default"
                >
                  {PLAN_FEATURES.pro.badge}
                </Badge>
              ) : null}
              <div className="mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  {PLAN_FEATURES.pro.name}
                  <Sparkles className="w-4 h-4 text-primary" />
                </h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">
                    {PLAN_FEATURES.pro.price}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    {PLAN_FEATURES.pro.priceInterval}
                  </span>
                </div>
              </div>
              <ul className="space-y-3">
                {PLAN_FEATURES.pro.features.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-2">
                    {feature.included ? (
                      <Check className="w-4 h-4 text-green-500 mt-0.5" />
                    ) : (
                      <div className="w-4 h-4 mt-0.5" />
                    )}
                    <span
                      className={cn(
                        'text-sm',
                        !feature.included &&
                          'text-muted-foreground line-through',
                      )}
                    >
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Business Plan */}
            <div
              className={cn(
                'relative rounded-xl border-2 p-6 cursor-pointer transition-all',
                selectedPlan === 'business'
                  ? 'border-primary bg-primary/5 shadow-lg scale-105'
                  : 'border-border hover:border-primary/50',
                currentPlan === 'business' && 'ring-2 ring-primary/20',
              )}
              onClick={() => setSelectedPlan('business')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedPlan('business');
                }
              }}
            >
              {currentPlan === 'business' ? (
                <Badge className="absolute top-4 right-4" variant="secondary">
                  Current Plan
                </Badge>
              ) : PLAN_FEATURES.business.badge ? (
                <Badge
                  className="absolute -top-3 left-1/2 -translate-x-1/2"
                  variant="default"
                >
                  {PLAN_FEATURES.business.badge}
                </Badge>
              ) : null}
              <div className="mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  {PLAN_FEATURES.business.name}
                  <Users className="w-4 h-4 text-primary" />
                </h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">
                    {PLAN_FEATURES.business.price}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    {PLAN_FEATURES.business.priceInterval}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 2 seats • Requires organization
                </p>
              </div>
              <ul className="space-y-3">
                {PLAN_FEATURES.business.features.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-2">
                    {feature.included ? (
                      <Check className="w-4 h-4 text-green-500 mt-0.5" />
                    ) : (
                      <div className="w-4 h-4 mt-0.5" />
                    )}
                    <span
                      className={cn(
                        'text-sm',
                        !feature.included &&
                          'text-muted-foreground line-through',
                      )}
                    >
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Feature Icons */}
          <div className="flex items-center justify-center gap-8 py-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>Export</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Calendar</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mic className="w-4 h-4" />
              <span>Voice</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Search className="w-4 h-4" />
              <span>Research</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>Personas</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={
                loading ||
                currentPlan === 'business' ||
                (currentPlan === 'pro' && selectedPlan === 'pro') ||
                Boolean(org && org.plan !== 'free')
              }
              className="min-w-[120px]"
            >
              {loading
                ? 'Processing...'
                : org && org.plan !== 'free'
                  ? `Organization has ${org.plan}`
                  : currentPlan === 'business'
                    ? 'Already on Business'
                    : currentPlan === 'pro' && selectedPlan === 'pro'
                      ? 'Current Plan'
                      : currentPlan === 'pro' && selectedPlan === 'business'
                        ? 'Upgrade to Business'
                        : `Upgrade to ${selectedPlan === 'pro' ? 'Pro' : 'Business'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
