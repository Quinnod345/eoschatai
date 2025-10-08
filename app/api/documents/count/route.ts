import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getDocumentCountByUserId } from '@/lib/db/queries';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Security: Only allow users to get their own count
    if (!userId || userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const count = await getDocumentCountByUserId({ userId });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error fetching document count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document count' },
      { status: 500 },
    );
  }
}

