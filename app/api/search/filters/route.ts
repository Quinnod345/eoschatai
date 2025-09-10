import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { persona, userDocuments, document } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [personasRes, docCatsRes, composerKindsRes] = await Promise.all([
      db
        .select({ name: persona.name })
        .from(persona)
        .where(eq(persona.userId, session.user.id)),
      db
        .selectDistinct({ category: userDocuments.category })
        .from(userDocuments)
        .where(eq(userDocuments.userId, session.user.id)),
      db
        .selectDistinct({ kind: document.kind })
        .from(document)
        .where(eq(document.userId, session.user.id)),
    ]);

    const personas = personasRes.map((p) => p.name).filter(Boolean);
    const documentTypes = docCatsRes.map((c) => c.category).filter(Boolean);
    const composerTypes = composerKindsRes.map((c) => c.kind).filter(Boolean);

    return NextResponse.json({ personas, documentTypes, composerTypes });
  } catch (error) {
    console.error('Error fetching search filters:', error);
    return NextResponse.json(
      { personas: [], documentTypes: [], composerTypes: [] },
      { status: 200 },
    );
  }
}
