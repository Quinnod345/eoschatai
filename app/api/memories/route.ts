import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { userMemory } from '@/lib/db/schema';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = Math.min(
      Number.parseInt(searchParams.get('limit') || '50', 10),
      100,
    );

    const conditions = [eq(userMemory.userId, session.user.id)];
    if (q) {
      const like = `%${q}%`;
      conditions.push(
        or(
          ilike(userMemory.summary, like),
          ilike(userMemory.content, like),
          ilike(userMemory.topic, like),
        ) as any,
      );
    }
    if (status) conditions.push(eq(userMemory.status, status as any));
    if (type) conditions.push(eq(userMemory.memoryType, type as any));

    const results = await db
      .select()
      .from(userMemory)
      .where(and(...conditions))
      .orderBy(desc(userMemory.createdAt))
      .limit(limit);

    return NextResponse.json({ memories: results });
  } catch (error) {
    console.error('GET /api/memories error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memories' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const {
      summary,
      content,
      topic,
      memoryType,
      confidence = 60,
      status = 'active',
      tags,
      sourceMessageId,
    } = body || {};
    if (!summary || typeof summary !== 'string') {
      return NextResponse.json(
        { error: 'summary is required' },
        { status: 400 },
      );
    }

    const now = new Date();
    const [row] = await db
      .insert(userMemory)
      .values({
        userId: session.user.id,
        summary,
        content: content || null,
        topic: topic || null,
        memoryType: (memoryType || 'other') as any,
        confidence,
        status: (status || 'active') as any,
        tags: tags || null,
        sourceMessageId: sourceMessageId || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ memory: row });
  } catch (error) {
    console.error('POST /api/memories error:', error);
    return NextResponse.json(
      { error: 'Failed to create memory' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { id, ...updates } = body || {};
    if (!id)
      return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const allowed = [
      'summary',
      'content',
      'topic',
      'memoryType',
      'confidence',
      'status',
      'tags',
      'expiresAt',
    ] as const;
    const set: any = { updatedAt: new Date() };
    for (const key of allowed) if (key in updates) set[key] = updates[key];

    const [row] = await db
      .update(userMemory)
      .set(set)
      .where(and(eq(userMemory.id, id), eq(userMemory.userId, session.user.id)))
      .returning();

    return NextResponse.json({ memory: row });
  } catch (error) {
    console.error('PATCH /api/memories error:', error);
    return NextResponse.json(
      { error: 'Failed to update memory' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id)
      return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await db
      .delete(userMemory)
      .where(
        and(eq(userMemory.id, id), eq(userMemory.userId, session.user.id)),
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/memories error:', error);
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 },
    );
  }
}
