import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getStorageStats, getStorageByCategory } from '@/lib/storage/tracking';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [stats, breakdown] = await Promise.all([
      getStorageStats(session.user.id),
      getStorageByCategory(session.user.id),
    ]);

    return NextResponse.json({
      ...stats,
      breakdown,
    });
  } catch (error) {
    console.error('Error fetching storage stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch storage stats' },
      { status: 500 },
    );
  }
}


