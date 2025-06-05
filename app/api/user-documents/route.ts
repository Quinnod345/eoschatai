import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const documents = await db
      .select()
      .from(userDocuments)
      .where(eq(userDocuments.userId, session.user.id))
      .orderBy(desc(userDocuments.createdAt));

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Error fetching user documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 },
    );
  }
}
