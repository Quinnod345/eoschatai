'use client';

import { Crown, Sparkles, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatFeatureLockedMessageProps {
  feature: {
    name: string;
    icon: LucideIcon;
    description: string;
    requiredPlan: 'pro' | 'business';
  };
  onUpgrade: () => void;
  className?: string;
}

export function ChatFeatureLockedMessage({
  feature,
  onUpgrade,
  className,
}: ChatFeatureLockedMessageProps) {
  const FeatureIcon = feature.icon;
  const isPro = feature.requiredPlan === 'pro';

  return (
    <div
      className={cn(
        'my-4 rounded-xl border-2 overflow-hidden',
        isPro
          ? 'border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10'
          : 'border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-orange-500/10',
        className,
      )}
    >
      {/* Header Stripe */}
      <div
        className={cn(
          'h-1',
          isPro
            ? 'bg-gradient-to-r from-primary/50 via-primary to-primary/50'
            : 'bg-gradient-to-r from-yellow-500/50 via-yellow-500 to-orange-500/50',
        )}
      />

      <div className="p-6">
        {/* Icon and Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                isPro
                  ? 'bg-primary/20'
                  : 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20',
              )}
            >
              <FeatureIcon
                className={cn(
                  'w-6 h-6',
                  isPro
                    ? 'text-primary'
                    : 'text-yellow-600 dark:text-yellow-500',
                )}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{feature.name}</h3>
                <div
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
                    isPro
                      ? 'bg-primary/20 text-primary'
                      : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
                  )}
                >
                  <Crown className="w-3 h-3" />
                  {isPro ? 'Strengthen' : 'Mastery'}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {feature.description}
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>
            Available with Circle{' '}
            {isPro ? 'Strengthen' : 'Mastery'} tier
          </span>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onUpgrade}
          className={cn(
            'w-full',
            isPro
              ? 'bg-primary hover:bg-primary/90'
              : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white',
          )}
        >
          <Crown className="w-4 h-4 mr-2" />
          Upgrade your Circle tier
        </Button>
      </div>
    </div>
  );
}
