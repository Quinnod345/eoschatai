'use client';

import * as React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { formatBytes } from '@/lib/utils/storage-format';
import { AlertCircle, HardDrive, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface StorageUsageProps {
  used: number; // bytes
  quota: number; // bytes
  showDetails?: boolean;
  showUpgradeButton?: boolean;
  onManageClick?: () => void;
}

export function StorageUsage({
  used,
  quota,
  showDetails = true,
  showUpgradeButton = true,
  onManageClick,
}: StorageUsageProps) {
  const percentage = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  const available = Math.max(0, quota - used);

  // Color based on usage
  const getColor = () => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTextColor = () => {
    if (percentage < 50) return 'text-green-600 dark:text-green-400';
    if (percentage < 80) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getStatus = () => {
    if (percentage < 50) return 'Good';
    if (percentage < 80) return 'Warning';
    if (percentage < 95) return 'Critical';
    return 'Full';
  };

  const usedMB = Math.round((used / (1024 * 1024)) * 100) / 100;
  const quotaMB = Math.round((quota / (1024 * 1024)) * 100) / 100;
  const availableMB = Math.round((available / (1024 * 1024)) * 100) / 100;

  return (
    <Card className="p-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Storage Usage</h3>
          </div>
          <span className={`text-sm font-medium ${getTextColor()}`}>
            {getStatus()}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress
            value={percentage}
            className="h-2"
            indicatorClassName={getColor()}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatBytes(used)}</span>
            <span>{formatBytes(quota)}</span>
          </div>
        </div>

        {/* Details */}
        {showDetails && (
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Used</div>
              <div className="font-medium">{usedMB} MB</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Available</div>
              <div className="font-medium">{availableMB} MB</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Total</div>
              <div className="font-medium">{quotaMB} MB</div>
            </div>
          </div>
        )}

        {/* Warning for high usage */}
        {percentage >= 80 && (
          <div className="flex items-start gap-2 rounded-md bg-yellow-50 dark:bg-yellow-950/20 p-2 text-xs">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-yellow-700 dark:text-yellow-300">
              {percentage >= 95
                ? 'Storage almost full. Delete unused documents or upgrade your plan.'
                : 'Storage usage is high. Consider managing your documents.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {onManageClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onManageClick}
              className="flex-1"
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Manage Storage
            </Button>
          )}
          {showUpgradeButton && percentage >= 80 && (
            <Link href="/settings?tab=billing" className="flex-1">
              <Button size="sm" className="w-full">
                Upgrade Plan
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

// Compact version for sidebars
export function StorageUsageCompact({
  used,
  quota,
}: {
  used: number;
  quota: number;
}) {
  const percentage = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;

  const getColor = () => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Storage</span>
        <span className="font-medium">
          {formatBytes(used)} / {formatBytes(quota)}
        </span>
      </div>
      <Progress
        value={percentage}
        className="h-1"
        indicatorClassName={getColor()}
      />
    </div>
  );
}


