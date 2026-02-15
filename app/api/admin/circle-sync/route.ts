import { NextResponse } from 'next/server';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';

import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { circleSyncLog } from '@/lib/db/schema';

const parsePositiveInt = (
  value: string | null,
  fallback: number,
  bounds: { min: number; max: number },
): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, bounds.min), bounds.max);
};

const parseDate = (value: string | null, asEndOfDay = false): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (isDateOnly) {
    if (asEndOfDay) {
      parsed.setHours(23, 59, 59, 999);
    } else {
      parsed.setHours(0, 0, 0, 0);
    }
  }

  return parsed;
};

export async function GET(request: Request) {
  try {
    const adminError = await requireAdmin();
    if (adminError) return adminError;

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get('page'), 1, {
      min: 1,
      max: 10_000,
    });
    const pageSize = parsePositiveInt(searchParams.get('pageSize'), 25, {
      min: 1,
      max: 100,
    });
    const actionFilter = searchParams.get('action');
    const fromDateRaw = searchParams.get('from');
    const toDateRaw = searchParams.get('to');

    const fromDate = parseDate(fromDateRaw, false);
    if (fromDateRaw && !fromDate) {
      return NextResponse.json(
        { error: 'Invalid "from" date format' },
        { status: 400 },
      );
    }

    const toDate = parseDate(toDateRaw, true);
    if (toDateRaw && !toDate) {
      return NextResponse.json(
        { error: 'Invalid "to" date format' },
        { status: 400 },
      );
    }

    const filters: SQL[] = [];
    if (actionFilter) {
      filters.push(eq(circleSyncLog.action, actionFilter));
    }
    if (fromDate) {
      filters.push(gte(circleSyncLog.createdAt, fromDate));
    }
    if (toDate) {
      filters.push(lte(circleSyncLog.createdAt, toDate));
    }

    let whereClause: SQL | undefined;
    if (filters.length === 1) {
      whereClause = filters[0];
    } else if (filters.length > 1) {
      whereClause = and(...filters);
    }

    const offset = (page - 1) * pageSize;

    const [totalRow] = whereClause
      ? await db
          .select({ count: sql<number>`count(*)::int` })
          .from(circleSyncLog)
          .where(whereClause)
      : await db
          .select({ count: sql<number>`count(*)::int` })
          .from(circleSyncLog);

    const rows = whereClause
      ? await db
          .select()
          .from(circleSyncLog)
          .where(whereClause)
          .orderBy(desc(circleSyncLog.createdAt))
          .limit(pageSize)
          .offset(offset)
      : await db
          .select()
          .from(circleSyncLog)
          .orderBy(desc(circleSyncLog.createdAt))
          .limit(pageSize)
          .offset(offset);

    const [summary] = await db
      .select({
        total: sql<number>`count(*)::int`,
        failures: sql<number>`count(*) filter (where ${circleSyncLog.action} = 'error')::int`,
        createdUsers: sql<number>`count(*) filter (where ${circleSyncLog.action} = 'created_user')::int`,
        updatedPlans: sql<number>`count(*) filter (where ${circleSyncLog.action} = 'updated_plan')::int`,
        noChanges: sql<number>`count(*) filter (where ${circleSyncLog.action} = 'no_change')::int`,
      })
      .from(circleSyncLog);

    const total = totalRow?.count ?? 0;
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    return NextResponse.json({
      rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
      summary: {
        total: summary?.total ?? 0,
        failures: summary?.failures ?? 0,
        createdUsers: summary?.createdUsers ?? 0,
        updatedPlans: summary?.updatedPlans ?? 0,
        noChanges: summary?.noChanges ?? 0,
      },
    });
  } catch (error) {
    console.error('[admin.circle-sync] Failed to fetch sync logs', error);
    return NextResponse.json(
      { error: 'Failed to fetch Circle sync logs' },
      { status: 500 },
    );
  }
}
