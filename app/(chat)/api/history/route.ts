import { auth } from '@/app/(auth)/auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getChatsByUserId } from '@/lib/db/queries';
import { API_CACHE } from '@/lib/api/cache-headers';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');

  if (startingAfter && endingBefore) {
    return NextResponse.json(
      { error: 'Only one of starting_after or ending_before can be provided!' },
      { status: 400 },
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized!' }, { status: 401 });
  }

  try {
    const chats = await getChatsByUserId({
      id: session.user.id,
      limit,
      startingAfter,
      endingBefore,
    });

    // Use private-short cache: 10s max-age with 30s stale-while-revalidate
    // Chat history can change (new chats created) but benefits from brief caching
    return NextResponse.json(chats, { headers: API_CACHE.privateShort() });
  } catch (error) {
    console.error('[History API] Error fetching chats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch chats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
