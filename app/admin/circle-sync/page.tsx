'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

type CircleSyncRow = {
  id: string;
  eventId: string;
  circleMemberId: string | null;
  email: string | null;
  tierPurchased: string | null;
  mappedPlan: 'free' | 'pro' | 'business' | null;
  action: string;
  userId: string | null;
  payload: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
};

type SyncResponse = {
  rows: CircleSyncRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    failures: number;
    createdUsers: number;
    updatedPlans: number;
    noChanges: number;
  };
};

const PAGE_SIZE = 25;

const ACTION_OPTIONS = [
  'all',
  'created_user',
  'updated_plan',
  'no_change',
  'user_not_found',
  'membership_missing',
  'error',
];

const actionBadgeClass = (action: string): string => {
  if (action === 'error') return 'bg-red-500/10 text-red-600 border-red-500/20';
  if (action === 'created_user')
    return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (action === 'updated_plan')
    return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (action === 'membership_missing')
    return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  return 'bg-muted text-foreground border-border';
};

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function CircleSyncAdminPage() {
  const [rows, setRows] = useState<CircleSyncRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [summary, setSummary] = useState<SyncResponse['summary']>({
    total: 0,
    failures: 0,
    createdUsers: 0,
    updatedPlans: 0,
    noChanges: 0,
  });
  const [pagination, setPagination] = useState<SyncResponse['pagination']>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    if (actionFilter !== 'all') params.set('action', actionFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    return params.toString();
  }, [actionFilter, fromDate, page, toDate]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/circle-sync?${queryString}`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || 'Failed to load Circle sync logs');
      }

      const data = (await response.json()) as SyncResponse;
      setRows(data.rows);
      setPagination(data.pagination);
      setSummary(data.summary);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load Circle sync logs';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Circle Sync Logs</h1>
          <p className="text-muted-foreground mt-2">
            Monitor webhook sync results and nightly reconciliation outcomes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-lg border border-border p-4 bg-card">
            <div className="text-sm text-muted-foreground">Total Events</div>
            <div className="text-2xl font-semibold">{summary.total}</div>
          </div>
          <div className="rounded-lg border border-border p-4 bg-card">
            <div className="text-sm text-muted-foreground">Failures</div>
            <div className="text-2xl font-semibold text-red-600">
              {summary.failures}
            </div>
          </div>
          <div className="rounded-lg border border-border p-4 bg-card">
            <div className="text-sm text-muted-foreground">New Users</div>
            <div className="text-2xl font-semibold text-blue-600">
              {summary.createdUsers}
            </div>
          </div>
          <div className="rounded-lg border border-border p-4 bg-card">
            <div className="text-sm text-muted-foreground">Plan Updates</div>
            <div className="text-2xl font-semibold text-green-600">
              {summary.updatedPlans}
            </div>
          </div>
          <div className="rounded-lg border border-border p-4 bg-card">
            <div className="text-sm text-muted-foreground">No Change</div>
            <div className="text-2xl font-semibold">{summary.noChanges}</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="circle-sync-action-filter"
                className="text-xs text-muted-foreground"
              >
                Action
              </label>
              <select
                id="circle-sync-action-filter"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={actionFilter}
                onChange={(event) => {
                  setPage(1);
                  setActionFilter(event.target.value);
                }}
              >
                {ACTION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All actions' : option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="circle-sync-from-date"
                className="text-xs text-muted-foreground"
              >
                From
              </label>
              <input
                id="circle-sync-from-date"
                type="date"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={fromDate}
                onChange={(event) => {
                  setPage(1);
                  setFromDate(event.target.value);
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="circle-sync-to-date"
                className="text-xs text-muted-foreground"
              >
                To
              </label>
              <input
                id="circle-sync-to-date"
                type="date"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={toDate}
                onChange={(event) => {
                  setPage(1);
                  setToDate(event.target.value);
                }}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPage(1);
                  setActionFilter('all');
                  setFromDate('');
                  setToDate('');
                }}
              >
                Clear Filters
              </Button>
              <Button variant="default" onClick={() => void fetchLogs()}>
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Mapped Plan</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-muted-foreground" colSpan={6}>
                      Loading Circle sync logs...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-4 py-8 text-red-600" colSpan={6}>
                      {error}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-muted-foreground" colSpan={6}>
                      No Circle sync events found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatTimestamp(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">{row.email || '-'}</td>
                      <td className="px-4 py-3">{row.tierPurchased || '-'}</td>
                      <td className="px-4 py-3">
                        {row.mappedPlan ? (
                          <span className="capitalize">{row.mappedPlan}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${actionBadgeClass(
                            row.action,
                          )}`}
                        >
                          {row.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[320px]">
                        {row.errorMessage ? (
                          <span className="text-red-600 break-words">
                            {row.errorMessage}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Success</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)} (
            {pagination.total} total)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={
                loading ||
                pagination.totalPages === 0 ||
                pagination.page >= pagination.totalPages
              }
              onClick={() =>
                setPage((current) =>
                  pagination.totalPages > 0
                    ? Math.min(pagination.totalPages, current + 1)
                    : current,
                )
              }
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
