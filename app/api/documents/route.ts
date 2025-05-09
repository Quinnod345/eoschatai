import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 },
      );
    }

    const documents = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          eq(userDocuments.userId, session.user.id),
          eq(userDocuments.category, category),
        ),
      )
      .orderBy(desc(userDocuments.createdAt));

    return NextResponse.json({
      documents: documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        category: doc.category,
        uploadedAt: doc.createdAt,
        size: doc.fileSize,
      })),
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 },
    );
  }
}
