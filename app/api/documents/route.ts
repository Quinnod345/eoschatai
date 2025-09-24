import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { userDocuments } from '@/lib/db/schema';
// Inline query for listing documents by user and kind to avoid missing export
import { document } from '@/lib/db/schema';
import type { ComposerKind } from '@/components/composer';
import { eq, and, desc, sql } from 'drizzle-orm';

// Define the valid document categories
type DocumentCategory =
  | 'Scorecard'
  | 'VTO'
  | 'Rocks'
  | 'A/C'
  | 'Core Process'
  | 'Other';
const validCategories: DocumentCategory[] = [
  'Scorecard',
  'VTO',
  'Rocks',
  'A/C',
  'Core Process',
  'Other',
];

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category');
    const composerKindParam = searchParams.get('composerKind');
    const searchParam = searchParams.get('search');
    const limitParam = searchParams.get('limit');
    const limit = Math.min(Number.parseInt(limitParam || '10', 10) || 10, 25);

    // Optional path 0: full-text search across composer documents by title
    if (searchParam) {
      const search = `%${searchParam}%`;

      // Search user's composer documents (Document table) by title ILIKE
      const docs = await db
        .select()
        .from(document)
        .where(
          and(
            eq(document.userId, session.user.id),
            sql`"title" ILIKE ${search}`,
            // Filter out RAG user notes
            sql`NOT "title" LIKE 'User Note:%'`,
          ),
        )
        .orderBy(desc(document.createdAt));

      const limited = docs.slice(0, limit);

      return NextResponse.json({
        documents: limited.map((d) => ({
          id: d.id,
          title: d.title,
          kind: d.kind,
          createdAt: d.createdAt,
          preview: (d.content || '').slice(0, 300),
        })),
      });
    }

    // Optional path 1: legacy uploaded documents by category
    if (categoryParam) {
      // Validate that the category is one of the allowed values
      if (!validCategories.includes(categoryParam as DocumentCategory)) {
        return NextResponse.json(
          { error: 'Invalid category' },
          { status: 400 },
        );
      }

      // Use the validated category
      const category = categoryParam as DocumentCategory;

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
    }

    // Optional path 2: list AI-generated composer by kind for Composer dashboards
    if (composerKindParam) {
      const kind = composerKindParam as ComposerKind;
      // Rough validation to allowed kinds defined in schema
      const allowed: ComposerKind[] = [
        'text',
        'code',
        'image',
        'sheet',
        'chart',
        'vto',
        'accountability',
      ];
      if (!allowed.includes(kind)) {
        return NextResponse.json(
          { error: 'Invalid composer kind' },
          { status: 400 },
        );
      }

      const docs = await db
        .select()
        .from(document)
        .where(
          and(
            eq(document.userId, session.user.id),
            eq(document.kind, kind),
            // Filter out RAG user notes
            sql`NOT "title" LIKE 'User Note:%'`,
          ),
        )
        .orderBy(desc(document.createdAt));

      return NextResponse.json({
        documents: docs.map((d) => ({
          id: d.id,
          title: d.title,
          kind: d.kind,
          createdAt: d.createdAt,
        })),
      });
    }

    return NextResponse.json(
      { error: 'Missing query parameter: category or composerKind' },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 },
    );
  }
}
