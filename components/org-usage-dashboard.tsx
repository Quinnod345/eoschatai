'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BarChart3, RefreshCw } from 'lucide-react';

type UsageCounters = {
  uploads_total: number;
  chats_today: number;
  asr_minutes_month: number;
  exports_month: number;
  deep_runs_day: number;
  personas_created: number;
  memories_stored: number;
  concurrent_sessions_active: number;
  storage_used_mb: number;
};

type UsageMember = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'owner' | 'admin' | 'member';
  plan: string;
  storageUsedBytes: number;
  usageCounters: UsageCounters;
};

type UsageResponse = {
  totals: UsageCounters;
  members: UsageMember[];
};

function bytesToMb(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return 0;
  }
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

export function OrgUsageDashboard({ orgId }: { orgId: string }) {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsage = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(`/api/organizations/${orgId}/usage`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load usage dashboard');
      }

      setData(payload as UsageResponse);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load usage');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, [orgId]);

  const sortedMembers = useMemo(() => {
    if (!data?.members) {
      return [];
    }
    return [...data.members].sort(
      (a, b) => b.usageCounters.chats_today - a.usageCounters.chats_today,
    );
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Organization Usage
            </CardTitle>
            <CardDescription>
              Team-wide usage totals and per-member breakdown.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchUsage(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !data ? (
          <div className="text-sm text-muted-foreground">Loading usage data...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Chats Today</p>
                <p className="text-lg font-semibold">{data.totals.chats_today}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Uploads</p>
                <p className="text-lg font-semibold">{data.totals.uploads_total}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Exports This Month</p>
                <p className="text-lg font-semibold">{data.totals.exports_month}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Storage (MB)</p>
                <p className="text-lg font-semibold">
                  {Math.round(data.totals.storage_used_mb)}
                </p>
              </div>
            </div>

            <div className="rounded-md border overflow-hidden">
              <div className="grid grid-cols-12 gap-2 p-2 text-xs font-medium text-muted-foreground bg-muted/40">
                <div className="col-span-4">Member</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-2 text-right">Chats</div>
                <div className="col-span-2 text-right">Uploads</div>
                <div className="col-span-2 text-right">Storage MB</div>
              </div>
              <div className="divide-y">
                {sortedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="grid grid-cols-12 gap-2 p-2 text-sm items-center"
                  >
                    <div className="col-span-4 min-w-0">
                      <p className="font-medium truncate">
                        {member.displayName || member.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <Badge variant="outline">{member.role}</Badge>
                    </div>
                    <div className="col-span-2 text-right">
                      {member.usageCounters.chats_today}
                    </div>
                    <div className="col-span-2 text-right">
                      {member.usageCounters.uploads_total}
                    </div>
                    <div className="col-span-2 text-right">
                      {bytesToMb(member.storageUsedBytes)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
