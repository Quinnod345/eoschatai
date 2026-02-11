import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db/queries';
import { validateUuidField } from '@/lib/api/validation';
import { sql } from 'drizzle-orm';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('id');
  const validatedDocumentId = validateUuidField(documentId, 'id');
  if (!validatedDocumentId.ok) {
    return NextResponse.json({ error: validatedDocumentId.error }, { status: 400 });
  }

  try {
    // Find the most recent chat for this user whose message parts mention the documentId
    const rows = await db.execute(sql`\
      SELECT m."chatId"
      FROM "Message_v2" m
      JOIN "Chat" c ON m."chatId" = c.id
      WHERE c."userId" = ${session.user.id}
        AND m.parts::text ILIKE ${`%${validatedDocumentId.value}%`}
      ORDER BY m."createdAt" DESC
      LIMIT 1
    `);

    const chatId =
      (Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0])?.chatId || null;
    return NextResponse.json({ chatId });
  } catch (error) {
    console.error('[by-document] Failed to find chat for document', error);
    return NextResponse.json({ chatId: null });
  }
}
