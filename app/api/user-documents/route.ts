import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/errors/api-wrapper';

export const GET = withErrorHandler(async (request: NextRequest) => {
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
    throw error; // Let the error handler wrapper handle it
  }
});
