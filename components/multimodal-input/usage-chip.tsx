'use client';

import cx from 'classnames';
import { Badge } from '@/components/ui/badge';

interface UsageChipProps {
  label: string;
  used: number;
  limit: number | null;
  title?: string;
}

export function UsageChip({ label, used, limit, title }: UsageChipProps) {
  if (!limit || limit <= 0) return null;

  const isExceeded = used >= limit;
  const ratio = limit > 0 ? used / limit : 0;
  const isApproaching = !isExceeded && ratio >= 0.8;

  return (
    <Badge
      variant="outline"
      title={title ?? `${label} usage ${used}/${limit}`}
      className={cx(
        'flex h-6 items-center gap-1 rounded-full border border-muted-foreground/30 bg-muted/70 px-2 text-xs font-medium tabular-nums',
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
}


