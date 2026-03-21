'use client';

import cx from 'classnames';
import { Badge } from '@/components/ui/badge';
import { useUpgradeStore } from '@/lib/stores/upgrade-store';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface UsageChipProps {
  label: string;
  used: number;
  limit: number | null;
  title?: string;
  /** Shown in hover tooltip (plain language). */
  tooltipDescription?: string;
}

export function UsageChip({
  label,
  used,
  limit,
  title,
  tooltipDescription,
}: UsageChipProps) {
  const openUpgradeModal = useUpgradeStore((state) => state.openModal);

  if (!limit || limit <= 0) return null;

  const isExceeded = used >= limit;
  const ratio = limit > 0 ? used / limit : 0;
  const isApproaching = !isExceeded && ratio >= 0.8;

  const chip = (
    <Badge
      variant="outline"
      title={
        title ??
        `${label}: ${used} of ${limit} used this period. Click for upgrade options.`
      }
      onClick={() => openUpgradeModal('premium')}
      className={cx(
        'flex h-6 max-w-full cursor-pointer items-center gap-1 rounded-full border border-muted-foreground/30 bg-muted/70 px-2 text-xs font-medium tabular-nums transition-opacity hover:opacity-80',
        isApproaching && 'border-amber-200 bg-amber-100 text-amber-900',
        isExceeded &&
          'border-destructive/40 bg-destructive/10 text-destructive',
      )}
    >
      <span className="text-[11px] font-semibold tracking-tight text-muted-foreground/80">
        {label}
      </span>
      <span className="tabular-nums">
        {used}/{limit}
      </span>
    </Badge>
  );

  if (!tooltipDescription) {
    return chip;
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[min(20rem,calc(100vw-2rem))] border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
        sideOffset={6}
      >
        <p className="font-medium">{label}</p>
        <p className="mt-1 text-muted-foreground">{tooltipDescription}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Counts toward your plan limit. Upgrade for more capacity.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
