import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { AUTOCOMPLETE_CORPUS } from '@/lib/predictive/corpus';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { corpus: AUTOCOMPLETE_CORPUS },
    {
      headers: {
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=7200',
      },
    },
  );
}
