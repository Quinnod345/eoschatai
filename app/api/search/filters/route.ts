import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { persona, userDocuments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all personas for the user
    const personas = await db
      .select({ name: persona.name })
      .from(persona)
      .where(eq(persona.userId, session.user.id));

    // Get distinct document categories
    const documentTypes = await db
      .selectDistinct({ category: userDocuments.category })
      .from(userDocuments)
      .where(eq(userDocuments.userId, session.user.id));

    return NextResponse.json({
      personas: personas.map((p) => p.name),
      documentTypes: documentTypes.map((d) => d.category),
    });
  } catch (error) {
    console.error('Error fetching search filters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filters' },
      { status: 500 },
    );
  }
}
