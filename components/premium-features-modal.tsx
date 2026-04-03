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
  X,
  Sparkles,
  Crown,
  Users,
  FileText,
  Calendar,
  Search,
  Link2,
  ExternalLink,
  ArrowRight,
  GraduationCap,
  Shield,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/lib/stores/account-store';
import { trackClientEvent } from '@/lib/analytics/client';
import { Badge } from '@/components/ui/badge';

const EOS_ACADEMY_URL = 'https://academy.eosworldwide.com/c/the-eos-bot/';

const TIER_DISPLAY_NAME: Record<string, string> = {
  free: 'Discovery',
  pro: 'Strengthen',
  business: 'Mastery',
};

const PLAN_FEATURES = {
  free: {
    displayName: 'Discovery',
    description: 'Explore the EOS AI Bot and get started.',
    icon: Zap,
    gradient: 'from-zinc-500/20 to-zinc-600/5',
    borderColor: 'border-zinc-500/20',
    accentColor: 'text-zinc-400',
    features: [
      { name: 'Basic EOS AI assistance', included: true },
      { name: '20 chats per day', included: true },
      { name: '5 document uploads', included: true },
      { name: 'System personas', included: true },
      { name: 'Text composer', included: true },
      { name: 'Custom AI Personas', included: false },
      { name: 'Advanced composers', included: false },
      { name: 'Export to PDF/DOCX', included: false },
      { name: 'Calendar integration', included: false },
      { name: 'Long-term memory', included: false },
      { name: 'Deep research', included: false },
    ],
  },
  pro: {
    displayName: 'Strengthen',
    description: 'Full-featured EOS AI for serious implementers.',
    badge: 'Most Popular',
    icon: Sparkles,
    gradient: 'from-primary/20 to-primary/5',
    borderColor: 'border-primary/30',
    accentColor: 'text-primary',
    features: [
      { name: 'Everything in Discovery', included: true },
      { name: '200 chats per day', included: true },
      { name: '100 document uploads', included: true },
      { name: '25 custom AI personas', included: true },
      { name: 'Advanced composers (chart, sheet)', included: true },
      { name: 'Export to PDF/DOCX', included: true },
      { name: 'Google Calendar sync', included: true },
      { name: 'Long-term memory (100 memories)', included: true },
      { name: 'Pinning & bookmarking', included: true },
      { name: 'Version history (50 versions)', included: true },
      { name: 'Advanced search & analytics', included: true },
      { name: 'Priority support', included: true },
      { name: 'Deep research', included: false },
      { name: 'Team features', included: false },
    ],
  },
  business: {
    displayName: 'Mastery',
    description: 'Full access for leadership teams running EOS at scale.',
    badge: 'Best for Teams',
    icon: Shield,
    gradient: 'from-amber-500/20 to-orange-500/5',
    borderColor: 'border-amber-500/30',
    accentColor: 'text-amber-500',
    features: [
      { name: 'Everything in Strengthen', included: true },
      { name: '1,000 chats per day per seat', included: true },
      { name: 'Unlimited personas & memories', included: true },
      { name: 'All composers (VTO, A/C Chart)', included: true },
      { name: 'Deep research with 40 lookups', included: true },
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

type PlanKey = keyof typeof PLAN_FEATURES;

interface PremiumFeaturesModalProps {
  open: boolean;
  onClose: () => void;
}

export function PremiumFeaturesModal({
  open,
  onClose,
}: PremiumFeaturesModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business'>('pro');
  const userPlan = useAccountStore((state) => state.user?.plan ?? 'free');
  const userSubscriptionSource = useAccountStore(
    (state) => state.user?.subscriptionSource,
  );
  const org = useAccountStore((state) => state.org);

  const currentPlan =
    org?.subscriptionSource === 'circle' ? userPlan : (org?.plan ?? userPlan);
  const isCircleLinked = userSubscriptionSource === 'circle';

  useEffect(() => {
    if (open && currentPlan === 'pro') {
      setSelectedPlan('business');
    } else if (open) {
      setSelectedPlan('pro');
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

  const openCircleConnect = useCallback(() => {
    onClose();
    setTimeout(() => {
      window.dispatchEvent(new Event('open-circle-connect-flow'));
    }, 100);
  }, [onClose]);

  const currentDisplayName = TIER_DISPLAY_NAME[currentPlan] ?? currentPlan;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20">
              <Crown className="w-5 h-5 text-white" />
            </div>
            {currentPlan === 'free'
              ? 'Unlock More with EOS Academy'
              : `You\u2019re on ${currentDisplayName}`}
          </DialogTitle>
          <DialogDescription className="text-base mt-3 leading-relaxed">
            {currentPlan === 'business'
              ? 'You have full access to all EOS AI Bot features.'
              : 'Your EOS AI Bot tier is linked to your EOS Academy subscription. Upgrade at the Academy to unlock more features.'}
          </DialogDescription>
        </DialogHeader>

        {/* Academy linked status */}
        {isCircleLinked && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/60 dark:border-blue-800/40">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 shrink-0 mt-0.5">
                <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Synced with EOS Academy ({currentDisplayName})
                </p>
                <p className="text-xs text-blue-700/70 dark:text-blue-300/60 mt-0.5">
                  Upgrade your Academy subscription, then re-sync to unlock new features.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2.5 text-xs font-medium border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  onClick={openCircleConnect}
                >
                  Re-sync subscription
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Organization subscription note */}
        {org && org.plan !== 'free' && org.subscriptionSource !== 'circle' && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
            <p className="text-sm text-emerald-900 dark:text-emerald-100">
              <strong>Organization tier active:</strong> Your organization
              &quot;{org.name}&quot; is on{' '}
              {TIER_DISPLAY_NAME[org.plan] ?? org.plan}. All members have
              access to those features.
            </p>
          </div>
        )}

        {/* Tier cards */}
        <div className="grid gap-4 py-2 md:grid-cols-3">
          {(['free', 'pro', 'business'] as PlanKey[]).map((planKey) => {
            const plan = PLAN_FEATURES[planKey];
            const isCurrent = currentPlan === planKey;
            const isSelected = planKey !== 'free' && selectedPlan === planKey;
            const IconComponent = plan.icon;

            return (
              <div
                key={planKey}
                className={cn(
                  'relative rounded-2xl border-2 p-5 transition-all duration-200',
                  planKey === 'free'
                    ? 'border-border/50 bg-muted/20'
                    : 'cursor-pointer',
                  planKey !== 'free' && isSelected
                    ? `${plan.borderColor} bg-gradient-to-b ${plan.gradient} shadow-lg`
                    : planKey !== 'free' &&
                        'border-border/50 hover:border-border hover:shadow-sm',
                  isCurrent && 'ring-2 ring-primary/20',
                )}
                onClick={
                  planKey !== 'free'
                    ? () => setSelectedPlan(planKey as 'pro' | 'business')
                    : undefined
                }
                role={planKey !== 'free' ? 'button' : undefined}
                tabIndex={planKey !== 'free' ? 0 : undefined}
                onKeyDown={
                  planKey !== 'free'
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedPlan(planKey as 'pro' | 'business');
                        }
                      }
                    : undefined
                }
              >
                {/* Badge */}
                {isCurrent ? (
                  <Badge className="absolute -top-2.5 right-4 shadow-sm" variant="secondary">
                    Current
                  </Badge>
                ) : 'badge' in plan && plan.badge ? (
                  <Badge className="absolute -top-2.5 right-4 shadow-sm">
                    {plan.badge}
                  </Badge>
                ) : null}

                {/* Header */}
                <div className="mb-5">
                  <div className={cn('flex items-center gap-2 mb-2', plan.accentColor)}>
                    <IconComponent className="w-4.5 h-4.5" />
                    <h3 className="text-lg font-bold tracking-tight">
                      {plan.displayName}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature.name} className="flex items-start gap-2.5">
                      {feature.included ? (
                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/10 mt-0.5 shrink-0">
                          <Check className="w-2.5 h-2.5 text-emerald-500" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-muted mt-0.5 shrink-0">
                          <X className="w-2.5 h-2.5 text-muted-foreground/40" strokeWidth={3} />
                        </div>
                      )}
                      <span
                        className={cn(
                          'text-[13px] leading-snug',
                          feature.included
                            ? 'text-foreground/80'
                            : 'text-muted-foreground/50',
                        )}
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Connect EOS Academy button — prominent CTA for manual sync */}
        {!isCircleLinked && (
          <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-5">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-sm font-semibold text-foreground">
                  Already subscribed to EOS Academy?
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Connect your account to automatically sync your tier and unlock features.
                </p>
              </div>
              <Button
                size="lg"
                variant="default"
                className="shrink-0 font-semibold gap-2 px-6 shadow-md"
                onClick={openCircleConnect}
              >
                Connect EOS Academy
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Feature highlights row */}
        <div className="flex items-center justify-center gap-6 sm:gap-8 py-3">
          {[
            { icon: FileText, label: 'Export' },
            { icon: Calendar, label: 'Calendar' },
            { icon: Search, label: 'Research' },
            { icon: Users, label: 'Personas' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/70"
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground/60 px-4">
          Tiers are managed through your EOS Academy subscription.{' '}
          <a
            href={EOS_ACADEMY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Learn more at EOS Academy
          </a>
        </p>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
            Close
          </Button>
          <Button asChild size="lg" className="gap-2 font-semibold shadow-md">
            <a
              href={EOS_ACADEMY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GraduationCap className="w-4 h-4" />
              Visit EOS Academy
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
