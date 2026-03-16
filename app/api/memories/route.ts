import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { userMemory } from '@/lib/db/schema';
import { z } from 'zod/v3';

const memoryStatusFilterSchema = z.enum([
  'active',
  'pending',
  'archived',
  'dismissed',
]);
const memoryTypeFilterSchema = z.enum([
  'preference',
  'profile',
  'company',
  'task',
  'knowledge',
  'personal',
  'other',
]);

// Validation schema for creating a memory
const createMemorySchema = z.object({
  summary: z.string().min(1, 'Summary is required').max(500, 'Summary must be 500 characters or less'),
  content: z.string().max(10000, 'Content must be 10000 characters or less').optional(),
  topic: z.string().max(100, 'Topic must be 100 characters or less').optional(),
  memoryType: z.enum(['fact', 'preference', 'context', 'insight']).optional(),
  confidence: z.number().min(0).max(100).optional().default(60),
  status: z.enum(['active', 'archived']).optional().default('active'),
  tags: z.array(z.string().max(50)).max(20).optional(),
  sourceMessageId: z.string().uuid().optional(),
});

const updateMemorySchema = z
  .object({
    id: z.string().uuid('Invalid memory id'),
    summary: z
      .string()
      .min(1, 'Summary is required')
      .max(500, 'Summary must be 500 characters or less')
      .optional(),
    content: z
      .string()
      .max(10000, 'Content must be 10000 characters or less')
      .nullable()
      .optional(),
    topic: z.string().max(100, 'Topic must be 100 characters or less').nullable().optional(),
    memoryType: memoryTypeFilterSchema.optional(),
    confidence: z.number().int().min(0).max(100).optional(),
    status: memoryStatusFilterSchema.optional(),
    tags: z.array(z.string().max(50)).max(20).nullable().optional(),
    expiresAt: z.union([z.coerce.date(), z.null()]).optional(),
  })
  .strict();

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const statusParam = searchParams.get('status');
    const typeParam = searchParams.get('type');
    const parsedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;

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
    if (statusParam) {
      const parsedStatus = memoryStatusFilterSchema.safeParse(statusParam);
      if (!parsedStatus.success) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
      }
      conditions.push(eq(userMemory.status, parsedStatus.data as any));
    }
    if (typeParam) {
      const parsedType = memoryTypeFilterSchema.safeParse(typeParam);
      if (!parsedType.success) {
        return NextResponse.json({ error: 'Invalid type filter' }, { status: 400 });
      }
      conditions.push(eq(userMemory.memoryType, parsedType.data as any));
    }

    const results = await db
      .select({
        id: userMemory.id,
        userId: userMemory.userId,
        sourceMessageId: userMemory.sourceMessageId,
        summary: userMemory.summary,
        content: userMemory.content,
        topic: userMemory.topic,
        memoryType: userMemory.memoryType,
        confidence: userMemory.confidence,
        status: userMemory.status,
        tags: userMemory.tags,
        createdAt: userMemory.createdAt,
        updatedAt: userMemory.updatedAt,
        expiresAt: userMemory.expiresAt,
      })
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
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Check entitlements for memory feature
    const { getAccessContext } = await import('@/lib/entitlements');
    const accessContext = await getAccessContext(session.user.id);

    if (!accessContext.entitlements.features.memory.enabled) {
      return NextResponse.json(
        {
          error: 'Long-term memory is a Pro feature',
          code: 'FEATURE_LOCKED',
          requiredPlan: 'pro',
          feature: 'memory',
        },
        { status: 403 },
      );
    }

    // Check memory count limit - use COUNT query for efficiency
    let currentMemoryCount = 0;
    try {
      const result = await db
        .select({ count: count() })
        .from(userMemory)
        .where(eq(userMemory.userId, session.user.id));

      currentMemoryCount = result[0]?.count || 0;
    } catch (countError) {
      console.error('Failed to count user memories:', countError);
      return NextResponse.json(
        {
          error: 'Failed to check memory limit',
          code: 'DATABASE_ERROR',
        },
        { status: 500 },
      );
    }

    const maxMemories = accessContext.entitlements.features.memory.max_memories;
    if (maxMemories !== -1 && currentMemoryCount >= maxMemories) {
      return NextResponse.json(
        {
          error: `You've reached your memory limit (${maxMemories} memories)`,
          code: 'LIMIT_REACHED',
          limit: maxMemories,
          current: currentMemoryCount,
          requiredPlan: 'business',
          feature: 'memory.unlimited',
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    
    // Validate input with Zod
    const parseResult = createMemorySchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const {
      summary,
      content,
      topic,
      memoryType,
      confidence,
      sourceMessageId,
    } = parseResult.data;

    // Use the saveUserMemory function which creates embeddings automatically
    const { saveUserMemory } = await import('@/lib/ai/memory');
    
    const row = await saveUserMemory({
      userId: session.user.id,
      sourceMessageId: sourceMessageId || undefined,
      summary,
      content: content || undefined,
      topic: topic || undefined,
      memoryType: (memoryType as any) || undefined,
      confidence: confidence || 60,
    });

    console.log(`Memory API: Created memory with embeddings for user ${session.user.id}`);

    // Update usage counter for memories
    const { incrementUsageCounter } = await import('@/lib/entitlements');
    await incrementUsageCounter(session.user.id, 'memories_stored', 1);

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
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parseResult = updateMemorySchema.safeParse(body);
    if (!parseResult.success) {
      const details = parseResult.error.errors
        .map((error) => `${error.path.join('.')}: ${error.message}`)
        .join(', ');
      return NextResponse.json(
        { error: 'Validation failed', details },
        { status: 400 },
      );
    }

    const { id, ...updates } = parseResult.data;
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        set[key] = value;
      }
    }

    if (Object.keys(set).length === 1) {
      return NextResponse.json(
        { error: 'No fields provided to update' },
        { status: 400 },
      );
    }

    const [row] = await db
      .update(userMemory)
      .set(set)
      .where(and(eq(userMemory.id, id), eq(userMemory.userId, session.user.id)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

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
  if (!session?.user?.id)
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
