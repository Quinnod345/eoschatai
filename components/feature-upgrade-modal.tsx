'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  feature: {
    name: string;
    icon: LucideIcon;
    description: string;
    benefits: string[];
    requiredPlan: 'pro' | 'business';
  };
}

export function FeatureUpgradeModal({
  open,
  onClose,
  onUpgrade,
  feature,
}: FeatureUpgradeModalProps) {
  const FeatureIcon = feature.icon;
  const isPro = feature.requiredPlan === 'pro';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center',
                isPro
                  ? 'bg-gradient-to-br from-primary/20 to-primary/10'
                  : 'bg-gradient-to-br from-yellow-500/20 to-orange-500/10',
              )}
            >
              <FeatureIcon
                className={cn(
                  'w-8 h-8',
                  isPro
                    ? 'text-primary'
                    : 'text-yellow-600 dark:text-yellow-500',
                )}
              />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            {feature.name}
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {feature.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-3">
            {feature.benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">{benefit}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-primary" />
              <span className="font-semibold">
                {isPro ? 'Pro' : 'Business'} Feature
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Upgrade to {isPro ? 'Pro' : 'Business'} to unlock {feature.name}{' '}
              and many more premium features.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Maybe Later
          </Button>
          <Button onClick={onUpgrade} className="w-full sm:w-auto">
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to {isPro ? 'Pro' : 'Business'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
